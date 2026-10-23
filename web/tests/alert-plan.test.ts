import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { planAlerts, type AlertObservation } from "../src/server/alert-plan";

function sample(at = "2026-10-23T01:00:00Z"): AlertObservation {
  return { kind: "operations-observation-v1", at, lastVerifiedBackupAt: at, lastRetentionSuccessAt: at,
    health: { mode: "research", status: "ok", reasons: [],
      jobs: { queued: 0, delayedQueued: 0, oldestQueuedComparisonSeconds: 0, running: 0, failed: 0, expiredLeases: 0, oldestExpiredLeaseSeconds: 0 },
      payments: { confirming: 0, confirmationUnknown: 0, refundPending: 0, oldestPendingOrderSeconds: 0, overduePending: 0, unknownPendingAge: 0 } } };
}

test("two adjacent failures alert, thirty-minute dedup and single recovery; a long gap is not a second failure", () => {
  const a = planAlerts({ ...sample(), health: null });
  assert.deepEqual(a.notifications, []);
  const b = planAlerts({ ...sample("2026-10-23T01:05:00Z"), health: null }, a.nextHistory);
  assert.deepEqual(b.notifications, [{ code: "HEALTH_UNAVAILABLE", event: "problem", severity: "critical" }]);
  const c = planAlerts({ ...sample("2026-10-23T01:10:00Z"), health: null }, b.nextHistory);
  assert.deepEqual(c.notifications, []);
  const longGap = planAlerts({ ...sample("2026-10-23T02:00:00Z"), health: null }, a.nextHistory);
  assert.deepEqual(longGap.notifications, []);
  const stillDown = planAlerts({ ...sample("2026-10-23T02:00:00Z"), health: null }, b.nextHistory);
  assert.equal(stillDown.notifications[0].event, "problem");
  const recovered = planAlerts(sample("2026-10-23T02:05:00Z"), stillDown.nextHistory);
  assert.equal(recovered.notifications[0].event, "recovery");
  assert.deepEqual(planAlerts(sample("2026-10-23T02:10:00Z"), recovered.nextHistory).notifications, []);
});

test("critical payment and backup faults bypass quiet hours, warnings wait until nine KST", () => {
  const o = sample("2026-10-22T23:55:00Z"); // 08:55 KST
  o.health!.jobs.failed = 2;
  o.health!.payments.overduePending = 1;
  o.lastVerifiedBackupAt = "2026-10-22T21:54:00Z";
  const a = planAlerts(o);
  assert.deepEqual(a.notifications.map(n => n.code), ["PAYMENT_OVERDUE", "BACKUP_OVERDUE"]);
  const b = planAlerts({ ...o, at: "2026-10-23T00:00:00Z" }, a.nextHistory);
  assert.deepEqual(b.notifications.map(n => n.code), ["FAILED_JOBS"]);
  assert.equal(b.externalMessagesSent, 0);
});

test("unknown health never produces false payment/job recovery; warning recovery is deferred overnight", () => {
  const o = sample(); o.health!.jobs.failed = 1; o.health!.payments.overduePending = 1;
  const a = planAlerts(o);
  const b = planAlerts({ ...sample("2026-10-23T01:05:00Z"), health: null }, a.nextHistory);
  assert.deepEqual(b.notifications, []);
  assert.ok(b.nextHistory.incidents.FAILED_JOBS);
  assert.ok(b.nextHistory.incidents.PAYMENT_OVERDUE);
  const evening = planAlerts(sample("2026-10-23T10:00:00Z"), a.nextHistory);
  assert.deepEqual(evening.notifications.map(n => n.code), ["PAYMENT_OVERDUE"]);
  assert.ok(evening.nextHistory.incidents.FAILED_JOBS);
  const morning = planAlerts(sample("2026-10-24T00:00:00Z"), evening.nextHistory);
  assert.deepEqual(morning.notifications, [{ code: "FAILED_JOBS", event: "recovery", severity: "warning" }]);
});

test("backup exact threshold, missing verified success, future timestamps, unknown fields and nonmonotonic history", () => {
  const o = sample(); o.lastVerifiedBackupAt = "2026-10-22T23:00:00Z";
  assert.deepEqual(planAlerts(o).notifications, []);
  assert.equal(planAlerts({ ...o, at: "2026-10-23T01:00:00.001Z" }).notifications[0].code, "BACKUP_OVERDUE");
  assert.equal(planAlerts({ ...o, lastVerifiedBackupAt: null }).notifications[0].code, "BACKUP_OVERDUE");
  assert.throws(() => planAlerts({ ...o, lastVerifiedBackupAt: "2026-11-01T00:00:00Z" }));
  assert.throws(() => planAlerts({ ...o, privateBirthDate: "synthetic-private-value" }));
  assert.throws(() => planAlerts(o, planAlerts(o).nextHistory));
  const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/alert-plan.ts", "--observaton", "synthetic-private-value"], { encoding: "utf8" });
  assert.equal(result.status, 1); assert.equal(result.stderr, "");
  assert.equal(result.stdout.includes("synthetic-private-value"), false);
  assert.equal(JSON.parse(result.stdout).externalMessagesSent, 0);
});

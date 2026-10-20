import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { openDatabase, migrate, one, type Database } from "../src/server/db";
import { health, maintenance } from "../src/server/operations";
import { operationalCommand } from "../src/server/operational-command";
import * as s from "../src/server/service";
import { samplePerson } from "../src/domain/model";

async function setup() {
  const db = await openDatabase("memory://");
  await migrate(db);
  return db;
}
async function queued(db: Database) {
  const { owner } = await s.newSession(db);
  const comparison = await s.createComparison(
    db,
    owner,
    { me: samplePerson(), other: samplePerson(true) },
    randomUUID(),
    true,
  );
  return { owner, id: comparison.id as string };
}

test("health distinguishes normal queue and live leases from failed and expired jobs without exposing data", async () => {
  const db = await setup();
  try {
    assert.equal((await health(db)).status, "ok");
    const a = await queued(db),
      b = await queued(db),
      c = await queued(db);
    await s.claimJob(db, b.owner);
    let report = await health(db);
    assert.equal(report.status, "ok");
    assert.deepEqual(report.jobs, {
      queued: 2,
      delayedQueued: 0,
      oldestQueuedComparisonSeconds: report.jobs.oldestQueuedComparisonSeconds,
      running: 1,
      failed: 0,
      expiredLeases: 0,
      oldestExpiredLeaseSeconds: 0,
    });
    assert.ok(report.jobs.oldestQueuedComparisonSeconds < 300);
    await db.query(
      "UPDATE generation_jobs SET lease_until=now()-interval '2 minutes' WHERE comparison_id=$1",
      [b.id],
    );
    await db.query(
      "UPDATE generation_jobs SET state='failed' WHERE comparison_id=$1",
      [c.id],
    );
    report = await health(db);
    assert.equal(report.status, "needs_attention");
    assert.deepEqual(report.reasons, ["FAILED_JOBS", "EXPIRED_LEASES"]);
    assert.equal(report.jobs.expiredLeases, 1);
    assert.equal(report.jobs.failed, 1);
    assert.ok(report.jobs.oldestExpiredLeaseSeconds >= 120);
    assert.deepEqual(Object.keys(report).sort(), [
      "jobs",
      "mode",
      "payments",
      "reasons",
      "status",
    ]);
    for (const value of [a.owner, a.id, b.id, c.id, samplePerson().name])
      assert.ok(!JSON.stringify(report).includes(value));
  } finally {
    await db.close();
  }
});

test("a stopped worker produces a delayed-queue alert and maintenance clears it without exposing IDs", async () => {
  const db = await setup();
  try {
    const { id, owner } = await queued(db);
    await db.query("UPDATE comparisons SET created_at=now()-interval '6 minutes' WHERE id=$1", [id]);
    const report = await health(db);
    assert.deepEqual(report.reasons, ["DELAYED_QUEUE"]);
    assert.equal(report.jobs.delayedQueued, 1);
    assert.ok(report.jobs.oldestQueuedComparisonSeconds >= 360);
    assert.equal(JSON.stringify(report).includes(id), false);
    assert.equal(JSON.stringify(report).includes(owner), false);
    const result = await maintenance(db);
    assert.equal(result.health.status, "ok");
    assert.equal(result.health.jobs.delayedQueued, 0);
    assert.equal(result.health.jobs.oldestQueuedComparisonSeconds, 0);
    assert.equal((await s.state(db, owner)).results.length, 1);
  } finally { await db.close(); }
});

test("queue alarm threshold uses comparison age and ignores old completed jobs and fresh queued jobs", async () => {
  const db = await setup();
  try {
    const old = await queued(db);
    await db.query("UPDATE comparisons SET created_at=now()-interval '1 day' WHERE id=$1", [old.id]);
    await s.runJobs(db, old.owner);
    const fresh = await queued(db);
    await db.query("UPDATE comparisons SET created_at=now()-interval '299 seconds' WHERE id=$1", [fresh.id]);
    assert.equal((await health(db)).jobs.delayedQueued, 0);
    // PostgreSQL now() is stable inside the transaction: test the exact inclusive endpoint.
    await db.transaction(async tx => {
      await tx.query("UPDATE comparisons SET created_at=now()-interval '300 seconds' WHERE id=$1", [fresh.id]);
      const report = await health({ ...db, query: tx.query.bind(tx) });
      assert.equal(report.jobs.delayedQueued, 1);
      assert.equal(report.jobs.oldestQueuedComparisonSeconds, 300);
    });
  } finally { await db.close(); }
});

test("health separates pending payment states and reports order age, excluding closed orders", async () => {
  const db = await setup();
  try {
    for (const state of [
      "confirming",
      "confirmation_unknown",
      "refund_pending",
      "refunded",
    ]) {
      const { owner } = await queued(db);
      await s.runJobs(db, owner);
      await s.recoveryCode(db, owner);
      const c = await s.createComparison(
        db,
        owner,
        { me: samplePerson(), other: samplePerson(true) },
        randomUUID(),
        true,
      );
      await db.query(
        "UPDATE orders SET state=$2,created_at=now()-interval '10 minutes' WHERE comparison_id=$1",
        [c.id, state],
      );
    }
    const report = await health(db);
    assert.deepEqual(report.reasons, ["PENDING_PAYMENTS"]);
    assert.equal(report.payments.confirming, 1);
    assert.equal(report.payments.confirmationUnknown, 1);
    assert.equal(report.payments.refundPending, 1);
    assert.ok(report.payments.oldestPendingOrderSeconds >= 600);
    await db.query("UPDATE orders SET state='refunded'");
    assert.deepEqual((await health(db)).payments, {
      confirming: 0,
      confirmationUnknown: 0,
      refundPending: 0,
      oldestPendingOrderSeconds: 0,
    });
  } finally {
    await db.close();
  }
});

test("maintenance records attention after exhausted lease cleanup and clears it after manual recovery", async () => {
  const db = await setup();
  try {
    const { owner, id } = await queued(db);
    for (let n = 0; n < 3; n++) {
      await s.claimJob(db, owner);
      await db.query(
        "UPDATE generation_jobs SET lease_until=now()-interval '1 second' WHERE comparison_id=$1",
        [id],
      );
    }
    const report = await maintenance(db);
    assert.equal(report.jobs.completed, 0);
    assert.equal(report.health.status, "needs_attention");
    assert.equal(report.health.jobs.failed, 1);
    assert.equal(
      (await one(
        db,
        "SELECT outcome FROM operational_events WHERE kind='maintenance' ORDER BY id DESC LIMIT 1",
      ))!.outcome,
      "needs_attention",
    );
    assert.equal((await s.state(db, owner)).free, "available");
    await s.retryJob(db, owner, id);
    assert.equal((await maintenance(db)).health.status, "ok");
    assert.equal(
      (await one(
        db,
        "SELECT outcome FROM operational_events WHERE kind='maintenance' ORDER BY id DESC LIMIT 1",
      ))!.outcome,
      "completed",
    );
  } finally {
    await db.close();
  }
});

test("operational health exit codes distinguish successful inspection from actionable state and always close DB", async () => {
  for (const failed of [false, true]) {
    const db = await setup();
    if (failed) {
      const { id } = await queued(db);
      await db.query(
        "UPDATE generation_jobs SET state='failed' WHERE comparison_id=$1",
        [id],
      );
    }
    let closed = false;
    const result = await operationalCommand("health", async () => ({
      ...db,
      close: async () => {
        closed = true;
        await db.close();
      },
    }));
    assert.equal(result.exitCode, failed ? 2 : 0);
    assert.equal(closed, true);
  }
});

test("operational commands suppress connection, query and close exception payloads", async () => {
  const sensitive =
    "postgres://private:secret@host/database birthday recovery payment-token";
  const expected = {
    exitCode: 1,
    report: { status: "error", code: "OPERATION_FAILED" },
  };
  assert.deepEqual(
    await operationalCommand("health", async () => {
      throw new Error(sensitive);
    }),
    expected,
  );
  for (const failAt of ["query", "close"]) {
    const db = await setup();
    let closed = false;
    const result = await operationalCommand("health", async () => ({
      ...db,
      query:
        failAt === "query"
          ? async () => {
              throw new Error(sensitive);
            }
          : db.query,
      close: async () => {
        closed = true;
        await db.close();
        if (failAt === "close") throw new Error(sensitive);
      },
    }));
    assert.deepEqual(result, expected);
    assert.equal(closed, true);
  }
});

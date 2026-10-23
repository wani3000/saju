import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { openDatabase, migrate, one } from "../src/server/db";
import * as s from "../src/server/service";
import * as i from "../src/server/identity";
import * as p from "../src/server/payments";
import { expireData, health } from "../src/server/operations";
import { operationalCli } from "../src/server/operational-command";
import { goodwillRefundAssessment } from "../src/server/service-policy";
import { samplePerson } from "../src/domain/model";
const pair = () => ({ me: samplePerson(), other: samplePerson(true) });
async function setup() { const db = await openDatabase("memory://"); await migrate(db); return db; }

test("expired member draft is hidden before cleanup, scrubbed at 30 days, and stale tabs cannot overwrite a new revision", async () => {
  const db = await setup();
  try {
    const a = await s.newSession(db), b = await s.newSession(db);
    await s.recoveryCode(db, a.owner);
    const c = await s.createComparison(db, a.owner, pair(), randomUUID(), true);
    await s.runJobs(db, a.owner);
    const saved = await s.result(db, a.owner, c.id);
    await s.saveDraft(db, a.owner, pair(), 0);
    await s.saveDraft(db, b.owner, pair(), 0);
    await db.query("UPDATE drafts SET updated_at=now()-interval '31 days' WHERE owner_id=$1", [a.owner]);
    assert.equal((await s.state(db, a.owner)).draft, null);
    await db.transaction(async tx => {
      await tx.query("UPDATE drafts SET updated_at=now()-interval '30 days' WHERE owner_id=$1", [a.owner]);
      assert.equal((await s.state(tx, a.owner)).draft, null);
    });
    const report = await expireData(db);
    assert.equal(report.drafts, 1);
    assert.deepEqual((await one(db, "SELECT data,revision FROM drafts WHERE owner_id=$1", [a.owner])), { data: {}, revision: 2 });
    assert.equal((await expireData(db)).drafts, 0);
    assert.deepEqual(await s.result(db, a.owner, c.id), saved);
    assert.ok((await s.state(db, b.owner)).draft);
    await assert.rejects(s.saveDraft(db, a.owner, pair(), 1), { code: "DRAFT_CONFLICT" });
    await s.saveDraft(db, a.owner, pair(), 2);
    assert.equal((await s.state(db, a.owner)).revision, 3);
    await assert.rejects(s.saveDraft(db, a.owner, pair(), 1), { code: "DRAFT_CONFLICT" });
  } finally { await db.close(); }
});

test("merge ignores expired birth conflicts and preserves transferred draft age and target revision", async () => {
  const db = await setup();
  try {
    const target = await s.newSession(db), source = await s.newSession(db), subject = randomUUID();
    await i.bindIdentity(db, target.owner, await i.startIdentity(db, target.owner), subject);
    const old = pair(); old.me.year = "1980";
    await s.saveDraft(db, target.owner, old, 0);
    await db.query("UPDATE drafts SET updated_at=now()-interval '31 days' WHERE owner_id=$1", [target.owner]);
    await s.saveDraft(db, source.owner, pair(), 0);
    await db.query("UPDATE drafts SET updated_at=now()-interval '20 days' WHERE owner_id=$1", [source.owner]);
    const before = (await one(db, "SELECT updated_at FROM drafts WHERE owner_id=$1", [source.owner]))!.updated_at;
    const ticket = (await i.bindIdentity(db, source.owner, await i.startIdentity(db, source.owner), subject)).ticket!;
    assert.equal(await i.finishIdentity(db, source.owner, ticket, true), target.owner);
    assert.equal((await s.state(db, target.owner)).draft!.me.year, pair().me.year);
    const merged = (await one(db, "SELECT revision,updated_at FROM drafts WHERE owner_id=$1", [target.owner]))!;
    assert.equal(merged.revision, 2);
    assert.deepEqual(merged.updated_at, before);
    await assert.rejects(s.saveDraft(db, target.owner, old, 1), { code: "DRAFT_CONFLICT" });
    const expiredSource = await s.newSession(db);
    await s.saveDraft(db, expiredSource.owner, old, 0);
    await db.query("UPDATE drafts SET updated_at=now()-interval '31 days' WHERE owner_id=$1", [expiredSource.owner]);
    const second = (await i.bindIdentity(db, expiredSource.owner, await i.startIdentity(db, expiredSource.owner), subject)).ticket!;
    await i.finishIdentity(db, expiredSource.owner, second, true);
    assert.equal((await s.state(db, target.owner)).draft!.me.year, pair().me.year);
  } finally { await db.close(); }
});

test("retention-only command never reconciles a payment or runs queued work; invalid flags never connect", async () => {
  const db = await setup();
  try {
    const queued = await s.newSession(db);
    const job = await s.createComparison(db, queued.owner, pair(), randomUUID(), true);
    const a = await s.newSession(db);
    await s.createComparison(db, a.owner, pair(), randomUUID(), true);
    await s.runJobs(db, a.owner); await s.recoveryCode(db, a.owner);
    const paid = await s.createComparison(db, a.owner, pair(), randomUUID(), true);
    const order = (await one(db, "SELECT * FROM orders WHERE comparison_id=$1", [paid.id]))!;
    await assert.rejects(p.confirmPayment(db, a.owner, order.id, `mock_${order.id}`, 2900, new p.MockProvider(db, true)));
    const result = await operationalCli("retention", [], async () => ({ ...db, close: async () => {} }));
    assert.equal(result.exitCode, 0);
    assert.equal((await one(db, "SELECT state FROM orders WHERE id=$1", [order.id]))!.state, "confirmation_unknown");
    assert.equal((await one(db, "SELECT count(*)::int AS n FROM results WHERE comparison_id=$1", [paid.id]))!.n, 0);
    assert.equal((await one(db, "SELECT state FROM generation_jobs WHERE comparison_id=$1", [job.id]))!.state, "queued");
    let connects = 0;
    await operationalCli("retention", ["--health"], async () => { connects++; throw new Error(); });
    assert.equal(connects, 0);
  } finally { await db.close(); }
});

test("payment alert measures current operation request time, retries preserve age, legacy timestamps stay unknown", async () => {
  const db = await setup();
  try {
    const a = await s.newSession(db);
    await s.createComparison(db, a.owner, pair(), randomUUID(), true);
    await s.runJobs(db, a.owner); await s.recoveryCode(db, a.owner);
    const c = await s.createComparison(db, a.owner, pair(), randomUUID(), true);
    const o = (await one(db, "SELECT * FROM orders WHERE comparison_id=$1", [c.id]))!;
    await db.query("UPDATE orders SET created_at=now()-interval '1 year' WHERE id=$1", [o.id]);
    await p.confirmPayment(db, a.owner, o.id, `mock_${o.id}`, 2900);
    class FailingCancel extends p.MockProvider { async cancel(): Promise<p.Payment> { throw new Error("SYNTHETIC_TIMEOUT"); } }
    const failing = new FailingCancel(db);
    await assert.rejects(p.refundPayment(db, a.owner, o.id, failing));
    assert.equal((await health(db)).payments.overduePending, 0);
    await db.query("UPDATE payment_attempts SET created_at=now()-interval '1 year' WHERE order_id=$1 AND operation='confirm'", [o.id]);
    assert.equal((await health(db)).payments.overduePending, 0);
    await db.transaction(async tx => {
      await tx.query("UPDATE payment_attempts SET created_at=now()-interval '10 minutes' WHERE order_id=$1 AND operation='refund'", [o.id]);
      assert.equal((await health({ ...db, query: tx.query.bind(tx) })).payments.overduePending, 1);
    });
    await assert.rejects(p.refundPayment(db, a.owner, o.id, failing));
    assert.equal((await one(db, "SELECT count(*)::int AS n FROM payment_attempts WHERE order_id=$1 AND operation='refund' AND state='requested'", [o.id]))!.n, 1);
    await db.query("DELETE FROM payment_attempts WHERE order_id=$1", [o.id]);
    assert.equal((await health(db)).payments.unknownPendingAge, 1);
    await p.refundPayment(db, a.owner, o.id);
    assert.equal((await health(db)).payments.unknownPendingAge, 0);
  } finally { await db.close(); }
});

test("seven-day goodwill boundary never rejects statutory claims or guesses unknown payment time", () => {
  const paid = "2026-10-01T00:00:00.000Z";
  assert.equal(goodwillRefundAssessment(paid, "2026-10-08T00:00:00.000Z").decision, "full_refund");
  assert.equal(goodwillRefundAssessment(paid, "2026-10-08T00:00:00.001Z").decision, "manual_review");
  for (const time of [null, "invalid", "2026-11-01T00:00:00Z"])
    assert.equal(goodwillRefundAssessment(time, "2026-10-08T00:00:00Z").code, "VERIFIED_PAYMENT_TIME_REQUIRED");
});

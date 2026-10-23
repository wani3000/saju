import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { openDatabase, migrate, one, type Database } from "../src/server/db";
import * as s from "../src/server/service";
import * as p from "../src/server/payments";
import { eraseReading } from "../src/server/operations";
import { samplePerson } from "../src/domain/model";
const pair = () => ({ me: samplePerson(), other: samplePerson(true) });
async function setup() { const db = await openDatabase("memory://"); await migrate(db); return db; }
async function free(db: Database, owner: string) {
  const input = pair(), key = randomUUID(), c = await s.createComparison(db, owner, input, key, true);
  await s.runJobs(db, owner); return { ...c, input, key };
}
async function paid(db: Database, owner: string, confirm = true) {
  const c = await s.createComparison(db, owner, pair(), randomUUID(), true);
  const o = (await one(db, "SELECT * FROM orders WHERE comparison_id=$1", [c.id]))!;
  if (confirm) { await p.confirmPayment(db, owner, o.id, `mock_${o.id}`, 2900); await s.runJobs(db, owner); }
  return { c, o };
}

test("individual erasure scrubs result/share/matching draft, preserves other stories and consumed free claim, and rejects old request replay", async () => {
  const db = await setup();
  try {
    const a = await s.newSession(db), first = await free(db, a.owner);
    await s.recoveryCode(db, a.owner);
    const other = await paid(db, a.owner), snapshot = await s.result(db, a.owner, other.c.id);
    const share = await s.share(db, a.owner, first.id, ["별명", "친구"]);
    await s.saveDraft(db, a.owner, first.input, 0);
    await eraseReading(db, a.owner, first.id);
    await eraseReading(db, a.owner, first.id);
    const state = await s.state(db, a.owner);
    assert.equal(state.free, "consumed"); assert.equal(state.draft, null); assert.equal(state.revision, 2);
    assert.deepEqual(state.readingHistory.map(r => r.id), [other.c.id]);
    assert.deepEqual(await s.result(db, a.owner, other.c.id), snapshot);
    assert.equal(await s.publicShare(db, share.path.split("/").pop()!), null);
    assert.equal(await s.sessionOwner(db, a.secret), a.owner);
    assert.deepEqual(await one(db, "SELECT inputs,charts,input_hash,state FROM comparisons WHERE id=$1", [first.id]), { inputs: {}, charts: {}, input_hash: "", state: "cancelled" });
    await assert.rejects(s.result(db, a.owner, first.id), { code: "NOT_FOUND" });
    await assert.rejects(s.share(db, a.owner, first.id, ["나", "너"]), { code: "NOT_FOUND" });
    await assert.rejects(s.createComparison(db, a.owner, first.input, first.key, true), { code: "READING_ERASED" });
    await assert.rejects(s.saveDraft(db, a.owner, first.input, 1), { code: "DRAFT_CONFLICT" });
    assert.equal((await one(db, "SELECT count(*)::int AS n FROM operational_events WHERE kind='reading_erasure'"))!.n, 1);
  } finally { await db.close(); }
});

test("paid erasure does not refund, late approval cannot resurrect work, and later cancellation still closes the retained order", async () => {
  const db = await setup();
  try {
    const a = await s.newSession(db); const first = await free(db, a.owner);
    await s.recoveryCode(db, a.owner); const { c, o } = await paid(db, a.owner);
    await eraseReading(db, a.owner, c.id);
    assert.equal((await one(db, "SELECT state FROM orders WHERE id=$1", [o.id]))!.state, "paid");
    assert.equal((await one(db, "SELECT status FROM mock_payments WHERE order_id=$1", [o.id]))!.status, "DONE");
    assert.equal((await s.state(db, a.owner)).orders[0].other_name, null);
    await db.query("DELETE FROM generation_jobs WHERE comparison_id=$1", [c.id]);
    await p.applyPayment(db, a.owner, o.id, await new p.MockProvider(db).lookup(o));
    assert.equal((await one(db, "SELECT count(*)::int AS n FROM generation_jobs WHERE comparison_id=$1", [c.id]))!.n, 0);
    await p.refundPayment(db, a.owner, o.id);
    assert.equal((await one(db, "SELECT state FROM orders WHERE id=$1", [o.id]))!.state, "refunded");
    await assert.rejects(s.result(db, a.owner, c.id), { code: "NOT_FOUND" });
    assert.ok(await s.result(db, a.owner, first.id));
  } finally { await db.close(); }
});

test("erasing an unfinished free reservation releases it once and fences a worker that already claimed the story", async () => {
  const db = await setup();
  try {
    const a = await s.newSession(db), c = await s.createComparison(db, a.owner, pair(), randomUUID(), true);
    const job = (await s.claimJob(db, a.owner))!;
    const before = (await one(db, "SELECT generation FROM free_claims WHERE owner_id=$1", [a.owner]))!.generation;
    await eraseReading(db, a.owner, c.id);
    await eraseReading(db, a.owner, c.id);
    assert.equal(await s.finishJob(db, job), false);
    assert.deepEqual(await one(db, "SELECT state,generation FROM free_claims WHERE owner_id=$1", [a.owner]), { state: "available", generation: before + 1 });
    const fresh = await free(db, a.owner); assert.ok(await s.result(db, a.owner, fresh.id));
  } finally { await db.close(); }
});

test("unpaid erasure cancels only its order/return attempt and leaves an unrelated draft untouched", async () => {
  const db = await setup();
  try {
    const a = await s.newSession(db); await free(db, a.owner); await s.recoveryCode(db, a.owner);
    const { c, o } = await paid(db, a.owner, false);
    const unrelated = pair(); await s.saveDraft(db, a.owner, unrelated, 0);
    await db.query("INSERT INTO nicepay_attempts(order_id,return_hash) VALUES($1,'synthetic-return-hash')", [o.id]);
    await eraseReading(db, a.owner, c.id);
    assert.equal((await one(db, "SELECT state FROM orders WHERE id=$1", [o.id]))!.state, "cancelled");
    assert.equal((await one(db, "SELECT count(*)::int AS n FROM nicepay_attempts WHERE order_id=$1", [o.id]))!.n, 0);
    assert.deepEqual((await s.state(db, a.owner)).draft, unrelated);
    await assert.rejects(p.confirmPayment(db, a.owner, o.id, `mock_${o.id}`, 2900), { code: "ORDER_CLOSED" });
  } finally { await db.close(); }
});

test("cross-owner deletion and unresolved approval/refund are refused without changing the result", async () => {
  const db = await setup();
  try {
    const a = await s.newSession(db), b = await s.newSession(db);
    await free(db, a.owner); await s.recoveryCode(db, a.owner);
    const { c, o } = await paid(db, a.owner), saved = await s.result(db, a.owner, c.id);
    await assert.rejects(eraseReading(db, b.owner, c.id), { code: "NOT_FOUND" });
    for (const state of ["confirming", "confirmation_unknown", "refund_pending"]) {
      await db.query("UPDATE orders SET state=$2 WHERE id=$1", [o.id, state]);
      await assert.rejects(eraseReading(db, a.owner, c.id), { code: "PAYMENT_UNRESOLVED" });
      assert.deepEqual(await s.result(db, a.owner, c.id), saved);
    }
  } finally { await db.close(); }
});

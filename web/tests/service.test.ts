import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  openDatabase,
  migrate,
  one,
  assertMode,
  type Database,
} from "../src/server/db";
import * as s from "../src/server/service";
import * as p from "../src/server/payments";
import { selfGroup, samplePerson } from "../src/domain/model";
import { validatePair } from "../src/server/engine";
let db: Database;
before(async () => {
  db = await openDatabase("memory://");
  await migrate(db);
});
after(async () => db.close());
const pair = () => ({ me: samplePerson(), other: samplePerson(true) });
async function owner() {
  return (await s.newSession(db)).owner;
}
async function free(id: string) {
  const c = await s.createComparison(db, id, pair(), randomUUID(), true);
  await s.runJobs(db, id);
  return c.id as string;
}
async function paidOrder(id: string) {
  await free(id);
  await s.recoveryCode(db, id);
  const c = await s.createComparison(db, id, pair(), randomUUID(), true);
  return (await one(db, "SELECT * FROM orders WHERE comparison_id=$1", [
    c.id,
  ]))!;
}
test("migrations can be reapplied without losing records", async () => {
  const id = await owner();
  await migrate(db);
  assert.ok(await one(db, "SELECT id FROM accounts WHERE id=$1", [id]));
});
test("session token is hashed and expires", async () => {
  const session = await s.newSession(db);
  assert.equal(await s.sessionOwner(db, session.secret), session.owner);
  assert.equal(await s.sessionOwner(db, "wrong"), undefined);
  assert.equal(
    (await one(db, "SELECT token_hash FROM sessions WHERE owner_id=$1", [
      session.owner,
    ]))!.token_hash,
    s.hash(session.secret),
  );
  await db.query(
    "UPDATE sessions SET expires_at=now()-interval '1 second' WHERE owner_id=$1",
    [session.owner],
  );
  assert.equal(await s.sessionOwner(db, session.secret), undefined);
});
test("draft optimistic concurrency rejects stale tabs", async () => {
  const id = await owner();
  const a = pair();
  await s.saveDraft(db, id, a, 0);
  await assert.rejects(s.saveDraft(db, id, pair(), 0), {
    code: "DRAFT_CONFLICT",
  });
  assert.deepEqual((await s.state(db, id)).draft, a);
});
test("date validation rejects solar overflow, invalid lunar leap and future birth", () => {
  let a = pair();
  a.me.year = "2001";
  a.me.month = "2";
  a.me.day = "29";
  assert.throws(() => validatePair(a));
  a = pair();
  a.me.calendar = "lunar";
  a.me.leap = true;
  a.me.year = "2025";
  a.me.month = "1";
  a.me.day = "10";
  assert.throws(() => validatePair(a));
  a = pair();
  a.me.year = "2026";
  a.me.month = "12";
  a.me.day = "31";
  assert.throws(() => validatePair(a));
});
test("unknown time is not noon and clears hidden values", () => {
  const a = pair();
  a.me.hour = "12";
  a.me.minute = "00";
  const r = validatePair(a);
  assert.equal(r.pair.me.hour, "");
  assert.equal(r.charts.me.pillars.hour, null);
  assert.equal(r.charts.me.policy.productionApproved, false);
});
test("simultaneous first free claims reserve only one comparison", async () => {
  const id = await owner();
  const out = await Promise.allSettled([
    s.createComparison(db, id, pair(), randomUUID(), true),
    s.createComparison(db, id, pair(), randomUUID(), true),
  ]);
  assert.equal(out.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(
    (await one(
      db,
      "SELECT count(*) AS n FROM generation_jobs WHERE owner_id=$1",
      [id],
    ))!.n,
    1,
  );
  await s.runJobs(db, id);
  assert.equal((await s.state(db, id)).free, "consumed");
});
test("same request is idempotent and changed payload is rejected", async () => {
  const id = await owner(),
    a = pair(),
    key = randomUUID();
  const first = await s.createComparison(db, id, a, key, true);
  assert.deepEqual(await s.createComparison(db, id, a, key, true), first);
  await assert.rejects(s.createComparison(db, id, pair(), key, true), {
    code: "IDEMPOTENCY_CONFLICT",
  });
});
test("same input with a new key opens existing result without charge", async () => {
  const id = await owner(),
    a = pair();
  const c = await s.createComparison(db, id, a, randomUUID(), true);
  await s.runJobs(db, id);
  assert.deepEqual(await s.createComparison(db, id, a, randomUUID(), true), c);
  assert.equal((await s.state(db, id)).orders.length, 0);
});
test("birthdays are not used to merge different people", async () => {
  const id = await owner(),
    a = pair();
  const first = await s.createComparison(db, id, a, randomUUID(), true);
  await s.runJobs(db, id);
  await s.recoveryCode(db, id);
  a.other.id = randomUUID();
  const second = await s.createComparison(db, id, a, randomUUID(), true);
  assert.notEqual(first.id, second.id);
});
test("three free generation failures release reservation; stale worker cannot commit", async () => {
  const id = await owner();
  const c = await s.createComparison(db, id, pair(), randomUUID(), true);
  let stale;
  for (let i = 0; i < 3; i++) {
    stale = await s.claimJob(db, id);
    await s.finishJob(db, stale!, true);
  }
  assert.equal((await s.state(db, id)).free, "available");
  assert.equal(await s.finishJob(db, stale!), false);
  await s.retryJob(db, id, c.id);
  await s.runJobs(db, id);
  assert.equal((await s.state(db, id)).results.length, 1);
});
test("expired lease gets a new fence and rejects previous worker", async () => {
  const id = await owner();
  await s.createComparison(db, id, pair(), randomUUID(), true);
  const old = (await s.claimJob(db, id))!;
  await db.query(
    "UPDATE generation_jobs SET lease_until=now()-interval '1 second' WHERE comparison_id=$1",
    [old.comparison_id],
  );
  const next = (await s.claimJob(db, id))!;
  assert.ok(next.fence > old.fence);
  assert.equal(await s.finishJob(db, old), false);
  assert.equal(await s.finishJob(db, next), true);
});
test("results cannot be accessed or shared by another owner", async () => {
  const a = await owner(),
    b = await owner();
  const id = await free(a);
  await assert.rejects(s.result(db, b, id), { code: "NOT_FOUND" });
  await assert.rejects(s.share(db, b, id, ["나", "너"]), { code: "NOT_FOUND" });
  assert.equal((await s.state(db, b)).results.length, 0);
});
test("result snapshots survive later draft edits", async () => {
  const id = await owner();
  const resultId = await free(id);
  const before = await s.result(db, id, resultId);
  const edited = pair();
  edited.me.year = "1980";
  await s.saveDraft(db, id, edited, 0);
  assert.deepEqual(await s.result(db, id, resultId), before);
});
test("share snapshot only contains public aliases and example copy; revoke and expiry work", async () => {
  const id = await owner(),
    r = await free(id);
  const link = await s.share(db, id, r, ["우리", "친구"]);
  const secret = link.path.split("/").pop()!;
  const card = await s.publicShare(db, secret);
  assert.deepEqual(Object.keys(card).sort(), [
    "aliases",
    "avatars",
    "catalogVersion",
    "reading",
  ]);
  assert.ok(!JSON.stringify(card).includes("1990"));
  assert.ok(!JSON.stringify(card).includes("pillars"));
  assert.equal(
    (await one(db, "SELECT token_hash FROM shares WHERE id=$1", [link.id]))!
      .token_hash,
    s.hash(secret),
  );
  await assert.rejects(s.revokeShare(db, await owner(), link.id), {
    code: "NOT_FOUND",
  });
  await s.revokeShare(db, id, link.id);
  assert.equal(await s.publicShare(db, secret), null);
  const expired = await s.share(db, id, r, ["나", "상대"]);
  await db.query(
    "UPDATE shares SET expires_at=now()-interval '1 second' WHERE id=$1",
    [expired.id],
  );
  assert.equal(await s.publicShare(db, expired.path.split("/").pop()!), null);
});
test("recovery keeps owner/free history and rotated code invalidates old code", async () => {
  const id = await owner();
  await free(id);
  const code = await s.recoveryCode(db, id);
  const recovered = await s.recover(db, code);
  assert.equal(recovered.owner, id);
  assert.equal((await s.state(db, recovered.owner)).free, "consumed");
  await s.recoveryCode(db, id);
  await assert.rejects(s.recover(db, code), { code: "INVALID_RECOVERY" });
});
test("additional purchase requires persistent recovery identity", async () => {
  const id = await owner();
  await free(id);
  await assert.rejects(s.createComparison(db, id, pair(), randomUUID(), true), {
    code: "ACCOUNT_REQUIRED",
  });
});
test("price and ownership tampering are rejected before provider call", async () => {
  const id = await owner(),
    o = await paidOrder(id);
  await assert.rejects(p.confirmPayment(db, id, o.id, `mock_${o.id}`, 1), {
    code: "AMOUNT_MISMATCH",
  });
  await assert.rejects(
    p.confirmPayment(db, await owner(), o.id, `mock_${o.id}`, 2900),
    { code: "NOT_FOUND" },
  );
  assert.equal(
    await one(db, "SELECT * FROM mock_payments WHERE order_id=$1", [o.id]),
    undefined,
  );
});
test("duplicate payment confirmation grants exactly one entitlement and job", async () => {
  const id = await owner(),
    o = await paidOrder(id);
  await p.confirmPayment(db, id, o.id, `mock_${o.id}`, 2900);
  await p.confirmPayment(db, id, o.id, `mock_${o.id}`, 2900);
  await s.runJobs(db, id);
  assert.equal(
    (await one(
      db,
      "SELECT count(*) n FROM entitlements WHERE comparison_id=$1",
      [o.comparison_id],
    ))!.n,
    1,
  );
  assert.equal((await s.state(db, id)).results.length, 2);
});
test("provider success with lost response is recovered by lookup, without paying again", async () => {
  const id = await owner(),
    o = await paidOrder(id);
  await assert.rejects(
    p.confirmPayment(
      db,
      id,
      o.id,
      `mock_${o.id}`,
      2900,
      new p.MockProvider(db, true),
    ),
    { code: "CONFIRMATION_UNKNOWN" },
  );
  assert.equal(
    (await p.ownedOrder(db, id, o.id)).state,
    "confirmation_unknown",
  );
  await p.reconcilePayment(db, id, o.id);
  await s.runJobs(db, id);
  assert.equal((await p.ownedOrder(db, id, o.id)).state, "paid");
  assert.equal((await s.state(db, id)).results.length, 2);
});
test("provider success before DB commit is recovered by reconciliation", async () => {
  const id = await owner(),
    o = await paidOrder(id);
  await new p.MockProvider(db).confirm(o, `mock_${o.id}`);
  assert.equal((await p.ownedOrder(db, id, o.id)).state, "created");
  await p.reconcilePayment(db, id, o.id);
  assert.equal((await p.ownedOrder(db, id, o.id)).state, "paid");
});
test("duplicate and out-of-order events use current provider state; refund cannot resurrect result", async () => {
  const id = await owner(),
    o = await paidOrder(id);
  await p.confirmPayment(db, id, o.id, `mock_${o.id}`, 2900);
  await s.runJobs(db, id);
  const share = await s.share(db, id, o.comparison_id, ["나", "너"]);
  await p.paymentEvent(db, o.id, "event-1");
  await p.paymentEvent(db, o.id, "event-1");
  await p.refundPayment(db, id, o.id);
  await p.paymentEvent(db, o.id, "event-old");
  await assert.rejects(s.result(db, id, o.comparison_id), {
    code: "NOT_FOUND",
  });
  assert.equal(await s.publicShare(db, share.path.split("/").pop()!), null);
  assert.equal((await s.state(db, id)).results.length, 1);
  assert.equal((await p.ownedOrder(db, id, o.id)).state, "refunded");
});
test("refund racing with generation prevents late worker commit", async () => {
  const id = await owner(),
    o = await paidOrder(id);
  await p.confirmPayment(db, id, o.id, `mock_${o.id}`, 2900);
  const job = (await s.claimJob(db, id))!;
  await p.refundPayment(db, id, o.id);
  assert.equal(await s.finishJob(db, job), false);
  assert.equal(
    await one(db, "SELECT * FROM results WHERE comparison_id=$1", [
      o.comparison_id,
    ]),
    undefined,
  );
});
test("mismatched provider receipt cannot grant access", async () => {
  const id = await owner(),
    o = await paidOrder(id);
  await assert.rejects(
    p.applyPayment(db, id, o.id, {
      orderId: o.id,
      paymentKey: "fake",
      totalAmount: 1,
      currency: "KRW",
      status: "DONE",
    }),
    { code: "PAYMENT_MISMATCH" },
  );
  assert.equal(
    await one(db, "SELECT * FROM entitlements WHERE comparison_id=$1", [
      o.comparison_id,
    ]),
    undefined,
  );
});
test("cancelled order cannot be confirmed", async () => {
  const id = await owner(),
    o = await paidOrder(id);
  await p.cancelOrder(db, id, o.id);
  await assert.rejects(p.confirmPayment(db, id, o.id, `mock_${o.id}`, 2900), {
    code: "ORDER_CLOSED",
  });
});
test("production mode and live Toss keys fail closed", () => {
  process.env.SAJU_MODE = "production";
  assert.throws(assertMode, /NOT_APPROVED/);
  delete process.env.SAJU_MODE;
  assert.throws(
    () => new p.TossTestProvider("live_sk_invalid"),
    /ONLY_TOSS_TEST/,
  );
});
test("file-backed database retains draft across close/reopen", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "saju-db-"));
  let local = await openDatabase(path.join(dir, "db"));
  try {
    await migrate(local);
    const id = (await s.newSession(local)).owner;
    const value = pair();
    await s.saveDraft(local, id, value, 0);
    await local.close();
    local = await openDatabase(path.join(dir, "db"));
    assert.deepEqual((await s.state(local, id)).draft, value);
  } finally {
    await local.close();
    await rm(dir, { recursive: true, force: true });
  }
});
test("crash after marking confirming but before provider call retries the same key", async () => {
  const id = await owner(),
    o = await paidOrder(id);
  await db.query(
    "UPDATE orders SET state='confirming',payment_key=$2 WHERE id=$1",
    [o.id, `mock_${o.id}`],
  );
  await p.reconcilePayment(db, id, o.id);
  assert.equal((await p.ownedOrder(db, id, o.id)).state, "paid");
  assert.equal(
    (await one(db, "SELECT count(*) n FROM mock_payments WHERE order_id=$1", [
      o.id,
    ]))!.n,
    1,
  );
});
test("renaming or changing relationship reuses the purchased snapshot without a new charge", async () => {
  const id = await owner(),
    a = pair();
  const c = await s.createComparison(db, id, a, randomUUID(), true);
  await s.runJobs(db, id);
  a.other.name = "새별명";
  a.other.relation = "가족";
  assert.equal(
    (await s.createComparison(db, id, a, randomUUID(), true)).id,
    c.id,
  );
  assert.equal((await s.state(db, id)).orders.length, 0);
  assert.equal((await s.result(db, id, c.id)).other.name, "하루");
});
test("refund stays pending if provider has not confirmed cancellation", async () => {
  const id = await owner(),
    o = await paidOrder(id);
  const mock = new p.MockProvider(db);
  await p.confirmPayment(db, id, o.id, `mock_${o.id}`, 2900, mock);
  const noCancel = {
    confirm: mock.confirm.bind(mock),
    lookup: mock.lookup.bind(mock),
    cancel: mock.lookup.bind(mock),
  };
  await assert.rejects(p.refundPayment(db, id, o.id, noCancel), {
    code: "REFUND_PENDING",
  });
  assert.equal((await p.ownedOrder(db, id, o.id)).state, "refund_pending");
  await p.refundPayment(db, id, o.id);
  assert.equal((await p.ownedOrder(db, id, o.id)).state, "refunded");
});

test("map groups separate changed self birth snapshots and ignore names", async () => {
  const id = await owner();
  const r = await s.result(db, id, await free(id));
  const renamed = structuredClone(r);
  renamed.me.name = "바뀐별명";
  assert.equal(selfGroup(r), selfGroup(renamed));
  const changed = structuredClone(r);
  (changed.charts.me as { solar: { year: number } }).solar.year = 1980;
  assert.notEqual(selfGroup(r), selfGroup(changed));
});

test("three crashed workers terminate the lease, release free reservation and permit manual retry", async () => {
  const id = await owner();
  const c = await s.createComparison(db, id, pair(), randomUUID(), true);
  let stale;
  for (let n = 0; n < 3; n++) {
    stale = await s.claimJob(db, id);
    assert.ok(stale);
    await db.query(
      "UPDATE generation_jobs SET lease_until=now()-interval '1 second' WHERE comparison_id=$1",
      [c.id],
    );
  }
  assert.equal(await s.claimJob(db, id), null);
  assert.equal((await s.state(db, id)).free, "available");
  const job = (await one(
    db,
    "SELECT * FROM generation_jobs WHERE comparison_id=$1",
    [c.id],
  ))!;
  assert.equal(job.state, "failed");
  assert.equal(job.attempts, 3);
  assert.equal(job.error_code, "LEASE_EXHAUSTED");
  assert.equal(await s.finishJob(db, stale!), false);
  await s.retryJob(db, id, c.id);
  await s.runJobs(db, id);
  assert.equal((await s.state(db, id)).results.length, 1);
});
test("one failing result does not stop other owners; error payload is never persisted", async () => {
  const broken = await owner(),
    healthy = await owner();
  const a = await s.createComparison(db, broken, pair(), randomUUID(), true);
  const b = await s.createComparison(db, healthy, pair(), randomUUID(), true);
  const report = await s.runJobs(db, undefined, async (job) => {
    if (job.comparison_id === a.id)
      throw new Error("PRIVATE_INPUT_MUST_NOT_BE_LOGGED");
    return s.finishJob(db, job);
  });
  assert.ok(report.completed >= 1);
  assert.equal(report.retriedOrFailed, 3);
  assert.ok(await s.result(db, healthy, b.id));
  const job = (await one(
    db,
    "SELECT * FROM generation_jobs WHERE comparison_id=$1",
    [a.id],
  ))!;
  assert.equal(job.error_code, "GENERATION_FAILED");
  assert.equal(job.state, "failed");
  assert.equal((await s.state(db, broken)).free, "available");
});
test("paid job crash limit preserves entitlement and manual retry does not create a new order", async () => {
  const id = await owner(),
    o = await paidOrder(id);
  await p.confirmPayment(db, id, o.id, "mock_" + o.id, 2900);
  for (let n = 0; n < 3; n++) {
    await s.claimJob(db, id);
    await db.query(
      "UPDATE generation_jobs SET lease_until=now()-interval '1 second' WHERE comparison_id=$1",
      [o.comparison_id],
    );
  }
  assert.equal(await s.claimJob(db, id), null);
  assert.equal(
    (await one(db, "SELECT state FROM entitlements WHERE comparison_id=$1", [
      o.comparison_id,
    ]))!.state,
    "active",
  );
  await s.retryJob(db, id, o.comparison_id);
  await s.runJobs(db, id);
  assert.ok(await s.result(db, id, o.comparison_id));
  assert.equal(
    (await db.query("SELECT * FROM orders WHERE owner_id=$1", [id])).rows
      .length,
    1,
  );
});

test("v4 boundary ambiguity survives result generation and reopening", async () => {
  const id = await owner(), input = pair();
  Object.assign(input.me, {year:"1954",month:"12",day:"7",hour:"23",minute:"58",timeKnown:true});
  const validated = validatePair(input);
  assert.equal(validated.charts.me.pillars.month, null);
  assert.equal(validated.charts.me.candidates!.month.length, 2);
  const comparison = await s.createComparison(db, id, input, randomUUID(), true);
  await s.runJobs(db, id);
  const saved = await s.result(db, id, comparison.id);
  assert.deepEqual(saved.charts, validated.charts);
  assert.equal((await one(db,"SELECT engine_version FROM comparisons WHERE id=$1",[comparison.id]))!.engine_version,
    "manseryeok-research-civil-midnight-v4");
  assert.deepEqual(await s.createComparison(db,id,input,randomUUID(),true),comparison);
  assert.deepEqual(await s.result(db,id,comparison.id),saved);
  assert.equal((await s.state(db,id)).orders.length,0);
});

test("a queued v3 snapshot is not recalculated or charged again by v4", async () => {
  const id = await owner(), input = pair();
  Object.assign(input.me, {year:"1954",month:"12",day:"7",hour:"23",minute:"58",timeKnown:true});
  const comparison = await s.createComparison(db,id,input,randomUUID(),true);
  // Simulate an already persisted pre-upgrade calculation, with its original policy.
  const previous = structuredClone(validatePair(input).charts);
  previous.me.pillars.month = previous.me.candidates!.month.find(p=>p.endsWith("자"))!;
  delete previous.me.candidates;
  delete previous.me.boundaryReview;
  previous.me.policy.version = "research-civil-midnight-v3";
  previous.other.policy.version = "research-civil-midnight-v3";
  await db.query("UPDATE comparisons SET charts=$2,engine_version=$3 WHERE id=$1",
    [comparison.id,JSON.stringify(previous),"manseryeok-research-civil-midnight-v3"]);
  await s.runJobs(db,id);
  assert.deepEqual((await s.result(db,id,comparison.id)).charts,previous);
  assert.deepEqual(await s.createComparison(db,id,input,randomUUID(),true),comparison);
  assert.deepEqual((await s.result(db,id,comparison.id)).charts,previous);
  assert.equal((await s.state(db,id)).orders.length,0);
});

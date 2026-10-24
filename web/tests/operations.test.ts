import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { openDatabase, migrate, one, type Database } from "../src/server/db";
import * as s from "../src/server/service";
import * as i from "../src/server/identity";
import {
  erasePersonalData,
  expireData,
  maintenance,
} from "../src/server/operations";
import { samplePerson } from "../src/domain/model";
import {
  MockProvider,
  confirmPayment,
  paymentEvent,
} from "../src/server/payments";
let db: Database;
before(async () => {
  db = await openDatabase("memory://");
  await migrate(db);
});
after(() => db.close());
const pair = () => ({ me: samplePerson(), other: samplePerson(true) });
async function link(owner: string, subject = randomUUID()) {
  return i.bindIdentity(db, owner, await i.startIdentity(db, owner), subject);
}
async function free(owner: string) {
  const c = await s.createComparison(db, owner, pair(), randomUUID(), true);
  await s.runJobs(db, owner);
  return c.id as string;
}
test("OAuth attempt bound to session owner, single use, expiry and identity", async () => {
  const a = await s.newSession(db),
    b = await s.newSession(db),
    attempt = await i.startIdentity(db, a.owner),
    subject = randomUUID();
  await assert.rejects(i.bindIdentity(db, b.owner, attempt, subject));
  await i.bindIdentity(db, a.owner, attempt, subject);
  await assert.rejects(i.bindIdentity(db, a.owner, attempt, subject));
  const stale = await i.startIdentity(db, a.owner);
  await db.query(
    "UPDATE oauth_attempts SET expires_at=now()-interval '1 second' WHERE owner_id=$1",
    [a.owner],
  );
  await assert.rejects(i.bindIdentity(db, a.owner, stale, subject));
  await assert.rejects(link(a.owner, randomUUID()), {
    code: "DIFFERENT_IDENTITY",
  });
});
test("explicit merge transfers snapshots, paid records, share ownership; keeps free consumed", async () => {
  const target = await s.newSession(db),
    source = await s.newSession(db),
    subject = randomUUID();
  await link(target.owner, subject);
  const c = await free(source.owner);
  const share = await s.share(db, source.owner, c, ["나", "친구"]);
  await s.recoveryCode(db, source.owner);
  const paid = await s.createComparison(
    db,
    source.owner,
    pair(),
    randomUUID(),
    true,
  );
  const order = (await one(db, "SELECT * FROM orders WHERE comparison_id=$1", [
    paid.id,
  ]))!;
  await confirmPayment(db, source.owner, order.id, "mock_" + order.id, 2900);
  await s.runJobs(db, source.owner);
  const result = await link(source.owner, subject);
  assert.ok(result.ticket);
  await assert.rejects(
    i.finishIdentity(db, target.owner, result.ticket!, true),
  );
  assert.equal(
    await i.finishIdentity(db, source.owner, result.ticket!, true),
    target.owner,
  );
  assert.equal(await s.sessionOwner(db, source.secret), undefined);
  assert.equal((await s.state(db, target.owner)).free, "consumed");
  assert.equal((await s.state(db, target.owner)).results.length, 2);
  await assert.rejects(s.result(db, source.owner, c));
  assert.ok(await s.result(db, target.owner, c));
  await s.revokeShare(db, target.owner, share.id);
  await assert.rejects(
    i.finishIdentity(db, source.owner, result.ticket!, true),
  );
  assert.equal(
    (await one(db, "SELECT owner_id FROM orders WHERE id=$1", [order.id]))!
      .owner_id,
    target.owner,
  );
});
test("conflicting self birth refuses merge; explicit switch preserves source", async () => {
  const a = await s.newSession(db),
    b = await s.newSession(db),
    subject = randomUUID();
  await link(a.owner, subject);
  await s.saveDraft(db, a.owner, pair(), 0);
  const changed = pair();
  changed.me.year = "1980";
  await s.saveDraft(db, b.owner, changed, 0);
  const t = (await link(b.owner, subject)).ticket!;
  await assert.rejects(i.finishIdentity(db, b.owner, t, true), {
    code: "BIRTH_CONFLICT",
  });
  assert.equal(await i.finishIdentity(db, b.owner, t, false), a.owner);
  assert.equal(await s.sessionOwner(db, b.secret), b.owner);
});
test("deletion revokes sessions and public links, scrubs snapshots, stops stale worker", async () => {
  const a = await s.newSession(db),
    subject = randomUUID();
  await link(a.owner, subject);
  const c = await free(a.owner);
  const share = await s.share(db, a.owner, c, ["별명", "친구"]);
  await s.saveDraft(db, a.owner, pair(), 0);
  await erasePersonalData(db, a.owner);
  assert.equal(await s.sessionOwner(db, a.secret), undefined);
  await assert.rejects(s.newSession(db, a.owner));
  assert.equal(await s.publicShare(db, share.path.split("/").pop()!), null);
  assert.deepEqual(
    (await one(db, "SELECT inputs FROM comparisons WHERE id=$1", [c]))!.inputs,
    {},
  );
  assert.equal(
    (await db.query("SELECT * FROM results WHERE owner_id=$1", [a.owner])).rows
      .length,
    0,
  );
  const b = await s.newSession(db);
  await assert.rejects(link(b.owner, subject), { code: "ACCOUNT_DELETED" });
  const running = await s.newSession(db);
  await s.createComparison(db, running.owner, pair(), randomUUID(), true);
  const job = await s.claimJob(db, running.owner);
  await db.query("UPDATE generation_jobs SET error_code='WORKER_FAILED' WHERE owner_id=$1",[running.owner]);
  await erasePersonalData(db, running.owner);
  const erasedJob=(await one(db,"SELECT lease_until,error_code FROM generation_jobs WHERE owner_id=$1",[running.owner]))!;
  assert.equal(erasedJob.lease_until,null);assert.equal(erasedJob.error_code,null);
  await assert.rejects(s.finishJob(db, job!));
});
test("retention deletes only inactive guests and rechecks activity after locking", async () => {
  const old = await s.newSession(db),
    active = await s.newSession(db),
    member = await s.newSession(db);
  await s.recoveryCode(db, member.owner);
  for (const a of [old, active, member])
    await db.query(
      "UPDATE accounts SET created_at=now()-interval '40 days' WHERE id=$1",
      [a.owner],
    );
  for (const a of [old, member])
    await db.query(
      "UPDATE sessions SET expires_at=now()-interval '1 day' WHERE owner_id=$1",
      [a.owner],
    );
  assert.equal(await erasePersonalData(db, active.owner, true), false);
  const count = await expireData(db);
  assert.equal(count.guests, 1);
  assert.ok(
    (await one(db, "SELECT deleted_at FROM accounts WHERE id=$1", [old.owner]))!
      .deleted_at,
  );
  assert.equal(
    (await one(db, "SELECT deleted_at FROM accounts WHERE id=$1", [
      member.owner,
    ]))!.deleted_at,
    null,
  );
});
test("maintenance reconciles lost approval and unresolved payments block deletion", async () => {
  const a = await s.newSession(db);
  await free(a.owner);
  await s.recoveryCode(db, a.owner);
  const c = await s.createComparison(db, a.owner, pair(), randomUUID(), true);
  const o = (await one(db, "SELECT * FROM orders WHERE comparison_id=$1", [
    c.id,
  ]))!;
  await assert.rejects(
    confirmPayment(
      db,
      a.owner,
      o.id,
      "mock_" + o.id,
      2900,
      new MockProvider(db, true),
    ),
  );
  await assert.rejects(erasePersonalData(db, a.owner), {
    code: "PAYMENT_UNRESOLVED",
  });
  const report = await maintenance(db);
  assert.ok(report.recovered >= 1);
  assert.equal(
    (await one(db, "SELECT state FROM orders WHERE id=$1", [o.id]))!.state,
    "paid",
  );
});

test("late provider cancellation closes retained order after erasure without restoring data", async () => {
  const a = await s.newSession(db);
  await free(a.owner);
  await s.recoveryCode(db, a.owner);
  const c = await s.createComparison(db, a.owner, pair(), randomUUID(), true);
  const o = (await one(db, "SELECT * FROM orders WHERE comparison_id=$1", [
    c.id,
  ]))!;
  await confirmPayment(db, a.owner, o.id, "mock_" + o.id, 2900);
  await s.runJobs(db, a.owner);
  await erasePersonalData(db, a.owner);
  const mock = new MockProvider(db);
  await mock.cancel(o);
  await paymentEvent(db, o.id, "erased-cancel", mock);
  assert.equal(
    (await one(db, "SELECT state FROM orders WHERE id=$1", [o.id]))!.state,
    "refunded",
  );
  assert.equal(
    (await db.query("SELECT * FROM results WHERE owner_id=$1", [a.owner])).rows
      .length,
    0,
  );
});

test("erasure during a failed worker does not stop the next owner or restore deleted data", async () => {
  const erased = await s.newSession(db),
    healthy = await s.newSession(db);
  const c = await s.createComparison(
    db,
    erased.owner,
    pair(),
    randomUUID(),
    true,
  );
  const h = await s.createComparison(
    db,
    healthy.owner,
    pair(),
    randomUUID(),
    true,
  );
  const report = await s.runJobs(db, undefined, async (job) => {
    if (job.comparison_id === c.id) {
      await erasePersonalData(db, erased.owner);
      throw new Error("TRANSIENT_WORK_ERROR");
    }
    return s.finishJob(db, job);
  });
  assert.equal(report.skipped, 1);
  assert.ok(await s.result(db, healthy.owner, h.id));
  assert.equal(
    (await db.query("SELECT * FROM results WHERE owner_id=$1", [erased.owner]))
      .rows.length,
    0,
  );
});

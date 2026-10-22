// Only invoked by postgres-check in its owned disposable cluster. Never prints tokens or rows.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { openDatabase, one, assertMigrationsApplied, type Database } from "../src/server/db";
import * as s from "../src/server/service";
import * as p from "../src/server/payments";
import {bindIdentity,startIdentity} from "../src/server/identity";
import {hasKakaoSession} from "../src/server/kakao-policy";
import { samplePerson } from "../src/domain/model";
const [phase, file] = process.argv.slice(2);
assert.ok(["seed", "verify"].includes(phase) && file);
assert.equal(process.env.SAJU_RESTORE_CHECK, "isolated-cluster");
const url = new URL(process.env.DATABASE_URL!);
assert.equal(url.hostname, "localhost");
assert.equal(url.username, "saju_runtime");
assert.equal(url.pathname, phase === "seed" ? "/saju_test" : "/saju_restore");
assert.equal(url.searchParams.get("host"), path.dirname(file));
assert.ok(path.basename(path.dirname(file)).startsWith("saju-pg-"));
const db = await openDatabase();
const pair = () => ({ me: samplePerson(), other: samplePerson(true) });
async function manifest(db: Database) {
  const tables = (await db.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
  )).rows;
  assert.ok(tables.length >= 21);
  const out: Record<string, { rows: number; sha256: string }> = {};
  for (const { tablename } of tables) {
    // Catalog identifiers only, never input values. Sort full JSON to cover every row/column.
    assert.match(tablename, /^[a-z_]+$/);
    const row = (await one(db, `SELECT count(*)::int AS count,
      coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb)::text AS data
      FROM "${tablename}" t`))!;
    out[tablename] = { rows: row.count, sha256: createHash("sha256").update(row.data).digest("hex") };
  }
  return out;
}
try {
  if (phase === "seed") {
    const session = await s.newSession(db), owner = session.owner;
    const recovery = await s.recoveryCode(db, owner);
    const subject=randomUUID(),profile={displayName:"가상 춘배",avatarUrl:"https://k.kakaocdn.net/synthetic.jpg"};
    await bindIdentity(db,owner,await startIdentity(db,owner),subject,profile);
    const verifiedSession=await s.newSession(db,owner,subject);
    assert.equal(await hasKakaoSession(db,owner,s.hash(verifiedSession.secret)),true);
    const draft = pair();
    await s.saveDraft(db, owner, draft, 0);
    const free = await s.createComparison(db, owner, pair(), randomUUID(), true);
    await s.runJobs(db, owner);
    const active = await s.share(db, owner, free.id, ["호랑이", "친구"]);
    const revoked = await s.share(db, owner, free.id, ["호랑이", "친구"]);
    await s.revokeShare(db, owner, revoked.id);
    const expired = await s.share(db, owner, free.id, ["호랑이", "친구"]);
    await db.query("UPDATE shares SET expires_at=now()-interval '1 hour' WHERE id=$1", [expired.id]);
    const paid = async () => {
      const comparison = await s.createComparison(db, owner, pair(), randomUUID(), true);
      const order = (await one(db, "SELECT id FROM orders WHERE comparison_id=$1", [comparison.id]))!;
      await p.confirmPayment(db, owner, order.id, "mock_" + order.id, 2900);
      await s.runJobs(db, owner);
      return { comparison: comparison.id, order: order.id };
    };
    const purchased = await paid(), refunded = await paid();
    const refundedShare = await s.share(db, owner, refunded.comparison, ["호랑이", "친구"]);
    await p.refundPayment(db, owner, refunded.order);
    const pendingOwner = (await s.newSession(db)).owner;
    const pending = await s.createComparison(db, pendingOwner, pair(), randomUUID(), true);
    const fixture = { owner, subject, profile, verifiedSession:verifiedSession.secret, session: session.secret, recovery, draft, free: free.id,
      purchased, refunded, active, revoked, expired, refundedShare,
      pendingOwner, pending: pending.id,
      snapshot: await s.result(db, owner, free.id),
      purchasedSnapshot: await s.result(db, owner, purchased.comparison),
      tables: await manifest(db) };
    await writeFile(file, JSON.stringify(fixture), { mode: 0o600, flag: "wx" });
    console.log(`Restore fixture: ${Object.keys(fixture.tables).length} tables fingerprinted; synthetic data only.`);
  } else {
    const f = JSON.parse(await readFile(file, "utf8"));
    await assertMigrationsApplied(db);
    assert.deepEqual(await manifest(db), f.tables, "RESTORED_TABLE_DATA_MISMATCH");
    // pg_restore must preserve ACLs/RLS; the application never runs as the DB owner.
    await assert.rejects(db.query("CREATE TABLE forbidden_restore(id int)"), { code: "42501" });
    await assert.rejects(db.query("DROP TABLE accounts"), { code: "42501" });
    await assert.rejects(db.query("UPDATE schema_migrations SET checksum='bad'"), { code: "42501" });
    assert.equal(await s.sessionOwner(db, f.session), f.owner);
    assert.equal(await hasKakaoSession(db,f.owner,s.hash(f.verifiedSession)),true);
    assert.equal(await hasKakaoSession(db,f.owner,s.hash(f.session)),false);
    const state = await s.state(db, f.owner);
    assert.deepEqual(state.profile,f.profile);
    assert.deepEqual(state.draft, f.draft);
    assert.equal(state.revision, 1);
    assert.equal(state.free, "consumed");
    assert.deepEqual(await s.result(db, f.owner, f.free), f.snapshot);
    assert.deepEqual(await s.result(db, f.owner, f.purchased.comparison), f.purchasedSnapshot);
    await assert.rejects(s.result(db, f.pendingOwner, f.free), { code: "NOT_FOUND" });
    await assert.rejects(s.result(db, f.owner, f.refunded.comparison), { code: "NOT_FOUND" });
    for (const id of [f.purchased.order, f.refunded.order]) {
      const order = state.orders.find(o => o.id === id)!;
      assert.equal(order.state, id === f.purchased.order ? "paid" : "refunded");
    }
    const secret = (share: { path: string }) => share.path.slice(3);
    assert.ok(await s.publicShare(db, secret(f.active)));
    for (const share of [f.revoked, f.expired, f.refundedShare])
      assert.equal(await s.publicShare(db, secret(share)), null);
    const runtimeUrl = process.env.DATABASE_URL!;
    process.env.DATABASE_URL = runtimeUrl.replace("saju_runtime@", "saju_anon@");
    const anon = await openDatabase();
    try {
      for (const table of Object.keys(f.tables))
        assert.equal((await anon.query(`SELECT * FROM "${table}"`)).rows.length, 0);
      await assert.rejects(anon.query("INSERT INTO accounts(id) VALUES($1)", [randomUUID()]), { code: "42501" });
      assert.equal((await anon.query("UPDATE accounts SET kind='member' RETURNING id")).rows.length, 0);
    } finally { await anon.close(); process.env.DATABASE_URL = runtimeUrl; }
    // Resume a backed-up reservation exactly once, without recreating already purchased results.
    await s.runJobs(db, f.pendingOwner);
    assert.ok(await s.result(db, f.pendingOwner, f.pending));
    const claim = await one(db, "SELECT state,generation FROM free_claims WHERE owner_id=$1", [f.pendingOwner]);
    assert.equal(claim!.state, "consumed");
    await s.runJobs(db, f.pendingOwner);
    assert.deepEqual(await one(db, "SELECT state,generation FROM free_claims WHERE owner_id=$1", [f.pendingOwner]), claim);
    assert.equal((await db.query("SELECT * FROM results WHERE comparison_id=$1", [f.pending])).rows.length, 1);
    assert.deepEqual(await s.result(db, f.owner, f.free), f.snapshot);
    assert.deepEqual(await s.result(db, f.owner, f.purchased.comparison), f.purchasedSnapshot);
    const recovered=await s.recover(db,f.recovery);
    assert.equal(recovered.owner,f.owner);
    assert.equal(await hasKakaoSession(db,f.owner,s.hash(recovered.secret)),false);
    console.log(`Restore verified: all ${Object.keys(f.tables).length} table fingerprints, runtime/anonymous permissions, sessions/recovery/Kakao stamp and profile, drafts, paid/refunded entitlements, share revocation/expiry, ownership and one-time job resumption.`);
  }
} finally { await db.close(); }

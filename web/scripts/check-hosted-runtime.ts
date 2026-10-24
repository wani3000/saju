// Explicit, dedicated staging target only. Synthetic service checks roll back.
// This does not exercise browser authentication, a payment provider, or backups.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { assertMigrationsApplied, type Database } from "../src/server/db";
import * as service from "../src/server/service";
import { erasePersonalData } from "../src/server/operations";
import { samplePerson } from "../src/domain/model";
import {bindIdentity,startIdentity} from "../src/server/identity";
import {hasKakaoSession} from "../src/server/kakao-policy";

let step = "settings";
let pool: Pool | undefined, client: PoolClient | undefined, begun = false;
try {
  const args = process.argv.slice(2);
  assert.ok(args.length === 4 && args[0] === "--settings" && args[2] === "--project");
  const project = args[3], env = parseEnv(readFileSync(args[1], "utf8"));
  assert.match(project, /^[a-z]{20}$/);
  assert.equal(env.ALLOW_REMOTE_TEST, "true");
  assert.equal(env.SAJU_MODE, "research");
  assert.ok(env.DATABASE_URL);
  const url = new URL(env.DATABASE_URL);
  assert.equal(url.username, `saju_server.${project}`);
  assert.ok(url.hostname.endsWith(".pooler.supabase.com"));
  assert.equal(url.searchParams.get("sslmode"), "verify-full");
  assert.equal(env.SUPABASE_URL, `https://${project}.supabase.co`);
  step = "verified-tls";
  pool = new Pool({ connectionString: url.href, max: 1, connectionTimeoutMillis: 15000, statement_timeout: 15000 });
  client = await pool.connect();
  // Supavisor terminates TLS; pg_stat_ssl describes its internal DB connection.
  const stream = (client as unknown as { connection: { stream: { encrypted?: boolean; authorized?: boolean } } }).connection.stream;
  assert.equal(stream.encrypted, true);
  assert.equal(stream.authorized, true);
  step = "restricted-runtime-role";
  const role = (await client.query("SELECT current_user,rolsuper,rolcreatedb,rolcreaterole,rolbypassrls FROM pg_roles WHERE rolname=current_user")).rows[0];
  assert.equal(role.current_user, "saju_server");
  for (const key of ["rolsuper", "rolcreatedb", "rolcreaterole", "rolbypassrls"]) assert.equal(role[key], false);
  let sequence = 0;
  const db: Database = {
    query: (sql, params) => client!.query(sql, params), close: async () => {},
    transaction: async fn => {
      const name = `hosted_check_${++sequence}`;
      await client!.query(`SAVEPOINT ${name}`);
      try { const out = await fn(db); await client!.query(`RELEASE SAVEPOINT ${name}`); return out; }
      catch (error) { await client!.query(`ROLLBACK TO SAVEPOINT ${name}`); await client!.query(`RELEASE SAVEPOINT ${name}`); throw error; }
    },
  };
  step = "migration-checksums";
  await assertMigrationsApplied(db);
  const protectedTables = (await client.query("SELECT count(*)::int AS total,count(*) FILTER(WHERE c.relrowsecurity)::int AS protected FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'")).rows[0];
  assert.equal(protectedTables.total, 22); assert.equal(protectedTables.protected, 22);
  const before = (await client.query("SELECT count(*)::int AS n FROM accounts")).rows[0].n;
  await client.query("BEGIN"); begun = true;
  step = "ddl-denial";
  await assert.rejects(db.transaction(tx => tx.query("CREATE TABLE public.saju_permission_probe(id int)")), { code: "42501" });
  await assert.rejects(db.transaction(tx => tx.query("SELECT count(*) FROM auth.users")), { code: "42501" });
  step = "synthetic-sessions";
  const owner = await service.newSession(db), stranger = await service.newSession(db);
  step = "reading-request";
  const input = { me: samplePerson(), other: samplePerson(true) };
  const comparison = await service.createComparison(db, owner.owner, input, randomUUID(), "request-reading");
  step = "generation";
  assert.equal((await service.runJobs(db, owner.owner)).completed, 1);
  step = "saved-reading-and-ownership";
  const saved = await service.result(db, owner.owner, comparison.id);
  assert.ok(saved.reading.wholeChart);
  assert.equal(saved.me.timeKnown, false);
  await assert.rejects(service.result(db, stranger.owner, comparison.id), { code: "NOT_FOUND" });
  step = "share-and-revocation";
  const shared = await service.share(db, owner.owner, comparison.id, ["가", "나"]);
  const secret = shared.path.split("/").at(-1)!;
  assert.ok(await service.publicShare(db, secret));
  await service.revokeShare(db, owner.owner, shared.id);
  assert.equal(await service.publicShare(db, secret), null);
  step = "synthetic-returning-account";
  const subject = randomUUID();
  await bindIdentity(db,owner.owner,await startIdentity(db,owner.owner),subject,{displayName:'검증',avatarUrl:null});
  const returning = await bindIdentity(db,stranger.owner,await startIdentity(db,stranger.owner),subject);
  assert.equal(returning.owner,owner.owner);assert.equal(returning.ticket,undefined);
  assert.equal(await hasKakaoSession(db,stranger.owner,service.hash(stranger.secret)),false);
  const verified = await service.newSession(db,owner.owner,subject);
  assert.equal(await hasKakaoSession(db,owner.owner,service.hash(verified.secret)),true);
  assert.equal((await service.state(db,owner.owner)).free,'consumed');
  step = "synthetic-erasure";
  await erasePersonalData(db, owner.owner);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM withdrawal_requests WHERE owner_id=$1 AND subject=$2 AND state=\'pending\'',[owner.owner,subject])).rows[0].n,1);
  await assert.rejects(service.result(db, owner.owner, comparison.id), { code: "NOT_FOUND" });
  step = "fixture-rollback";
  await client.query("ROLLBACK"); begun = false;
  assert.equal((await client.query("SELECT count(*)::int AS n FROM accounts")).rows[0].n, before);
  console.log(JSON.stringify({ status: "passed", scope: "hosted-runtime-service-check", tlsVerified: true, restrictedRole: true,
    tablesWithRls: 22, migrationChecksumsVerified: true, ddlDenied: true, authSchemaDenied: true,
    reading: true, ownership: true, shareRevocation: true, returningAccount: true, guestNotAuthenticated: true,
    erasure: true, withdrawalRequestRecorded: true, fixtureRolledBack: true,
    browserOAuthVerified: false, paymentProviderVerified: false, hostedRestoreVerified: false }));
} catch (error) {
  const code = (error as { code?: unknown }).code;
  console.log(JSON.stringify({ status: "failed", step, code: typeof code === "string" && /^[A-Z0-9_]+$/.test(code) ? code : "CHECK_FAILED" }));
  process.exitCode = 1;
} finally {
  if (client) { if (begun) await client.query("ROLLBACK").catch(() => {}); client.release(); }
  await pool?.end();
}

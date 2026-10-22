import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { openDatabase, migrate, one, assertMigrationsApplied } from "../src/server/db";
import * as s from "../src/server/service";
import * as p from "../src/server/payments";
import { erasePersonalData, health } from "../src/server/operations";
import { samplePerson } from "../src/domain/model";
const admin = await openDatabase();
try {
  await Promise.all([migrate(admin), migrate(admin)]);
  await admin.query(
    "CREATE ROLE saju_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT",
  );
  await admin.query("REVOKE CREATE ON SCHEMA public FROM PUBLIC");
  await admin.query("GRANT USAGE ON SCHEMA public TO saju_runtime");
  await admin.query(
    "GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO saju_runtime",
  );
  await admin.query("REVOKE ALL ON schema_migrations FROM saju_runtime");
  await admin.query("GRANT SELECT ON schema_migrations TO saju_runtime");
  await admin.query(
    "GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO saju_runtime",
  );
  for (const table of [
    "accounts",
    "sessions",
    "drafts",
    "comparisons",
    "free_claims",
    "orders",
    "entitlements",
    "generation_jobs",
    "results",
    "shares",
    "payment_attempts",
    "payment_events",
    "mock_payments",
    "consent_records",
    "rate_limits",
    "auth_identities",
    "oauth_attempts",
    "merge_tickets",
    "operational_events",
    "nicepay_attempts",
    "schema_migrations",
  ])
    await admin.query(
      `CREATE POLICY saju_server_access ON ${table} TO saju_runtime USING (true) WITH CHECK (true)`,
    );
  await admin.query("CREATE ROLE saju_anon LOGIN NOSUPERUSER");
  await admin.query("GRANT USAGE ON SCHEMA public TO saju_anon");
  await admin.query(
    "GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO saju_anon",
  );
  process.env.DATABASE_URL = process.env.DATABASE_URL!.replace(
    "saju_admin@",
    "saju_runtime@",
  );
  const a = await openDatabase(),
    b = await openDatabase();
  try {
    await assertMigrationsApplied(a);
    await assert.rejects(a.query("CREATE TABLE forbidden(id int)"), {
      code: "42501",
    });
    await assert.rejects(a.query("DROP TABLE accounts"), { code: "42501" });
    await assert.rejects(
      a.query("UPDATE schema_migrations SET checksum='bad'"),
      { code: "42501" },
    );
    const owner = (await s.newSession(a)).owner;
    const pair = () => ({ me: samplePerson(), other: samplePerson(true) });
    const submissions = await Promise.allSettled(
      Array.from({ length: 12 }, (_, i) =>
        s.createComparison(i % 2 ? a : b, owner, pair(), randomUUID(), true),
      ),
    );
    assert.equal(submissions.filter((r) => r.status === "fulfilled").length, 1);
    const jobs = await Promise.all([
      s.claimJob(a, owner),
      s.claimJob(b, owner),
    ]);
    assert.equal(jobs.filter(Boolean).length, 1);
    await s.finishJob(b, jobs.find(Boolean)!);
    assert.equal((await s.state(a, owner)).results.length, 1);
    await s.recoveryCode(a, owner);
    const c = await s.createComparison(a, owner, pair(), randomUUID(), true);
    const o = (await one(a, "SELECT * FROM orders WHERE comparison_id=$1", [
      c.id,
    ]))!;
    await Promise.all([
      p.confirmPayment(a, owner, o.id, "mock_" + o.id, 2900),
      p.confirmPayment(b, owner, o.id, "mock_" + o.id, 2900),
    ]);
    assert.equal(
      (
        await a.query("SELECT * FROM entitlements WHERE comparison_id=$1", [
          c.id,
        ])
      ).rows.length,
      1,
    );
    const job = await s.claimJob(a, owner);
    await p.refundPayment(b, owner, o.id);
    assert.equal(await s.finishJob(a, job!), false);
    const guest = await s.newSession(a);
    await a.query(
      "UPDATE accounts SET created_at=now()-interval '40 days' WHERE id=$1",
      [guest.owner],
    );
    await a.query("DELETE FROM sessions WHERE owner_id=$1", [guest.owner]);
    const renew = await s.newSession(b, guest.owner);
    assert.equal(await erasePersonalData(a, guest.owner, true), false);
    assert.equal(await s.sessionOwner(a, renew.secret), guest.owner);
    const crashOwner = (await s.newSession(a)).owner;
    const crashComparison = await s.createComparison(
      a,
      crashOwner,
      pair(),
      randomUUID(),
      true,
    );
    for (let n = 0; n < 3; n++) {
      assert.ok(await s.claimJob(a, crashOwner));
      await b.query(
        "UPDATE generation_jobs SET lease_until=now()-interval '1 second' WHERE comparison_id=$1",
        [crashComparison.id],
      );
    }
    const check = spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/maintenance.ts", "--health"],
      { encoding: "utf8" },
    );
    assert.equal(check.status, 2);
    assert.equal(check.stderr, "");
    const report = JSON.parse(check.stdout);
    assert.equal(report.status, "needs_attention");
    assert.equal(report.jobs.expiredLeases, 1);
    assert.deepEqual(
      await Promise.all([s.claimJob(a, crashOwner), s.claimJob(b, crashOwner)]),
      [null, null],
    );
    const released = await one(
      a,
      "SELECT state,generation FROM free_claims WHERE owner_id=$1",
      [crashOwner],
    );
    assert.equal(released!.state, "available");
    assert.equal(released!.generation, 2);
    assert.equal(
      (await one(
        a,
        "SELECT attempts,state FROM generation_jobs WHERE comparison_id=$1",
        [crashComparison.id],
      ))!.state,
      "failed",
    );
    await s.retryJob(a, crashOwner, crashComparison.id);
    await s.runJobs(b, crashOwner);
    assert.ok(await s.result(a, crashOwner, crashComparison.id));
    assert.equal((await health(a)).status, "ok");
    console.log(
      "Concurrent exhausted-lease cleanup releases free reservation once; health CLI exits 2 until manual recovery succeeds.",
    );
    const runtimeUrl = process.env.DATABASE_URL!;
    process.env.DATABASE_URL = runtimeUrl.replace(
      "saju_runtime@",
      "saju_anon@",
    );
    const anon = await openDatabase();
    try {
      assert.equal((await anon.query("SELECT * FROM results")).rows.length, 0);
      assert.equal((await anon.query("SELECT * FROM accounts")).rows.length, 0);
      await assert.rejects(
        anon.query("INSERT INTO accounts(id) VALUES($1)", [randomUUID()]),
        { code: "42501" },
      );
      assert.equal(
        (await anon.query("UPDATE accounts SET kind='member' RETURNING id"))
          .rows.length,
        0,
      );
    } finally {
      await anon.close();
      process.env.DATABASE_URL = runtimeUrl;
    }
    console.log(
      "Isolated PostgreSQL anonymous role with table grants: RLS reads/writes denied.",
    );
    console.log(
      "PostgreSQL: two connection pools, 12 concurrent free requests, SKIP LOCKED, duplicate approval, refund fencing, active-guest retention and restricted-role DDL denial passed.",
    );
  } finally {
    await a.close();
    await b.close();
  }
} finally {
  await admin.close();
}

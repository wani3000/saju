import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { openDatabase, migrate, one } from "../src/server/db";
import * as s from "../src/server/service";
import * as p from "../src/server/payments";
import { erasePersonalData } from "../src/server/operations";
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
  process.env.DATABASE_URL = process.env.DATABASE_URL!.replace(
    "saju_admin@",
    "saju_runtime@",
  );
  const a = await openDatabase(),
    b = await openDatabase();
  try {
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

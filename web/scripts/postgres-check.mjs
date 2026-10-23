// Creates an isolated temporary cluster. Never connects to a user's configured DATABASE_URL.
import { mkdtemp, rm, readFile, writeFile, mkdir, chmod } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
const bin = process.env.PG_BIN ?? "/opt/homebrew/opt/postgresql@17/bin";
const dir = await mkdtemp(path.join(tmpdir(), "saju-pg-"));
// Do not inherit app/PG/auth/payment configuration from the caller or read .env.
const localEnv = Object.fromEntries(
  ["PATH", "HOME", "TMPDIR", "TEMP", "SystemRoot", "CI"].filter(k => process.env[k] !== undefined)
    .map(k => [k, process.env[k]]),
);
Object.assign(localEnv, {
  LC_ALL: "C", LANG: "C", SAJU_MODE: "research", PAYMENT_PROVIDER: "mock", SAJU_RESTORE_CHECK: "isolated-cluster",
  PGPASSFILE: path.join(dir, "no-password-file"),
  PGSERVICEFILE: path.join(dir, "no-service-file"),
});
function run(command, args, extra = {}) {
  const r = spawnSync(command, args, { encoding: "utf8", env: localEnv, ...extra });
  if (r.status !== 0)
    throw new Error(
      `${path.basename(command)} failed: ${r.stderr || r.stdout}`,
    );
  return r.stdout;
}
let started = false;
try {
  run(path.join(bin, "initdb"), [
    "-D",
    path.join(dir, "data"),
    "-A",
    "trust",
    "-U",
    "saju_admin",
    "--no-locale",
    "-E",
    "UTF8",
  ]);
  run(path.join(bin, "pg_ctl"), [
    "-D",
    path.join(dir, "data"),
    "-l",
    path.join(dir, "server.log"),
    "-o",
    `-k ${dir} -h '' -p 55439`,
    "-w",
    "start",
  ]);
  started = true;
  const url = `postgresql://saju_admin@localhost:55439/postgres?host=${encodeURIComponent(dir)}`;
  run(path.join(bin, "psql"), [
    "-X",
    url,
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    "CREATE DATABASE saju_test",
  ]);
  run(path.join(bin, "psql"), [
    "-X",
    url,
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    "CREATE DATABASE saju_restore",
  ]);
  const testUrl = url.replace("/postgres?", "/saju_test?"),
    restoreUrl = url.replace("/postgres?", "/saju_restore?");
  const uninitialized = spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/maintenance.ts", "--health"],
    {
      encoding: "utf8",
      timeout: 10000,
      env: { ...localEnv, DATABASE_URL: testUrl },
    },
  );
  assert.equal(uninitialized.status, 1);
  assert.equal(uninitialized.stderr, "");
  assert.deepEqual(JSON.parse(uninitialized.stdout), {
    status: "error",
    code: "OPERATION_FAILED",
  });
  console.log(
    run(
      process.execPath,
      ["--import", "tsx", "scripts/postgres-scenarios.ts"],
      { env: { ...localEnv, DATABASE_URL: testUrl } },
    ),
  );
  for (const args of [
    ["scripts/maintenance.ts", "--health"],
    ["scripts/maintenance.ts"],
    ["scripts/worker.ts"],
  ]) {
    const report = JSON.parse(
      run(process.execPath, ["--import", "tsx", ...args], {
        env: {
          ...localEnv,
          DATABASE_URL: testUrl.replace("saju_admin@", "saju_runtime@"),
        },
      }),
    );
    assert.equal((report.health ?? report).status, "ok");
  }
  console.log(
    "Operational CLIs: uninitialized DB exits 1 without raw errors; recovered DB exits 0.",
  );
  const fixture = path.join(dir, "restore-fixture.json");
  console.log(run(process.execPath, ["--import", "tsx", "scripts/restore-scenarios.ts", "seed", fixture], {
    env: { ...localEnv, DATABASE_URL: testUrl.replace("saju_admin@", "saju_runtime@") },
  }));
  run(path.join(bin, "pg_dump"), [
    "--format=custom",
    "--file",
    path.join(dir, "backup.dump"),
    "--dbname",
    testUrl,
  ]);
  await chmod(path.join(dir, "backup.dump"), 0o600);
  await mkdir(path.join(dir, "keys"), { mode: 0o700 });
  const backupKey = path.join(dir, "keys", "backup.key");
  await writeFile(backupKey, randomBytes(32), { mode: 0o600 });
  for (const args of [
    ["seal", "--input", path.join(dir, "backup.dump"), "--key-file", backupKey, "--output", path.join(dir, "encrypted.saju-backup")],
    ["open", "--input", path.join(dir, "encrypted.saju-backup"), "--key-file", backupKey, "--output", path.join(dir, "verified.dump")],
  ]) {
    const report = JSON.parse(run(process.execPath, ["--import", "tsx", "scripts/backup.ts", ...args]));
    assert.equal(report.status, "completed");
    assert.equal(report.externalCalls, 0);
  }
  assert.deepEqual(await readFile(path.join(dir, "verified.dump")), await readFile(path.join(dir, "backup.dump")));
  await rm(path.join(dir, "backup.dump"));
  run(path.join(bin, "pg_restore"), [
    "--exit-on-error",
    "--dbname",
    restoreUrl,
    path.join(dir, "verified.dump"),
  ]);
  const schema = db => run(path.join(bin, "pg_dump"), ["--schema-only", "--no-comments", "--dbname", db])
    // PostgreSQL 17+ random psql restriction keys are not schema differences.
    .split("\n").filter(line => !/^\\(?:un)?restrict /.test(line)).join("\n");
  assert.equal(schema(restoreUrl), schema(testUrl), "RESTORED_SCHEMA_ACL_POLICY_MISMATCH");
  console.log(run(process.execPath, ["--import", "tsx", "scripts/restore-scenarios.ts", "verify", fixture], {
    env: { ...localEnv, DATABASE_URL: restoreUrl.replace("saju_admin@", "saju_runtime@") },
  }));
  console.log("PostgreSQL separate-DB restore: schema, constraints, indexes, ACLs and RLS policies match; no hosted recovery approval implied.");
  console.log("Private encrypted backup: synthetic pg_dump sealed, authenticated and restored; temporary key and all copies removed on exit.");
} catch (error) {
  // This log belongs only to the owned synthetic cluster and contains no service configuration.
  if (!started) console.error(await readFile(path.join(dir, "server.log"), "utf8").catch(() => "Cluster startup failed before log creation."));
  throw error;
} finally {
  if (started)
    run(path.join(bin, "pg_ctl"), [
      "-D",
      path.join(dir, "data"),
      "-m",
      "fast",
      "-w",
      "stop",
    ]);
  await rm(dir, { recursive: true, force: true });
}

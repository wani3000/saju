// Creates an isolated temporary cluster. Never connects to a user's configured DATABASE_URL.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
const bin = process.env.PG_BIN ?? "/opt/homebrew/opt/postgresql@17/bin";
const dir = await mkdtemp(path.join(tmpdir(), "saju-pg-"));
function run(command, args, extra = {}) {
  const r = spawnSync(command, args, { encoding: "utf8", ...extra });
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
    url,
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    "CREATE DATABASE saju_test",
  ]);
  run(path.join(bin, "psql"), [
    url,
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    "CREATE DATABASE saju_restore",
  ]);
  const testUrl = url.replace("/postgres?", "/saju_test?"),
    restoreUrl = url.replace("/postgres?", "/saju_restore?");
  console.log(
    run(
      process.execPath,
      ["--import", "tsx", "scripts/postgres-scenarios.ts"],
      { env: { ...process.env, DATABASE_URL: testUrl } },
    ),
  );
  run(path.join(bin, "pg_dump"), [
    "--format=custom",
    "--file",
    path.join(dir, "backup.dump"),
    "--dbname",
    testUrl,
  ]);
  run(path.join(bin, "pg_restore"), [
    "--exit-on-error",
    "--dbname",
    restoreUrl,
    path.join(dir, "backup.dump"),
  ]);
  const sql =
    "SELECT jsonb_agg(to_jsonb(r) ORDER BY comparison_id)::text FROM results r";
  const before = run(path.join(bin, "psql"), [testUrl, "-Atc", sql]);
  const after = run(path.join(bin, "psql"), [restoreUrl, "-Atc", sql]);
  if (before !== after || before.trim() === "")
    throw new Error("BACKUP_RESTORE_MISMATCH");
  console.log(
    "PostgreSQL backup restored into a separate DB; immutable result snapshots match.",
  );
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

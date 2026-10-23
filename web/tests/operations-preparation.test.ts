import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, chmod, symlink, stat } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { backupCycle, backupCycleCli } from "../scripts/backup-cycle";
import { queueAlerts, alertQueueCli } from "../scripts/alert-queue";
import { withPrivateLock } from "../scripts/private-operations";
import { privateBackup } from "../scripts/private-backup";
const at = "2026-10-24T01:00:00Z";
async function fixture() {
  const dir = await mkdtemp(path.join(tmpdir(), "saju-ops-test-"));
  for (const name of ["source", "keys", "backups", "alerts"]) await mkdir(path.join(dir, name), { mode: 0o700 });
  const key = path.join(dir, "keys", "key"), input = path.join(dir, "source", "source.dump"), directory = path.join(dir, "backups");
  const content = Buffer.concat([Buffer.from("PGDMP-synthetic-only"), randomBytes(100000)]);
  await writeFile(key, randomBytes(32), { mode: 0o600 }); await writeFile(input, content, { mode: 0o600 });
  return { dir, key, input, directory, content, config: { kind: "backup-cycle-file-v1", input, snapshotAt: at, keyFile: key, keyVersion: "synthetic-v1", directory } };
}
const observation = (time = at, failing = true) => ({ kind: "operations-observation-v1", at: time,
  health: null, lastVerifiedBackupAt: failing ? null : time, lastRetentionSuccessAt: time });

test("backup cycle commits only after authenticated roundtrip and never claims restore or backup health", async () => {
  const f = await fixture();
  try {
    const report = await backupCycle(f.config, at);
    assert.equal(report.integrityChecked, true); assert.equal(report.restoreVerified, false); assert.equal(report.lastVerifiedBackupAt, null);
    assert.equal(report.externalCalls, 0); assert.equal(report.automaticallyDeleted, 0);
    const file = path.join(f.directory, "catalog.json"), catalog = JSON.parse(await readFile(file, "utf8"));
    assert.equal((await stat(file)).mode & 0o777, 0o600); assert.equal(catalog.entries[0].restoreVerifiedAt, null);
    assert.equal((await readdir(f.directory)).some(n => n.includes("verify") || n.endsWith("partial") || n.includes("lock")), false);
    const out = path.join(f.dir, "source", "verify.dump");
    await privateBackup("open", path.join(f.directory, `${catalog.entries[0].id}.saju-backup`), f.key, out);
    assert.deepEqual(await readFile(out), f.content); assert.deepEqual(await readFile(f.input), f.content);
    const before = await readFile(file);
    await assert.rejects(backupCycle(f.config, "2026-10-24T01:05:00Z"));
    assert.deepEqual(await readFile(file), before);
  } finally { await rm(f.dir, { recursive: true, force: true }); }
});

test("backup failures, stale source, unknown fields, unsafe paths and locks do not advance catalog", async () => {
  const f = await fixture();
  try {
    await assert.rejects(backupCycle(f.config, "2026-10-24T02:00:00.001Z"));
    await assert.rejects(backupCycle(f.config, "2026-10-24T00:59:59Z"));
    await assert.rejects(backupCycle({ ...f.config, uploadUrl: "synthetic-private" }, at));
    await chmod(f.key, 0o644); await assert.rejects(backupCycle(f.config, at)); await chmod(f.key, 0o600);
    await assert.rejects(backupCycle({ ...f.config, directory: path.dirname(f.key) }, at));
    await symlink(f.input, path.join(f.dir, "source", "link.dump"));
    await assert.rejects(backupCycle({ ...f.config, input: path.join(f.dir, "source", "link.dump") }, at));
    const fifo = path.join(f.dir,"source","not-a-file");
    assert.equal(spawnSync("mkfifo",["-m","600",fifo]).status,0);
    await assert.rejects(backupCycle({...f.config,input:fifo},at));
    assert.equal((await alertQueueCli(["--observation",fifo,"--directory",path.join(f.dir,"alerts")])).exitCode,1);
    await withPrivateLock(f.directory, async () => { await assert.rejects(backupCycle(f.config, at), { code: "EEXIST" }); });
    assert.deepEqual(await readdir(f.directory), []);
    await writeFile(path.join(f.directory, "catalog.json"), "corrupt", { mode: 0o600 });
    await assert.rejects(backupCycle(f.config, at));
    assert.deepEqual(await readdir(f.directory), ["catalog.json"]);
  } finally { await rm(f.dir, { recursive: true, force: true }); }
});

test("expired copy candidates remain encrypted and present; latest copy retained", async () => {
  const f = await fixture();
  try {
    await backupCycle({ ...f.config, snapshotAt: "2026-10-16T01:00:00Z" }, "2026-10-16T01:00:00Z");
    const first = JSON.parse(await readFile(path.join(f.directory, "catalog.json"), "utf8")).entries[0];
    const report = await backupCycle(f.config, at);
    assert.equal(report.expiredCopyCandidates, 1); assert.equal(report.catalogEntries, 2); assert.equal(report.automaticallyDeleted, 0);
    assert.equal((await stat(path.join(f.directory, `${first.id}.saju-backup`))).isFile(), true);
  } finally { await rm(f.dir, { recursive: true, force: true }); }
});

test("catalog capacity failure cleans its new encrypted file without losing prior success", async () => {
  const f = await fixture();
  try {
    await backupCycle({ ...f.config, snapshotAt: "2026-10-16T01:00:00Z" }, "2026-10-16T01:00:00Z");
    const file = path.join(f.directory, "catalog.json"), catalog = JSON.parse(await readFile(file,"utf8"));
    const original = catalog.entries[0];
    catalog.entries = Array.from({length:512},(_, i)=>({...original,id:i ? randomUUID():original.id}));
    await writeFile(file, JSON.stringify(catalog));
    const before = await readFile(file);
    await assert.rejects(backupCycle(f.config, at));
    assert.deepEqual(await readFile(file), before);
    assert.deepEqual((await readdir(f.directory)).sort(), ["catalog.json", original.id+".saju-backup"].sort());
  } finally { await rm(f.dir,{recursive:true,force:true}); }
});

test("alert queue survives restart, deduplicates one incident and keeps recovery separate without receipts", async () => {
  const f = await fixture(), directory = path.join(f.dir, "alerts"), file = path.join(directory, "alerts.json");
  try {
    await queueAlerts(observation(), directory);
    await queueAlerts(observation("2026-10-24T01:05:00Z"), directory);
    await queueAlerts(observation("2026-10-24T01:35:00Z"), directory);
    let state = JSON.parse(await readFile(file, "utf8"));
    assert.equal(state.candidates.filter((c: {code:string}) => c.code === "BACKUP_OVERDUE").length, 1);
    const report = await queueAlerts(observation("2026-10-24T01:40:00Z", false), directory);
    assert.equal(report.externalMessagesSent, 0); assert.equal(report.senderConfigured, false);
    state = JSON.parse(await readFile(file, "utf8"));
    assert.equal(state.candidates.filter((c: {code:string,event:string}) => c.code === "BACKUP_OVERDUE" && c.event === "recovery").length, 1);
    assert.equal(JSON.stringify(state).includes("delivered"), false);
    const before = await readFile(file);
    await assert.rejects(queueAlerts(observation("2026-10-24T01:40:00Z", false), directory));
    assert.deepEqual(await readFile(file), before);
    await withPrivateLock(directory, async () => { await assert.rejects(queueAlerts(observation("2026-10-24T01:45:00Z"), directory), { code: "EEXIST" }); });
  } finally { await rm(f.dir, { recursive: true, force: true }); }
});

test("queue overflow, symlink and public permissions fail without overwriting state", async () => {
  const f = await fixture(), directory = path.join(f.dir, "alerts"), file = path.join(directory, "alerts.json");
  try {
    await queueAlerts(observation(), directory);
    const state = JSON.parse(await readFile(file, "utf8"));
    state.candidates = Array.from({length:128}, (_, i) => ({ code:"BACKUP_OVERDUE",event:"problem",severity:"critical", at,incidentAt:`2026-10-23T01:00:${String(i % 60).padStart(2,"0")}Z` }));
    state.history.incidents = {}; await writeFile(file, JSON.stringify(state));
    const before = await readFile(file);
    await assert.rejects(queueAlerts(observation("2026-10-24T01:05:00Z"), directory));
    assert.deepEqual(await readFile(file), before);
    await rm(file); await symlink(f.input, file);
    await assert.rejects(queueAlerts(observation(), directory));
    assert.deepEqual(await readFile(f.input), f.content);
    await rm(file); await chmod(directory, 0o755);
    await assert.rejects(queueAlerts(observation(), directory));
  } finally { await rm(f.dir, { recursive: true, force: true }); }
});

test("new CLIs refuse typos without connections, paths, key bytes or raw exceptions", async () => {
  for (const result of [await backupCycleCli(["--confg", "synthetic-private"]), await alertQueueCli(["--observaton", "synthetic-private", "--directory", "synthetic-private"])]) {
    assert.equal(result.exitCode, 1); assert.equal(JSON.stringify(result).includes("synthetic-private"), false);
  }
  for (const script of ["run-backup-cycle.ts", "run-alert-queue.ts"]) {
    const result = spawnSync(process.execPath, ["--import", "tsx", `scripts/${script}`, "--invalid", "synthetic-private"], {encoding:"utf8"});
    assert.equal(result.status, 1); assert.equal(result.stderr, ""); assert.equal(result.stdout.includes("synthetic-private"), false);
  }
});

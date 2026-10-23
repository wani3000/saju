import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, readdir, chmod, rm, symlink, stat } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { privateBackup, backupCli } from "../scripts/private-backup";

async function fixture() {
  const dir = await mkdtemp(path.join(tmpdir(), "saju-backup-test-"));
  await mkdir(path.join(dir, "keys"), { mode: 0o700 });
  await mkdir(path.join(dir, "data"), { mode: 0o700 });
  const key = path.join(dir, "keys", "key"), input = path.join(dir, "data", "source.dump"), sealed = path.join(dir, "data", "encrypted.saju-backup"), output = path.join(dir, "data", "restored.dump");
  const content = Buffer.concat([Buffer.from("synthetic-private-birth-data"), randomBytes(250000)]);
  await writeFile(key, randomBytes(32), { mode: 0o600 });
  await writeFile(input, content, { mode: 0o600 });
  return { dir, key, input, sealed, output, content };
}

test("streamed encrypted backup roundtrips binary data, does not overwrite, and never publishes corrupted plaintext", async () => {
  const f = await fixture();
  try {
    const report = await privateBackup("seal", f.input, f.key, f.sealed);
    assert.equal(report.bytes, f.content.length);
    assert.equal((await stat(f.sealed)).mode & 0o777, 0o600);
    assert.equal((await readFile(f.sealed)).includes(Buffer.from("synthetic-private-birth-data")), false);
    await privateBackup("open", f.sealed, f.key, f.output);
    assert.deepEqual(await readFile(f.output), f.content);
    await assert.rejects(privateBackup("open", f.sealed, f.key, f.output));
    assert.deepEqual(await readFile(f.output), f.content);
    await rm(f.output);
    const corrupted = await readFile(f.sealed); corrupted[100] ^= 1; await writeFile(f.sealed, corrupted);
    await assert.rejects(privateBackup("open", f.sealed, f.key, f.output));
    assert.equal((await readdir(path.dirname(f.sealed))).some(n => n.includes("partial") || n === "restored.dump"), false);
  } finally { await rm(f.dir, { recursive: true, force: true }); }
});

test("wrong key, unsafe permissions, same key directory, symlinks, repository destinations and arbitrary CLI input fail closed", async () => {
  const f = await fixture();
  try {
    await privateBackup("seal", f.input, f.key, f.sealed);
    await writeFile(f.key, randomBytes(32));
    await assert.rejects(privateBackup("open", f.sealed, f.key, f.output));
    await chmod(f.key, 0o644);
    await assert.rejects(privateBackup("seal", f.input, f.key, f.output));
    await chmod(f.key, 0o600);
    await assert.rejects(privateBackup("seal", f.input, f.key, path.join(f.dir, "keys", "output")));
    await symlink(f.input, path.join(f.dir, "data", "symlink"));
    await assert.rejects(privateBackup("seal", path.join(f.dir, "data", "symlink"), f.key, f.output));
    await assert.rejects(privateBackup("seal", f.input, f.key, path.join(process.cwd(), "private-dump")));
    for (const args of [["seal", "private-secret"], ["--help"], ["seel", "--input", f.input, "--key-file", f.key, "--output", f.output]]) {
      const result = await backupCli(args);
      assert.equal(result.exitCode, 1);
      assert.equal(JSON.stringify(result).includes("private-secret"), false);
    }
  } finally { await rm(f.dir, { recursive: true, force: true }); }
});

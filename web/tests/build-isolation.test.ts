import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { inspectTracePaths, inspectBuild, prepareVercelMappings } from "../scripts/check-build-isolation.mjs";
const assets = ["../../certs/supabase-prod-ca-2021.crt", ...["001_core", "002_operations", "003_server_access", "004_kakao_profile"].map(n => `../../db/migrations/${n}.sql`)];
test("build audit keeps required CA/migrations and blocks private setup, review and data files without echoing paths", () => {
  assert.equal(inspectTracePaths(assets).status, "passed");
  for (const file of ["../../.env.staging.local", ".env.supabase-bootstrap.local", "../../.local-review/private.json", "..\\.data\\postgres\\secret", "../../.vercel/.env.production.local"]) {
    const report = inspectTracePaths([...assets, file]);
    assert.equal(report.status, "blocked"); assert.ok(report.codes.includes("PRIVATE_FILE_IN_BUILD"));
    assert.equal(JSON.stringify(report).includes(file), false);
  }
  assert.equal(inspectTracePaths([]).status, "blocked");
});
test("build audit reads real manifest structures for both Next traces and Vercel mappings", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "saju-build-audit-"));
  try {
    await mkdir(path.join(dir, "next")); await mkdir(path.join(dir, "vercel"));
    await writeFile(path.join(dir, "next", "route.js.nft.json"), JSON.stringify({ files: assets }));
    await writeFile(path.join(dir, "vercel", ".vc-config.json"), JSON.stringify({ filePathMap: Object.fromEntries(assets.map(f => [f, f])) }));
    assert.equal((await inspectBuild(path.join(dir, "next"))).status, "passed");
    assert.equal((await inspectBuild(path.join(dir, "vercel"), true)).status, "passed");
    await writeFile(path.join(dir, "vercel", ".env.synthetic.local"), "synthetic-only");
    assert.equal((await inspectBuild(path.join(dir, "vercel"), true)).status, "blocked");
    await writeFile(path.join(dir, "next", "route.js.nft.json"), JSON.stringify({ files: [...assets, "../../.env.supabase-bootstrap.local"] }));
    assert.equal((await inspectBuild(path.join(dir, "next"))).status, "blocked");
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test("build isolation CLI fails closed on unsupported flags without echoing arbitrary input", () => {
  const result = spawnSync(process.execPath, ["scripts/check-build-isolation.mjs", "--vercl", "synthetic-private-value"], { encoding: "utf8" });
  assert.equal(result.status, 1); assert.equal(result.stderr, "");
  assert.deepEqual(JSON.parse(result.stdout), { status: "invalid", code: "BUILD_ISOLATION_CHECK_FAILED" });
});
test("artifact preparation removes only absent private mappings and blocks real private files without deleting them", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "saju-artifact-prepare-"));
  try {
    const manifest = path.join(dir, ".vc-config.json");
    const mapping = Object.fromEntries([...assets.map(f => [f, f]), [".env.synthetic.local", ".env.synthetic.local"]]);
    await writeFile(manifest, JSON.stringify({ filePathMap: mapping }));
    assert.deepEqual(await prepareVercelMappings(dir), { prunedMappings: 1 });
    assert.equal((await inspectBuild(dir, true)).status, "passed");
    assert.deepEqual(await prepareVercelMappings(dir), { prunedMappings: 0 });
    await writeFile(manifest, JSON.stringify({ filePathMap: mapping }));
    await writeFile(path.join(dir, ".env.synthetic.local"), "synthetic-only");
    await assert.rejects(prepareVercelMappings(dir));
    assert.equal((await inspectBuild(dir, true)).status, "blocked");
  } finally { await rm(dir, { recursive: true, force: true }); }
});

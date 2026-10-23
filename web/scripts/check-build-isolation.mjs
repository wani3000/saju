import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function inspectTracePaths(files) {
  const paths = files.filter(f => typeof f === "string").map(f => f.replaceAll("\\", "/"));
  const privateFiles = paths.filter(f => f.split("/").some(s => s.startsWith(".env") || [".data", ".local-review", ".vercel"].includes(s)));
  const ca = paths.some(f => f.endsWith("/supabase-prod-ca-2021.crt") || f === "supabase-prod-ca-2021.crt");
  const migrations = new Set(paths.filter(f => /(?:^|\/)db\/migrations\/\d{3}_[a-z_]+\.sql$/.test(f)).map(f => path.posix.basename(f)));
  return { status: privateFiles.length || !ca || migrations.size < 4 ? "blocked" : "passed",
    codes: [...(privateFiles.length ? ["PRIVATE_FILE_IN_BUILD"] : []), ...(!ca ? ["PUBLIC_CA_MISSING"] : []), ...(migrations.size < 4 ? ["MIGRATIONS_MISSING"] : [])],
    privateFileCount: privateFiles.length, caIncluded: ca, migrationCount: migrations.size };
}
async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(file));
    else if (entry.isFile() || entry.isSymbolicLink()) files.push(file);
  }
  return files;
}
export async function inspectBuild(directory, vercel = false) {
  const all = await walk(directory);
  const manifests = all.filter(f => vercel ? path.basename(f) === ".vc-config.json" : f.endsWith(".nft.json"));
  if (!manifests.length) throw new Error("BUILD_MANIFESTS_REQUIRED");
  const paths = vercel ? all.map(file => path.relative(directory, file)) : [];
  for (const file of manifests) {
    const manifest = JSON.parse(await readFile(file, "utf8"));
    if (vercel) {
      paths.push(...Object.keys(manifest.filePathMap ?? {}), ...Object.values(manifest.filePathMap ?? {}));
    } else {
      if (!Array.isArray(manifest.files)) throw new Error("INVALID_BUILD_MANIFEST");
      paths.push(...manifest.files);
    }
  }
  return { scope: vercel ? "vercel-function-mappings" : "next-server-traces", manifests: manifests.length, ...inspectTracePaths(paths) };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length > 1 || args.some(a => a !== "--vercel")) throw new Error();
    const vercel = args.length === 1;
    const report = await inspectBuild(path.join(process.cwd(), vercel ? ".vercel/output/functions" : ".next/server"), vercel);
    console.log(JSON.stringify(report)); process.exitCode = report.status === "passed" ? 0 : 2;
  } catch {
    console.log(JSON.stringify({ status: "invalid", code: "BUILD_ISOLATION_CHECK_FAILED" })); process.exitCode = 1;
  }
}

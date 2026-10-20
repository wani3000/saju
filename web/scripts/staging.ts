import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { stagingPreflight } from "../src/server/staging-preflight";

try {
  const args = process.argv.slice(2);
  const start = args[0] === "--start";
  if (start) args.shift();
  if (args.length && (args.length !== 2 || args[0] !== "--settings" || !args[1])) throw new Error();
  // Parse as data; never source shell code, print values, or implicitly load another project's settings.
  const env = args.length ? { ...process.env, ...parseEnv(readFileSync(args[1], "utf8")) } : process.env;
  const report = stagingPreflight(env);
  console.log(JSON.stringify(report));
  if (report.issues.length) process.exitCode = 2;
  else if (start) {
    const require = createRequire(import.meta.url);
    const child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", "4180"],
      { stdio: "inherit", env });
    child.once("error", () => { console.log(JSON.stringify({ status: "error", code: "STAGING_START_FAILED" })); process.exitCode = 1; });
    child.once("exit", code => { process.exitCode = code ?? 1; });
    process.once("SIGTERM", () => child.kill("SIGTERM"));
    process.once("SIGINT", () => child.kill("SIGINT"));
  }
} catch {
  // File/parser/URL errors may contain credentials. Only stable diagnostics leave this command.
  console.log(JSON.stringify({ status: "error", code: "STAGING_CHECK_FAILED" }));
  process.exitCode = 1;
}

import {readFile} from "node:fs/promises";
import {parseEnv} from "node:util";
import {inspectNicepayRegistration} from "./nicepay-registration";
try {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== "--settings") throw new Error();
  const settings = {...process.env, ...parseEnv(await readFile(args[1], "utf8"))};
  const report = await inspectNicepayRegistration(settings);
  console.log(JSON.stringify(report));
  process.exitCode = report.status === "registered" ? 0 : 2;
} catch {
  console.log(JSON.stringify({status: "error", code: "REGISTRATION_CHECK_FAILED"}));
  process.exitCode = 1;
}

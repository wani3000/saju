import { operationalCli } from "../src/server/operational-command";
const result = await operationalCli("retention", process.argv.slice(2));
console.log(JSON.stringify(result.report));
process.exitCode = result.exitCode;

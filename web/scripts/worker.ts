import { operationalCommand } from "../src/server/operational-command";
const result = await operationalCommand("worker");
console.log(JSON.stringify(result.report));
process.exitCode = result.exitCode;

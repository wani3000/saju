import { alertQueueCli } from "./alert-queue";
const result = await alertQueueCli(process.argv.slice(2));
console.log(JSON.stringify(result.report));
process.exitCode = result.exitCode;

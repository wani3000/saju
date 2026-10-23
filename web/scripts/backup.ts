import { backupCli } from "./private-backup";
const result = await backupCli(process.argv.slice(2));
console.log(JSON.stringify(result.report));
process.exitCode = result.exitCode;

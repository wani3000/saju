import { backupCycleCli } from "./backup-cycle";
const result = await backupCycleCli(process.argv.slice(2));
console.log(JSON.stringify(result.report));
process.exitCode = result.exitCode;

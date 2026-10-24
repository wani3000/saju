import {pruneCli} from './backup-prune';
const result=await pruneCli(process.argv.slice(2));
console.log(JSON.stringify(result.report));process.exitCode=result.exitCode;

import {observeCli} from './observe-operations';
const result=await observeCli(process.argv.slice(2));
console.log(JSON.stringify(result.report));process.exitCode=result.exitCode;

import {readFileSync,statSync} from 'node:fs';
import {recoveryArguments,recoveryCompatibility} from '../src/server/recovery-compatibility';

try{
  const args=recoveryArguments(process.argv.slice(2));
  if(!args)throw new Error();
  const read=(file:string)=>{if(statSync(file).size>65536)throw new Error();return JSON.parse(readFileSync(file,'utf8'));};
  const report=recoveryCompatibility(read(args.target),read(args.inventory));
  console.log(JSON.stringify(report));process.exitCode=report.status==='compatible'?0:report.status==='blocked'?2:1;
}catch{
  // Paths, parser errors and arbitrary JSON can contain private identifiers or credentials.
  console.log(JSON.stringify({status:'invalid',codes:['INVALID_RECOVERY_INPUT'],scope:'artifact-compatibility-only',externalCalls:0,databaseConnections:0,productionRecoveryApproved:false}));process.exitCode=1;
}

import {constants} from 'node:fs';
import {open} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {Pool} from 'pg';
import {collectOperationObservation} from '../src/server/operation-observation';
import {queueAlerts} from './alert-queue';
import {privateDirectory} from './private-operations';
import {latestVerifiedBackup} from './backup-verification';
export async function observeCli(args:string[]){
 let pool:Pool|undefined;
 try{
  if(![6,8].includes(args.length)||args[0]!=='--settings'||args[2]!=='--project'||args[4]!=='--directory'||!/^[a-z]{20}$/.test(args[3]))throw new Error();
  if(args.length===8&&args[6]!=='--backup-directory')throw new Error();
  await privateDirectory(args[5]);
  if(args.length===8)await privateDirectory(args[7]);
  const f=await open(args[1],constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  let env:Record<string,string|undefined>;
  try{const s=await f.stat();if(!s.isFile()||s.size>65536||(s.mode&0o077)||(process.getuid&&s.uid!==process.getuid()))throw new Error();env=parseEnv(await f.readFile('utf8'));}finally{await f.close();}
  const u=new URL(env.DATABASE_URL??''),project=args[3];
  if(env.SAJU_MODE!=='research'||env.ALLOW_REMOTE_TEST!=='true'||env.SUPABASE_URL!==`https://${project}.supabase.co`||u.protocol!=='postgresql:'||u.username!==`saju_server.${project}`||u.port!=='6543'||!/^aws-\d+-ap-northeast-2\.pooler\.supabase\.com$/.test(u.hostname)||u.pathname!=='/postgres'||u.searchParams.get('sslmode')!=='verify-full'||u.searchParams.get('sslrootcert')!=='certs/supabase-prod-ca-2021.crt'||[...u.searchParams.keys()].length!==2)throw new Error();
  pool=new Pool({connectionString:u.href,max:1,connectionTimeoutMillis:15000,statement_timeout:15000,options:'-c default_transaction_read_only=on'});
  let observation;
  try {observation=await collectOperationObservation({query:(q,p)=>pool!.query(q,p),close:async()=>{},transaction:async fn=>{const c=await pool!.connect();try{await c.query('BEGIN READ ONLY');const result=await fn(c);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}});}
  catch {observation={kind:'operations-observation-v1',at:new Date().toISOString(),health:null,lastVerifiedBackupAt:null,lastRetentionSuccessAt:null};}
  if(args.length===8){try{observation.lastVerifiedBackupAt=await latestVerifiedBackup(args[7],observation.at);}catch{observation.lastVerifiedBackupAt=null;}}
  const queued=await queueAlerts(observation,args[5]);
  return {exitCode:observation.health?.status==='ok'&&queued.activeIncidents===0?0:2,report:{...queued,healthObserved:observation.health!==null,healthStatus:observation.health?.status??'unavailable',verifiedBackupEvidence:observation.lastVerifiedBackupAt!==null}};
 }catch{return {exitCode:1,report:{status:'error',code:'OPERATION_OBSERVATION_FAILED',externalMessagesSent:0}};}
 finally{await pool?.end().catch(()=>{});}
}

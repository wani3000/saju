import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {engineVersion} from '../src/server/engine';
import {supportedReadingVersions} from '../src/server/readings';

export function recoveryManifest(){
  const dir=new URL('../db/migrations/',import.meta.url);
  return {kind:'runtime-recovery-manifest-v1' as const,schemaMigrations:readdirSync(dir).filter(name=>/^\d{3}_[a-z_]+\.sql$/.test(name)).sort().map(name=>({name,sha256:createHash('sha256').update(readFileSync(new URL(name,dir))).digest('hex')})),engineVersions:[engineVersion],readingVersions:supportedReadingVersions};
}
if(process.argv[1]?.endsWith('recovery-manifest.ts')){
  const args=process.argv.slice(2);if(args.length>1||args.some(a=>a!=='--check'))throw new Error('INVALID_RECOVERY_ARGUMENTS');
  const text=JSON.stringify(recoveryManifest(),null,2)+'\n',file=new URL('../../docs/audits/runtime-recovery-manifest.json',import.meta.url);
  if(args.length){if(readFileSync(file,'utf8')!==text)throw new Error('RECOVERY_MANIFEST_STALE');}else writeFileSync(file,text);
  console.log(JSON.stringify({status:'source-manifest-only',externalCalls:0,databaseConnections:0}));
}

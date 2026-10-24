// Called only after an actual isolated DB restore, not via the file-cycle config.
import path from 'node:path';
import {z} from 'zod';
import {backupCatalogSchema,fingerprint} from './backup-cycle';
import {atomicPrivateJson,privateDirectory,readPrivateJson,withPrivateLock} from './private-operations';
export async function recordVerifiedRestore(directory:string,sourceSha256:string,snapshotAt:string,at=new Date().toISOString()){
 const parent=await privateDirectory(directory);z.string().regex(/^[a-f0-9]{64}$/).parse(sourceSha256);z.string().datetime({offset:true}).parse(at);
 return withPrivateLock(parent,async()=>{
  const file=path.join(parent,'catalog.json'),c=backupCatalogSchema.parse(await readPrivateJson(file));
  if(c.prunePending?.length)throw new Error('PRUNE_RECOVERY_REQUIRED');
  const matches=c.entries.filter(e=>e.snapshotAt===snapshotAt&&e.sourceSha256===sourceSha256);
  if(matches.length!==1)throw new Error('EXACT_BACKUP_REQUIRED');
  const entry=matches[0];if(Date.parse(at)<Date.parse(entry.completedAt)||Date.parse(at)>Date.now()+1000)throw new Error('INVALID_VERIFICATION_TIME');
  if((await fingerprint(path.join(parent,entry.id+'.saju-backup'))).sha256!==entry.encryptedSha256)throw new Error('BACKUP_HASH_MISMATCH');
  entry.restoreVerifiedAt=at;await atomicPrivateJson(file,c);
  return {scope:'public-app-schema-isolated-restore',verifiedBackupSnapshotAt:entry.snapshotAt,authSchemaVerified:false,externalProviderStateVerified:false};
 });
}
export async function latestVerifiedBackup(directory:string,now=new Date().toISOString()){
 const parent=await privateDirectory(directory);z.string().datetime({offset:true}).parse(now);
 return withPrivateLock(parent,async()=>{
  const c=backupCatalogSchema.parse(await readPrivateJson(path.join(parent,'catalog.json')));
  if(c.prunePending?.length)throw new Error('PRUNE_RECOVERY_REQUIRED');
  const latest=c.entries.filter(e=>e.restoreVerifiedAt).sort((a,b)=>Date.parse(b.snapshotAt)-Date.parse(a.snapshotAt))[0];
  if(!latest)return null;
  if(Date.parse(latest.snapshotAt)>Date.parse(latest.completedAt)||Date.parse(latest.restoreVerifiedAt!)<Date.parse(latest.completedAt)||Date.parse(latest.restoreVerifiedAt!)>Date.parse(now))throw new Error('INVALID_BACKUP_TIMES');
  if((await fingerprint(path.join(parent,latest.id+'.saju-backup'))).sha256!==latest.encryptedSha256)throw new Error('BACKUP_HASH_MISMATCH');
  return latest.snapshotAt;
 });
}
export function hostedBackupArguments(args:string[]){
 if(![7,13].includes(args.length)||args[0]!=='--settings'||args[2]!=='--bootstrap'||args[4]!=='--project'||args[6]!=='--private-local-copy')throw new Error('INVALID_HOSTED_BACKUP_ARGUMENTS');
 if(args.length===7)return null;
 if(args[7]!=='--backup-directory'||args[9]!=='--key-file'||args[11]!=='--key-version'||!path.isAbsolute(args[8])||!path.isAbsolute(args[10])||!/^[A-Za-z0-9_-]{1,32}$/.test(args[12]))throw new Error('INVALID_HOSTED_BACKUP_ARGUMENTS');
 return {directory:args[8],keyFile:args[10],keyVersion:args[12]};
}

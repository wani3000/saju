import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm,unlink,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';
import {recordVerifiedRestore,latestVerifiedBackup,hostedBackupArguments} from '../scripts/backup-verification';
import {backupCycle} from '../scripts/backup-cycle';
import {pruneBackups,pruneCli} from '../scripts/backup-prune';
import {observeCli} from '../scripts/observe-operations';
import {validateRecoveryOverlay,applyIsolatedRecoveryOverlay} from '../src/server/recovery-overlay';
import {collectOperationObservation} from '../src/server/operation-observation';
import {openDatabase,migrate,one} from '../src/server/db';
const now='2026-10-24T01:00:00Z',old='2026-10-16T01:00:00Z';
async function fixture(){
 const dir=await mkdtemp(path.join(tmpdir(),'saju-rotation-test-'));
 for(const p of ['source','keys','backups'])await mkdir(path.join(dir,p),{mode:0o700});
 const input=path.join(dir,'source','source.dump'),keyFile=path.join(dir,'keys','key'),directory=path.join(dir,'backups');
 await writeFile(input,randomBytes(4096),{mode:0o600});await writeFile(keyFile,randomBytes(32),{mode:0o600});
 const config={kind:'backup-cycle-file-v1',input,keyFile,keyVersion:'synthetic-v1',directory};
 await backupCycle({...config,snapshotAt:old},old);await backupCycle({...config,snapshotAt:now},now);
 const file=path.join(directory,'catalog.json'),catalog=JSON.parse(await readFile(file,'utf8'));
 return {dir,directory,config,file,catalog};
}
test('rotation plans without mutation, explicitly removes expired copies, and keeps the recent verified bytes',async()=>{
 const f=await fixture();try{
  const before=await readFile(f.file);const planned=await pruneBackups(f.directory,false,now);
  assert.equal(planned.candidates,1);assert.deepEqual(await readFile(f.file),before);
  const done=await pruneBackups(f.directory,true,now);assert.equal(done.removed,1);
  const c=JSON.parse(await readFile(f.file,'utf8'));assert.equal(c.entries.length,1);assert.equal(c.entries[0].id,f.catalog.entries[1].id);
  assert.deepEqual((await readdir(f.directory)).sort(),['catalog.json',c.entries[0].id+'.saju-backup'].sort());
  assert.equal((await pruneBackups(f.directory,true,now)).removed,0);
 }finally{await rm(f.dir,{recursive:true,force:true});}
});
test('rotation refuses corrupt files, missing unplanned copies, symlinks, and losing the last recent backup',async()=>{
 const f=await fixture();try{
  const file=path.join(f.directory,f.catalog.entries[0].id+'.saju-backup'),original=await readFile(file),before=await readFile(f.file);
  await writeFile(file,'corrupt');await assert.rejects(pruneBackups(f.directory,true,now));assert.deepEqual(await readFile(f.file),before);
  await unlink(file);await assert.rejects(pruneBackups(f.directory,true,now));
  await symlink(f.config.input,file);await assert.rejects(pruneBackups(f.directory,true,now));await unlink(file);await writeFile(file,original,{mode:0o600});
  await assert.rejects(pruneBackups(f.directory,true,'2026-11-10T01:00:00Z'));
  assert.deepEqual(await readFile(f.file),before);
 }finally{await rm(f.dir,{recursive:true,force:true});}
});
test('interrupted rotation resumes already removed files, blocks backup cycles, and refuses retained IDs',async()=>{
 const f=await fixture();try{
  f.catalog.prunePending=[f.catalog.entries[0].id];await writeFile(f.file,JSON.stringify(f.catalog));
  await unlink(path.join(f.directory,f.catalog.entries[0].id+'.saju-backup'));
  await assert.rejects(backupCycle({...f.config,snapshotAt:'2026-10-24T02:00:00Z'},'2026-10-24T02:00:00Z'));
  assert.equal((await pruneBackups(f.directory,true,now)).removed,1);
  const c=JSON.parse(await readFile(f.file,'utf8'));c.prunePending=[c.entries[0].id];await writeFile(f.file,JSON.stringify(c));
  await assert.rejects(pruneBackups(f.directory,true,now));
 }finally{await rm(f.dir,{recursive:true,force:true});}
});
test('read-only observation uses actual DB time and retention success, never writes rows or infers a backup',async()=>{
 const db=await openDatabase('memory://');try{
  await migrate(db);await db.query("INSERT INTO operational_events(kind,outcome) VALUES('retention','completed')");
  const before=(await one(db,'SELECT count(*)::int AS n FROM operational_events'))!.n;
  const report=await collectOperationObservation(db);
  assert.equal(report.health!.status,'ok');assert.ok(report.lastRetentionSuccessAt);assert.equal(report.lastVerifiedBackupAt,null);
  assert.equal((await one(db,'SELECT count(*)::int AS n FROM operational_events'))!.n,before);
  await assert.rejects(collectOperationObservation({...db,transaction:async fn=>db.transaction(tx=>fn({query:async()=>{throw new Error('synthetic-private');}}))}));
 }finally{await db.close();}
});
test('overlay rejects stale/future snapshots, unknown fields, duplicate IDs, bad ownership and non-isolated targets',async()=>{
 const owner=randomUUID(),id=randomUUID(),overlay={kind:'recovery-overlay-v1',capturedAt:now,accounts:[{id:owner,erased:false}],comparisons:[{id,owner,erased:true}],orders:[]};
 assert.equal(validateRecoveryOverlay(overlay,old,now).comparisons.length,1);
 for(const raw of [{...overlay,birth:'private'},{...overlay,accounts:[...overlay.accounts,...overlay.accounts]},{...overlay,comparisons:[{id,owner:randomUUID(),erased:true}]}])assert.throws(()=>validateRecoveryOverlay(raw,old,now));
 assert.throws(()=>validateRecoveryOverlay(overlay,old,'2026-10-24T01:15:00.001Z'));
 assert.throws(()=>validateRecoveryOverlay(overlay,'2026-10-24T01:01:00Z',now));
 const db=await openDatabase('memory://');try{await assert.rejects(applyIsolatedRecoveryOverlay(db,overlay,old,now));}finally{await db.close();}
});
test('rotation and observation reject mistyped flags without changing files or connecting',async()=>{
 for(const result of [await pruneCli(['--directory','private','--aply']),await observeCli(['--setings','private'])]){
  assert.equal(result.exitCode,1);assert.equal(JSON.stringify(result).includes('private'),false);
 }
});

test('only an exact restore receipt can advance backup evidence; missing or corrupt copies are refused',async()=>{
 const f=await fixture();try{
  assert.equal(await latestVerifiedBackup(f.directory,now),null);
  await assert.rejects(recordVerifiedRestore(f.directory,'0'.repeat(64),now,now));
  await recordVerifiedRestore(f.directory,f.catalog.entries[1].sourceSha256,now,now);
  assert.equal(await latestVerifiedBackup(f.directory,now),now);
  await writeFile(path.join(f.directory,f.catalog.entries[1].id+'.saju-backup'),'corrupt');
  await assert.rejects(latestVerifiedBackup(f.directory,now));
 }finally{await rm(f.dir,{recursive:true,force:true});}
});
test('hosted backup retention flags fail closed rather than silently running another mode',()=>{
 const base=['--settings','private','--bootstrap','private','--project','a'.repeat(20),'--private-local-copy'];
 assert.equal(hostedBackupArguments(base),null);
 assert.ok(hostedBackupArguments([...base,'--backup-directory','/private/data','--key-file','/private/keys/key','--key-version','v1']));
 for(const args of [[...base,'--backup-directry','/private/data','--key-file','/private/keys/key','--key-version','v1'],[...base,'--backup-directory','relative','--key-file','/private/keys/key','--key-version','v1'],[...base,'--unknown']])assert.throws(()=>hostedBackupArguments(args));
});

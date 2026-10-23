import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {recoveryCompatibility,recoveryArguments} from '../src/server/recovery-compatibility';
import {recoveryManifest} from '../scripts/recovery-manifest';
import {reviewedDialogueVersion} from '../src/domain/reviewed-dialogue';
import {coherentReadingVersion} from '../src/domain/coherent-reading';

test('rollback refuses a v8 worker when new v9 jobs exist; current runtime supports both snapshot generations',()=>{
  const target=recoveryManifest(),inventory={kind:'recovery-inventory-v1',schemaMigrations:target.schemaMigrations,storedEngineVersions:target.engineVersions,storedReadingVersions:[coherentReadingVersion],pendingReadingVersions:[reviewedDialogueVersion]};
  const old={...target,readingVersions:target.readingVersions.filter(v=>v!==reviewedDialogueVersion)};
  assert.deepEqual(recoveryCompatibility(old,inventory).codes,['UNSUPPORTED_PENDING_READING_VERSION']);
  assert.equal(recoveryCompatibility(target,inventory).status,'compatible');
  inventory.storedReadingVersions=[reviewedDialogueVersion];inventory.pendingReadingVersions=[];
  assert.deepEqual(recoveryCompatibility(old,inventory).codes,['UNSUPPORTED_STORED_READING_VERSION']);
  assert.equal(recoveryCompatibility(target,inventory).productionRecoveryApproved,false);
});
test('schema drift, unknown engines and malformed or duplicate records fail closed without exposing input',()=>{
  const target=recoveryManifest(),inventory={kind:'recovery-inventory-v1',schemaMigrations:structuredClone(target.schemaMigrations),storedEngineVersions:['unknown-engine'],storedReadingVersions:[],pendingReadingVersions:[]};
  inventory.schemaMigrations[0].sha256='0'.repeat(64);
  assert.deepEqual(recoveryCompatibility(target,inventory).codes,['MIGRATION_MISMATCH','UNSUPPORTED_ENGINE_VERSION']);
  assert.equal(recoveryCompatibility(target,{...inventory,private:'synthetic-secret'}).status,'invalid');
  assert.equal(recoveryCompatibility({...target,schemaMigrations:[target.schemaMigrations[0],target.schemaMigrations[0]]},inventory).status,'invalid');
  assert.doesNotMatch(JSON.stringify(recoveryCompatibility(target,{private:'synthetic-secret'})),/synthetic-secret/);
});
test('offline recovery CLI refuses extra/unknown arguments before reading files and never opens a DB',()=>{
  for(const args of [[],['--target','x','--inventory','y','--apply'],['--target','x','--input','y']])assert.equal(recoveryArguments(args),null);
  const result=spawnSync(process.execPath,['--import','tsx','scripts/check-recovery-compatibility.ts','--target','synthetic-private-path','--inventory','missing','--apply'],{encoding:'utf8',timeout:10000,env:{NODE_ENV:'test',PATH:process.env.PATH,HOME:process.env.HOME,DATABASE_URL:'not-a-database-url'}});
  assert.equal(result.status,1);assert.equal(result.stderr,'');assert.doesNotMatch(result.stdout,/synthetic-private-path|not-a-database-url/);assert.equal(JSON.parse(result.stdout).databaseConnections,0);
});
test('offline recovery CLI returns 0/2/1 for valid, incompatible and oversized private metadata',()=>{
  const dir=mkdtempSync(path.join(tmpdir(),'saju-recovery-metadata-'));
  try{
    const target=recoveryManifest(),inventory={kind:'recovery-inventory-v1',schemaMigrations:target.schemaMigrations,storedEngineVersions:target.engineVersions,storedReadingVersions:[coherentReadingVersion],pendingReadingVersions:[reviewedDialogueVersion]};
    const targetFile=path.join(dir,'target.json'),inventoryFile=path.join(dir,'inventory.json');
    const write=(file:string,value:unknown)=>writeFileSync(file,JSON.stringify(value),{mode:0o600});
    write(targetFile,target);write(inventoryFile,inventory);
    const run=()=>spawnSync(process.execPath,['--import','tsx','scripts/check-recovery-compatibility.ts','--target',targetFile,'--inventory',inventoryFile],{encoding:'utf8',timeout:10000,env:{NODE_ENV:'test',PATH:process.env.PATH,HOME:process.env.HOME,DATABASE_URL:'not-a-database-url'}});
    assert.equal(run().status,0);
    write(targetFile,{...target,readingVersions:target.readingVersions.filter(v=>v!==reviewedDialogueVersion)});
    const blocked=run();assert.equal(blocked.status,2);assert.equal(JSON.parse(blocked.stdout).databaseConnections,0);
    write(inventoryFile,{payload:'x'.repeat(70000)});
    const invalid=run();assert.equal(invalid.status,1);assert.equal(invalid.stderr,'');assert.doesNotMatch(invalid.stdout,/payload|not-a-database-url/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});

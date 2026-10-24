import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase,migrate,assertMigrationsApplied,one} from '../src/server/db';
test('external startup rejects an unmigrated database without creating schema',async()=>{
 const db=await openDatabase('memory://');
 try{
  await assert.rejects(assertMigrationsApplied(db),{message:'RUN_MIGRATIONS_FIRST'});
  assert.equal((await one(db,"SELECT to_regclass('public.schema_migrations') AS ledger"))?.ledger,null);
 }finally{await db.close();}
});
test('profile migration is required and verification neither repairs missing entries nor changes data',async()=>{
 const db=await openDatabase('memory://');
 try{
  await migrate(db);await assertMigrationsApplied(db);
  await db.query("DELETE FROM schema_migrations WHERE name='004_kakao_profile.sql'");
  await assert.rejects(assertMigrationsApplied(db),{message:'RUN_MIGRATIONS_FIRST'});
  assert.equal(await one(db,"SELECT name FROM schema_migrations WHERE name='004_kakao_profile.sql'"),undefined);
 }finally{await db.close();}
});
test('runtime verification refuses altered migration evidence instead of changing its checksum',async()=>{
 const db=await openDatabase('memory://');
 try{
  await migrate(db);
  await db.query("UPDATE schema_migrations SET checksum='changed' WHERE name='004_kakao_profile.sql'");
  await assert.rejects(assertMigrationsApplied(db),{message:'MIGRATION_CHECKSUM_CHANGED'});
  assert.equal((await one(db,"SELECT checksum FROM schema_migrations WHERE name='004_kakao_profile.sql'"))?.checksum,'changed');
 }finally{await db.close();}
});
test('external startup requires the withdrawal ledger migration without repairing it',async()=>{
 const db=await openDatabase('memory://');
 try{
  await migrate(db);
  await db.query("DELETE FROM schema_migrations WHERE name='005_withdrawal_requests.sql'");
  await assert.rejects(assertMigrationsApplied(db),{message:'RUN_MIGRATIONS_FIRST'});
  assert.equal(await one(db,"SELECT name FROM schema_migrations WHERE name='005_withdrawal_requests.sql'"),undefined);
 }finally{await db.close();}
});

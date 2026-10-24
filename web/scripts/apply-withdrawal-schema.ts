// Additive migration on the explicitly named, dedicated research staging only.
// No account/provider API, row deletion, or credential/role creation.
import assert from 'node:assert/strict';
import { readFile, lstat } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { Client } from 'pg';
import { migrate, assertMigrationsApplied, type Database } from '../src/server/db';
import { hostedRestoreTarget } from './hosted-restore-target';
let client: Client | undefined, begun = false;
try {
  const args=process.argv.slice(2);
  assert.ok(args.length===7&&args[0]==='--settings'&&args[2]==='--bootstrap'&&args[4]==='--project'&&args[6]==='--apply-additive-schema');
  async function settings(file:string) {
    const s=await lstat(file);assert.ok(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&(s.mode&0o777)===0o600&&s.uid===process.getuid?.());
    return parseEnv(await readFile(file,'utf8'));
  }
  const runtime=await settings(args[1]),bootstrap=await settings(args[3]);
  const target=hostedRestoreTarget(runtime,bootstrap,args[5]);
  client=new Client({connectionString:target.href,connectionTimeoutMillis:15000,statement_timeout:15000});await client.connect();
  const tls=(client as unknown as {connection:{stream:{authorized?:boolean;encrypted?:boolean}}}).connection.stream;
  assert.ok(tls.encrypted&&tls.authorized);
  await client.query('BEGIN');begun=true;
  await client.query('SET LOCAL lock_timeout=\'5s\'');
  await client.query('SELECT pg_advisory_xact_lock(73410614)');
  const applied=(await client.query('SELECT name FROM schema_migrations ORDER BY name')).rows.map(r=>r.name);
  const expected=['001_core.sql','002_operations.sql','003_server_access.sql','004_kakao_profile.sql'];
  assert.deepEqual(applied.filter(n=>n!=='005_withdrawal_requests.sql'),expected);
  const db:Database={query:(s,p)=>client!.query(s,p),close:async()=>{},transaction:async fn=>{
    await client!.query('SAVEPOINT schema_apply');
    try { const value=await fn(client!);await client!.query('RELEASE SAVEPOINT schema_apply');return value; }
    catch(error){await client!.query('ROLLBACK TO SAVEPOINT schema_apply');throw error;}
  }};
  await migrate(db);await assertMigrationsApplied(db);
  // Fail if future source migrations have silently expanded this operation.
  assert.deepEqual((await db.query('SELECT name FROM schema_migrations ORDER BY name')).rows.map(r=>r.name),[...expected,'005_withdrawal_requests.sql']);
  await db.query('REVOKE ALL ON withdrawal_requests FROM PUBLIC,anon,authenticated');
  await db.query('GRANT SELECT,INSERT,UPDATE ON withdrawal_requests TO saju_runtime');
  if(!(await db.query("SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='withdrawal_requests' AND policyname='saju_server_access'")).rows.length)
    await db.query('CREATE POLICY saju_server_access ON withdrawal_requests TO saju_runtime USING (true) WITH CHECK (true)');
  assert.equal((await db.query("SELECT relrowsecurity FROM pg_class WHERE oid='public.withdrawal_requests'::regclass")).rows[0].relrowsecurity,true);
  await client.query('COMMIT');begun=false;
  console.log(JSON.stringify({status:'applied',migrations:5,rls:true,providerCalls:0,accountsDeleted:0,credentialsCreated:0}));
} catch {
  if(begun)await client?.query('ROLLBACK').catch(()=>{});
  console.log(JSON.stringify({status:'error',code:'WITHDRAWAL_SCHEMA_APPLY_FAILED'}));process.exitCode=1;
} finally {await client?.end();}

// Read-only hosted snapshot -> private, socket-only disposable local PostgreSQL.
// Never restore into a supplied URL. Never print SQL errors, row data or credentials.
import assert from "node:assert/strict";
import {mkdtemp,readFile,writeFile,stat,rm,chmod} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {execFile} from "node:child_process";
import {parseEnv,promisify} from "node:util";
import {Client} from "pg";
import {assertMigrationsApplied} from "../src/server/db";
import {health} from "../src/server/operations";
import {hostedRestoreTarget} from "./hosted-restore-target";

const exec = promisify(execFile);
const bin = process.env.PG_BIN ?? "/opt/homebrew/opt/postgresql@17/bin";
const env = Object.fromEntries(["PATH","HOME","TMPDIR","TEMP","SystemRoot"].filter(k=>process.env[k]!==undefined).map(k=>[k,process.env[k]]));
let step="settings", dir:string|undefined, started=false, startAttempted=false, remote:Client|undefined, local:Client|undefined;
let report:Record<string,unknown>|undefined;
const startedAt=Date.now();
async function privateSettings(file:string) {
  const info=await stat(file);
  assert.equal(info.mode & 0o777,0o600);
  if(process.getuid)assert.equal(info.uid,process.getuid());
  return parseEnv(await readFile(file,"utf8"));
}
async function run(command:string,args:string[],extra:Record<string,string>={}) {
  const result=await exec(path.join(bin,command),args,{env:{...env,...extra,NODE_ENV:"test"},encoding:"utf8",timeout:90000,maxBuffer:8*1024*1024});
  if(command==="pg_dump")assert.equal(result.stderr.trim(),"","DUMP_WARNINGS_REQUIRE_REVIEW");
  return result.stdout;
}
const identifier=(name:string)=>'"'+name.replaceAll('"','""')+'"';
const tablesSql="SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname";
async function manifest(db:Client,tables:string[]) {
  const out:Record<string,unknown>={};
  for(const table of tables){
    // Hash inside PostgreSQL: actual profile/session/birth content never enters stdout or JSON files.
    out[table]=(await db.query(`SELECT count(*)::int AS rows,
      encode(sha256(convert_to(coalesce(string_agg(to_jsonb(t)::text,E'\\n' ORDER BY to_jsonb(t)::text),''),'UTF8')),'hex') AS digest
      FROM public.${identifier(table)} t`)).rows[0];
  }
  return out;
}
async function schema(db:Client) {
  const queries = [
    `SELECT c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner) AS owner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','S') ORDER BY c.relname`,
    `SELECT table_name,column_name,ordinal_position,column_default,is_nullable,data_type,udt_name FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position`,
    `SELECT c.relname,k.conname,pg_get_constraintdef(k.oid) AS definition FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.relname,k.conname`,
    `SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname`,
    `SELECT tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname`,
    `SELECT c.relname,pg_get_userbyid(a.grantor) AS grantor,CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,a.privilege_type,a.is_grantable FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(c.relacl) a WHERE n.nspname='public' ORDER BY 1,2,3,4,5`,
    `SELECT pg_get_userbyid(d.defaclrole) AS owner,d.defaclobjtype,pg_get_userbyid(a.grantor) AS grantor,CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,a.privilege_type,a.is_grantable FROM pg_default_acl d JOIN pg_namespace n ON n.oid=d.defaclnamespace CROSS JOIN LATERAL aclexplode(d.defaclacl) a WHERE n.nspname='public' ORDER BY 1,2,3,4,5,6`,
    `SELECT pg_get_userbyid(a.grantor) AS grantor,CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,a.privilege_type,a.is_grantable,pg_get_userbyid(n.nspowner) AS owner FROM pg_namespace n CROSS JOIN LATERAL aclexplode(n.nspacl) a WHERE n.nspname='public' ORDER BY 1,2,3,4`,
  ];
  const out=[];
  for(const sql of queries)out.push((await db.query(sql)).rows);
  return out;
}
try {
  const args=process.argv.slice(2);
  assert.ok(args.length===7 && args[0]==="--settings" && args[2]==="--bootstrap" && args[4]==="--project" && args[6]==="--private-local-copy");
  const settings=await privateSettings(args[1]), bootstrap=await privateSettings(args[3]);
  const source=hostedRestoreTarget(settings,bootstrap,args[5]);
  dir=await mkdtemp(path.join(tmpdir(),"saju-hosted-restore-"));
  await chmod(dir,0o700);
  Object.assign(env,{LC_ALL:"C",LANG:"C",PGPASSFILE:path.join(dir,"no-password-file"),PGSERVICEFILE:path.join(dir,"no-service-file")});
  const pgEnv={PGHOST:source.hostname,PGPORT:source.port,PGUSER:decodeURIComponent(source.username),PGPASSWORD:decodeURIComponent(source.password),
    PGDATABASE:"postgres",PGSSLMODE:"verify-full",PGSSLROOTCERT:path.resolve(source.searchParams.get("sslrootcert")!),PGCONNECT_TIMEOUT:"15",
    PGOPTIONS:"-c default_transaction_read_only=on -c statement_timeout=60000 -c lock_timeout=5000"};
  step="remote-read-only-snapshot";
  remote=new Client({connectionString:source.href,connectionTimeoutMillis:15000,statement_timeout:60000,options:pgEnv.PGOPTIONS});
  await remote.connect();
  await remote.query("SET TIME ZONE 'UTC'");
  const stream=(remote as unknown as {connection:{stream:{encrypted?:boolean;authorized?:boolean}}}).connection.stream;
  assert.equal(stream.encrypted,true);assert.equal(stream.authorized,true);
  await remote.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  assert.equal((await remote.query("SHOW transaction_read_only")).rows[0].transaction_read_only,"on");
  assert.equal(Math.floor(Number((await remote.query("SHOW server_version_num")).rows[0].server_version_num)/10000),17);
  await assertMigrationsApplied(remote);
  const tables=(await remote.query(tablesSql)).rows.map(r=>r.relname as string);
  assert.equal(tables.length,21);
  // Dedicated app schema only, never restore hosted functions/extensions or auth/storage schemas.
  assert.equal((await remote.query("SELECT count(*)::int AS n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'")).rows[0].n,0);
  assert.equal((await remote.query("SELECT count(*)::int AS n FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE n.nspname='public'")).rows[0].n,0);
  const size=(await remote.query("SELECT sum(pg_total_relation_size(c.oid))::float8 AS bytes FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'")).rows[0].bytes;
  assert.ok(size<64*1024*1024,"SMALL_STAGING_CHECK_ONLY");
  const snapshot=(await remote.query("SELECT pg_export_snapshot() AS snapshot")).rows[0].snapshot as string;
  assert.match(snapshot,/^[A-Fa-f0-9-]+$/);
  const before=await manifest(remote,tables), beforeSchema=await schema(remote);
  const roles=(await remote.query("SELECT rolname FROM pg_roles WHERE rolname !~ '^pg_' ORDER BY rolname")).rows.map(r=>r.rolname as string);
  step="hosted-public-dump";
  const dump=path.join(dir,"application.dump");
  await run("pg_dump",["--format=custom","--schema=public","--snapshot",snapshot,"--file",dump],pgEnv);
  await chmod(dump,0o600);
  // Keep initdb's public schema baseline, while restoring its ACL and every app object.
  // pg_dump's ACL delta assumes that baseline; recreating public loses implicit USAGE.
  const entries=(await run("pg_restore",["--list",dump])).split("\n");
  const schemaEntry=/^\d+; \d+ \d+ SCHEMA - public /;
  assert.equal(entries.filter(line=>schemaEntry.test(line)).length,1);
  const restoreList=path.join(dir,"restore.list");
  await writeFile(restoreList,entries.filter(line=>!schemaEntry.test(line)).join("\n"),{mode:0o600,flag:"wx"});
  await remote.query("ROLLBACK");
  // Health is a separate current, read-only observation; not part of the backup snapshot.
  const currentHealth=await health({query:(s,p)=>remote!.query(s,p),close:async()=>{},
    transaction:async()=>{throw new Error("READ_ONLY_HEALTH_ONLY");}});
  await remote.end();remote=undefined;
  step="isolated-local-cluster";
  await run("initdb",["-D",path.join(dir,"data"),"-A","trust","-U","postgres","--no-locale","-E","UTF8"]);
  startAttempted=true;
  await run("pg_ctl",["-D",path.join(dir,"data"),"-l",path.join(dir,"server.log"),"-o",`-k ${dir} -h '' -p 55440`,"-w","start"]);started=true;
  // Local socket inside mode700 directory; no TCP listeners, provider env or external jobs.
  local=new Client({host:dir,port:55440,user:"postgres",database:"postgres"});await local.connect();
  await local.query("SET TIME ZONE 'UTC'");
  for(const role of roles)if(role!=="postgres")await local.query(`CREATE ROLE ${identifier(role)} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`);
  await local.query("GRANT saju_runtime TO saju_server");
  step="local-restore";
  await run("pg_restore",["--exit-on-error","--use-list",restoreList,"--host",dir,"--port","55440","--username","postgres","--dbname","postgres",dump]);
  step="all-table-and-schema-comparison";
  assert.deepEqual((await local.query(tablesSql)).rows.map(r=>r.relname),tables);
  step="all-table-data-comparison";
  assert.deepEqual(await manifest(local,tables),before);
  const restoredSchema=await schema(local);
  for(let i=0;i<beforeSchema.length;i++){
    step=`schema-catalog-${i+1}-comparison`;
    assert.deepEqual(restoredSchema[i],beforeSchema[i]);
  }
  await assertMigrationsApplied(local);
  step="restored-runtime-and-anonymous-permissions";
  await local.query("SET ROLE saju_server");
  step="restored-runtime-data";
  assert.deepEqual(await manifest(local,tables),before);
  step="restored-runtime-ddl-denial";
  await assert.rejects(local.query("CREATE TABLE public.restore_denied(id int)"),{code:"42501"});
  step="restored-migration-write-denial";
  await assert.rejects(local.query("UPDATE schema_migrations SET checksum='denied'"),{code:"42501"});
  await local.query("RESET ROLE");await local.query("SET ROLE anon");
  for(const table of tables){
    step=`restored-anonymous-${table}-denial`;
    // A table-level permission denial is as safe as RLS returning zero rows.
    let visible:number;
    try{visible=(await local.query(`SELECT count(*)::int AS n FROM public.${identifier(table)}`)).rows[0].n;}
    catch(error){assert.equal((error as {code?:string}).code,"42501");visible=0;}
    assert.equal(visible,0);
  }
  step="restored-anonymous-insert-denial";
  await assert.rejects(local.query("INSERT INTO public.accounts(id) VALUES(gen_random_uuid())"),{code:"42501"});
  await local.query("RESET ROLE");
  // The restore must not change remote records or consume/replay sessions, payments or jobs.
  report={status:"passed",scope:"hosted-public-backup-to-isolated-local-restore",tables:tables.length,
    sameSnapshot:true,tlsVerified:true,sourceReadOnly:true,allTableDataMatched:true,
    schemaConstraintsIndexesRlsAclMatched:true,runtimeReadMatched:true,runtimeDdlDenied:true,
    anonymousRowsDenied:true,sourceHealth:currentHealth.status,sourceHealthReasons:currentHealth.reasons,
    authSchemaBackedUp:false,providerCredentialsBackedUp:false,hostedDisasterRecoveryApproved:false};
} catch {
  report={status:"failed",scope:"hosted-public-backup-to-isolated-local-restore",step,code:"RESTORE_CHECK_FAILED"};
  process.exitCode=1;
} finally {
  let cleaned=true;
  try{if(remote){await remote.query("ROLLBACK").catch(()=>{});await remote.end();}}catch{cleaned=false;}
  try{await local?.end();}catch{cleaned=false;}
  try{
    // A start command can time out after PostgreSQL has already started.
    if(startAttempted && !started){
      try{await run("pg_ctl",["-D",path.join(dir!,"data"),"status"]);started=true;}
      catch(error){if((error as {code?:number}).code!==3)throw error;}
    }
    if(started)await run("pg_ctl",["-D",path.join(dir!,"data"),"-m","fast","-w","stop"]);
  }catch{cleaned=false;}
  // Do not remove a running cluster if stopping it failed.
  if(dir && cleaned)try{await rm(dir,{recursive:true,force:true});}catch{cleaned=false;}
  if(!cleaned){process.exitCode=1;report={status:"failed",step:"private-copy-cleanup",code:"LOCAL_CLEANUP_REQUIRED"};}
  console.log(JSON.stringify({...report,privateCopyRemoved:cleaned,elapsedSeconds:Math.ceil((Date.now()-startedAt)/1000)}));
}

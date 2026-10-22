import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stagingPreflight } from "../src/server/staging-preflight";
const configured = () => ({ SAJU_MODE:"research", SAJU_AUTH_MODE:'kakao-required', APP_ORIGIN:"https://staging.example.test", ALLOW_REMOTE_TEST:"true",
  DATABASE_URL:"postgresql://example:canary-private-password@db.example.test/staging?sslmode=verify-full",
  SUPABASE_URL:"https://project.example.test", SUPABASE_PUBLISHABLE_KEY:"sb_publishable_synthetic",
  PAYMENT_PROVIDER:"nicepay-test", NICEPAY_MODE:"sandbox", NICEPAY_CLIENT_KEY:"S2_synthetic", NICEPAY_SECRET_KEY:"canary-private-secret" });
test("valid-shaped test configuration never implies provider, human, or hosted verification", () => {
  const report = stagingPreflight(configured());
  assert.equal(report.status,"configuration-valid-unverified");
  assert.equal(report.publicReleaseApproved,false);assert.equal(report.realChargesEnabled,false);
  assert.ok(report.unverified.includes("hosted-access-control"));
  assert.ok(report.unverified.includes("nicepay-checkout-and-refund"));
  assert.deepEqual(report.issues,[]);
});
test("missing or unsafe staging configuration fails closed without echoing credentials", () => {
  assert.equal(stagingPreflight({}).status,"blocked");
  for (const patch of [{SAJU_AUTH_MODE:"local-demo"}, {SAJU_AUTH_MODE:""}, {SAJU_MODE:"production"}, {APP_ORIGIN:"https://user:canary-private-password@staging.example.test"},
    {APP_ORIGIN:"http://localhost:4180"}, {APP_ORIGIN:"https://example.test/subpath"}, {APP_ORIGIN:"https://staging.example.test/"}, {SUPABASE_URL:"https://example.test?key=canary-private-secret"},
    {SUPABASE_PUBLISHABLE_KEY:"sb_secret_canary-private-secret"}, {PAYMENT_PROVIDER:"mock"}, {NICEPAY_MODE:"production"},
    {NICEPAY_CLIENT_KEY:"R1_canary-private-secret"}, {NICEPAY_SECRET_KEY:""}, {DATABASE_URL:""},
    {DATABASE_URL:"postgres://user:canary-private-password@db.example.test/staging?sslmode=require"},
    {DATABASE_URL:"postgres://user:canary-private-password@db.example.test/staging?sslmode=verify-full&sslmode=disable"},
    {NODE_TLS_REJECT_UNAUTHORIZED:"0"}, {NEXT_PUBLIC_DATABASE_URL:"canary-private-secret"}]) {
    const report=stagingPreflight({...configured(),...patch});
    assert.equal(report.status,"blocked",JSON.stringify(Object.keys(patch)));
    assert.ok(!JSON.stringify(report).includes("canary-private"));
  }
});
test("legacy anon keys remain supported but service-role keys cannot be used for browser auth", () => {
  const jwt = (role:string) => "header."+Buffer.from(JSON.stringify({role})).toString("base64url")+".signature";
  assert.equal(stagingPreflight({...configured(),SUPABASE_PUBLISHABLE_KEY:jwt("anon")}).status,"configuration-valid-unverified");
  assert.equal(stagingPreflight({...configured(),SUPABASE_PUBLISHABLE_KEY:jwt("service_role")}).status,"blocked");
});
test("AI credentials and access tokens cannot be exposed through Next public settings",()=>{
 for(const name of ['NEXT_PUBLIC_OPENAI_API_KEY','NEXT_PUBLIC_AI_GATEWAY_API_KEY','NEXT_PUBLIC_VERCEL_OIDC_TOKEN','NEXT_PUBLIC_PROVIDER_ACCESS_TOKEN','NEXT_PUBLIC_AUTH_TOKEN']){
  const report=stagingPreflight({...configured(),[name]:'canary-private-value'});
  assert.equal(report.status,'blocked');assert.ok(report.issues.some(i=>i.code==='PUBLIC_SECRET_EXPOSURE'));
  assert.doesNotMatch(JSON.stringify(report),/canary-private-value/);
 }
 const allowed=stagingPreflight({...configured(),NEXT_PUBLIC_OPENAI_MODEL:'gpt-6-luna',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_synthetic',NEXT_PUBLIC_NICEPAY_CLIENT_KEY:'S2_synthetic'});
 assert.equal(allowed.status,'configuration-valid-unverified');
});
test("staging CLI parses a named file as data, redacts failures, and never starts with missing settings", () => {
  const dir=mkdtempSync(join(tmpdir(),"saju-staging-check-"));
  const env={...Object.fromEntries(["PATH","HOME","TMPDIR"].filter(k=>process.env[k]).map(k=>[k,process.env[k]!])),NODE_ENV:"test" as const};
  const run=(args:string[])=>spawnSync(process.execPath,["--import","tsx","scripts/staging.ts",...args],{env,encoding:"utf8",timeout:10000});
  try {
    const path=join(dir,"settings.env");
    writeFileSync(path,Object.entries(configured()).map(([k,v])=>`${k}=${v}`).join("\n"));
    const check=run(["--settings",path]);assert.equal(check.status,0);assert.equal(JSON.parse(check.stdout).status,"configuration-valid-unverified");
    const block=run(["--start"]);assert.equal(block.status,2);assert.equal(JSON.parse(block.stdout).status,"blocked");
    const failure=run(["--settings",join(dir,"canary-private-secret")]);assert.equal(failure.status,1);assert.equal(JSON.parse(failure.stdout).code,"STAGING_CHECK_FAILED");
    for(const result of [check,block,failure]) assert.ok(!(result.stdout+result.stderr).includes("canary-private"));
  } finally {rmSync(dir,{recursive:true,force:true});}
});

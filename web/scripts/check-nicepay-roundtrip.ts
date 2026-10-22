// Explicit synthetic fixture. Real sandbox checkout, forwarded signed callback
// to hosted staging, provider lookup/refund; no real-user account or OAuth claims.
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,writeFile,mkdir,chmod,rm} from "node:fs/promises";
import {existsSync} from "node:fs";
import {parseEnv} from "node:util";
import {randomUUID} from "node:crypto";
import {openDatabase,assertMigrationsApplied,one,type Database} from "../src/server/db";
import * as service from "../src/server/service";
import * as payments from "../src/server/payments";
import {prepareNicepay} from "../src/server/nicepay-checkout";
import {erasePersonalData} from "../src/server/operations";
import {samplePerson} from "../src/domain/model";
import {stagingPreflight} from "../src/server/staging-preflight";

let db:Database|undefined,owner:string|undefined,orderId:string|undefined;
let step="settings",running=false,finished=false;
const fixtureFile=".data/nicepay-roundtrip.json",reportFile=".data/nicepay-roundtrip-report.json";
let result:Record<string,unknown>={status:"waiting",scope:"real-sandbox-synthetic-fixture",realUserModified:false,browserOAuthVerified:false};
const server=createServer(async(req,res)=>{
  res.setHeader("Cache-Control","no-store");
  if(req.headers.host!=="127.0.0.1:4197"){res.writeHead(403).end();return;}
  if(req.method==="GET" && req.url==="/"){
    res.setHeader("Content-Type","text/html; charset=utf-8");res.end(html);return;
  }
  if(req.method==="GET" && req.url==="/status"){
    res.setHeader("Content-Type","application/json");res.end(JSON.stringify(result));return;
  }
  if(req.method!=="POST" || req.url!=="/return" || running || finished){res.writeHead(404).end();return;}
  running=true;
  try{
    let bytes=0;const chunks:Buffer[]=[];
    for await(const chunk of req){bytes+=chunk.length;assert.ok(bytes<=16384);chunks.push(Buffer.from(chunk));}
    const raw=Buffer.concat(chunks).toString("utf8");
    const fields=new URLSearchParams(raw);
    assert.equal(fields.get("orderId"),orderId);
    assert.equal(fields.get("authResultCode"),"0000");
    const callback=async()=>{
      const r=await fetch(hostedReturn,{method:"POST",redirect:"manual",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:raw,signal:AbortSignal.timeout(45000)});
      const location=new URL(r.headers.get("location")??"",origin);
      assert.equal(r.status,303);assert.equal(location.origin,origin);
      return location.searchParams.get("paymentReturn");
    };
    step="hosted-signed-return";
    const first=await callback();
    const order=await payments.ownedOrder(db!,owner!,orderId!);
    result={...result,authResponseReceived:true,hostedCallbackOutcome:first,orderState:order.state};
    assert.equal(first,"checked");assert.equal(order.state,"paid");
    step="duplicate-hosted-return";
    const before=(await one(db!,"SELECT count(*)::int AS n FROM payment_attempts WHERE order_id=$1 AND operation='confirm'",[orderId]))!.n;
    assert.equal(await callback(),"checked");
    assert.equal((await one(db!,"SELECT count(*)::int AS n FROM payment_attempts WHERE order_id=$1 AND operation='confirm'",[orderId]))!.n,before);
    const provider=payments.providerFor(db!,"nicepay-test");
    step="provider-lookup";assert.equal((await provider.lookup(order)).status,"DONE");
    step="paid-reading";await service.runJobs(db!,owner!);await service.result(db!,owner!,order.comparison_id);
    step="real-sandbox-refund";await payments.refundPayment(db!,owner!,orderId!);
    const refunded=await payments.ownedOrder(db!,owner!,orderId!);
    assert.equal(refunded.state,"refunded");assert.equal((await provider.lookup(refunded)).status,"CANCELED");
    await assert.rejects(service.result(db!,owner!,order.comparison_id),{code:"NOT_FOUND"});
    step="synthetic-record-erasure";await erasePersonalData(db!,owner!);
    result={...result,status:"passed",sandboxApproval:true,duplicateCallback:true,providerLookup:true,
      paidReading:true,sandboxFullRefund:true,refundedReadingDenied:true,syntheticPersonalDataErased:true,
      hostedCallbackThroughLocalForwarder:true,realChargesEnabled:false};
    finished=true;
    await rm(fixtureFile);
  }catch(error){
    const state=orderId&&db&&owner?(await payments.ownedOrder(db,owner,orderId).catch(()=>null))?.state:undefined;
    result={...result,status:"needs_attention",step,orderState:state,
      code:typeof(error as {code?:unknown}).code==="string"?(error as {code:string}).code:"ROUNDTRIP_CHECK_FAILED"};
    // Do not erase or fake-close an unknown financial state. Keep the private
    // fixture identifiers for investigation and a verified refund/cleanup.
  }finally{
    running=false;
    await writeFile(reportFile,JSON.stringify(result,null,2)+"\n",{mode:0o600});
    console.log(JSON.stringify(result));
    res.writeHead(303,{Location:"/status"}).end();
  }
});
let html="",hostedReturn="",origin="";
try{
  const args=process.argv.slice(2);
  assert.ok(args.length===5&&args[0]==="--settings"&&args[2]==="--project"&&args[4]==="--create-synthetic-fixture");
  const settings=parseEnv(await readFile(args[1],"utf8")),project=args[3];
  assert.equal(stagingPreflight(settings).issues.length,0);
  assert.match(project,/^[a-z]{20}$/);assert.equal(settings.SUPABASE_URL,`https://${project}.supabase.co`);
  assert.equal(settings.APP_ORIGIN,"https://chunbae-staging.vercel.app");
  const source=new URL(settings.DATABASE_URL!);
  assert.equal(source.username,`saju_server.${project}`);
  assert.equal(source.searchParams.get("sslmode"),"verify-full");
  assert.ok(source.hostname.endsWith(".pooler.supabase.com"));
  assert.equal(source.port,"6543");
  assert.equal(existsSync(fixtureFile),false,"EXISTING_FIXTURE_REQUIRES_REVIEW");
  for(const k of ["DATABASE_URL","SAJU_MODE","NICEPAY_MODE","NICEPAY_CLIENT_KEY","NICEPAY_SECRET_KEY"])process.env[k]=settings[k];
  origin=settings.APP_ORIGIN!;
  await mkdir(".data",{recursive:true,mode:0o700});await chmod(".data",0o700);
  step="synthetic-fixture";db=await openDatabase();await assertMigrationsApplied(db);
  owner=(await service.newSession(db)).owner;
  await writeFile(fixtureFile,JSON.stringify({scope:"nicepay-synthetic-fixture",project,owner}),{mode:0o600,flag:"wx"});
  // Every UUID/birth/name below is generated from the repository's synthetic
  // fixture; never bind an actual Kakao identity or reset another free claim.
  const pair=()=>({me:{...samplePerson(),name:"검증가"},other:{...samplePerson(true),name:"검증나"}});
  await service.createComparison(db,owner,pair(),randomUUID(),"request-reading","nicepay-test");
  await service.runJobs(db,owner);await service.recoveryCode(db,owner);
  const comparison=await service.createComparison(db,owner,pair(),randomUUID(),"request-reading","nicepay-test");
  orderId=(await one(db,"SELECT id FROM orders WHERE comparison_id=$1 AND owner_id=$2",[comparison.id,owner]))!.id;
  const checkout=await prepareNicepay(db,owner,orderId!,origin);
  hostedReturn=checkout.returnUrl;
  await writeFile(fixtureFile,JSON.stringify({scope:"nicepay-synthetic-fixture",project,owner,orderId,comparison:comparison.id,hostedReturn}),{mode:0o600});
  const browserCheckout={...checkout,returnUrl:"http://127.0.0.1:4197/return"};
  const data=JSON.stringify(browserCheckout).replaceAll("<","\\u003c");
  html=`<!doctype html><html lang="ko"><meta charset="utf-8"><title>김춘배 NICEPAY 합성 검증</title><style>body{font:20px sans-serif;max-width:600px;margin:60px auto;padding:24px}button{font:inherit;padding:20px}</style><h1>NICEPAY 테스트 결제</h1><p>실제 청구 없는 S2 테스트입니다.</p><p>기존 사용자 기록과 분리된 합성 주문 2,900원입니다. 승인 확인 후 자동으로 전액 테스트 취소합니다.</p><button id="checkout">테스트 결제창 열기</button><p id="message"></p><script src="https://pay.nicepay.co.kr/v1/js/"></script><script>document.querySelector('#checkout').onclick=()=>{AUTHNICE.requestPay({...${data},fnError:()=>{document.querySelector('#message').textContent='결제창을 완료하지 않았습니다. 상태를 확인합니다.';}});};</script></html>`;
  await new Promise<void>((resolve,reject)=>{server.once("error",reject);server.listen(4197,"127.0.0.1",resolve);});
  console.log(JSON.stringify({status:"checkout-ready",scope:"real-sandbox-synthetic-fixture",openUrl:"http://127.0.0.1:4197",realUserModified:false}));
  const close=async()=>{server.close();await db?.close();process.exit();};
  process.once("SIGINT",close);process.once("SIGTERM",close);
}catch{
  console.log(JSON.stringify({status:"failed",step,code:"ROUNDTRIP_SETUP_FAILED",privateFixtureRetained:existsSync(fixtureFile)}));
  await db?.close();process.exitCode=1;
}

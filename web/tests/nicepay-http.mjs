// Route guards only: disposable local DB and public synthetic test credentials.
// This must never be pointed at a hosted app or an actual merchant.
import assert from "node:assert/strict";
import {createHash,randomUUID,randomBytes} from "node:crypto";
const origin=process.env.TEST_ORIGIN;
assert.match(origin??"",/^http:\/\/127\.0\.0\.1:\d+$/);
assert.equal(process.env.NICEPAY_CLIENT_KEY,"S2_http_fixture");
assert.equal(process.env.NICEPAY_SECRET_KEY,"http-synthetic-secret");
const webhook=origin+"/api/nicepay/webhook";
const post=body=>fetch(webhook,{method:"POST",headers:{"Content-Type":"application/json"},body:typeof body==="string"?body:JSON.stringify(body)});
const notice={orderId:"registration-sample",tid:"T_synthetic_http",amount:2900,ediDate:"2026-10-22T00:00:00+09:00",signature:"0".repeat(64)};
let response=await post(notice);
assert.equal(response.status,200);assert.equal(await response.text(),"OK");
assert.match(response.headers.get("cache-control"),/(?:^|,\s*)no-store(?:,|$)/);
assert.ok(response.headers.get("content-type").startsWith("text/html"));
for(const bad of ["{",{}, {...notice,amount:-1},{...notice,orderId:randomUUID()}]){
  response=await post(bad);assert.equal(response.status,400);
}
response=await post(" ".repeat(16385));assert.equal(response.status,413);
response=await fetch(webhook);assert.equal(response.status,405);
const own={...notice,orderId:randomUUID()};
own.signature=createHash("sha256").update(`${own.tid}${own.amount}${own.ediDate}${process.env.NICEPAY_SECRET_KEY}`).digest("hex");
response=await post(own);assert.equal(response.status,200);assert.equal(await response.text(),"OK");
const auth={orderId:randomUUID(),tid:"T_synthetic_http",clientId:process.env.NICEPAY_CLIENT_KEY,amount:"2900",authToken:"synthetic",authResultCode:"0000",signature:"0".repeat(64)};
response=await fetch(origin+"/api/nicepay/return?state="+randomBytes(32).toString("base64url"),{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams(auth),redirect:"manual"});
assert.equal(response.status,400);
console.log("PASS: isolated NICEPAY HTTP guards: foreign sample disposal, forged UUID rejection, malformed/oversize bodies, method boundary, signed unknown order and invalid return; no gateway calls.");

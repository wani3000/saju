import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { NicepayTestProvider, signatureMatches } from "../src/server/nicepay";
import {
  prepareNicepay,
  acceptNicepayReturn,
} from "../src/server/nicepay-checkout";
import { openDatabase, migrate, one, type Database } from "../src/server/db";
import * as s from "../src/server/service";
import * as p from "../src/server/payments";
import { samplePerson } from "../src/domain/model";
import {acceptNicepayWebhook,isForeignNicepayNotice} from "../src/server/nicepay-webhook";
const tid = (o: Record<string, any>) =>
  "T" + o.id.replaceAll("-", "").slice(0, 29);
const client = "S2_test_fixture",
  secret = "test-only-fixture";
let db: Database;
before(async () => {
  process.env.NICEPAY_CLIENT_KEY = client;
  process.env.NICEPAY_SECRET_KEY = secret;
  process.env.NICEPAY_MODE = "sandbox";
  db = await openDatabase("memory://");
  await migrate(db);
});
after(async () => {
  await db.close();
  delete process.env.NICEPAY_CLIENT_KEY;
  delete process.env.NICEPAY_SECRET_KEY;
  delete process.env.NICEPAY_MODE;
});
async function order() {
  const a = await s.newSession(db);
  const pair = () => ({ me: samplePerson(), other: samplePerson(true) });
  await s.createComparison(db, a.owner, pair(), randomUUID(), true);
  await s.runJobs(db, a.owner);
  await s.recoveryCode(db, a.owner);
  const c = await s.createComparison(
    db,
    a.owner,
    pair(),
    randomUUID(),
    true,
    "nicepay-test",
  );
  return (await one(db, "SELECT * FROM orders WHERE comparison_id=$1", [
    c.id,
  ]))!;
}
function gateway(
  o: Record<string, any>,
  options: {
    wrongOrder?: boolean;
    badSignature?: boolean;
    lost?: boolean;
    unapprovedNotFound?: boolean;
  } = {},
) {
  let status = "ready",
    posts = 0;
  const requests: string[] = [];
  const transport: typeof fetch = async (url, init) => {
    const u = String(url);
    requests.push(u);
    if(options.unapprovedNotFound && status==="ready" && init?.method!=="POST")
      return Response.json({resultCode:"U107"},{status:404});
    assert.ok(u.startsWith("https://sandbox-api.nicepay.co.kr/"));
    if (init?.method === "POST") {
      posts++;
      status = u.endsWith("/cancel") ? "cancelled" : "paid";
      if (options.lost) {
        options.lost = false;
        throw new Error("RESPONSE_LOST");
      }
    }
    const body = {
      resultCode: "0000",
      tid: tid(o),
      amount: 2900,
      currency: "KRW",
      ediDate: "2026-10-14T12:00:00+09:00",
      orderId: options.wrongOrder ? randomUUID() : o.id,
      status,
      balanceAmt: status === "cancelled" ? 0 : 2900,
      signature: "",
    };
    body.signature = options.badSignature
      ? "0".repeat(64)
      : s.hash(`${body.tid}${body.amount}${body.ediDate}${secret}`);
    return new Response(JSON.stringify(body));
  };
  return {
    provider: new NicepayTestProvider(client, secret, transport),
    posts: () => posts,
    requests,
  };
}
test("sandbox keys only; signatures compare safely", () => {
  assert.throws(() => new NicepayTestProvider("R2_live", secret));
  assert.equal(signatureMatches("x", "bad"), false);
  assert.equal(signatureMatches("x", s.hash("x")), true);
});
test("signed return requires nonce, exact amount/client and valid auth signature", async () => {
  const o = await order(),
    ready = await prepareNicepay(db, o.owner_id, o.id, "http://127.0.0.1:4180"),
    nonce = new URL(ready.returnUrl).searchParams.get("state")!;
  const f = {
    orderId: o.id,
    tid: tid(o),
    clientId: client,
    amount: 2900,
    authToken: "test_auth",
    signature: s.hash(`test_auth${client}2900${secret}`),
    authResultCode: "0000",
  };
  const g = gateway(o);
  await assert.rejects(acceptNicepayReturn(db, s.token(), f, g.provider));
  await assert.rejects(
    acceptNicepayReturn(db, nonce, { ...f, amount: 1 }, g.provider),
  );
  await assert.rejects(
    acceptNicepayReturn(
      db,
      nonce,
      { ...f, signature: "0".repeat(64) },
      g.provider,
    ),
  );
  assert.equal(g.posts(), 0);
  await acceptNicepayReturn(db, nonce, f, g.provider);
  await acceptNicepayReturn(db, nonce, f, g.provider);
  assert.equal(g.posts(), 1);
  await s.runJobs(db, o.owner_id);
  assert.ok(await s.result(db, o.owner_id, o.comparison_id));
  await p.refundPayment(db, o.owner_id, o.id, g.provider);
  assert.equal((await p.ownedOrder(db, o.owner_id, o.id)).state, "refunded");
  await p.paymentEvent(db, o.id, "cancel-event", g.provider);
  await assert.rejects(s.result(db, o.owner_id, o.comparison_id));
});
test("lookup binds TID to order before any approval and refuses altered signatures", async () => {
  const o = await order(),
    g = gateway(o, { wrongOrder: true });
  await assert.rejects(g.provider.confirm(o, tid(o)));
  assert.equal(g.posts(), 0);
  const bad = gateway(o, { badSignature: true });
  await assert.rejects(bad.provider.confirm(o, tid(o)));
  assert.equal(bad.posts(), 0);
});
test("verified return approves an authenticated card before lookup; generic U107 cannot approve",async()=>{
  const o=await order(),g=gateway(o,{unapprovedNotFound:true});
  await assert.rejects(g.provider.confirm(o,tid(o)),{message:"PAYMENT_NOT_FOUND"});
  assert.equal(g.posts(),0);
  const ready=await prepareNicepay(db,o.owner_id,o.id,"http://127.0.0.1:4180");
  const nonce=new URL(ready.returnUrl).searchParams.get("state")!;
  const f={orderId:o.id,tid:tid(o),clientId:client,amount:o.amount,authToken:"authenticated-card",
    signature:s.hash(`authenticated-card${client}${o.amount}${secret}`),authResultCode:"0000"};
  await assert.rejects(acceptNicepayReturn(db,nonce,{...f,signature:"0".repeat(64)},g.provider));
  assert.equal(g.posts(),0);
  await acceptNicepayReturn(db,nonce,f,g.provider);
  await acceptNicepayReturn(db,nonce,f,g.provider);
  assert.equal(g.posts(),1);
  assert.equal((await p.ownedOrder(db,o.owner_id,o.id)).state,"paid");
  await p.refundPayment(db,o.owner_id,o.id,g.provider);
  assert.equal((await p.ownedOrder(db,o.owner_id,o.id)).state,"refunded");
});
test("authenticated approval rejects a signed receipt for another order without granting access",async()=>{
  const o=await order(),g=gateway(o,{unapprovedNotFound:true,wrongOrder:true});
  const ready=await prepareNicepay(db,o.owner_id,o.id,"http://127.0.0.1:4180"),nonce=new URL(ready.returnUrl).searchParams.get("state")!;
  const f={orderId:o.id,tid:tid(o),clientId:client,amount:o.amount,authToken:"scoped-return",
    signature:s.hash(`scoped-return${client}${o.amount}${secret}`),authResultCode:"0000"};
  await assert.rejects(acceptNicepayReturn(db,nonce,f,g.provider),{code:"CONFIRMATION_UNKNOWN"});
  assert.equal(g.posts(),1);
  assert.equal((await p.ownedOrder(db,o.owner_id,o.id)).state,"confirmation_unknown");
  await assert.rejects(s.result(db,o.owner_id,o.comparison_id),{code:"NOT_FOUND"});
});
test("lost initial approval is recovered by inquiry on the duplicate signed return",async()=>{
  const o=await order(),g=gateway(o,{unapprovedNotFound:true,lost:true});
  const ready=await prepareNicepay(db,o.owner_id,o.id,"http://127.0.0.1:4180"),nonce=new URL(ready.returnUrl).searchParams.get("state")!;
  const f={orderId:o.id,tid:tid(o),clientId:client,amount:o.amount,authToken:"lost-return",
    signature:s.hash(`lost-return${client}${o.amount}${secret}`),authResultCode:"0000"};
  await assert.rejects(acceptNicepayReturn(db,nonce,f,g.provider),{code:"CONFIRMATION_UNKNOWN"});
  await acceptNicepayReturn(db,nonce,f,g.provider);
  assert.equal(g.posts(),1);
  assert.equal((await p.ownedOrder(db,o.owner_id,o.id)).state,"paid");
});
test("lost NICEPAY approval recovers by signed inquiry without another charge", async () => {
  const o = await order(),
    g = gateway(o, { lost: true });
  await assert.rejects(
    p.confirmPayment(db, o.owner_id, o.id, tid(o), 2900, g.provider),
  );
  await p.reconcilePayment(db, o.owner_id, o.id, g.provider);
  assert.equal(g.posts(), 1);
  assert.equal((await p.ownedOrder(db, o.owner_id, o.id)).state, "paid");
});

const notification = (orderId:string,key="T_synthetic",amount=2900) => {
  const ediDate="2026-10-22T20:00:00+09:00";
  return {orderId,tid:key,amount,ediDate,signature:s.hash(`${key}${amount}${ediDate}${secret}`)};
};
test("shared sandbox acknowledges signed foreign orders without provider calls or persisted payloads",async()=>{
  const before=await one(db,"SELECT count(*)::int AS n FROM payment_events");
  const foreignProvider:p.Provider={confirm:async()=>{throw new Error("FOREIGN_APPROVAL_FORBIDDEN");},
    lookup:async()=>{throw new Error("FOREIGN_LOOKUP_FORBIDDEN");},cancel:async()=>{throw new Error("FOREIGN_CANCEL_FORBIDDEN");}};
  assert.equal(await acceptNicepayWebhook(db,notification("ebook-test-123"),foreignProvider),"ignored");
  assert.equal(await acceptNicepayWebhook(db,notification(randomUUID()),foreignProvider),"ignored");
  assert.deepEqual(await one(db,"SELECT count(*)::int AS n FROM payment_events"),before);
});
test("malformed notices and forged UUID transactions are rejected",async()=>{
  for(const payload of [null,{},notification("x","x",-1),{...notification(randomUUID()),signature:"0".repeat(64)}])
    await assert.rejects(acceptNicepayWebhook(db,payload),{code:"INVALID_WEBHOOK",status:400});
});
test("registration sample with a foreign order is discarded before any DB or provider access",async()=>{
  const probe={...notification("registration-sample"),signature:"0".repeat(64)};
  assert.equal(isForeignNicepayNotice(probe),true);
  assert.equal(await acceptNicepayWebhook(undefined as unknown as Database,probe),"ignored");
  assert.equal(isForeignNicepayNotice({...probe,orderId:randomUUID()}),false);
  for(const invalid of [null,{}, {...probe,amount:-1},{...probe,signature:"invalid"}]){
    assert.equal(isForeignNicepayNotice(invalid),false);
    await assert.rejects(acceptNicepayWebhook(undefined as unknown as Database,invalid),{code:"INVALID_WEBHOOK"});
  }
});
test("webhook uses queried payment truth; reordered duplicates are one event and refund revokes result",async()=>{
  const o=await order(),g=gateway(o);
  await p.confirmPayment(db,o.owner_id,o.id,tid(o),o.amount,g.provider);
  await s.runJobs(db,o.owner_id);
  const f=notification(o.id,tid(o));
  assert.equal(await acceptNicepayWebhook(db,{...f,status:"cancelled"},g.provider),"checked");
  assert.equal((await p.ownedOrder(db,o.owner_id,o.id)).state,"paid");
  await acceptNicepayWebhook(db,{buyerName:"do not persist",signature:f.signature,ediDate:f.ediDate,amount:f.amount,tid:f.tid,orderId:f.orderId},g.provider);
  assert.equal((await one(db,"SELECT count(*)::int AS n FROM payment_events WHERE order_id=$1",[o.id]))!.n,1);
  await assert.rejects(acceptNicepayWebhook(db,notification(o.id,tid(o),1),g.provider),{code:"INVALID_WEBHOOK"});
  await assert.rejects(acceptNicepayWebhook(db,notification(o.id,"T_wrong"),g.provider),{code:"INVALID_WEBHOOK"});
  await g.provider.cancel(await p.ownedOrder(db,o.owner_id,o.id));
  await acceptNicepayWebhook(db,{...f,status:"paid"},g.provider);
  assert.equal((await p.ownedOrder(db,o.owner_id,o.id)).state,"refunded");
  await assert.rejects(s.result(db,o.owner_id,o.comparison_id),{code:"NOT_FOUND"});
  assert.equal(g.posts(),2);
});
test("owned webhook provider outage remains retryable and does not grant access or record success",async()=>{
  const o=await order();
  const unavailable:p.Provider={lookup:async()=>{throw new Error("SYNTHETIC_OUTAGE");},
    confirm:async()=>{throw new Error("UNEXPECTED_APPROVAL");},cancel:async()=>{throw new Error("UNEXPECTED_CANCEL");}};
  await assert.rejects(acceptNicepayWebhook(db,notification(o.id,tid(o)),unavailable),
    {code:"PAYMENT_LOOKUP_FAILED",status:503});
  assert.equal((await p.ownedOrder(db,o.owner_id,o.id)).state,"created");
  assert.equal((await one(db,"SELECT count(*)::int AS n FROM payment_events WHERE order_id=$1",[o.id]))!.n,0);
  await assert.rejects(s.result(db,o.owner_id,o.comparison_id),{code:"NOT_FOUND"});
});

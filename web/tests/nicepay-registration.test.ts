import assert from "node:assert/strict";
import {test} from "node:test";
import {inspectNicepayRegistration} from "../scripts/nicepay-registration";
const env = {APP_ORIGIN: "https://chunbae-staging.vercel.app", SAJU_MODE: "research", ALLOW_REMOTE_TEST: "true",
  PAYMENT_PROVIDER: "nicepay-test", NICEPAY_MODE: "sandbox", NICEPAY_CLIENT_KEY: "S2_synthetic_registration", NICEPAY_SECRET_KEY: "synthetic-secret"};
const target = env.APP_ORIGIN + "/api/nicepay/webhook";
const reply = (body: unknown) => (async () => Response.json(body)) as typeof fetch;
test("registration check refuses live keys, wrong target and TLS weakening before transport", async () => {
  for (const change of [{NICEPAY_CLIENT_KEY: "R2_synthetic"}, {APP_ORIGIN: "https://other.example"}, {NICEPAY_MODE: "production"},
    {NODE_TLS_REJECT_UNAUTHORIZED: "0"}, {ALLOW_REMOTE_TEST: "false"}, {SAJU_MODE: "production"}]) {
    const result = await inspectNicepayRegistration({...env, ...change}, (async () => {throw new Error("MUST_NOT_CALL");}) as typeof fetch);
    assert.equal(result.status, "blocked");
  }
});
test("registration lookup uses sandbox GET only and separates registration from transaction delivery", async () => {
  const result = await inspectNicepayRegistration(env, (async (url, init) => {
    assert.equal(url, "https://sandbox-api.nicepay.co.kr/v1/webhook");
    assert.equal(init?.method, "GET"); assert.equal(init?.redirect, "error"); assert.equal(init?.body, undefined);
    return Response.json({resultCode: "0000", urls: [{method: "card", url: target, managerEmail: "private@example.invalid"}, {method: "bank", url: "https://private.invalid"}]});
  }) as typeof fetch);
  assert.equal(result.status, "registered"); assert.equal(result.transactionDeliveryVerified, false);
  assert.ok(!JSON.stringify(result).includes("private"));
});
test("empty and different or ambiguous card registrations require attention", async () => {
  const missing = await inspectNicepayRegistration(env, reply({resultCode: "U111", urls: []}));
  assert.equal(missing.code, "CARD_WEBHOOK_NOT_REGISTERED");
  for (const urls of [[], [{method: "bank", url: target}], [{method: "card", url: target + "/wrong"}], [{method: "card", url: target}, {method: "card", url: target}]]) {
    const result = await inspectNicepayRegistration(env, reply({resultCode: "0000", urls}));
    assert.equal(result.status, "needs_attention");
  }
});
test("vendor failures and malformed replies never disclose errors, credentials or endpoint data", async () => {
  for (const transport of [reply({resultCode: "0000", urls: [null]}), reply({resultCode: "U104", resultMsg: env.NICEPAY_SECRET_KEY}),
    (async () => {throw new Error(env.NICEPAY_SECRET_KEY);}) as typeof fetch]) {
    const result = await inspectNicepayRegistration(env, transport);
    assert.equal(result.status, "unavailable"); assert.ok(!JSON.stringify(result).includes(env.NICEPAY_SECRET_KEY));
  }
});

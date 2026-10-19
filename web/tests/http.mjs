import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const base = process.env.TEST_ORIGIN ?? "http://127.0.0.1:4180";
let cookie = "";
async function request(path, body, options = {}) {
  const method = options.method ?? (body === undefined ? "GET" : "POST");
  const r = await fetch(base + "/api/" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(method !== "GET" ? { Origin: base } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...options.headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (r.headers.get("set-cookie"))
    cookie = r.headers.get("set-cookie").split(";")[0];
  return r;
}
let r = await request("state");
assert.equal(r.status, 401);
r = await request(
  "session",
  {},
  { headers: { Origin: "https://untrusted.example" } },
);
assert.equal(r.status, 403);
r = await request("session", {});
assert.equal(r.status, 200);
assert.match(r.headers.get("set-cookie"), /HttpOnly/i);
assert.match(r.headers.get("set-cookie"), /SameSite=lax/i);
const person = (other = false) => ({
  id: randomUUID(),
  name: other ? "테스트상대" : "테스트나",
  year: other ? "1992" : "1990",
  month: "3",
  day: "12",
  calendar: "solar",
  leap: false,
  timeKnown: false,
  hour: "",
  minute: "",
  relation: "친구",
});
const pair = { me: person(), other: person(true) };
r = await request("draft", { pair, revision: 0 });
assert.equal(r.status, 200);
r = await request("state");
assert.match(r.headers.get("cache-control"), /no-store/);
assert.deepEqual((await r.json()).draft, pair);
r = await request("comparisons", {
  pair: { ...pair, me: { ...pair.me, year: "1954", month: "3", day: "21",
    timeKnown: true, hour: "0", minute: "15" } },
  key: randomUUID(), consent: true,
});
assert.equal(r.status, 422);
assert.equal((await r.json()).code, "HISTORICAL_CLOCK_SOURCE_DISPUTE");
assert.equal((await (await request("state")).json()).free, "available");
r = await request("comparisons", { pair, key: randomUUID(), consent: true });
assert.equal(r.status, 200);
const { id } = await r.json();
await request("process", {});
r = await request("results/" + id);
assert.equal(r.status, 200);
const savedReading = (await r.json()).reading;
assert.equal(savedReading.score, null);
assert.equal(savedReading.ruleVersion, "source-observations-copy-v1");
assert.equal(savedReading.basis.kind, "source-symbol-comparison");
assert.ok(savedReading.strength.includes("일간"));
assert.deepEqual(savedReading.basis.comparisonPositions,["year","month","day"]);
r = await request("results/" + id + "/shares", { aliases: ["나", "너"] });
assert.equal(r.status, 200);
const link = await r.json();
r = await fetch(base + link.path);
assert.equal(r.status, 200);
assert.match(r.headers.get("cache-control"), /no-store/);
let html = await r.text();
assert.ok(!html.includes("1990"));
assert.ok(!html.includes("테스트나"));
assert.ok(html.includes("함께 나누는 대화"));
assert.ok(html.includes(savedReading.basis.sharedCopy.title));
assert.ok(html.includes(savedReading.basis.sharedCopy.strength));
assert.ok(!html.includes(savedReading.strength));
assert.ok(!html.includes("pdfSha256"));
assert.ok(!html.includes("source-symbol-comparison"));
assert.ok(!html.includes("pillars"));
await request("shares/" + link.id, undefined, { method: "DELETE" });
r = await fetch(base + link.path);
assert.ok((await r.text()).includes("지금은 볼 수 없는"));
const firstCookie = cookie;
cookie = "";
await request("session", {});
r = await request("results/" + id);
assert.equal(r.status, 404);
cookie = firstCookie;
r = await request("comparisons", {
  pair: { ...pair, other: person(true) },
  key: randomUUID(),
  consent: true,
});
assert.equal(r.status, 409);
r = await request("recovery-code", {});
const { code } = await r.json();
assert.equal(typeof code, "string");
r = await request("comparisons", {
  pair: { ...pair, other: person(true) },
  key: randomUUID(),
  consent: true,
});
const second = (await r.json()).id;
const account = await (await request("state")).json();
const order = account.orders.find((x) => x.comparison_id === second);
r = await request(`orders/${order.id}/confirm`, {
  paymentKey: `mock_${order.id}`,
  amount: 1,
});
assert.equal(r.status, 422);
r = await request(`orders/${order.id}/confirm`, {
  paymentKey: `mock_${order.id}`,
  amount: 2900,
});
assert.equal(r.status, 200);
await request("process", {});
assert.equal((await (await request("state")).json()).results.length, 2);
await request(`orders/${order.id}/refund`, {});
assert.equal((await (await request("state")).json()).results.length, 1);
r = await request("payments/webhook", {
  eventType: "PAYMENT_STATUS_CHANGED",
  createdAt: new Date().toISOString(),
  data: { orderId: order.id },
});
assert.equal(r.status, 403);
await request("logout", {});
cookie = "";
r = await request("recover", { code });
assert.equal(r.status, 200);
assert.equal((await (await request("state")).json()).results.length, 1);
r = await request("auth/start", {});
assert.equal(r.status, 503);
r = await request("auth/finish", { choice: "merge" });
assert.equal(r.status, 401);
r = await request("account", undefined, { method: "DELETE" });
assert.equal(r.status, 200);
r = await request("state");
assert.equal(r.status, 401);
r = await request("recover", { code });
assert.equal(r.status, 401);
const oversized = new ReadableStream({
  start(c) {
    c.enqueue(new TextEncoder().encode("가".repeat(6000)));
    c.close();
  },
});
r = await fetch(base + "/api/session", {
  method: "POST",
  headers: { Origin: base, "Content-Type": "application/json" },
  body: oversized,
  duplex: "half",
});
assert.equal(r.status, 413);
assert.equal((await r.json()).code, "TOO_LARGE");
r = await fetch(base + "/api/session", {
  method: "POST",
  headers: { Origin: base, "Content-Type": "application/json" },
  body: new Uint8Array([0xff]),
});
assert.equal(r.status, 400);
assert.equal((await r.json()).code, "INVALID_ENCODING");
console.log(
  "HTTP journey passed: CSRF, cookie, persistence, free result, public redaction/revocation, ownership, recovery, mock payment/refund, webhook gate, unconfigured OAuth, invalid merge ticket, erasure, revoked recovery, streamed byte limits and encoding.",
);

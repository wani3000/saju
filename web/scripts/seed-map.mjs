// Synthetic local QA only. Test recovery code is written to an ignored local file, never stdout.
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
const base = "http://127.0.0.1:4180";
let cookie = "";
async function api(path, body) {
  const r = await fetch(base + "/api/" + path, {
    method: body ? "POST" : "GET",
    headers: {
      Origin: base,
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (r.headers.get("set-cookie"))
    cookie = r.headers.get("set-cookie").split(";")[0];
  if (!r.ok) throw new Error("QA_REQUEST_" + r.status);
  return r.json();
}
await api("session", {});
const { code } = await api("recovery-code", {});
const me = {
  id: randomUUID(),
  name: "가상나래",
  year: "1990",
  month: "3",
  day: "12",
  calendar: "solar",
  leap: false,
  timeKnown: false,
  hour: "",
  minute: "",
  relation: "친구",
};
for (let index = 0; index < 20; index++) {
  const pair = {
    me,
    other: {
      ...me,
      id: randomUUID(),
      name: "가상친구" + String(index + 1).padStart(2, "0"),
      year: "1992",
    },
  };
  const { id } = await api("comparisons", {
    pair,
    key: randomUUID(),
    consent: true,
  });
  if (index) {
    const state = await api("state");
    const order = state.orders.find((o) => o.comparison_id === id);
    if (order.provider !== "mock") throw new Error("MOCK_ONLY");
    await api("orders/" + order.id + "/confirm", {
      paymentKey: "mock_" + order.id,
      amount: 2900,
    });
  }
  await api("process", {});
}
await mkdir(".data", { recursive: true });
await writeFile(".data/qa-recovery", code, { mode: 0o600 });
console.log("20 synthetic results prepared; local QA recovery file saved.");

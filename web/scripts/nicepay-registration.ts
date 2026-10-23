// Read-only check for this dedicated staging app. Never registers or changes URLs.
type Environment = Readonly<Record<string, string | undefined>>;
const origin = "https://chunbae-staging.vercel.app";
export async function inspectNicepayRegistration(env: Environment, transport: typeof fetch = fetch) {
  const base = {scope: "sandbox-webhook-registration-only", transactionDeliveryVerified: false, realChargesEnabled: false};
  if (env.APP_ORIGIN !== origin || env.SAJU_MODE !== "research" || env.ALLOW_REMOTE_TEST !== "true" ||
      env.PAYMENT_PROVIDER !== "nicepay-test" || env.NICEPAY_MODE !== "sandbox" ||
      !/^S2_\S+$/.test(env.NICEPAY_CLIENT_KEY ?? "") || !env.NICEPAY_SECRET_KEY?.trim() ||
      env.NODE_TLS_REJECT_UNAUTHORIZED === "0")
    return {...base, status: "blocked", code: "DEDICATED_SANDBOX_SETTINGS_REQUIRED"};
  try {
    const response = await transport("https://sandbox-api.nicepay.co.kr/v1/webhook", {
      method: "GET", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15000),
      headers: {Authorization: "Basic " + Buffer.from(env.NICEPAY_CLIENT_KEY + ":" + env.NICEPAY_SECRET_KEY).toString("base64")},
    });
    const data: unknown = await response.json();
    if (!response.ok || !data || typeof data !== "object") throw new Error();
    const result = data as {resultCode?: unknown; urls?: unknown};
    if (result.resultCode === "U111" && Array.isArray(result.urls) && result.urls.length === 0)
      return {...base, status: "needs_attention", code: "CARD_WEBHOOK_NOT_REGISTERED"};
    if (result.resultCode !== "0000" || !Array.isArray(result.urls) ||
        !result.urls.every(u => u && typeof u === "object" && typeof u.method === "string" && typeof u.url === "string")) throw new Error();
    const cards = result.urls.filter(u => u.method === "card");
    // Do not disclose other services' endpoints, manager emails, or vendor errors.
    if (cards.length !== 1 || cards[0].url !== origin + "/api/nicepay/webhook")
      return {...base, status: "needs_attention", code: "CARD_WEBHOOK_TARGET_MISMATCH"};
    return {...base, status: "registered", code: "CANONICAL_CARD_WEBHOOK_REGISTERED"};
  } catch {
    return {...base, status: "unavailable", code: "REGISTRATION_LOOKUP_UNCONFIRMED"};
  }
}

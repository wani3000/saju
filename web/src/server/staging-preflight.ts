/** Offline configuration checks only: never connects to auth, payment, or the database. */
type Environment = Readonly<Record<string, string | undefined>>;
type Issue = { code: string; setting: string };
function serviceURL(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
      ["localhost", "127.0.0.1", "[::1]", "0.0.0.0"].includes(url.hostname)) return null;
    return url;
  } catch { return null; }
}
function publishable(value: string) {
  if (/^sb_publishable_\S+$/.test(value)) return true;
  // Legacy anon JWTs remain supported; parsing a role does not verify the key.
  if (value.length > 8192 || value.split(".").length !== 3) return false;
  try { return JSON.parse(Buffer.from(value.split(".")[1], "base64url").toString()).role === "anon"; }
  catch { return false; }
}
export function stagingPreflight(env: Environment) {
  const issues: Issue[] = [];
  const add = (code: string, setting: string) => issues.push({ code, setting });
  if (env.SAJU_MODE !== "research") add("RESEARCH_MODE_REQUIRED", "SAJU_MODE");
  const origin = serviceURL(env.APP_ORIGIN);
  if (!origin || env.APP_ORIGIN !== origin.origin) add("CANONICAL_HTTPS_ORIGIN_REQUIRED", "APP_ORIGIN");
  if (env.ALLOW_REMOTE_TEST !== "true") add("REMOTE_TEST_OPT_IN_REQUIRED", "ALLOW_REMOTE_TEST");
  if (!serviceURL(env.SUPABASE_URL)) add("AUTH_PROJECT_URL_REQUIRED", "SUPABASE_URL");
  if (!publishable(env.SUPABASE_PUBLISHABLE_KEY ?? "")) add("AUTH_PUBLISHABLE_KEY_REQUIRED", "SUPABASE_PUBLISHABLE_KEY");
  if (env.PAYMENT_PROVIDER !== "nicepay-test") add("NICEPAY_TEST_REQUIRED", "PAYMENT_PROVIDER");
  if (env.NICEPAY_MODE !== "sandbox") add("NICEPAY_SANDBOX_REQUIRED", "NICEPAY_MODE");
  if (!/^S2_\S+$/.test(env.NICEPAY_CLIENT_KEY ?? "")) add("NICEPAY_SERVER_TEST_KEY_REQUIRED", "NICEPAY_CLIENT_KEY");
  if (!env.NICEPAY_SECRET_KEY?.trim()) add("NICEPAY_SECRET_REQUIRED", "NICEPAY_SECRET_KEY");
  try {
    const db = new URL(env.DATABASE_URL ?? "");
    if (!["postgres:", "postgresql:"].includes(db.protocol) || !db.hostname || db.pathname.length < 2)
      throw new Error();
    // A remote preview must never silently fall back to local PGlite or disable certificate verification.
    if (db.searchParams.getAll("sslmode").length !== 1 || db.searchParams.get("sslmode") !== "verify-full" || db.searchParams.has("uselibpqcompat"))
      add("VERIFIED_DATABASE_TLS_REQUIRED", "DATABASE_URL");
  } catch { add("POSTGRES_DATABASE_REQUIRED", "DATABASE_URL"); }
  if (env.NODE_TLS_REJECT_UNAUTHORIZED === "0") add("TLS_VERIFICATION_DISABLED", "NODE_TLS_REJECT_UNAUTHORIZED");
  if (Object.keys(env).some(k => k.startsWith("NEXT_PUBLIC_") && /SECRET|SERVICE_ROLE|PASSWORD|DATABASE_URL|PRIVATE_KEY/.test(k)))
    add("PUBLIC_SECRET_EXPOSURE", "NEXT_PUBLIC_*");
  return {
    status: issues.length ? "blocked" : "configuration-valid-unverified",
    checks: "offline-only-no-connections",
    issues,
    unverified: ["expert-review", "provider-authentication", "kakao-redirect-and-login", "nicepay-checkout-and-refund",
      "hosted-access-control", "database-migration-and-roles", "hosted-backup-restore", "monitoring-and-policies"],
    publicReleaseApproved: false,
    realChargesEnabled: false,
  };
}

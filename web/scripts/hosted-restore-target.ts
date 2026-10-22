import assert from "node:assert/strict";

// Reject an unrelated account, transaction pooler, or TLS downgrade before connecting.
export function hostedRestoreTarget(
  settings: Record<string, string | undefined>, bootstrap: Record<string, string | undefined>, project: string,
) {
  assert.match(project, /^[a-z]{20}$/);
  assert.equal(settings.SAJU_MODE, "research");
  assert.equal(settings.ALLOW_REMOTE_TEST, "true");
  assert.equal(settings.SUPABASE_URL, `https://${project}.supabase.co`);
  assert.equal(bootstrap.SUPABASE_PROJECT_REF, project);
  assert.ok(settings.DATABASE_URL);
  assert.ok(bootstrap.SUPABASE_ADMIN_DATABASE_URL);
  const runtime = new URL(settings.DATABASE_URL);
  const admin = new URL(bootstrap.SUPABASE_ADMIN_DATABASE_URL);
  for (const url of [runtime, admin]) {
    assert.equal(url.protocol, "postgresql:");
    assert.match(url.hostname, /^aws-\d+-ap-northeast-2\.pooler\.supabase\.com$/);
    assert.equal(url.pathname, "/postgres");
    assert.equal(url.searchParams.get("sslmode"), "verify-full");
    assert.equal(url.searchParams.get("sslrootcert"), "certs/supabase-prod-ca-2021.crt");
    assert.ok(url.password);
    assert.deepEqual([...url.searchParams.keys()].sort(), ["sslmode", "sslrootcert"]);
  }
  assert.equal(runtime.username, `saju_server.${project}`);
  assert.equal(runtime.port, "6543");
  assert.equal(admin.username, `postgres.${project}`);
  assert.equal(admin.port, "5432");
  assert.equal(admin.hostname, runtime.hostname);
  return admin;
}

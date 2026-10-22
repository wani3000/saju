import {test} from "node:test";
import assert from "node:assert/strict";
import {hostedRestoreTarget} from "../scripts/hosted-restore-target";
const project = "abcdefghijklmnopqrst";
function fixture() {
  const base = "aws-0-ap-northeast-2.pooler.supabase.com";
  const suffix = "/postgres?sslmode=verify-full&sslrootcert=certs/supabase-prod-ca-2021.crt";
  return {
    settings: {SAJU_MODE:"research", ALLOW_REMOTE_TEST:"true", SUPABASE_URL:`https://${project}.supabase.co`,
      DATABASE_URL:`postgresql://saju_server.${project}:synthetic@${base}:6543${suffix}`},
    bootstrap: {SUPABASE_PROJECT_REF:project,
      SUPABASE_ADMIN_DATABASE_URL:`postgresql://postgres.${project}:synthetic@${base}:5432${suffix}`},
  };
}
test("restore source requires dedicated matching Seoul session pooler with verified TLS", () => {
  const {settings,bootstrap}=fixture();
  assert.equal(hostedRestoreTarget(settings,bootstrap,project).port,"5432");
});
test("restore rejects project confusion, host injection, TLS changes and inherited PG options", () => {
  const bad = [
    (s:Record<string,string>, b:Record<string,string>)=>{b.SUPABASE_PROJECT_REF="other";},
    (s:Record<string,string>)=>{s.SAJU_MODE="production";},
    (s:Record<string,string>)=>{s.ALLOW_REMOTE_TEST="false";},
    (s:Record<string,string>)=>{s.SUPABASE_URL="https://other.supabase.co";},
    (_:Record<string,string>,b:Record<string,string>)=>{b.SUPABASE_ADMIN_DATABASE_URL=b.SUPABASE_ADMIN_DATABASE_URL.replace(":5432",":6543");},
    (_:Record<string,string>,b:Record<string,string>)=>{b.SUPABASE_ADMIN_DATABASE_URL=b.SUPABASE_ADMIN_DATABASE_URL.replace("verify-full","require");},
    (_:Record<string,string>,b:Record<string,string>)=>{b.SUPABASE_ADMIN_DATABASE_URL=b.SUPABASE_ADMIN_DATABASE_URL.replace("pooler.supabase.com","pooler.supabase.com.attacker.invalid");},
    (_:Record<string,string>,b:Record<string,string>)=>{b.SUPABASE_ADMIN_DATABASE_URL+="&options=-c%20default_transaction_read_only%3Doff";},
  ];
  for(const mutate of bad){const {settings,bootstrap}=fixture();mutate(settings,bootstrap);
    assert.throws(()=>hostedRestoreTarget(settings,bootstrap,project));}
});

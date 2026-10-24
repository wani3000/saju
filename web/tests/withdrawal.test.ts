import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase, migrate, one, type Database } from '../src/server/db';
import { newSession } from '../src/server/service';
import { bindIdentity, startIdentity } from '../src/server/identity';
import { erasePersonalData, health } from '../src/server/operations';
import { processWithdrawal, WithdrawalProviderError, type WithdrawalProvider } from '../src/server/withdrawal';
import { withdrawalProvider } from '../src/server/withdrawal-provider';
let db: Database;
before(async()=>{db=await openDatabase('memory://');await migrate(db);});
after(()=>db.close());
async function request() {
  const session=await newSession(db),subject=randomUUID();
  await bindIdentity(db,session.owner,await startIdentity(db,session.owner),subject);
  await erasePersonalData(db,session.owner);
  return {...session,subject};
}
const fake = (calls: string[]): WithdrawalProvider => ({
  lookupKakaoId: async subject=>{calls.push('lookup:'+subject);return '123456789';},
  unlinkKakao: async id=>{calls.push('unlink:'+id);},
  deleteSupabase: async subject=>{calls.push('delete:'+subject);},
});
test('erasure atomically records linked identity, anonymous erasure never queues provider deletion',async()=>{
  const r=await request();
  const row=(await one(db,'SELECT * FROM withdrawal_requests WHERE owner_id=$1',[r.owner]))!;
  assert.equal(row.subject,r.subject);assert.equal(row.stage,'lookup');assert.equal(row.state,'pending');
  assert.equal(await one(db,'SELECT owner_id FROM sessions WHERE owner_id=$1',[r.owner]),undefined);
  const guest=await newSession(db);await erasePersonalData(db,guest.owner);
  assert.equal(await one(db,'SELECT * FROM withdrawal_requests WHERE owner_id=$1',[guest.owner]),undefined);
  await assert.rejects(erasePersonalData(db,r.owner));
  assert.equal((await db.query('SELECT * FROM withdrawal_requests WHERE owner_id=$1',[r.owner])).rows.length,1);
});
test('missing config blocks, configured stages resume in order and completion clears Kakao id',async()=>{
  const r=await request(),calls:string[]=[];
  await processWithdrawal(db,r.owner);
  assert.equal((await one(db,'SELECT reason FROM withdrawal_requests WHERE owner_id=$1',[r.owner]))!.reason,'CONFIGURATION_REQUIRED');
  const provider=fake(calls);
  for(let i=0;i<3;i++)assert.equal((await processWithdrawal(db,r.owner,provider)).advanced,true);
  assert.deepEqual(calls,['lookup:'+r.subject,'unlink:123456789','delete:'+r.subject]);
  const done=(await one(db,'SELECT * FROM withdrawal_requests WHERE owner_id=$1',[r.owner]))!;
  assert.equal(done.state,'completed');assert.equal(done.stage,'complete');assert.equal(done.kakao_id,null);assert.ok(done.completed_at);
  await processWithdrawal(db,r.owner,provider);assert.equal(calls.length,3);
});
test('uncertain unlink response stops before Supabase deletion and cannot be automatically retried',async()=>{
  const r=await request(),calls:string[]=[],provider=fake(calls);
  await processWithdrawal(db,r.owner,provider);
  provider.unlinkKakao=async()=>{calls.push('timeout');throw new Error('synthetic-private-provider-error');};
  await processWithdrawal(db,r.owner,provider);await processWithdrawal(db,r.owner,provider);
  const row=(await one(db,'SELECT * FROM withdrawal_requests WHERE owner_id=$1',[r.owner]))!;
  assert.equal(row.state,'unknown');assert.equal(row.stage,'kakao_unlink');
  assert.equal(row.reason,'RESPONSE_UNCERTAIN');assert.equal(JSON.stringify(row).includes('synthetic-private'),false);
  assert.deepEqual(calls,['lookup:'+r.subject,'timeout']);
});
test('concurrent worker cannot duplicate provider call, expired lease fences late success',async()=>{
  const r=await request();let release!:(id:string)=>void,calls=0;
  let entered!:()=>void;const started=new Promise<void>(resolve=>entered=resolve);
  const provider=fake([]);provider.lookupKakaoId=()=>{calls++;entered();return new Promise(resolve=>release=resolve);};
  const active=processWithdrawal(db,r.owner,provider);await started;
  assert.deepEqual(await processWithdrawal(db,r.owner,provider),{advanced:false});
  await db.query("UPDATE withdrawal_requests SET lease_until=now()-interval '1 second' WHERE owner_id=$1",[r.owner]);
  await processWithdrawal(db,r.owner,provider);
  release('123456789');assert.equal((await active).advanced,false);
  const row=(await one(db,'SELECT * FROM withdrawal_requests WHERE owner_id=$1',[r.owner]))!;
  assert.equal(row.state,'unknown');assert.equal(row.stage,'lookup');assert.equal(calls,1);
});
test('explicit provider rejection stays blocked and does not retry as a configuration change',async()=>{
  const r=await request(),provider=fake([]);let calls=0;
  provider.lookupKakaoId=async()=>{calls++;throw new WithdrawalProviderError('PROVIDER_REJECTED');};
  await processWithdrawal(db,r.owner,provider);await processWithdrawal(db,r.owner,provider);
  assert.equal(calls,1);assert.equal((await one(db,'SELECT reason FROM withdrawal_requests WHERE owner_id=$1',[r.owner]))!.reason,'PROVIDER_REJECTED');
});
test('provider refuses inactive/missing credentials without network; adapter uses verified identity and exact unlink target',async()=>{
  let requests=0;
  const subject=randomUUID();
  const settings={SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co',SUPABASE_SECRET_KEY:'synthetic-secret',KAKAO_ADMIN_KEY:'synthetic-admin',KAKAO_APP_ID:'1618169',SAJU_MODE:'research',ALLOW_REMOTE_TEST:'true',WITHDRAWAL_WORKER_ENABLED:'true'};
  const transport:typeof fetch=async(input,init)=>{
    requests++;const url=String(input);
    if(url==='https://kapi.kakao.com/v1/user/unlink'){
      assert.equal(new Headers(init?.headers).get('Authorization'),'KakaoAK synthetic-admin');
      assert.equal(String(init?.body),'target_id_type=user_id&target_id=123456789');
      return Response.json({id:123456789});
    }
    assert.equal(url,settings.SUPABASE_URL+'/auth/v1/admin/users/'+subject);
    assert.equal(new Headers(init?.headers).get('apikey'),'synthetic-secret');
    if(init?.method==='DELETE')return Response.json({id:subject});
    return Response.json({id:subject,identities:[{provider:'kakao',identity_data:{sub:'123456789'}}]});
  };
  assert.equal(withdrawalProvider({...settings,WITHDRAWAL_WORKER_ENABLED:'false'},transport),undefined);
  assert.equal(withdrawalProvider({...settings,KAKAO_ADMIN_KEY:''},transport),undefined);assert.equal(requests,0);
  const provider=withdrawalProvider(settings,transport)!;
  assert.equal(await provider.lookupKakaoId(subject),'123456789');await provider.unlinkKakao('123456789');await provider.deleteSupabase(subject);
  assert.equal(requests,3);
});
test('wrong provider identity or unlink response is never treated as successful deletion',async()=>{
  const settings={SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co',SUPABASE_SECRET_KEY:'synthetic-secret',KAKAO_ADMIN_KEY:'synthetic-admin',KAKAO_APP_ID:'1618169',SAJU_MODE:'research',ALLOW_REMOTE_TEST:'true',WITHDRAWAL_WORKER_ENABLED:'true'};
  const subject=randomUUID();
  const provider=withdrawalProvider(settings,async()=>Response.json({id:subject,identities:[{provider:'kakao',identity_data:{sub:123}}]}))!;
  await assert.rejects(provider.lookupKakaoId(subject),{reason:'IDENTITY_UNAVAILABLE'});
  const mismatch=withdrawalProvider(settings,async()=>Response.json({id:987654321}))!;
  await assert.rejects(mismatch.unlinkKakao('123456789'),{reason:'RESPONSE_UNCERTAIN'});
});
test('health reports blocked, unknown, expired and 24-hour withdrawal requests without identifiers',async()=>{
  const r=await request();
  let report=await health(db);
  const previous=report.withdrawals.reviewRequired;
  await db.query("UPDATE withdrawal_requests SET requested_at=now()-interval '24 hours' WHERE owner_id=$1",[r.owner]);
  report=await health(db);assert.equal(report.withdrawals.reviewRequired,previous+1);
  assert.ok(report.reasons.includes('WITHDRAWAL_REVIEW_REQUIRED'));
  assert.equal(JSON.stringify(report).includes(r.subject),false);assert.equal(JSON.stringify(report).includes(r.owner),false);
  const provider=fake([]);
  for(let i=0;i<3;i++)await processWithdrawal(db,r.owner,provider);
  assert.equal((await health(db)).withdrawals.reviewRequired,previous);
});

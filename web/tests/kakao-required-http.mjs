import assert from 'node:assert/strict';
const origin=process.env.TEST_ORIGIN;
assert.equal(process.env.SAJU_LOCAL_RUN,'1');assert.equal(new URL(origin).hostname,'127.0.0.1');
let cookie='';
async function call(path,body,method=body===undefined?'GET':'POST'){
 const r=await fetch(origin+'/api/'+path,{method,headers:{origin,cookie,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const set=r.headers.getSetCookie();if(set.length)cookie=set.map(c=>c.split(';')[0]).join('; ');
 return {status:r.status,body:await r.json()};
}
assert.equal((await call('session',{})).status,200);
const state=(await call('state')).body;assert.equal(state.authRequired,true);assert.equal(state.authenticated,false);assert.equal(state.authEnabled,false);assert.equal(state.profile,null);assert.equal(state.draft,null);
for(const key of ['results','orders','readingHistory','shares','pending'])assert.deepEqual(state[key],[]);
for(const [path,method] of [['draft','POST'],['comparisons','POST'],['process','POST'],['recover','POST'],['recovery-code','POST'],['account','DELETE'],['results/00000000-0000-4000-8000-000000000000','GET'],['results/00000000-0000-4000-8000-000000000000','DELETE'],['orders/00000000-0000-4000-8000-000000000000/confirm','POST']]){
 const result=await call(path,method==='POST'?{authenticated:true,provider:'kakao',subject:'fake'}:undefined,method);
 assert.equal(result.status,401,path);assert.equal(result.body.code,'KAKAO_LOGIN_REQUIRED',path);
}
assert.equal((await call('auth/start',{})).status,503);
assert.equal((await call('auth/finish',{choice:'switch'})).status,401);
const callback=await fetch(origin+'/auth/callback?code=fake',{headers:{cookie:cookie+'; chunbae-supabase-auth.0=synthetic; chunbae-supabase-auth-code-verifier=synthetic'},redirect:'manual'});
assert.ok(callback.headers.getSetCookie().some(c=>c.startsWith('chunbae-supabase-auth.0=;')&&c.includes('Max-Age=0')));
assert.equal(callback.status,307);assert.match(callback.headers.get('location'),/auth=failed/);
console.log('PASS: required Kakao HTTP gate, redacted state, forged claims/recovery denial, unconfigured auth and callback failure. No live OAuth assertion.');

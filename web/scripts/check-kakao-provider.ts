// Explicit staging authorize check only; never submits user consent or exchanges a code.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {createServerClient} from '@supabase/ssr';
import {kakaoOAuthOptions} from '../src/server/kakao-policy';

let step='settings';
try{
 const args=process.argv.slice(2);
 assert.ok(args.length===4&&args[0]==='--settings'&&args[2]==='--project');
 const env=parseEnv(readFileSync(args[1],'utf8')),project=args[3];
 assert.match(project,/^[a-z]{20}$/);assert.equal(env.ALLOW_REMOTE_TEST,'true');
 assert.equal(env.SAJU_MODE,'research');assert.equal(env.SAJU_AUTH_MODE,'kakao-required');
 const supabaseUrl=env.SUPABASE_URL,publishableKey=env.SUPABASE_PUBLISHABLE_KEY;
 assert.ok(supabaseUrl);assert.equal(supabaseUrl,`https://${project}.supabase.co`);
 assert.ok(publishableKey);assert.ok(publishableKey.startsWith('sb_publishable_'));
 assert.ok(env.APP_ORIGIN);const origin=new URL(env.APP_ORIGIN);
 assert.equal(origin.protocol,'https:');assert.equal(origin.origin,env.APP_ORIGIN);
 step='sdk-pkce';
 const auth=createServerClient(supabaseUrl,publishableKey,{
  cookies:{getAll:()=>[],setAll:()=>{}},
  global:{fetch:async()=>{throw new Error('UNEXPECTED_SDK_NETWORK_REQUEST');}},
 });
 const {data,error}=await auth.auth.signInWithOAuth({provider:'kakao',options:kakaoOAuthOptions(origin.origin)});
 assert.equal(error,null);assert.ok(data.url);
 const authorize=new URL(data.url);assert.equal(authorize.origin,env.SUPABASE_URL);
 assert.equal(authorize.pathname,'/auth/v1/authorize');assert.equal(authorize.searchParams.get('code_challenge_method'),'s256');
 assert.match(authorize.searchParams.get('code_challenge')??'',/^[A-Za-z0-9_-]{43}$/);
 step='hosted-authorize';
 const response=await fetch(authorize,{redirect:'manual',headers:{apikey:publishableKey},signal:AbortSignal.timeout(15000)});
 assert.equal(response.status,302);const location=response.headers.get('location');assert.ok(location);
 const provider=new URL(location);assert.equal(provider.origin,'https://kauth.kakao.com');
 assert.equal(provider.pathname,'/oauth/authorize');
 assert.equal(provider.searchParams.get('redirect_uri'),`${env.SUPABASE_URL}/auth/v1/callback`);
 assert.equal(provider.searchParams.get('response_type'),'code');assert.ok(provider.searchParams.get('state'));
 step='minimal-provider-scope';
 assert.equal(provider.searchParams.getAll('scope').length,1);
 assert.deepEqual(provider.searchParams.get('scope')?.split(/[ ,]+/).filter(Boolean).sort(),['profile_image','profile_nickname']);
 console.log(JSON.stringify({status:'passed',scope:'hosted-kakao-authorize-only',pkce:true,providerEnabled:true,
  callbackMatches:true,profileOnlyScope:true,emailRequested:false,codeExchanged:false,browserOAuthVerified:false}));
}catch{
 console.log(JSON.stringify({status:'failed',step,code:'KAKAO_PROVIDER_CHECK_FAILED'}));process.exitCode=1;
}

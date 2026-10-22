import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServerClient} from '@supabase/ssr';
import {kakaoOAuthOptions} from '../src/server/kakao-policy';

test('real SSR SDK preserves profile-only provider scope and PKCE without requesting email or contacting a provider',async()=>{
 const stored:string[]=[];
 const auth=createServerClient('https://synthetic.supabase.co','sb_publishable_synthetic',{
  cookies:{getAll:()=>[],setAll:items=>{stored.push(...items.map(c=>c.name));}},
  global:{fetch:async()=>{throw new Error('UNEXPECTED_NETWORK_REQUEST');}},
 });
 const {data,error}=await auth.auth.signInWithOAuth({provider:'kakao',options:kakaoOAuthOptions('https://staging.example')});
 assert.equal(error,null);assert.ok(data.url);
 const url=new URL(data.url);
 assert.equal(url.origin,'https://synthetic.supabase.co');assert.equal(url.pathname,'/auth/v1/authorize');
 assert.equal(url.searchParams.get('provider'),'kakao');
 assert.equal(url.searchParams.get('redirect_to'),'https://staging.example/auth/callback');
 // `scopes` would only append to Supabase's unwanted email default.
 assert.equal(url.searchParams.has('scopes'),false);
 assert.deepEqual(url.searchParams.getAll('scope'),['profile_nickname,profile_image']);
 assert.equal(url.searchParams.get('code_challenge_method'),'s256');
 assert.match(url.searchParams.get('code_challenge')??'',/^[A-Za-z0-9_-]{43}$/);
 assert.ok(stored.some(name=>name.endsWith('-code-verifier')));
});

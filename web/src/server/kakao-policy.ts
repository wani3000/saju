import {z} from 'zod';
import {one,type Sql} from './db';
import {AppError} from '../domain/model';
import {kakaoAvatar,profileName,type ProfileSummary} from '../domain/profile';
// Guest access is an explicit local research/demo mode. Staging must use kakao-required.
export const kakaoRequired=(mode=process.env.SAJU_AUTH_MODE)=>mode!=='local-demo';
export async function hasKakaoSession(db:Sql,owner:string,secretHash:string){
 return Boolean(await one(db,`SELECT s.owner_id FROM sessions s JOIN auth_identities i ON i.subject=s.auth_subject AND i.owner_id=s.owner_id
  JOIN accounts a ON a.id=s.owner_id WHERE s.token_hash=$1 AND s.owner_id=$2 AND s.expires_at>now() AND a.deleted_at IS NULL AND a.merged_into IS NULL`,[secretHash,owner]));
}
export async function requireKakaoSession(db:Sql,owner:string,secretHash:string){
 if(!(await hasKakaoSession(db,owner,secretHash)))throw new AppError('KAKAO_LOGIN_REQUIRED',401,'카카오로 로그인한 뒤 시작해 주세요.');
}
// Call only with the server's getUser() response after the PKCE code exchange.
export function verifiedKakaoProfile(input:unknown):{subject:string;profile:ProfileSummary}{
 const user=z.object({id:z.uuid(),is_anonymous:z.boolean().optional(),identities:z.array(z.object({provider:z.string(),identity_data:z.record(z.string(),z.unknown()).optional()})),user_metadata:z.record(z.string(),z.unknown()).optional()}).parse(input);
 const identity=user.identities.find(i=>i.provider==='kakao');
 if(user.is_anonymous||!identity)throw new AppError('KAKAO_IDENTITY_REQUIRED',401);
 const meta=identity.identity_data??{},display=user.user_metadata??{};
 return {subject:user.id,profile:{displayName:profileName(meta.name??meta.full_name??meta.preferred_username??display.name??display.full_name),avatarUrl:kakaoAvatar(meta.avatar_url??meta.picture??display.avatar_url)}};
}
export function loggedOutState(){return {kind:'guest',authLinked:false,authenticated:false,profile:null,draft:null,revision:0,free:'available',results:[],pending:[],shares:[],orders:[],readingHistory:[]};}

export const temporaryAuthCookie='chunbae-supabase-auth';
export const isTemporaryAuthCookie=(name:string)=>/^chunbae-supabase-auth(?:-code-verifier)?(?:\.\d+)?$/.test(name);

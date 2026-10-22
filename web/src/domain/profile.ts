export type ProfileSummary={displayName:string|null;avatarUrl:string|null};
export type ReadingHistoryItem={id:string;other_name:string|null;relation:string|null;created_at:string;state:string;can_open:boolean;entitlement_state:string|null};
// Display metadata is never an identity credential. Only Kakao's image hosts are accepted.
export function kakaoAvatar(value:unknown):string|null{
 if(typeof value!=='string'||value.length>2048)return null;
 try{
  const u=new URL(value);
  if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.port||u.hash)return null;
  if(!['k.kakaocdn.net','img1.kakaocdn.net','t1.kakaocdn.net','t1.daumcdn.net','k.kakao.com'].includes(u.hostname))return null;
  u.protocol='https:';return u.toString();
 }catch{return null;}
}
export function profileName(value:unknown):string|null{
 if(typeof value!=='string')return null;
 return value.replace(/[\u0000-\u001f\u007f-\u009f]/g,'').trim().slice(0,60)||null;
}

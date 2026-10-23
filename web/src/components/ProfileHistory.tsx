"use client";
import {useState} from 'react';
import IconPersonCircleLine from '@karrotmarket/react-monochrome-icon/IconPersonCircleLine';
import {kakaoAvatar,type ProfileSummary,type ReadingHistoryItem} from '@/domain/profile';
export type HistoryOrder={id:string;comparison_id:string;amount:number;state:string;provider:string;created_at?:string;other_name?:string|null};
export function ProfileAvatar({profile}:{profile?:ProfileSummary|null}){
 const [failed,setFailed]=useState<string|null>(null),src=kakaoAvatar(profile?.avatarUrl);
 return src&&failed!==src?<img className="profile-avatar" src={src} alt="" width={44} height={44} referrerPolicy="no-referrer" onError={()=>setFailed(src)}/>:<IconPersonCircleLine size={36} aria-hidden="true"/>;
}
const date=(value?:string)=>value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('ko-KR',{dateStyle:'medium',timeStyle:'short'}):'기록 시각 없음';
const statuses:Record<string,string>={created:'결제 전',confirming:'승인 확인 중',confirmation_unknown:'결제 상태 확인 필요',paid:'테스트 승인 완료',refund_pending:'테스트 취소 확인 중',refunded:'테스트 취소 완료',cancelled:'주문 취소'};
export default function ProfileHistory({profile,preview,readings,orders,busy,onOpen,onOrder,onDelete}:{profile?:ProfileSummary|null;preview:boolean;readings:ReadingHistoryItem[];orders:HistoryOrder[];busy:boolean;onOpen:(id:string)=>void;onOrder:(order:HistoryOrder,action:'open'|'reconcile'|'refund')=>void;onDelete:(id:string)=>void}){
 const [tab,setTab]=useState<'readings'|'payments'>('readings');
 const [confirmDelete,setConfirmDelete]=useState<string|null>(null);
 return <section className="profile-history">
  <div className="card profile-summary"><ProfileAvatar profile={profile}/><div><h2>{profile?.displayName|| (preview?'체험 중인 손님':'나의 프로필')}</h2><p>{preview?'이곳에서 나눈 이야기를 다시 펼쳐 보게.':'자네가 남긴 이야기와 이용 내역을 모아 두었네.'}</p></div></div>
  <div className="history-tabs" role="group" aria-label="내역 선택">
   <button className={tab==='readings'?'primary':'secondary'} aria-pressed={tab==='readings'} onClick={()=>setTab('readings')}>사주 조회 내역</button>
   <button className={tab==='payments'?'primary':'secondary'} aria-pressed={tab==='payments'} onClick={()=>setTab('payments')}>결제 내역</button>
  </div>
  {tab==='readings'?<div aria-label="사주 조회 내역"><h2>사주 조회 내역</h2>{!readings.length&&<p>아직 남긴 이야기가 없네. 두 사람의 생일부터 적어 보게.</p>}{readings.map(r=><article className="card" key={r.id}>
   <h3>{r.other_name||'함께 본 사람'}{r.relation?` · ${r.relation}`:''}</h3><p className="hint">{date(r.created_at)}</p>
   <p>{r.can_open?'다시 읽을 수 있네.':r.entitlement_state==='revoked'||r.state==='cancelled'?'이용이 취소된 이야기일세.':r.state==='failed'?'준비가 멈췄네. 다시 시도할 수 있네.':['awaiting_payment','awaiting-payment'].includes(r.state)?'결제를 기다리는 이야기일세.':'이야기를 준비하고 있네.'}</p>
   {(r.can_open||r.state!=='cancelled'&&r.entitlement_state!=='revoked')&&<button className="secondary" disabled={busy} onClick={()=>onOpen(r.id)}>{r.can_open?'이야기 다시 보기':'이어서 확인하기'}</button>}
   {orders.some(o=>o.comparison_id===r.id&&['confirming','confirmation_unknown','refund_pending'].includes(o.state))?<p className="hint">결제·취소 확인을 마친 뒤 이 이야기를 지울 수 있네.</p>:<>
    <button id={`erase-trigger-${r.id}`} className="secondary" disabled={busy} aria-expanded={confirmDelete===r.id} aria-controls={`erase-confirm-${r.id}`} onClick={()=>setConfirmDelete(confirmDelete===r.id?null:r.id)}>이 이야기 삭제</button>
    {confirmDelete===r.id&&<div id={`erase-confirm-${r.id}`} role="group" aria-label="이야기 삭제 확인">
    <p>이 이야기를 지우면 다시 볼 수 없고, 공유 링크도 닫히네. 결제 내역은 남으며, 환불은 따로 요청해야 하네.</p>
    <p className="hint">이미 본 무료 이야기를 지워도 무료 기회가 새로 생기지는 않네.</p>
    <button className="secondary" disabled={busy} onClick={()=>{setConfirmDelete(null);document.getElementById(`erase-trigger-${r.id}`)?.focus();}}>계속 보관하기</button>
    <button className="primary" disabled={busy} onClick={()=>onDelete(r.id)}>이야기 지우기</button>
   </div>}</>}
  </article>)}</div>:<div aria-label="결제 내역"><h2>결제 내역</h2><p className="hint">지금은 테스트 내역이며 실제로 청구되지 않네.</p>{!orders.length&&<p>아직 결제 내역이 없네. 무료로 본 이야기는 사주 조회 내역에 있네.</p>}{orders.map(o=><article className="card" key={o.id}>
   <h3>{o.other_name?`${o.other_name}의 이야기`:'추가 이야기'} · {o.amount.toLocaleString('ko-KR')}원</h3><p className="hint">{date(o.created_at)}</p><p>{statuses[o.state]||'상태 확인 필요'} · 실제 청구 없음</p>
   {o.state==='refund_pending'&&<p className="hint">취소를 확인하는 동안은 이 이야기를 열 수 없네. 새로 결제하지 말고 아래에서 취소 상태를 다시 확인해 보게.</p>}
   {o.state==='created'&&<button className="secondary" disabled={busy} onClick={()=>onOrder(o,'open')}>주문 이어가기</button>}
   {['confirming','confirmation_unknown'].includes(o.state)&&<button className="secondary" disabled={busy} onClick={()=>onOrder(o,'reconcile')}>결제 상태 확인</button>}
   {['paid','refund_pending'].includes(o.state)&&<button className="secondary" disabled={busy} onClick={()=>onOrder(o,'refund')}>{o.state==='refund_pending'?'취소 재시도':'테스트 결제 취소'}</button>}
  </article>)}</div>}
 </section>;
}

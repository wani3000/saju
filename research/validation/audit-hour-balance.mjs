import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {chart} from './audit-extended-sources.mjs';
import {hourBalanceVersion,preferredHours,earthInteractions,analyzeHourAndInteractions,analyzeGeneralBalance,reviewHourAndBalance} from './hour-balance-review.mjs';
const stems=[...'갑을병정무기경신임계'],branches=[...'자축인묘진사오미신유술해'];
const pillar=s=>s+(stems.indexOf(s)%2?'축':'자');
export function preferredChart(r,reverse=false) {
  const day=r.pair[reverse?1:0],partner=r.pair[reverse?0:1],b=r.months[0];
  const neutral=stems.find(s=>!r.pair.includes(s)&&stems.indexOf(s)%2===branches.indexOf(b)%2);
  return chart({year:pillar(partner),month:neutral+b,day:pillar(day),hour:r.hour});
}
export function interactionChart(r) {return chart({year:pillar(r.pair[0]),month:pillar(r.pair[1]),day:'갑자',hour:'기축'});}
export function buildHourBalanceAudit() {
  return {ruleVersion:hourBalanceVersion,productionApproved:false,
    scope:'Synthetic structural fixtures, not calendar-valid births; integrated inputs are synthetic calendar cases.',
    hourCases:preferredHours.flatMap(r=>[false,true].map(reverse=>({id:r.pair+(reverse?'-reverse':''),review:analyzeHourAndInteractions(preferredChart(r,reverse))}))),
    interactionCases:earthInteractions.map(r=>({id:r.pair,review:analyzeHourAndInteractions(interactionChart(r))})),
    balanceCases:[['relative-groups',chart({year:'을축',month:'신유',day:'갑자',hour:'정묘'})],
      ['unknown-hour',{...chart({year:'갑인',month:'갑인',day:'갑인',hour:null}),timeKnown:false}],
      ['candidate-correlation',{...chart({year:'갑자',month:null,day:'갑자',hour:'갑자'}),candidates:{month:['기축','을묘']}}]]
      .map(([id,p])=>({id,review:analyzeGeneralBalance(p)})),
    integratedCases:[['ordinary',{calendar:'solar',leap:false,timeKnown:true,year:2024,month:2,day:10,hour:8,minute:30}],
      ['午-unresolved',{calendar:'solar',leap:false,timeKnown:false,year:2024,month:6,day:15}]]
      .map(([id,input])=>({id,review:reviewHourAndBalance(input)}))};
}
export function renderHourBalanceAudit(r) {
  const lines=['# 시상 왕기·파상·자조와 일반 강약·중화 감수','','연구용 조건 관찰입니다. 신강·신약·중화 또는 합화 성립의 최종 판정이 아닙니다.','',
    '| 합 | 원문 선호 시주 | 함께 제시된 월지 |','|---|---|---|'];
  for(const h of preferredHours) lines.push(`| ${h.pair} | ${h.hour} | ${h.months.join('·')} |`);
  lines.push('','선호 시주/월 일치는 원문 예시의 일부 조건입니다. 목록 밖 시주가 시상 왕기 부재를 뜻하지 않으며, 목록 일치가 왕기·합화의 성립을 뜻하지 않습니다.',
    '','## 토로 화하는 경우의 파상·자조 예시','','| 추가 합 | 가정한 변화 | 원문 관계 |','|---|---|---|');
  for(const e of earthInteractions) lines.push(`| ${e.pair} | ${e.hypotheticalElement} | ${e.sourceLabel} |`);
  lines.push('','위 관계는 토로 화함과 추가 합의 변화가 모두 성립한다는 전제가 있습니다. 현재는 보이는 글자만 관찰하며 실제 손상·도움은 미판정입니다. 삼명통회 갑기 단락의 화 기피 조건과 명리집성의 화토 자조는 출처별로 병기합니다.',
    '','## 일반 강약·중화 검토','','월령·통근·사령·투출 근거는 기존 통합 감수와 함께 제공합니다. 재/겁·관/상·살/제 관계에서 양쪽 요소의 존재를 관찰하되 경중·왕쇠는 판단하지 않습니다. 식상은 제어 관계의 검토 후보이며 제살 성립을 뜻하지 않습니다.',
    '','| 사례 | 재/겁 관찰 | 관/상 관찰 | 살/제 후보 관찰 |','|---|---|---|---|');
  const names={'both-groups-observed-in-all-candidates':'전체 후보에서 양쪽 관찰','candidate-dependent-cooccurrence':'일부 후보 조합에서만 관찰',
    'not-both-observed':'양쪽 동시 관찰 없음','hour-unobserved-not-both-observed':'시각 미상·양쪽 동시 관찰 없음'};
  for(const c of r.balanceCases) lines.push(`| ${c.id} | ${c.review.relationalReviews.map(x=>names[x.status]).join(' | ')} |`);
  lines.push('','요소 미관찰은 중화 또는 무근의 증명이 아닙니다. 태왕/왕극·태쇠/쇠극의 일반 경계, 유효한 제어 및 합화 충분조건은 후속 과제입니다.',
    '',`검토 사례: 시주 ${r.hourCases.length}개, 파상·자조 ${r.interactionCases.length}개, 일반 중화 ${r.balanceCases.length}개, 실제 입력 경로 ${r.integratedCases.length}개.`,
    '','[전체 JSON](hour-balance-audit.json) · [출처·범위](../../../docs/hour-balance-review.md)','');
  return lines.join('\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  const flags=process.argv.slice(2);if(flags.some(f=>!['--check','--release-check'].includes(f))) throw new Error('UNKNOWN_ARGUMENT');
  const r=buildHourBalanceAudit();
  for(const [name,content] of [['hour-balance-audit.json',JSON.stringify(r,null,2)+'\n'],['hour-balance-drafts.md',renderHourBalanceAudit(r)]]) {
    const file=new URL('./reports/'+name,import.meta.url);
    if(flags.length){if(readFileSync(file,'utf8')!==content) throw new Error('HOUR_BALANCE_AUDIT_STALE');}else writeFileSync(file,content);
  }
  console.log('PASS: 19 hour, interaction, relational and integrated cases reproduce.');
  if(flags.includes('--release-check')){console.log('BLOCKED: general strength, moderation and transformation remain unapproved.');process.exitCode=2;}
}

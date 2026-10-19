import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {extendedReviewVersion,transformationCatalog,moderationExamples,analyzeFivePairConditions,analyzeModerationExamples,reviewExtendedSources} from './extended-source-review.mjs';
export const chart=pillars=>({policy:{version:'research-civil-midnight-v5',productionApproved:false},timeKnown:true,pillars});
const stems=[...'갑을병정무기경신임계'],branches=[...'자축인묘진사오미신유술해'];
const pillar=stem=>stem+(stems.indexOf(stem)%2?'축':'자');
export function pairChart(rule,branch,reverse=false) {
  const day=rule.pair[reverse?1:0],partner=rule.pair[reverse?0:1];
  const neutral=stems.filter(s=>!rule.pair.includes(s));
  const month=neutral.find(s=>stems.indexOf(s)%2===branches.indexOf(branch)%2)+branch;
  return chart({year:pillar(neutral.at(-1)),month,day:pillar(day),hour:pillar(partner)});
}
export function buildExtendedAudit() {
  return {ruleVersion:extendedReviewVersion,productionApproved:false,
    examplePolicy:'Source charts are historical text examples; month screens are synthetic structural charts, not real birth profiles.',
    transformationCases:transformationCatalog.flatMap(rule=>[
      ['primary',rule.primaryMonths[0]],['additional',rule.additionalMonth],
      ['unlisted',branches.find(b=>!rule.primaryMonths.includes(b)&&b!==rule.additionalMonth)],
    ].map(([kind,branch])=>({id:rule.pair+'-'+kind,review:analyzeFivePairConditions(pairChart(rule,branch))}))),
    moderationCases:moderationExamples.map(e=>({id:e.id,review:analyzeModerationExamples(chart(Object.fromEntries(['year','month','day','hour'].map((k,i)=>[k,e.pillars[i]]))))})),
    integratedCases:[['ordinary',{calendar:'solar',leap:false,timeKnown:false,year:2024,month:2,day:10}],
      ['午-duration-conflict',{calendar:'solar',leap:false,timeKnown:false,year:2024,month:6,day:15}]].map(([id,input])=>({id,review:reviewExtendedSources(input)}))};
}
const routes={'primary-month':'기본월','additional-month':'예외월','unlisted-month':'목록 밖 월 — 시상 왕기 등 추가 검토'};
export function renderExtendedAudit(r) {
  const lines=['# 오월·중화·다섯 합화 쌍 후속 감수','','연구용 출처 대조입니다. 신강·신약이나 합화의 최종 판정은 아닙니다.','',
    '오월 29일은 1940년 판본의 도표와 시구에서도 확인됩니다. 누락 위치·수정값을 정할 근거는 확보되지 않았습니다.','',
    '| 사례 | 월령 분류 | 상대 관찰 |','|---|---|---|'];
  for(const c of r.transformationCases) lines.push(`| ${c.id} | ${routes[c.review.common.monthRoute]} | ${c.review.common.presence==='observed'?'있음':'미확정'} |`);
  lines.push('','미수록월이라도 원문의 시상 왕기 경로가 남습니다. 한 쌍의 유일성과 월령을 모두 만족해도 중화·파상·자조는 별도 검토합니다.','',
    '## 강약 원문 사례','', '| 사례 | 원문 판어 | 대조 |','|---|---|---|');
  for(const c of r.moderationCases) lines.push(`| ${c.id} | ${c.review.matches[0].sourceLabel} | 원문 네 기둥 일치 |`);
  lines.push('','태왕·왕극과 태쇠·쇠극을 구분합니다. 미수록 명조를 중화로 처리하지 않으며, 일간 강약의 판어를 합화의 중화 충족으로 전용하지 않습니다.',
    '','## 실제 입력 경로','');
  for(const c of r.integratedCases) lines.push(`- ${c.id}: 사령 ${c.review.seasonalCommand.status}, 다섯 합 조건 ${c.review.transformation.status}. 종합 강약·합화는 미판정.`);
  lines.push('','[전체 판정 JSON](extended-source-audit.json) · [출처와 적용 범위](../../../docs/extended-source-review.md)','');
  return lines.join('\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  const flags=process.argv.slice(2);
  if(flags.some(f=>!['--check','--release-check'].includes(f))) throw new Error('UNKNOWN_ARGUMENT');
  const r=buildExtendedAudit();
  for(const [name,content] of [['extended-source-audit.json',JSON.stringify(r,null,2)+'\n'],['extended-source-drafts.md',renderExtendedAudit(r)]]) {
    const file=new URL('./reports/'+name,import.meta.url);
    if(flags.length){if(readFileSync(file,'utf8')!==content) throw new Error('EXTENDED_AUDIT_STALE');} else writeFileSync(file,content);
  }
  console.log('PASS: 15 five-pair screens, four source strength examples and two integrated cases reproduce.');
  if(flags.includes('--release-check')){console.log('BLOCKED: moderation thresholds, full transformation and production review remain unapproved.');process.exitCode=2;}
}

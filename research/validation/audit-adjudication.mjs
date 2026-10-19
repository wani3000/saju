import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {chart} from './audit-extended-sources.mjs';
import {adjudicationVersion,strengthReferences,transformationVetoes,adjudicateStrengthReference,adjudicateTransformationVetoes,auditVisibleSupportShortcut,auditScoreProposal,auditScaleCounterexamples} from './adjudication-review.mjs';
import {stems} from './reading-rules.mjs';
export const pillar=s=>s+(stems.indexOf(s)%2?'축':'자');
export const sourceChart=c=>chart(Object.fromEntries(['year','month','day','hour'].map((k,i)=>[k,c.pillars[i]])));
export function vetoChart(r,reverse=false) {
 const day=r.pair[reverse?1:0],partner=r.pair[reverse?0:1];
 const neutral=[...stems].find(s=>!r.pair.includes(s)&&s!==r.stem);
 return chart({year:pillar(partner),month:pillar(r.stem),day:pillar(day),hour:pillar(neutral)});
}
export const scoreProposal=(components,overrides={})=>({version:'score-proposal-v1',components,
 directionPolicy:'symmetric',unknownHourPolicy:'omit',candidatePolicy:'all-candidates',normalization:'fixed-scale',duplicatePolicy:'deduplicate-feature',...overrides});
export function buildAdjudicationAudit() {
 return {ruleVersion:adjudicationVersion,productionApproved:false,
  scope:'Historical text charts and synthetic structural/numeric probes, not real birth outcomes or validated scoring weights.',
  strengthCases:strengthReferences.map(c=>({id:c.id,review:adjudicateStrengthReference(sourceChart(c))})),
  transformationCases:transformationVetoes.flatMap(r=>[false,true].map(reverse=>({id:r.pair+(reverse?'-reverse':''),review:adjudicateTransformationVetoes(vetoChart(r,reverse))}))),
  rejectedStrengthShortcut:auditVisibleSupportShortcut(),
  scoringProposals:[
   ['symbol-count',scoreProposal([{ruleId:'stem-combination:갑기',weight:10},{ruleId:'branch-clash:자오',weight:-10}],{duplicatePolicy:'count-duplicates'})],
   ['individual-strength-as-compatibility',scoreProposal([{ruleId:'strength:wood-too-strong',weight:5}])],
   ['source-veto-as-compatibility',scoreProposal([{ruleId:'veto:갑기',weight:-5}],{normalization:'cohort-minmax'})]
  ].map(([id,p])=>({id,review:auditScoreProposal(p)})),scaleProbes:auditScaleCounterexamples()};
}
export function renderAdjudicationAudit(r) {
 const lines=['# 강약·합화 판정과 궁합 점수 기준 감수','','원문 명조 판어와 출처별 부정 조건을 적용한 연구 결과입니다. 일반 강약·합화 분류기나 궁합 점수의 운영 승인은 아닙니다.','',
  '## 원문 강약 20명조','','| 원문 사례 | 원문 판어 | 쪽 |','|---|---|---|'];
 for(const c of r.strengthCases)lines.push(`| ${c.id} | ${c.review.sourceClassification.label} | ${c.review.matches[0].source.pdfPage} |`);
 lines.push('','물의 쇠극 마지막 명조에는 원문이 연·월의 무계 종화를 직접 언급합니다. 이 사례 판어를 일간 합화 일반 규칙으로 바꾸지 않습니다.',
  '','## 다섯 합의 방해 조건','','| 합 | 방해 천간 | 적용 위치 |','|---|---|---|');
 for(const c of transformationVetoes)lines.push(`| ${c.pair} | ${c.stem} | ${c.scope==='between-pair'?'두 합 위치 사이':'관찰된 천간 전체'} |`);
 lines.push('','갑기·을경의 間之와 나머지의 柱有를 구분합니다. 한 상대가 방해받아도 다른 상대를 함께 검사하며, 시각 미상은 미관찰 상대를 배제할 수 없습니다. 방해 부재는 합화 성립이 아닙니다.',
  '','## 배제한 강약 지름길','',`다른 천간 3개 중 생조 2개 이상이면 강하다는 가설은 원문과 ${r.rejectedStrengthShortcut.counterexamples.length}사례에서 어긋났습니다. 이 20명조는 극단 사례만 포함하므로 일반 정확도 수치로 읽지 않습니다.`,
  '',...r.rejectedStrengthShortcut.counterexamples.map(id=>'- '+id),'',
  '## 점수안 감수','','아래 제안의 수치는 결함 검사용 임의값이며 채택된 가중치가 아닙니다.','');
 for(const c of r.scoringProposals)lines.push(`- ${c.id}: ${c.review.blockers.join(', ')}. 점수·지도 반경은 null.`);
 lines.push('',`합성 척도 검사: 같은 값 60을 집단 최솟값/최댓값으로 정규화하면 ${r.scaleProbes.cohortNormalization.before}에서 ${r.scaleProbes.cohortNormalization.afterAddingAnother}로 바뀝니다. 다른 사람 추가로 기존 거리가 바뀌는 정책은 채택하지 않습니다.`,
  '','기호 정의의 출처, 개인 강약 판어, 개인 합화 방해는 두 사람 관계의 효과나 숫자 가중치 근거를 대신하지 못합니다. 방향이 다른 십성도 대칭 합산 정책 없이 수치화하지 않습니다.',
  '','[전체 결과](adjudication-audit.json) · [출처·결정·미완료 범위](../../../docs/adjudication-score-review.md)','');
 return lines.join('\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const flags=process.argv.slice(2);if(flags.some(f=>!['--check','--release-check'].includes(f)))throw new Error('UNKNOWN_ARGUMENT');
 const r=buildAdjudicationAudit();for(const [name,content]of [['adjudication-audit.json',JSON.stringify(r,null,2)+'\n'],['adjudication-drafts.md',renderAdjudicationAudit(r)]]){
  const file=new URL('./reports/'+name,import.meta.url);if(flags.length){if(readFileSync(file,'utf8')!==content)throw new Error('ADJUDICATION_AUDIT_STALE');}else writeFileSync(file,content);
 }
 console.log('PASS: 20 strength cases, ten veto cases and three score proposal audits reproduce.');
 if(flags.includes('--release-check')){console.log('BLOCKED: no exhaustive general classifier, conflict/rescue precedence or adopted compatibility weights.');process.exitCode=2;}
}

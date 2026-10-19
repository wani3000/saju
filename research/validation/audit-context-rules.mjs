import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {analyzeContext} from './context-analysis.mjs';
import {buildContextDraft,buildRelationshipReview} from './context-drafts.mjs';
import {calculateProfile} from './adapter.mjs';

export function buildContextAudit() {
  const chart=pillars => ({policy:{version:'research-civil-midnight-v5',productionApproved:false},timeKnown:true,pillars});
  const ordinary=chart({year:'갑자',month:'병인',day:'무진',hour:'경오'});
  const partner=chart({year:'기축',month:'신해',day:'계유',hour:'을미'});
  const uncertain=calculateProfile({calendar:'solar',leap:false,timeKnown:false,year:2024,month:2,day:4});
  const examples=[
    ['month-exposure-and-root-evidence',ordinary],
    ['intervening-controller',chart({year:'갑자',month:'경오',day:'기축',hour:'정묘'})],
    ['distant-year-hour-pair',chart({year:'갑자',month:'병인',day:'무진',hour:'기축'})],
    ['source-example-separated-partners',chart({year:'경오',month:'을유',day:'갑자',hour:'을해'})],
    ['coexisting-combination-and-clash',chart({year:'갑자',month:'병오',day:'기축',hour:'을미'})],
    ['ipchun-unknown-hour',uncertain],
    ['correlated-month', {...ordinary,pillars:{...ordinary.pillars,month:null},candidates:{month:['병인','정묘']}}],
    ['correlated-day',{...ordinary,pillars:{...ordinary.pillars,day:null},candidates:{day:['갑자','을축']}}],
  ];
  return {ruleVersion:'month-combination-context-research-v1',productionApproved:false,
    exampleData:'Synthetic chart fixtures; the source-example chart is transcribed for structural testing, not treated as a verified person or prediction.',
    cases:examples.map(([id,profile]) => ({id,analysis:analyzeContext(profile),draft:buildContextDraft(profile)})),
    relationshipCases:[...['friend','family','partner'].map(type => ({id:type,draft:buildRelationshipReview(ordinary,partner,type)})),
      {id:'uncertain-friend',draft:buildRelationshipReview(uncertain,partner,'friend')}]};
}
const references=sources => [...new Set(sources.flatMap(s => (s.pdfPages ?? [s.pdfPage]).map(p => `${s.id} PDF ${p}쪽`)))].join('; ');
export function renderContextAudit(report) {
  const lines=['# 월령·합화 조건과 관계별 풀이 감수','','연구용 합성 사례. 운영 미승인. 점수·강약·합화 판정 없음.',''];
  for (const c of report.cases) {
    lines.push(`## ${c.id}`,'',c.draft.notice);
    const coverage=c.draft.coverage[0];
    if (coverage.omittedPositions.length) lines.push('시간 모름: 시주는 관찰하지 않았습니다.');
    if (coverage.boundaryReviewRequired) lines.push('절기 경계: 후보 전체의 공통 사실만 문장으로 남겼습니다.');
    if (coverage.clockReviewRequired) lines.push('역사 시계 검토가 필요한 입력입니다.');
    lines.push('',...c.draft.statements.map(s => `- ${s.text} (근거: ${references(s.sources)})`),'');
    if (!c.draft.statements.length) lines.push('확정 문장으로 낼 공통 관찰 항목이 없습니다.','');
  }
  for (const c of report.relationshipCases) {
    lines.push(`## 관계별 초안: ${c.id}`,'',c.draft.summary,'');
    for (const coverage of c.draft.coverage) {
      if (coverage.omittedPositions.length) lines.push(`${coverage.side.toUpperCase()}: 시간 모름으로 시주를 제외했습니다.`);
      if (coverage.boundaryReviewRequired) lines.push(`${coverage.side.toUpperCase()}: 절기 경계 후보를 보존했습니다.`);
      if (coverage.clockReviewRequired) lines.push(`${coverage.side.toUpperCase()}: 역사적 시계 검토가 필요합니다.`);
    }
    lines.push(`일부 후보 전용 분류 ${c.draft.omittedCandidateDependentFacts}건은 확정 문장에서 제외했습니다.`,'',
      ...c.draft.details.map(s => `- ${s.text} (근거: ${references(s.sources)})`),'',
      `생일에서 도출하지 않은 대화 제안: ${c.draft.advice[0].text}`,'',
      '강점·차이의 성격 해석, 점수와 지도 거리는 미판정입니다.','');
  }
  lines.push('근거·해석 범위: [감수 기록](../../../docs/month-combination-review.md).','');
  return lines.join('\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const flags=process.argv.slice(2);
  if (flags.some(f => !['--check','--release-check'].includes(f))) throw new Error('UNKNOWN_ARGUMENT');
  const report=buildContextAudit();
  for (const [name,text] of [['context-rule-audit.json',JSON.stringify(report,null,2)+'\n'],['context-reading-drafts.md',renderContextAudit(report)]]) {
    const file=new URL(`./reports/${name}`,import.meta.url);
    if (flags.includes('--check') || flags.includes('--release-check')) {
      if (readFileSync(file,'utf8') !== text) throw new Error('CONTEXT_AUDIT_STALE');
    } else writeFileSync(file,text);
  }
  console.log('PASS: eight context cases and four relationship drafts reproduce.');
  if (flags.includes('--release-check')) {console.log('BLOCKED: interpretation, calendar and scale approval pending.');process.exitCode=2;}
}

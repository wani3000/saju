import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {judgmentCatalog,analyzeSourceJudgments,buildSourceJudgmentDraft} from './source-judgments.mjs';
import {stems,branches} from './reading-rules.mjs';
import {calculateProfile} from './adapter.mjs';
const chart=(pillars,rest={}) => ({policy:{version:'research-civil-midnight-v5',productionApproved:false},timeKnown:true,pillars,...rest});
export function buildSourceJudgmentAudit() {
  const examples=judgmentCatalog.roots.map(r=>[r.id,chart({year:'임자',
    month:(branches.indexOf(r.branch)%2 === 0 ? '갑' : '을')+r.branch,
    day:r.stem+(stems.indexOf(r.stem)%2 === 0 ? '자' : '축'),hour:'경신'})]);
  examples.push(
    ['intervening-gyeong',chart({year:'갑자',month:'경오',day:'기축',hour:'정묘'})],
    ['intervening-eul',chart({year:'갑자',month:'을묘',day:'기축',hour:'정묘'})],
    ['candidate-only-obstruction',chart({year:'갑자',month:null,day:'기축',hour:'정묘'}, {candidates:{month:['경오','병인']}})],
    ['uncovered-is-not-transformation',chart({year:'갑자',month:'병인',day:'기축',hour:'정묘'})],
    ['unknown-hour-ipchun',calculateProfile({calendar:'solar',leap:false,timeKnown:false,year:2024,month:2,day:4})],
  );
  return {ruleVersion:judgmentCatalog.version,productionApproved:false,
    scope:'Synthetic structures for explicit source examples; not verified historical people, birthdays or predictions.',
    cases:examples.map(([id,profile])=>({id,analysis:analyzeSourceJudgments(profile),draft:buildSourceJudgmentDraft(profile)}))};
}
export function renderSourceJudgmentAudit(report) {
  const lines=['# 통근 등급·합 방해 사례 감수','','한 판본의 명시적 예를 적용한 연구 초안. 신강·신약, 합화 성립, 궁합 점수는 미판정입니다.',''];
  for (const c of report.cases) {
    lines.push(`## ${c.id}`,'',c.draft.notice);
    const coverage=c.draft.coverage[0];
    if (coverage.omittedPositions.length) lines.push('시간 모름: 시주를 제외했습니다.');
    if (coverage.boundaryReviewRequired) lines.push('절기 경계: 후보를 보존했습니다.');
    if (coverage.clockReviewRequired) lines.push('역사적 시계 검토가 필요합니다.');
    lines.push('',...c.draft.statements.map(s=>`- ${s.text} (PDF ${[...new Set(s.sources.flatMap(v=>v.pdfPages))].sort((a,b)=>a-b).join('·')}쪽)`),'');
    if (!c.draft.statements.length) lines.push('이 예제집으로 확정해 설명할 항목이 없습니다. 뿌리나 방해가 없다는 뜻은 아닙니다.','');
    lines.push(`일부 후보에만 해당하는 항목 ${c.draft.omittedCandidateDependentFacts}건은 확정 문장에서 제외했습니다.`,
      '예제집에 없는 조합은 미판정이며, 예제집의 적용 여부는 [JSON](source-judgment-audit.json)에 보존합니다.','');
  }
  lines.push('근거와 한계: [통근·합 방해 후속 감수](../../../docs/source-judgments-review.md).','');
  return lines.join('\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const flags=process.argv.slice(2);
  if (flags.some(f=>!['--check','--release-check'].includes(f))) throw new Error('UNKNOWN_ARGUMENT');
  const report=buildSourceJudgmentAudit();
  for (const [name,content] of [['source-judgment-audit.json',JSON.stringify(report,null,2)+'\n'],
    ['source-judgment-drafts.md',renderSourceJudgmentAudit(report)]]) {
    const file=new URL(`./reports/${name}`,import.meta.url);
    if (flags.length) {if (readFileSync(file,'utf8') !== content) throw new Error('SOURCE_JUDGMENT_AUDIT_STALE');}
    else writeFileSync(file,content);
  }
  console.log(`PASS: ${report.cases.length} explicit-source example drafts reproduce.`);
  if (flags.includes('--release-check')) {console.log('BLOCKED: partial convention, full interpretation and production review pending.');process.exitCode=2;}
}

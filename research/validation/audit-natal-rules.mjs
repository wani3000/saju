import {readFileSync, writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {calculateProfile} from './adapter.mjs';
import {analyzeNatal, buildNatalDraft} from './natal-analysis.mjs';
import {natalCatalog} from './natal-rules.mjs';

export function buildNatalAudit() {
  const chart = {policy:{version:'research-civil-midnight-v5',productionApproved:false},timeKnown:true,
    pillars:{year:'갑자',month:'병인',day:'무진',hour:'경오'}};
  const birth = {calendar:'solar',leap:false,timeKnown:false,year:2024,month:2,day:4};
  const cases = [
    ['synthetic-four-pillars',chart],
    ['synthetic-unknown-hour',{...chart,timeKnown:false,pillars:{...chart.pillars,hour:null}}],
    ['synthetic-correlated-day',{...chart,pillars:{...chart.pillars,day:null},candidates:{day:['갑자','을축']}}],
    ['synthetic-month-candidates',{...chart,pillars:{...chart.pillars,month:null},candidates:{month:['병인','정묘']}}],
    ['ipchun-unknown-hour',calculateProfile(birth)],
    ['historical-clock-review',calculateProfile({...birth,year:1954,month:3,day:21})],
  ];
  return {ruleVersion:natalCatalog.version,productionApproved:false,
    exampleData:'Synthetic test charts/dates only, not personal records. Constructed pillars are rule tests, not verified birth charts.',
    reviewScope:'Primary-source definition collation and software checks, with unapproved Korean terminology normalization.',
    releaseBlockers:['Calendar engine approval pending','Terminology and interpretation review pending','Strength, 合化 and compatibility policy pending'],
    cases:cases.map(([id,profile]) => ({id,analysis:analyzeNatal(profile),draft:buildNatalDraft(profile)}))};
}

export function renderNatalAudit(report) {
  return ['# 지장간·십성 감수 초안', '', '합성 시험 자료. 운영 미승인. 점수·성격·관계 예측 없음.', '',
    ...report.cases.flatMap(c => [`## ${c.id}`,'',c.draft.notice,'',
      `제외한 일부 후보 전용 분류: ${c.draft.omittedCandidateDependentFacts}건.`,
      ...(c.draft.coverage[0].omittedPositions.includes('hour') ? ['시간 모름: 시주는 분석에서 제외했습니다.'] : []),
      ...(c.draft.coverage[0].clockReviewRequired ? ['역사적 시계 전환 검토가 필요한 입력입니다.'] : []),
      ...(c.draft.coverage[0].boundaryReviewRequired ? ['절기 경계 후보를 보존한 입력입니다.'] : []), '',
      ...c.draft.statements.map(s => `- ${s.text} (근거: ${[...new Set(s.sources.map(r => `PDF ${r.pdfPage}쪽`))].join(', ')})`),'']),
    '원문·용어 정책과 한계: [감수 기록](../../../docs/natal-rules-review.md).',''].join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const flags = process.argv.slice(2);
  if (flags.some(f => !['--check','--release-check'].includes(f))) throw new Error('UNKNOWN_ARGUMENT');
  const report = buildNatalAudit();
  for (const [name, content] of [
    ['natal-rule-audit.json',JSON.stringify(report,null,2)+'\n'],
    ['natal-reading-drafts.md',renderNatalAudit(report)],
  ]) {
    const file = new URL(`./reports/${name}`,import.meta.url);
    if (flags.includes('--check') || flags.includes('--release-check')) {
      if (readFileSync(file,'utf8') !== content) throw new Error('NATAL_AUDIT_STALE');
    } else writeFileSync(file,content);
  }
  console.log('PASS: six research natal cases and review drafts reproduced.');
  if (flags.includes('--release-check')) {
    console.log('BLOCKED: terminology, interpretations and calendar engine remain unapproved.');
    process.exitCode = 2;
  }
}

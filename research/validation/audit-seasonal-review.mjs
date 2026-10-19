import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {reviewVersion,reviewStrengthAndTransformation,analyzeTransformationConditions} from './strength-transformation-review.mjs';
const chart=(pillars,rest={})=>({policy:{version:'research-civil-midnight-v5',productionApproved:false},timeKnown:true,pillars,...rest});
const statusNames={
  'single-command':'선택한 사령표에서 하나의 천간으로 일치',
  'command-boundary':'사령 배분 경계에 걸려 후보 보존',
  'source-scheme-unresolved':'사령표의 일수 문제 또는 30일 범위 밖으로 미확정',
  'solar-term-boundary-review':'절입 경계로 월령·사령 미확정',
  'historical-clock-review':'역사적 시계 기준 검토로 사령 미확정',
  'reviewed-necessary-conditions-met':'검토한 필요조건 충족 — 합화 성립 확정은 아님',
  'necessary-condition-failed':'검토한 필요조건 중 미충족 항목 있음',
  'insufficient-data':'시주 미상 등으로 필요조건을 확정할 수 없음',
  'candidate-dependent':'후보에 따라 판정이 달라짐',
  'outside-reviewed-pair':'일간이 갑·기가 아니므로 이번 합화 조건의 적용 범위 밖',
  'no-day-combination':'관찰한 전체 천간에 일간의 갑기 합 상대가 없음',
};
const checkNames={
  'month-earth-branch':'월령이 진·술·축·미에 해당하지 않음', 'one-visible-partner':'합 상대가 한 개라는 조건을 충족하지 않음',
  'no-extra-jia':'추가 갑이 드러남', 'no-visible-eul':'을이 드러남',
  'no-explicit-intervening-obstruction':'합 상대 사이에 경·을의 방해 사례가 나타남',
  'multiple-ji-scope-unreviewed':'기 반복 사례의 적용 범위 미검토',
};
export function buildSeasonalReviewAudit() {
  const base={calendar:'solar',leap:false,timeKnown:false,year:2024,month:2,day:10};
  const cases=[['ordinary-command',base],['command-change-day',{...base,day:11}],
    ['ipchun-day',{...base,day:4}],['午-source-duration-conflict',{...base,month:6,day:15}],
    ['beyond-nominal-thirty-days',{...base,month:5,day:5,timeKnown:true,hour:0,minute:0}],
    ['historical-clock-review',{...base,year:1954,month:3,day:21}]];
  const synthetic=[
    ['necessary-checks-met',chart({year:'기축',month:'무진',day:'갑자',hour:'병인'})],
    ['wrong-month',chart({year:'기축',month:'병인',day:'갑자',hour:'정묘'})],
    ['extra-jia',chart({year:'기축',month:'갑진',day:'갑자',hour:'병인'})],
    ['visible-eul',chart({year:'기축',month:'을미',day:'갑자',hour:'병인'})],
    ['unknown-hour',chart({year:'기축',month:'무진',day:'갑자',hour:null},{timeKnown:false})],
    ['correlated-month-candidates',chart({year:'기축',month:null,day:'갑자',hour:'정묘'}, {candidates:{month:['을사','병진']}})],
  ];
  return {ruleVersion:reviewVersion,productionApproved:false,
    exampleData:'Synthetic birth fixtures and structural charts, not real people or predictions.',
    birthCases:cases.map(([id,input])=>({id,review:reviewStrengthAndTransformation(input)})),
    transformationCases:synthetic.map(([id,profile])=>({id,review:analyzeTransformationConditions(profile)}))};
}
export function renderSeasonalReviewAudit(report) {
  const lines=['# 사령·종합 강약 요소·합화 필요조건 감수','','연구용 사례. 신강·신약과 최종 합화 성립은 미판정입니다.',''];
  for(const c of report.birthCases) {
    const r=c.review,s=r.seasonalCommand;
    lines.push(`## ${c.id}`,'',`사령: ${statusNames[s.status]}${s.confirmedStem?` (${s.confirmedStem})`:''}.`);
    if(!s.timeKnown) lines.push('시간 모름: 날짜 전체의 가능한 시각을 사용하고 시주를 제외했습니다.');
    if(r.coverage[0].boundaryReviewRequired) lines.push('절입 경계 후보를 보존했습니다.');
    if(r.coverage[0].clockReviewRequired) lines.push('역사 시계 기준 검토가 필요합니다.');
    lines.push('');
    for(const f of r.strength.commandRelations) lines.push(`- 일간 ${f.dayStem} 기준 사령 ${f.targetStem}: ${f.label}. 사령의 관계 분류이며 신강·신약 자체가 아닙니다.`);
    lines.push('- 사령, 월지 투출, 지장간의 같은 오행, 판본별 뿌리 등급, 다른 천간과의 생극 관계를 구분해 대조했습니다.',
      '- 생조와 설기·재성·극 관계의 개수를 더하거나 다수결로 신강·신약을 정하지 않습니다.',
      `- 합화 조건: ${statusNames[r.transformation.status]}.`,'');
  }
  for(const c of report.transformationCases) {
    const r=c.review;
    lines.push(`## ${c.id}`,'',statusNames[r.status]+'.','');
    if(r.commonFailedChecks.length) lines.push(`후보 전체의 공통 미충족 조건: ${r.commonFailedChecks.map(id=>checkNames[id]).join(', ')}.`,'');
    if(r.status==='candidate-dependent') lines.push('일부 후보의 충족·미충족을 전체 차트의 확정 판단으로 제시하지 않습니다.','');
    lines.push('검토한 필요조건을 충족해도 중화·과다·부족의 종합 기준이 남으므로 천간의 오행을 토로 바꾸지 않습니다.','');
  }
  lines.push('전체 근거·후보별 판정: [JSON](seasonal-review-audit.json).',
    '출처, 사령 일수의 상충과 적용 정책: [감수 기록](../../../docs/seasonal-strength-review.md).','');
  return lines.join('\n');
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const flags=process.argv.slice(2);
  if(flags.some(f=>!['--check','--release-check'].includes(f))) throw new Error('UNKNOWN_ARGUMENT');
  const report=buildSeasonalReviewAudit();
  for(const [name,content] of [['seasonal-review-audit.json',JSON.stringify(report,null,2)+'\n'],
    ['seasonal-review-drafts.md',renderSeasonalReviewAudit(report)]]) {
    const file=new URL(`./reports/${name}`,import.meta.url);
    if(flags.length){if(readFileSync(file,'utf8')!==content) throw new Error('SEASONAL_REVIEW_AUDIT_STALE');}
    else writeFileSync(file,content);
  }
  console.log('PASS: six integrated birth cases and six transformation condition cases reproduce.');
  if(flags.includes('--release-check')){console.log('BLOCKED: total strength, sufficient transformation rules and production review pending.');process.exitCode=2;}
}

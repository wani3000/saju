import {readFileSync, writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {analyzeProfile, compareProfiles} from './reading-analysis.mjs';
import {ruleCatalog} from './reading-rules.mjs';
import {calculateProfile} from './adapter.mjs';
import {compare1954Clocks} from './compare-1954-clocks.mjs';

const positionNames = {year:'연주', month:'월주', day:'일주', hour:'시주'};
function reviewStatements(analysis) {
  return analysis.findings.filter(f => f.certainty === 'all-candidates').map(f => {
    const rule = ruleCatalog.rules.find(r => r.id === f.ruleId);
    const locations = f.endpoints.map(e => `${e.side}의 ${positionNames[e.position]}`).join('와 ');
    return {ruleId:f.ruleId, source:f.source,
      draft:`${locations}에서 ${rule.symbols.join('·')}(${rule.hanja})가 확인되어, 선택한 규칙표의 ${rule.label}에 해당합니다.`,
      status:'editorial-draft-not-approved',
      limitation:'이 분류만으로 합화 성립이나 실제 관계의 좋고 나쁨을 판단하지 않습니다.'};
  });
}

export function buildReadingAudit() {
  const policy = {version:'research-civil-midnight-v5', productionApproved:false};
  const a = {policy, timeKnown:true, pillars:{year:'갑자',month:'병인',day:'무진',hour:'경오'}};
  const b = {policy, timeKnown:true, pillars:{year:'기축',month:'신해',day:'계유',hour:'을미'}};
  const uncertain = {...a, pillars:{...a.pillars,year:null}, candidates:{year:['갑자','을축']}};
  const cases = [
    ['cross-profile-pairs', compareProfiles(a,b)],
    ['coexisting-combinations-and-clashes', analyzeProfile({...a,pillars:{year:'갑자',month:'병오',day:'기축',hour:'을미'}})],
    ['candidate-dependent-pair', compareProfiles(uncertain,b)],
    ['unknown-hour-at-ipchun', analyzeProfile(calculateProfile({calendar:'solar',leap:false,timeKnown:false,year:2024,month:2,day:4}))],
    ['historical-clock-review', analyzeProfile(calculateProfile({calendar:'solar',leap:false,timeKnown:false,year:1954,month:3,day:21}))],
    ['self-comparison-no-score', compareProfiles(a,a)],
  ];
  return {ruleVersion:ruleCatalog.version, productionApproved:false, score:null,
    reviewScope:'Source definitions and software behavior only; no expert or relationship validity approval',
    exampleData:'Synthetic charts and dates, not user records. Some charts deliberately combine positions for isolated rule tests.',
    releaseBlockers:['Interpretation and policy review pending','Calendar engine approval pending','Cross-profile application and priorities not approved'],
    rules:ruleCatalog.rules,
    cases:cases.map(([id,analysis]) => ({id,analysis,reviewStatements:reviewStatements(analysis)})),
    historicalClockProbe:compare1954Clocks({year:1954,month:3,day:21,hour:0,minute:15})};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const flags = process.argv.slice(2);
  if (flags.some(f => !['--check','--release-check'].includes(f))) throw new Error('UNKNOWN_ARGUMENT');
  const expected = JSON.stringify(buildReadingAudit(), null, 2) + '\n';
  const file = new URL('./reports/reading-rule-audit.json', import.meta.url);
  if (flags.includes('--check') || flags.includes('--release-check')) {
    if (readFileSync(file, 'utf8') !== expected) throw new Error('READING_AUDIT_STALE');
    console.log('PASS: reviewed rule definitions and six synthetic cases reproduce the saved report.');
  } else {
    writeFileSync(file, expected);
    console.log('Wrote reports/reading-rule-audit.json (research only).');
  }
  if (flags.includes('--release-check')) {
    console.log('BLOCKED: definitions reviewed; interpretations, engine and production release remain unapproved.');
    process.exitCode = 2;
  }
}

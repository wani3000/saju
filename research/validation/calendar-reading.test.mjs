import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {calendarRows,auditCalendarRows,auditReadingPermutations,buildCalendarReadingAudit} from './audit-calendar-reading.mjs';
import {buildBetaReading} from './beta-reading.mjs';
import {buildReleaseReadiness} from './audit-release-readiness.mjs';

test('24 source months and 730 published Gregorian/lunar/day-label rows reproduce offline with their hashes',()=>{
 const run=spawnSync('python3',[new URL('./collect-kasi-months.py',import.meta.url).pathname,'--check'],{encoding:'utf8'});
 assert.equal(run.status,0,run.stdout+run.stderr);
 assert.equal(calendarRows.length,730);assert.equal(calendarRows.filter(r=>r.lunar[3]).length,78);
 assert.equal(new Set(calendarRows.map(r=>r.solar[0])).size,16);
});
test('collector rejects a fallback month, a duplicated day and an incomplete requested table',()=>{
 const code=`import sys,gzip,importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location('collector',sys.argv[1]);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
raw=gzip.decompress((m.DIR/'kasi-1908-04.html.gz').read_bytes()).decode()
assert len(m.parse_month(raw.encode(),1908,4))==30
for text in [raw.replace('양력 1908년 4월 달력정보','양력 1908년 5월 달력정보'),raw.replace('1908년 04월 01일','1908년 04월 02일',1),raw.replace('monthly_bg','missing_table')]:
 try:m.parse_month(text.encode(),1908,4)
 except ValueError:pass
 else:raise AssertionError('tampered source accepted')
`;
 const run=spawnSync('python3',['-c',code,new URL('./collect-kasi-months.py',import.meta.url).pathname],{encoding:'utf8'});
 assert.equal(run.status,0,run.stdout+run.stderr);
});
test('expanded calendar checks preserve midnight day labels, unknown hours and matching lunar profiles',()=>{
 const r=buildCalendarReadingAudit();assert.equal(r.checksPassed,true);assert.deepEqual(r.failures,[]);
 for(const key of ['solarToLunar','lunarToSolar','publishedDayLabelUnknownTime','noInventedHour','calendarToReadingEvidence','noCalendarApprovalOrScore'])assert.equal(r.checks[key].passed,730,key);
 assert.equal(r.checks.lunarProfileEquivalent.passed,699);assert.equal(r.lunarInputRangeExcluded.count,31);
 assert.equal(r.checks.publishedDayLabelKnownMinutes.passed,5100);
 assert.deepEqual(r.refusedKnownMinutes,{NONEXISTENT_BIRTH_TIME:6,AMBIGUOUS_BIRTH_TIME:2,HISTORICAL_CLOCK_SOURCE_DISPUTE:2});
 assert.equal(r.productionApproved,false);assert.equal(r.expertSignoff,'not-completed');
});
test('lunar year/month names are never treated as independent saju year/month oracles',()=>{
 const r=buildCalendarReadingAudit();assert.equal(r.lunarYearMonthAreNotSaju.yearMonthLabelDifferences,139);
 assert.ok(r.lunarYearMonthAreNotSaju.examples.some(e=>e.sourceLunarMonth!==e.sajuMonth));
 const row=structuredClone(calendarRows.find(r=>r.solar.join('-')==='1908-4-1'));
 row.sourceGanji='신축(辛丑)년 신축(辛丑)월 병술(丙戌)일';
 assert.equal(auditCalendarRows([row]).checksPassed,true);
});
test('a wrong published day or forged numeric reading is detected instead of becoming a passing report',()=>{
 const row=structuredClone(calendarRows.find(r=>r.solar.join('-')==='2020-6-1'));
 row.dayPillar='갑자';
 const bad=auditCalendarRows([row]);assert.equal(bad.checksPassed,false);
 assert.ok(bad.failures.some(f=>f.kind==='publishedDayLabelUnknownTime'));
 const forged=auditCalendarRows([calendarRows[0]],(...args)=>({...buildBetaReading(...args),score:90}));
 assert.equal(forged.checksPassed,false);assert.ok(forged.failures.some(f=>f.kind==='noCalendarApprovalOrScore'));
});
test('100 editorial combinations preserve A/B symmetry and hour independence; candidate expansion cannot add certainty',()=>{
 const r=auditReadingPermutations();assert.equal(r.cases,100);assert.equal(r.passed,true);
 assert.equal(r.candidateExpansionDoesNotAddConfirmedFacts,true);assert.deepEqual(r.failures,[]);
});
test('new source audit and existing copy reports reproduce; extra calendar evidence cannot open the release gate',()=>{
 for(const file of ['audit-calendar-reading.mjs','audit-beta-quality.mjs','audit-selected-reading.mjs']) {
  const r=spawnSync(process.execPath,[new URL(file,import.meta.url).pathname,'--check'],{encoding:'utf8'});assert.equal(r.status,0,r.stdout+r.stderr);
 }
 const blocked=spawnSync(process.execPath,[new URL('./audit-calendar-reading.mjs',import.meta.url).pathname,'--release-check'],{encoding:'utf8'});
 assert.equal(blocked.status,2,blocked.stderr);
 assert.equal(JSON.parse(readFileSync(new URL('./reports/beta-quality-audit.json',import.meta.url))).humanParticipantsObserved,0);
});
test('reproduced calendar and reading evidence never become human, external-service or public-release approval',()=>{
 const r=buildReleaseReadiness();assert.equal(r.evidence.status,'source-reports-reproduced');
 assert.equal(r.status,'blocked');assert.equal(r.publicReleaseApproved,false);assert.equal(r.realChargesEnabled,false);
 assert.equal(r.humanExpertSignoff,'not-completed');assert.equal(r.blockerIds.length,8);
 for(const id of ['CALENDAR_POLICY_PENDING','EXPERT_REVIEW_PENDING','USER_STUDY_NOT_STARTED','EXTERNAL_AUTH_UNVERIFIED','EXTERNAL_PAYMENT_UNVERIFIED'])assert.ok(r.blockerIds.includes(id));
 assert.ok(r.automatedSuiteExecution.includes('Not executed'));
});
test('release report reproduces offline and cannot be approved by process environment flags',()=>{
 const file=new URL('./audit-release-readiness.mjs',import.meta.url).pathname;
 for(const [args,expected] of [[['--check'],0],[['--release-check'],2],[['--approve'],1]]) {
  const r=spawnSync(process.execPath,[file,...args],{encoding:'utf8',env:{...process.env,PRODUCTION_APPROVED:'true',EXPERT_APPROVED:'true',NICEPAY_SECRET_KEY:'synthetic-secret-not-for-report'}});
  assert.equal(r.status,expected,r.stdout+r.stderr);assert.ok(!(r.stdout+r.stderr).includes('synthetic-secret-not-for-report'));
 }
});

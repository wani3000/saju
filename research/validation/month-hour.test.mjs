import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildMonthHourAudit,source,renderMonthHour} from './audit-month-hour.mjs';
const report=buildMonthHourAudit();
test('month/hour anchors cover all stems once per source passage',()=>{
 for(const kind of ['month','hour']) {
  assert.equal(source[kind].anchors.length,5);
  assert.deepEqual([...source[kind].anchors.flatMap(a=>[...a.stems])].sort(),[...'甲乙丙丁戊己庚辛壬癸'].sort());
 }
 assert.deepEqual(source.pages.map(p=>[p.pdfPage,p.printedPage]),[[39,20],[40,21]]);
});
test('source month anchors and sequential progression match all 120 combinations',()=>{
 assert.equal(report.counts.monthCombinations,120);
 assert.deepEqual(report.failures.filter(f=>['year-stem','month'].includes(f.kind)),[]);
});
test('ten published day labels retain declared day and source hour sequence at every minute',()=>{
 assert.equal(report.counts.hourMinuteProbes,14400);
 assert.deepEqual(report.failures.filter(f=>['day','hour'].includes(f.kind)),[]);
});
test('late zi alternatives preserve their distinct day/hour conventions',()=>{
 assert.equal(report.counts.lateZiPolicyProbes,20);
 assert.deepEqual(report.failures.filter(f=>f.kind.startsWith('late-zi')),[]);
});
test('source review cannot approve the product or silently change saved reading versions',()=>{
 assert.equal(report.checksPassed,true);
 assert.equal(report.productionApproved,false);
 assert.equal(report.humanExpertSignoff,false);
 assert.equal(report.engineVersion,'research-civil-midnight-v5');
 assert.equal(report.readingVersion,'source-observations-copy-v2');
});
test('source hashes and generated month/hour report reproduce offline',()=>{
 assert.equal(readFileSync(new URL('./reports/month-hour-audit.json',import.meta.url),'utf8'),JSON.stringify(report,null,2)+'\n');
 assert.equal(readFileSync(new URL('./reports/month-hour-audit.md',import.meta.url),'utf8'),renderMonthHour(report));
});

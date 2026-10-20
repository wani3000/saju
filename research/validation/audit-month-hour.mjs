/** Source anchors, derived progression and declared clock convention are distinct evidence. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {computeFourPillars} from './build/pillars.mjs';
const read=p=>readFileSync(new URL(p,import.meta.url));
export const source=JSON.parse(read('fixtures/reading-sources/month-hour-anchors.json'));
const han='甲乙丙丁戊己庚辛壬癸',stems='갑을병정무기경신임계';
const monthBranches='인묘진사오미신유술해자축',hourBranches='자축인묘진사오미신유술해';
function sequence(part,stem) {
 const anchor=source[part].anchors.find(a=>a.stems.includes(han[stem]));
 const start=han.indexOf(anchor.start);
 return Array.from({length:12},(_,i)=>stems[(start+i)%10]);
}
const label=p=>p.heavenlyStem+p.earthlyBranch;
export function buildMonthHourAudit() {
 const catalog=JSON.parse(read('fixtures/reading-sources/source.json'));
 if(source.sourceId!==catalog.sourceId||source.pdfSha256!==catalog.pdfSha256)throw new Error('MONTH_HOUR_SOURCE_METADATA_CHANGED');
 for(const page of source.pages) {
  if(createHash('sha256').update(read('fixtures/reading-sources/'+page.file)).digest('hex')!==page.sha256)
   throw new Error('MONTH_HOUR_SOURCE_CHANGED');
 }
 const counts={monthCombinations:0,hourMinuteProbes:0,lateZiPolicyProbes:0};
 const failures=[];
 const check=(kind,input,actual,expected)=>{if(actual!==expected)failures.push({kind,input,actual,expected});};
 // 1984..1993 span the ten year stems. Feb..Jan are well inside the Jie months.
 for(let stem=0;stem<10;stem++) {
  const expected=sequence('month',stem),year=1984+stem;
  for(let m=0;m<12;m++) {
   const wall=Date.UTC(year,1+m,20,12),d=new Date(wall);
   const p=computeFourPillars({instantUTCms:wall-9*3600000,apparentMs:wall},d.getUTCFullYear(),'midnight');
   check('year-stem', [year,m],p.year.heavenlyStem,stems[stem]);
   check('month', [year,m],label(p.month),expected[m]+monthBranches[m]);
   counts.monthCombinations++;
  }
 }
 const rows=JSON.parse(read('fixtures/kasi-months-derived.json')).dates
  .filter(r=>r.solar[0]===2026&&r.solar[1]===2&&r.solar[2]>=10&&r.solar[2]<20);
 if(rows.length!==10||new Set(rows.map(r=>r.dayPillar[0])).size!==10)throw new Error('DAY_ANCHOR_COVERAGE');
 for(const row of rows) {
  const [year,month,day]=row.solar,base=Date.UTC(year,month-1,day);
  const expected=sequence('hour',stems.indexOf(row.dayPillar[0]));
  // Explicit start minutes define the research civil-clock policy; the old text does not.
  const starts=[0,60,180,300,420,540,660,780,900,1020,1140,1260,1380];
  const branches=[0,1,2,3,4,5,6,7,8,9,10,11,0];
  for(let minute=0;minute<1440;minute++) {
   let slot=0;while(slot+1<starts.length&&minute>=starts[slot+1])slot++;
   const branch=branches[slot],wall=base+minute*60000;
   const p=computeFourPillars({instantUTCms:wall-9*3600000,apparentMs:wall},year,'midnight');
   check('day', [...row.solar,minute],label(p.day),row.dayPillar);
   check('hour', [...row.solar,minute],label(p.hour),expected[branch]+hourBranches[branch]);
   counts.hourMinuteProbes++;
  }
  for(const minute of [1380,1439]) {
   const wall=base+minute*60000;
   const p=rule=>computeFourPillars({instantUTCms:wall-9*3600000,apparentMs:wall},year,rule);
   const civil=p('midnight'),jasi=p('jasi'),split=p('splitJasi');
   const next=sequence('hour',(stems.indexOf(row.dayPillar[0])+1)%10)[0]+'자';
   check('late-zi-midnight-day',[...row.solar,minute],label(civil.day),row.dayPillar);
   check('late-zi-split-day',[...row.solar,minute],label(split.day),row.dayPillar);
   const nextDay=stems[(stems.indexOf(row.dayPillar[0])+1)%10]+hourBranches[(hourBranches.indexOf(row.dayPillar[1])+1)%12];
   check('late-zi-jasi-day',[...row.solar,minute],label(jasi.day),nextDay);
   check('late-zi-jasi-hour',[...row.solar,minute],label(jasi.hour),next);
   check('late-zi-split-hour',[...row.solar,minute],label(split.hour),next);
   counts.lateZiPolicyProbes++;
  }
 }
 return {version:source.version,reviewedOn:source.reviewedOn,sourceId:source.sourceId,
  sourceAnchorGroups:10,counts,failures,checksPassed:failures.length===0,
  sourceFixtureSha256:createHash('sha256').update(read('fixtures/reading-sources/month-hour-anchors.json')).digest('hex'),
  engineVersion:'research-civil-midnight-v5',readingVersion:'source-observations-copy-v2',
  productionApproved:false,humanExpertSignoff:false,
  limitations:[source.scope,'14400 minute probes use ten KASI published day labels and a derived source progression; they are not 14400 independent observations.',
   'Midnight, 23:00 and split Zi are explicitly tested implementation conventions. The source does not select a modern civil-clock policy.',
   'No engine, stored result, reading, strength, transformation or score rule is changed by this audit.']};
}
export function renderMonthHour(r) {
 return ['# 월간·시간 천간 원문 및 시각 경계 검토','',
  `원문 시작값 ${r.sourceAnchorGroups}묶음 → 파생 월주 ${r.counts.monthCombinations}조합, 시각 ${r.counts.hourMinuteProbes}분, 늦은 자시 정책 ${r.counts.lateZiPolicyProbes}건: ${r.checksPassed?'통과':'실패'}.`,
  '',...r.limitations.map(x=>'- '+x),'',
  '[구조화 결과](month-hour-audit.json) · [원문·전사·시작값](../fixtures/reading-sources/month-hour-anchors.json) · [감수 및 복구 검증](../../../docs/month-hour-restore-review.md)',''].join('\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
 const args=process.argv.slice(2);if(args.some(a=>a!=='--check'))throw new Error('UNKNOWN_ARGUMENT');
 const r=buildMonthHourAudit();if(!r.checksPassed)throw new Error('MONTH_HOUR_AUDIT_FAILED');
 for(const [name,text] of [['month-hour-audit.json',JSON.stringify(r,null,2)+'\n'],['month-hour-audit.md',renderMonthHour(r)]]) {
  const file=new URL('reports/'+name,import.meta.url);
  if(args.length){if(readFileSync(file,'utf8')!==text)throw new Error('MONTH_HOUR_REPORT_STALE');}else writeFileSync(file,text);
 }
 console.log(`PASS: ${r.sourceAnchorGroups} source anchors; ${r.counts.monthCombinations} months; ${r.counts.hourMinuteProbes} minute probes. No release approval.`);
}

/** Published calendar rows + declared research conventions + existing copy. No human signoff. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {solarToLunar,lunarToSolar} from './build/manseryeok.mjs';
import {calculateProfile} from './adapter.mjs';
import {buildBetaReading} from './beta-reading.mjs';
import {checkBetaEvidence} from './beta-quality-pack.mjs';
import {compareProfiles} from './reading-analysis.mjs';
const root=new URL('./',import.meta.url);
const digest=b=>createHash('sha256').update(b).digest('hex');
export const calendarRows=JSON.parse(readFileSync(new URL('fixtures/kasi-months-derived.json',root))).dates;
const flags={calendar:'solar',leap:false,timeKnown:false};
export function auditReadingPermutations() {
 const representatives=['갑자','병인','무진','경오','임신'];
 const profile=day=>({policy:{version:'research-civil-midnight-v5',productionApproved:false},timeKnown:true,
  pillars:{year:'갑자',month:'을축',day,hour:'임자'}});
 const failures=[];let cases=0;
 for(const first of representatives)for(const second of representatives)for(const relation of ['친구','가족','연인','동료']) {
  const a=profile(first),b=profile(second),r=buildBetaReading(a,b,relation),reverse=buildBetaReading(b,a,relation);
  const unknown=structuredClone(a);unknown.timeKnown=false;unknown.pillars.hour=null;
  const withoutHour=buildBetaReading(unknown,b,relation);
  const checks={
   evidence:Object.values(checkBetaEvidence(a,b,r)).every(Boolean),
   reverseFamilies:JSON.stringify(r.basis.commonFamilies)===JSON.stringify(reverse.basis.commonFamilies),
   reverseCount:r.basis.totalCommonObservations===reverse.basis.totalCommonObservations,
   reverseElements:JSON.stringify(r.basis.dayElements.map(x=>x.element))===JSON.stringify(reverse.basis.dayElements.map(x=>x.element).reverse()),
   hourDoesNotChangeFacts:JSON.stringify(r.basis.observations)===JSON.stringify(withoutHour.basis.observations),
   hourDoesNotChangeSummary:r.strength===withoutHour.strength&&r.difference===withoutHour.difference,
  };
  if(Object.values(checks).some(v=>!v))failures.push({first,second,relation,checks});
  cases++;
 }
 const keys=p=>new Set(compareProfiles(p,profile('기축')).findings.filter(f=>f.certainty==='all-candidates'&&f.endpoints.every(e=>e.position!=='hour'))
  .map(f=>f.ruleId+':'+f.endpoints.map(e=>e.position).join(':')));
 const fixed=profile('갑자'),expanded=profile(null);expanded.candidates={day:['갑자','병자']};
 const before=keys(fixed),after=keys(expanded);
 const candidateExpansionDoesNotAddConfirmedFacts=[...after].every(k=>before.has(k));
 return {cases,failures,candidateExpansionDoesNotAddConfirmedFacts,passed:failures.length===0&&candidateExpansionDoesNotAddConfirmedFacts,
  scope:'Five day-element representatives x both sides x four editorial relationships; structural invariants only, no inferred relationship quality.'};
}
export function auditCalendarRows(rows=calendarRows,makeReading=buildBetaReading) {
 const checks={},failures=[],refusedKnownMinutes={},lunarInputRangeExcluded=[];
 const labelDifferences=[];let publishedMonthLabels=0,yearMonthLabelDifferences=0;
 const other=calculateProfile({...flags,year:1992,month:5,day:21});
 function check(kind,row,expected,fn) {
  const count=checks[kind]??={passed:0,failed:0};
  try {const actual=fn();if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error(JSON.stringify({expected,actual}));count.passed++;}
  catch(error){count.failed++;failures.push({kind,solar:row.solar,detail:error.message});}
 }
 for(const row of rows) {
  const [year,month,day]=row.solar,[ly,lm,ld,leap]=row.lunar;
  check('solarToLunar',row,{year:ly,month:lm,day:ld,isLeapMonth:leap},()=>solarToLunar(year,month,day));
  check('lunarToSolar',row,{year,month,day},()=>lunarToSolar(ly,lm,ld,leap));
  const input={...flags,year,month,day};
  const unknown=calculateProfile(input);
  check('publishedDayLabelUnknownTime',row,row.dayPillar,()=>unknown.pillars.day);
  check('noInventedHour',row,[null,false],()=>[unknown.pillars.hour,unknown.timeKnown]);
  if(ly>=1908&&ly<=2026) {
   check('lunarProfileEquivalent',row,{solar:unknown.solar,pillars:unknown.pillars,candidates:unknown.candidates},()=>{
    const p=calculateProfile({...flags,calendar:'lunar',year:ly,month:lm,day:ld,leap});
    return {solar:p.solar,pillars:p.pillars,candidates:p.candidates};
   });
  } else lunarInputRangeExcluded.push(row.solar);
  // Date-label checks validate our declared midnight policy, not an alternative school.
  for(const [hour,minute] of [[0,0],[0,29],[0,30],[22,59],[23,0],[23,30],[23,59]]) {
   try {
    const p=calculateProfile({...input,timeKnown:true,hour,minute});
    check('publishedDayLabelKnownMinutes',row,row.dayPillar,()=>p.pillars.day);
   } catch(error) {
    if(!['NONEXISTENT_BIRTH_TIME','AMBIGUOUS_BIRTH_TIME','HISTORICAL_CLOCK_SOURCE_DISPUTE'].includes(error.message))throw error;
    refusedKnownMinutes[error.message]=(refusedKnownMinutes[error.message]??0)+1;
   }
  }
  // This source's lunar month name is deliberately NOT used as a saju month oracle.
  const sourceYear=row.sourceGanji.match(/^([가-힣]{2})\([^()]+\)년/)?.[1];
  const sourceMonth=row.sourceGanji.match(/([가-힣]{2})\([^()]+\)월/)?.[1];
  if(sourceMonth) {
   publishedMonthLabels++;
   const noon=calculateProfile({...input,timeKnown:true,hour:12,minute:0});
   if(noon.pillars.year&&noon.pillars.month&&(sourceYear!==noon.pillars.year||sourceMonth!==noon.pillars.month)) {
    yearMonthLabelDifferences++;
    if(labelDifferences.length<6)labelDifferences.push({solar:row.solar,sourceLunarYear:sourceYear,sourceLunarMonth:sourceMonth,sajuYear:noon.pillars.year,sajuMonth:noon.pillars.month});
   }
  }
  const reading=makeReading(unknown,other,'친구');
  check('calendarToReadingEvidence',row,true,()=>Object.values(checkBetaEvidence(unknown,other,reading)).every(Boolean));
  check('noCalendarApprovalOrScore',row,[false,null,false],()=>[unknown.policy.productionApproved,reading.score,reading.basis.productionApproved]);
 }
 return {auditVersion:'calendar-reading-source-review-v1',reviewedOn:'2026-10-20',reviewer:'Codex',
  sourceScope:'KASI public monthly Gregorian conversion rows fetched separately from the pinned candidate table; not an independent astronomical model.',
  sourceSelection:{months:new Set(rows.map(r=>r.sourceMonth)).size,years:[...new Set(rows.map(r=>r.solar[0]))],dateRows:rows.length,leapDateRows:rows.filter(r=>r.lunar[3]).length},
  checks,failures,checksPassed:failures.length===0,
  refusalScope:'Pinned IANA/v5 mechanism rechecks only; not additional historical evidence.',refusedKnownMinutes,
  lunarInputRangeExcluded:{count:lunarInputRangeExcluded.length,solarDates:lunarInputRangeExcluded,reason:'Gregorian 1908 dates can fall in lunar 1907, below the current lunar input lower bound. Raw conversion is checked; app-range equivalence is not claimed.'},
  lunarYearMonthAreNotSaju:{publishedMonthLabels,yearMonthLabelDifferences,examples:labelDifferences,verdict:'Expected convention difference, excluded from calendar failure counts.'},
  productionApproved:false,expertSignoff:'not-completed',
  limitations:['24 selected months are not continuous verification of the supported years.',
   'Published calendar date labels do not prove birth-clock practice, hour pillars or a universally correct day-boundary convention.',
   'No new strength, transformation, compatibility score or relationship prediction is introduced.',
   '2026 fixtures include dates after the review date; calendar arithmetic tests do not relax the web future-birth rejection.']};
}
export function buildCalendarReadingAudit() {
 const report=auditCalendarRows();
 const readingPermutations=auditReadingPermutations();
 return {...report,checksPassed:report.checksPassed&&readingPermutations.passed,readingPermutations,
  sourceManifestSha256:digest(readFileSync(new URL('fixtures/kasi-months/sources.json',root))),
  derivedRowsSha256:digest(readFileSync(new URL('fixtures/kasi-months-derived.json',root)))};
}
export function renderCalendarReading(r) {
 return ['# 달력·풀이 연결 감수', '',`${r.sourceSelection.years.length}개 연도·${r.sourceSelection.months}개월·${r.sourceSelection.dateRows}일, 윤달 ${r.sourceSelection.leapDateRows}일. 실제 사용자의 출생 자료가 아닙니다.`,
  '',...Object.entries(r.checks).map(([k,v])=>`- ${k}: ${v.passed} 통과 / ${v.failed} 실패`),
  '',`풀이 조합 ${r.readingPermutations.cases}개: ${r.readingPermutations.passed?'통과':'실패'}. 오행·관계·순서 교환·시간 제외의 일관성 검사이며 해석 승인과 구분합니다.`,
  '',`역사 시각 거절 재현: ${JSON.stringify(r.refusedKnownMinutes)}`,
  `양력 1908년에 속하지만 음력 입력 범위 밖인 날짜: ${r.lunarInputRangeExcluded.count}개. 원시 왕복 변환은 별도로 검사했습니다.`,
  '',`음력 연·월 표기와 절입 사주 연·월의 차이: ${r.lunarYearMonthAreNotSaju.yearMonthLabelDifferences}건. 서로 다른 기준이므로 실패로 세지 않습니다.`,
  '',...r.limitations.map(x=>'- '+x),'', '전문가 감수·계산 운영 승인은 미완료입니다.',
  '', '[세부 수치](calendar-reading-audit.json) · [출처](../fixtures/kasi-months/sources.json) · [감수와 출시 준비](../../../docs/calendar-reading-release-review.md)',''].join('\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
 const args=process.argv.slice(2);if(args.some(a=>!['--check','--release-check'].includes(a)))throw new Error('UNKNOWN_ARGUMENT');
 const report=buildCalendarReadingAudit();if(!report.checksPassed)throw new Error('CALENDAR_READING_REVIEW_FAILED');
 for(const [file,text] of [['calendar-reading-audit.json',JSON.stringify(report,null,2)+'\n'],['calendar-reading-drafts.md',renderCalendarReading(report)]]) {
  const out=new URL('reports/'+file,root);
  if(args.length){if(readFileSync(out,'utf8')!==text)throw new Error('CALENDAR_READING_REPORT_STALE');}else writeFileSync(out,text);
 }
 console.log(`PASS: ${report.sourceSelection.dateRows} calendar rows and reading evidence reproduced.`);
 if(args.includes('--release-check')){console.log('BLOCKED: calculation policy and expert signoff remain pending.');process.exitCode=2;}
}

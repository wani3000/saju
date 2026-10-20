/** Reproducible research policy mechanisms and source-scoped criteria. No production approval. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {calculateProfile,boundaryReviewSeconds} from './adapter.mjs';
import {calculateProfile as baseline} from './baseline-v3.mjs';
import {getSolarTermsOfYear} from './build/manseryeok.mjs';
import {chart} from './beta-quality-pack.mjs';
import {criteriaSource,criteriaVersion,reviewScopedGuards,auditFiveElementShortcut,reviewScopedPair} from './scoped-criteria.mjs';
const read=p=>readFileSync(new URL(p,import.meta.url));
const hash=b=>createHash('sha256').update(b).digest('hex');
const base={calendar:'solar',leap:false,timeKnown:true};
export function auditCalendarPolicy() {
 let monthBoundaryProbes=0;const failures=[];
 for(let year=2000;year<=2026;year++)for(const term of getSolarTermsOfYear(year).filter(t=>t.index%2===0)) {
  const t=term.date.getTime(),margin=boundaryReviewSeconds*1000;
  // Probe exact engine cutoffs, including the minute that ENDS at the lower margin.
  for(const [utc,near] of [[t-margin-60000,false],[t-margin,true],[t+margin,true],[t+margin+60000,false]]) {
   const d=new Date(utc+9*3600000),input={...base,year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate(),hour:d.getUTCHours(),minute:d.getUTCMinutes()};
   const p=calculateProfile(input),b=baseline(input);
   const checks=[Boolean(p.boundaryReview)===near,p.policy.productionApproved===false,
    p.pillars.day===b.pillars.day,p.pillars.hour===b.pillars.hour,
    near?p.pillars.month===null&&p.candidates.month.length===2&&p.boundaryReview.verifiedErrorBound===false:p.pillars.month!==null];
   if(checks.some(c=>!c))failures.push({year,index:term.index,utc:new Date(utc).toISOString(),near});
   monthBoundaryProbes++;
  }
 }
 const choices=[
  {id:'range',value:'1908..2026 for input and converted solar year',status:'selected-for-local-research'},
  {id:'year-month-clock',value:'historical UTC coordinate / Jie boundary; lunar year/month names are distinct',status:'selected-for-local-research'},
  {id:'day-hour-clock',value:'civil wall / midnight; no DST removal or solar-time correction',status:'selected-for-local-research'},
  {id:'birth-minute',value:'[minute start, next minute); lower review-edge ending minute excluded, upper starting minute included',status:'mechanism-checked'},
  {id:'review-margin',value:'120 seconds; not an astronomical error bound or a claim outside the window',status:'provisional-review-envelope'},
  {id:'unknown-hour',value:'whole civil date; no invented hour or probability over candidates',status:'selected-for-local-research'},
  {id:'historical-clock',value:'reject IANA gaps/folds; preserve 1954 source dispute and LMT/pre-1972 limitations',status:'source-dispute-retained'},
  {id:'production-adoption',value:null,status:'not-approved'},
 ];
 return {engineVersion:'research-civil-midnight-v5',productionApproved:false,monthBoundaryProbes,failures,checksPassed:failures.length===0,choices,
  scope:'324 engine Jie boundaries in 2000..2026 x four policy edge probes. Mechanism checks, not additional independent astronomy or historical clock evidence.'};
}
const stemPillar=s=>s+('갑을병정무기경신임계'.indexOf(s)%2?'축':'자');
export function guardFixtures() {
 const months=['무진','갑신','기해','계묘','정사'],hours=['병인','병자','신묘','병오','을묘'];
 const list=criteriaSource.guards.flatMap((g,i)=>[false,true].map(reverse=>({
  id:g.pair+(reverse?'-reverse':''),profile:chart({year:stemPillar(g.pair[reverse?0:1]),month:months[i],day:stemPillar(g.pair[reverse?1:0]),hour:hours[i]})})));
 list.push({id:'preferred-hour-with-day-guard',profile:chart({year:'무진',month:'정사',day:'계유',hour:'병진'})});
 const unknown=structuredClone(list.at(-1).profile);unknown.timeKnown=false;unknown.pillars.hour=null;
 list.push({id:'known-day-guard-unknown-hour',profile:unknown});
 return list;
}
export function buildPolicyCriteriaAudit() {
 const manifest=JSON.parse(read('fixtures/reading-sources/hour-balance-sources.json')).sources.find(s=>s.sourceId===criteriaSource.sourceId);
 if(manifest.pdfSha256!==criteriaSource.pdfSha256)throw new Error('CRITERIA_SOURCE_CHANGED');
 for(const page of criteriaSource.pages)if(hash(read('fixtures/reading-sources/'+page.file))!==page.sha256)throw new Error('CRITERIA_PAGE_CHANGED');
 const calendar=auditCalendarPolicy(),guards=guardFixtures().map(f=>({id:f.id,review:reviewScopedGuards(f.profile)}));
 const strength=auditFiveElementShortcut();
 const pair=reviewScopedPair(guardFixtures()[0].profile,guardFixtures()[10].profile);
 const calendarInputs=[
  ['known-time',{...base,year:2026,month:2,day:17,hour:12,minute:0}],
  ['unknown-time',{...base,year:2026,month:2,day:17,timeKnown:false}],
  ['term-candidates',{...base,year:2024,month:2,day:4,hour:17,minute:27}],
  ['clock-source-dispute',{...base,year:1954,month:3,day:21,timeKnown:false}],
 ].map(([id,input])=>({id,review:reviewScopedGuards(calculateProfile(input))}));
 return {ruleVersion:criteriaVersion,reviewedOn:'2026-10-20',reviewer:'Codex source and mechanism review; no human signoff',
  productionApproved:false,sourceFixtureSha256:hash(read('fixtures/reading-sources/scoped-criteria-source.json')),
  calendar,guards,calendarInputs,strength,pair,
  checksPassed:calendar.checksPassed&&guards.every(g=>g.review.triggerInEveryCandidate)&&strength.counterexamples.length>0&&pair.score===null&&
   calendarInputs.every(c=>c.review.transformationEstablished===null),
  limitations:['Named day/hour triggers are source-position observations; remaining qi/exception/rescue conditions remain unresolved.',
   'Five-element presence is not strength or balance. Individual source labels are not pairwise relationship effects.',
   'Earlier reports, app copy v2, calculated profiles and saved/purchased/shared snapshots are unchanged.']};
}
export function renderPolicyCriteria(r) {
 return ['# 계산 정책·강약·합화·궁합 후속 감수','',
  `계산 정책 경계 ${r.calendar.monthBoundaryProbes}건, 기피 조건 ${r.guards.length}사례, 달력 입력 연결 ${r.calendarInputs.length}사례, 강약 원문 20명조를 재현합니다.`,
  '',`오행이 모두 관찰돼도 원문 강약 극단 판어가 있는 대조 ${r.strength.counterexamples.length}건: ${r.strength.counterexamples.join(', ')}.`,
  '','선호 시주와 무계 일지 기피 조건이 같은 명조에서 함께 관찰될 수 있습니다. 선호 예시 일치를 합화 성립으로 바꾸지 않습니다.',
  '',...r.limitations.map(x=>'- '+x),'',
  '[구조화 결과](policy-criteria-audit.json) · [출처·판정·보류 이유](../../../docs/policy-criteria-review.md)',''].join('\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
 const args=process.argv.slice(2);if(args.some(a=>!['--check','--release-check'].includes(a)))throw new Error('UNKNOWN_ARGUMENT');
 const r=buildPolicyCriteriaAudit();if(!r.checksPassed)throw new Error('POLICY_CRITERIA_FAILED');
 for(const [file,text] of [['policy-criteria-audit.json',JSON.stringify(r,null,2)+'\n'],['policy-criteria-drafts.md',renderPolicyCriteria(r)]]) {
  const url=new URL('reports/'+file,import.meta.url);if(args.length){if(readFileSync(url,'utf8')!==text)throw new Error('POLICY_CRITERIA_REPORT_STALE');}else writeFileSync(url,text);
 }
 console.log(`PASS: ${r.calendar.monthBoundaryProbes} policy probes, ${r.guards.length} guard cases, ${r.strength.counterexamples.length} five-element counterexamples.`);
 if(args.includes('--release-check')){console.log('BLOCKED: calendar production policy, general strength/transformation and compatibility weights remain unapproved.');process.exitCode=2;}
}

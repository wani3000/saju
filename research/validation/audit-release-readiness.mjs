/** Offline review readiness. No service provisioning, credentials, or human approval inference. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
import {buildCalendarReadingAudit} from './audit-calendar-reading.mjs';
import {buildMonthHourAudit} from './audit-month-hour.mjs';
import {buildBetaQualityPack} from './beta-quality-pack.mjs';
import {privateBetaScope} from './beta-reading.mjs';
const read=p=>readFileSync(new URL(p,import.meta.url));
const hash=b=>createHash('sha256').update(b).digest('hex');
export function buildReleaseReadiness() {
 const calendar=buildCalendarReadingAudit(),quality=buildBetaQualityPack(),monthHour=buildMonthHourAudit();
 if(!calendar.checksPassed||!quality.checksPassed||!monthHour.checksPassed)throw new Error('REVIEW_EVIDENCE_FAILED');
 for(const [name,current] of [['calendar-reading-audit.json',calendar],['beta-quality-audit.json',quality],['month-hour-audit.json',monthHour]])
  if(read('reports/'+name).toString()!==JSON.stringify(current,null,2)+'\n')throw new Error('REVIEW_EVIDENCE_STALE');
 const sources=JSON.parse(read('fixtures/kasi-months/sources.json'));
 for(const s of sources.sources) {
  const compressed=read('fixtures/kasi-months/'+s.file);
  if(hash(compressed)!==s.gzipSha256||hash(gunzipSync(compressed))!==s.sha256)throw new Error('REVIEW_SOURCE_CHANGED');
 }
 const gates=[
  {id:'calendar-policy',status:'pending',reason:'CALENDAR_POLICY_PENDING',evidence:'Range, midnight/solar-time convention, 1954 clock interpretation and model adoption need review.'},
  {id:'expert-interpretation',status:'not-completed',reason:'EXPERT_REVIEW_PENDING',evidence:'Source/editorial review by Codex does not provide a human expert signature.'},
  {id:'user-comprehension',status:'not-started',reason:'USER_STUDY_NOT_STARTED',evidence:`Observed human participants: ${quality.humanParticipantsObserved}.`},
  {id:'private-access',status:'not-verified',reason:'PRIVATE_ACCESS_UNVERIFIED',evidence:'No externally hosted private pilot or access-control verification.'},
  {id:'external-auth',status:'deferred-until-ready',reason:'EXTERNAL_AUTH_UNVERIFIED',evidence:'Supabase/Kakao actual round trip deferred at user direction; no credentials inspected.'},
  {id:'external-payment',status:'deferred-until-ready',reason:'EXTERNAL_PAYMENT_UNVERIFIED',evidence:'NICEPAY actual sandbox round trip deferred; local mocks are not external payment evidence.'},
  {id:'paid-product',status:'deferred',reason:'PAID_PRODUCT_NOT_APPROVED',evidence:'First free / additional KRW 2900 plan retained; paid scope/value and any score require separate approval.'},
  {id:'operations',status:'not-verified',reason:'OPERATIONS_UNVERIFIED',evidence:'Hosted backup/restore, monitoring, support, consent/retention/refund policy and rollback rehearsal remain pending.'},
 ];
 return {version:'local-release-readiness-v1',reviewedOn:'2026-10-20',scopeVersion:privateBetaScope.scopeVersion,
  engineVersion:'research-civil-midnight-v5',readingVersion:privateBetaScope.readingVersion,
  evidence:{status:'source-reports-reproduced',calendarDays:calendar.sourceSelection.dateRows,
   calendarYears:calendar.sourceSelection.years,calendarMonths:calendar.sourceSelection.months,
   syntheticReadingCombinations:calendar.readingPermutations.cases,originalReferenceCharts:quality.sourceReferenceBank.length,
   betaCopyCases:quality.cases.length,
   monthHourSourceAnchors:monthHour.sourceAnchorGroups,monthHourChecks:monthHour.counts,
   reports:['calendar-reading-audit.json','beta-quality-audit.json','month-hour-audit.json'].map(file=>({file,sha256:hash(read('reports/'+file))}))},
  automatedSuiteExecution:'Not executed by this command. Unit/browser/DB/build checks are separate CI steps.',
  gates,blockerIds:gates.filter(g=>g.status!=='approved').map(g=>g.reason),
  status:'blocked',publicReleaseApproved:false,realChargesEnabled:false,
  humanExpertSignoff:privateBetaScope.review.expertInterpretationSignoff,
  limitations:['Reproducing reports cannot approve factual calendar accuracy or relationship predictions.',
   'A passing CI run does not complete any human, external-service or hosted-operations gate.',
   'No environment variable, secret, service account, deployment or actual user data is read or changed.']};
}
export function renderReleaseReadiness(r) {
 return ['# 출시 준비 종합 검토','','현재 상태: **출시 차단 유지**. 외부 연동은 준비 후 진행합니다.',
  '',`자료 재현: 달력 ${r.evidence.calendarDays}일·풀이 조합 ${r.evidence.syntheticReadingCombinations}개·원문 ${r.evidence.originalReferenceCharts}명조·편집 초안 ${r.evidence.betaCopyCases}개.`,
  '',`월간·시간 천간 원문 ${r.evidence.monthHourSourceAnchors}묶음 → 파생 월주 ${r.evidence.monthHourChecks.monthCombinations}조합·시각 ${r.evidence.monthHourChecks.hourMinuteProbes}분을 추가 재현합니다.`,
  '','| 항목 | 상태 | 차단 사유 |','|---|---|---|',...r.gates.map(g=>`| ${g.id} | ${g.status} | ${g.reason} |`),
  '','이 명령은 자료 해시와 보고서 재현을 검사합니다. 단위·브라우저·DB·빌드 검사를 대신 실행하지 않습니다.',
  '','[구조화 결과](release-readiness.json) · [근거와 후속 작업](../../../docs/calendar-reading-release-review.md)',''].join('\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
 const args=process.argv.slice(2);if(args.some(a=>!['--check','--release-check'].includes(a)))throw new Error('UNKNOWN_ARGUMENT');
 const r=buildReleaseReadiness();
 for(const [name,text] of [['release-readiness.json',JSON.stringify(r,null,2)+'\n'],['release-readiness.md',renderReleaseReadiness(r)]]) {
  const file=new URL('reports/'+name,import.meta.url);
  if(args.length){if(readFileSync(file,'utf8')!==text)throw new Error('RELEASE_REVIEW_STALE');}else writeFileSync(file,text);
 }
 console.log(`PASS: source reports reproduced; ${r.blockerIds.length} release gates remain incomplete.`);
 if(args.includes('--release-check')) {console.log('BLOCKED: '+r.blockerIds.join(', '));process.exitCode=2;}
}

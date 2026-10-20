import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {chart,referenceProfile} from './beta-quality-pack.mjs';
import {calculateProfile} from './adapter.mjs';
import {rescueSource,rescueVersion,reviewRescueActors,reviewTransformationReference,auditWeightSensitivity,reviewRescuePair} from './rescue-wangqi-review.mjs';
const read=p=>readFileSync(new URL(p,import.meta.url));
const hash=b=>createHash('sha256').update(b).digest('hex');
export function rescueFixtures() {
 return [
  {id:'officer-injury-resource',profile:chart({year:'신축',month:'신묘',day:'무자',hour:'병진'})},
  {id:'killing-food-resource-wealth',profile:chart({year:'임자',month:'무신',day:'갑자',hour:'병인'})},
  {id:'wealth-rob-officer',profile:chart({year:'을축',month:'경진',day:'갑자',hour:'신미'})},
 ];
}
export function buildRescueWangqiAudit() {
 const old=[JSON.parse(read('fixtures/reading-sources/context-source.json')),
  ...JSON.parse(read('fixtures/reading-sources/adjudication-sources.json')).sources];
 for(const s of rescueSource.sources) {
  if(!old.some(o=>o.sourceId===s.sourceId&&o.pdfSha256===s.pdfSha256))throw new Error('RESCUE_SOURCE_METADATA_CHANGED');
  for(const p of s.pages)if(hash(read('fixtures/reading-sources/'+p.file))!==p.sha256)throw new Error('RESCUE_SOURCE_PAGE_CHANGED');
 }
 const references=rescueSource.transformationCases.map(c=>({id:c.id,review:reviewTransformationReference(referenceProfile(c))}));
 const rescue=rescueFixtures().map(c=>({id:c.id,review:reviewRescueActors(c.profile)}));
 const base={calendar:'solar',leap:false};
 const calendarInputs=[
  ['known-time',{...base,timeKnown:true,year:2026,month:2,day:17,hour:12,minute:0}],
  ['unknown-time',{...base,timeKnown:false,year:2026,month:2,day:17}],
  ['term-candidates',{...base,timeKnown:true,year:2024,month:2,day:4,hour:17,minute:27}],
  ['clock-source-dispute',{...base,timeKnown:false,year:1954,month:3,day:21}],
 ].map(([id,input])=>({id,review:reviewRescueActors(calculateProfile(input))}));
 const weights=auditWeightSensitivity();
 const shortcutCounterexamples={
  literalChenNecessary:references.filter(c=>c.review.literalChen.absenceConfirmed).map(c=>c.id),
  listedPreferredHourNecessary:references.filter(c=>c.review.priorPreference.hourMatch!=='listed-preferred-hour').map(c=>c.id),
  noExtraJiaEulUniversal:references.filter(c=>c.review.priorJiaJiConditions.commonFailedChecks?.some(id=>['no-extra-jia','no-visible-eul'].includes(id))).map(c=>c.id),
  scope:'Cross-edition universal shortcuts only; these do not decide the meaning of Sanming 時上旺氣 or override source-specific clauses.',
 };
 return {ruleVersion:rescueVersion,reviewedOn:'2026-10-20',reviewer:'Codex visual/source/mechanism review; no human expert signoff',
  productionApproved:false,sourceFixtureSha256:hash(read('fixtures/reading-sources/rescue-wangqi-source.json')),
  references,rescue,calendarInputs,shortcutCounterexamples,weights,
  pair:reviewRescuePair(rescueFixtures()[0].profile,rescueFixtures()[1].profile),
  checksPassed:references.every(c=>c.review.sourceClassification?.sourceSaysTrueTransformation)&&
   rescue.every(c=>c.review.patterns.find(p=>p.id===c.id).actorsInEveryCandidate)&&
   shortcutCounterexamples.literalChenNecessary.length>0&&new Set(weights.probes.map(p=>p.ordering)).size===3,
  limitations:['Four source examples are not verified birth records or outcome observations.',
   'Static month-frame candidates and visible actor groups do not establish 格局, real harm, force or effective rescue.',
   'True transformation is a source-attributed premise; transformed qi strength is distinct from original-day strength.',
   'Existing app v5/v2, stored/purchased/shared results and earlier source reports remain unchanged.']};
}
export function renderRescueWangqi(r) {
 return ['# 왕기·구응·강약 경계·가중치 감수','',
  `새 원문 합화 사례 ${r.references.length}개, 구응 관찰 ${r.rescue.length}구조, 달력 연결 ${r.calendarInputs.length}개를 재현합니다.`,
  '',`辰 필수 가설 반례: ${r.shortcutCounterexamples.literalChenNecessary.join(', ')}. 선호 시주 필수 가설 반례: ${r.shortcutCounterexamples.listedPreferredHourNecessary.join(', ')}.`,
  '','이는 여러 출처를 합친 보편 규칙의 반례이며, 다른 책의 시상 왕기 정의를 자동 확정하지 않습니다.',
  '','동일 인성은 관·상관 문맥에서 구제 수단, 살·식신 문맥에서 방해 요인으로 기록됩니다. 실제 구응과 일반 강약 판단은 null입니다.',
  '','합성 가중치 민감도: '+r.weights.probes.map(p=>`${p.hypotheticalCombinationWeight}/${p.hypotheticalClashCost}: ${p.ordering}`).join(' → ')+'. 추천 가중치나 궁합 점수가 아닙니다.',
  '',...r.limitations.map(x=>'- '+x),'',
  '[전체 결과](rescue-wangqi-audit.json) · [출처·조건·검증·미완료](../../../docs/rescue-wangqi-review.md)',''].join('\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
 const flags=process.argv.slice(2);if(flags.some(f=>!['--check','--release-check'].includes(f)))throw new Error('UNKNOWN_ARGUMENT');
 const r=buildRescueWangqiAudit();if(!r.checksPassed)throw new Error('RESCUE_WANGQI_AUDIT_FAILED');
 for(const [file,content] of [['rescue-wangqi-audit.json',JSON.stringify(r,null,2)+'\n'],['rescue-wangqi-drafts.md',renderRescueWangqi(r)]]) {
  const url=new URL('reports/'+file,import.meta.url);if(flags.length){if(readFileSync(url,'utf8')!==content)throw new Error('RESCUE_WANGQI_REPORT_STALE');}else writeFileSync(url,content);
 }
 console.log(`PASS: ${r.references.length} source charts; ${r.rescue.length} rescue patterns; ${r.weights.probes.length} synthetic weight regimes.`);
 if(flags.includes('--release-check')){console.log('BLOCKED: no universal 旺氣, rescue/strength classifier or adopted compatibility weights.');process.exitCode=2;}
}

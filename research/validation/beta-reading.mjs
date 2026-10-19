/** Frozen beta scope and revised copy. Earlier reading versions are immutable. */
import {readFileSync} from 'node:fs';
import {buildSelectedReading} from './selected-reading.mjs';
import {ruleCatalog} from './reading-rules.mjs';
const scope=JSON.parse(readFileSync(new URL('./beta-scope.json', import.meta.url)));
const freeze=o=>{if(o&&typeof o==='object'){Object.values(o).forEach(freeze);Object.freeze(o);}return o;};
export function validateBetaScope(value) {
 if(!value||Object.keys(value).some(k=>!['scopeVersion','readingVersion','phase','access','productionApproved','calendarApproval','domainInterpretationApproval','audience','externalPilotStarted','monetization','realCharges','paidProduct','supportedResearchInput','comparisonPositions','included','excluded','copy','review'].includes(k))||value.scopeVersion!=='private-beta-scope-v1'||value.readingVersion!=='source-observations-copy-v2'||
  value.phase!=='local-private-beta-candidate'||value.access!=='local-review-until-access-control-verified'||value.audience!=='invited-adult-testers-after-access-control'||
  value.productionApproved!==false||value.realCharges!==false||value.externalPilotStarted!==false||
  value.monetization!=='free-beta-test-payments-only'||value.calendarApproval!=='pending'||value.domainInterpretationApproval!=='pending'||
  JSON.stringify(value.comparisonPositions)!==JSON.stringify(['year','month','day'])||
  JSON.stringify(value.included)!==JSON.stringify(['day-stem-element','common-symbol-pairs','source-and-coverage','relationship-conversation-prompts','private-result-storage','conversation-only-sharing','unranked-collection'])||
  JSON.stringify(value.excluded)!==JSON.stringify(['personality-prediction','relationship-outcome','strength-verdict','transformation-verdict','compatibility-score','map-ranking','live-payments','public-release'])||
  value.paidProduct?.status!=='deferred-not-cancelled'||value.paidProduct?.firstPartnerFree!==true||value.paidProduct?.additionalPartnerPriceKRW!==2900||
  value.supportedResearchInput?.region!=='KR'||value.supportedResearchInput?.minimumYear!==1908||value.supportedResearchInput?.maximumYear!==2026||value.supportedResearchInput?.productionAccuracyApproved!==false||
  value.review?.expertInterpretationSignoff!=='not-completed'||value.review?.userComprehensionStudy!=='not-started'||
  !value.copy||JSON.stringify(Object.keys(value.copy).sort())!==JSON.stringify(['label','title','notice','elementDefinition','uncertainElement','pairMeaning','noMatch','adviceNotice','positionGuide','sharedTitle','sharedStrength'].sort())||Object.values(value.copy).some(v=>typeof v!=='string'||v.trim().length===0||v.length>180))throw new Error('INVALID_BETA_SCOPE');
 return structuredClone(value);
}
export const privateBetaScope=freeze(validateBetaScope(scope));
const positionLabels={year:'태어난 해',month:'절기로 나눈 태어난 달',day:'태어난 날'};
export function buildBetaReading(first,second,relationship) {
 const result=buildSelectedReading(first,second,relationship);
 const {copy}=scope,basis=result.basis;
 const [a,b]=basis.dayElements.map(d=>d.element);
 const describe=(who,element)=>element?`${who}의 기준 오행은 ${element}${['목','금'].includes(element)?'이에요':'예요'}.`:`${who}의 기준 오행은 ${copy.uncertainElement}`;
 const strength=a&&b?`태어난 날의 글자를 오행으로 나누면 나는 ${a}, 상대방은 ${b}에 해당해요. ${copy.elementDefinition}`:
  `${describe('나',a)} ${describe('상대방',b)} ${copy.elementDefinition}`;
 return {...result,label:copy.label,title:copy.title,strength,
  difference:basis.commonFamilies.length?`확인한 짝은 ${basis.commonFamilies.join('·')}이에요. ${copy.pairMeaning}`:copy.noMatch,
  ruleVersion:scope.readingVersion,
  basis:{...basis,notice:copy.notice,adviceNotice:copy.adviceNotice,
   observations:basis.observations.map(f=>{
    const r=ruleCatalog.rules.find(r=>r.id===f.ruleId);
    return {...f,text:`내 정보(${positionLabels[f.positions[0].position]})와 상대방 정보(${positionLabels[f.positions[1].position]})에서 ${r.symbols.join('·')}의 ${r.label} 짝이 확인돼요.`};
   }),
   cautions:[...basis.cautions,copy.positionGuide],
   sharedCopy:{title:copy.sharedTitle,strength:copy.sharedStrength}}};
}

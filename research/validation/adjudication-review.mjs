/** Source-attributed case judgments and vetoes; no universal chart classifier or numeric compatibility. */
import {readFileSync} from 'node:fs';
import {analyzeProfile,compareProfiles} from './reading-analysis.mjs';
import {ruleCatalog} from './reading-rules.mjs';
import {classifyTenGod} from './natal-rules.mjs';
const manifest=JSON.parse(readFileSync(new URL('./fixtures/reading-sources/adjudication-sources.json',import.meta.url)));
const tx=JSON.parse(readFileSync(new URL('./fixtures/reading-sources/adjudication-transcription.json',import.meta.url)));
const positions=['year','month','day','hour'];
const freeze=o=>{if(o&&typeof o==='object'){Object.values(o).forEach(freeze);Object.freeze(o);}return o;};
const unique=xs=>[...new Set(xs)].sort();
const options=(p,k)=>k==='hour'&&!p.timeKnown?[null]:p.pillars[k]===null?p.candidates[k]:[p.pillars[k]];
export const adjudicationVersion='source-case-veto-and-score-review-v1';
export const strengthReferences=freeze(tx.strengthCases);
export function adjudicationSource(id,page) {
 const s=manifest.sources.find(s=>s.sourceId===id);if(!s||!s.pages.some(p=>p.pdfPage===page))throw new Error('UNKNOWN_SOURCE_PAGE');
 return {sourceId:id,pdfPage:page,pdfSha256:s.pdfSha256,url:s.url};
}
export function adjudicateStrengthReference(profile) {
 const base=analyzeProfile(profile);
 const fixed=profile.timeKnown&&positions.every(k=>options(profile,k).length===1);
 const matches=strengthReferences.filter(c=>positions.every((k,i)=>k==='hour'&&!profile.timeKnown||options(profile,k).includes(c.pillars[i])));
 const exact=fixed?matches[0]:null;
 return {ruleVersion:adjudicationVersion,productionApproved:false,coverage:base.coverage,
  status:exact?'exact-source-case':matches.length?'partial-source-case':'outside-reference-corpus',
  sourceClassification:exact?{category:exact.classification,label:exact.sourceLabel,element:exact.element,scope:'this-edition-exact-case'}:null,
  matches:matches.map(c=>({id:c.id,match:fixed?'exact-four-pillars':'partial-not-jointly-established',source:adjudicationSource('ditian-1947',c.pdfPage)})),
  sourceAttributedTransformation:exact?.id==='water-extremely-weak'?{
   pair:'무계',positions:['year','month'],element:'화',sourceSaysTransformation:true,scope:'this-source-example-only',
   source:adjudicationSource('ditian-1947',188)}:null,
  generalClassification:null,moderation:null,score:null,
  limitations:['Twenty deliberately selected extreme cases contain no balanced reference class',
   'No nearest-chart inference, default balance, numerical thresholds or prediction',
   'An exact source match is not calendar approval; coverage flags still apply',
   'The source year/month transformation example is not a day-stem or cross-person rule']};
}
export const transformationVetoes=freeze([
 {pair:'갑기',stem:'무',scope:'between-pair',page:128,sourceWording:'有戊字間之則不化'},
 {pair:'을경',stem:'갑',scope:'between-pair',page:128,sourceWording:'有甲字間之則不化'},
 {pair:'병신',stem:'정',scope:'visible-stems',page:129,sourceWording:'柱有丁字不化'},
 {pair:'정임',stem:'병',scope:'visible-stems',page:129,sourceWording:'柱有丙字不化'},
 {pair:'무계',stem:'기',scope:'visible-stems',page:129,sourceWording:'柱有己字不化'},
]);
function* assign(slots,i=0,a={}) {
 if(i===slots.length){yield a;return;}
 const [k,vs]=slots[i];for(const v of vs)yield* assign(slots,i+1,{...a,[k]:v});
}
function vetoAssignment(a,timeKnown) {
 const r=transformationVetoes.find(r=>r.pair.includes(a.day)),partner=[...r.pair].find(s=>s!==a.day);
 const targets=positions.filter(k=>k!=='day'&&a[k]===partner);
 const pairs=targets.map(k=>{
  const left=Math.min(positions.indexOf(k),2),right=Math.max(positions.indexOf(k),2);
  const inspected=r.scope==='between-pair'?positions.slice(left+1,right):positions;
  const blockers=inspected.filter(p=>a[p]===r.stem);
  return {partnerPosition:k,blockerPositions:blockers,sourceVetoObserved:blockers.length>0};
 });
 const allVetoed=pairs.length>0&&pairs.every(p=>p.sourceVetoObserved);
 return {pair:r.pair,scope:r.scope,blockerStem:r.stem,pairs,
  status:!pairs.length?timeKnown?'no-visible-day-partner':'day-partner-unobserved':
   allVetoed?timeKnown?'all-observed-day-pairs-vetoed':'observed-pairs-vetoed-hour-unobserved':'remaining-conditions-unresolved',
  dayPairSourceClausePassed:timeKnown&&(!pairs.length||allVetoed)?false:null,
  dayPairTransformationEstablished:timeKnown&&!pairs.length?false:null,
  source:adjudicationSource('sanming-1926',r.page)};
}
export function adjudicateTransformationVetoes(profile) {
 const base=analyzeProfile(profile);
 const slots=positions.map(k=>[k,unique(options(profile,k).map(p=>p?.[0]??null))]);
 const found=new Map();for(const a of assign(slots)){const r=vetoAssignment(a,profile.timeKnown);found.set(JSON.stringify(r),r);}
 const alternatives=[...found.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([,v])=>v);
 const states=unique(alternatives.map(a=>a.status));
 return {ruleVersion:adjudicationVersion,productionApproved:false,coverage:base.coverage,
  status:states.length===1?states[0]:'candidate-dependent',alternatives,
  dayPairSourceClausePassed:alternatives.every(a=>a.dayPairSourceClausePassed===false)?false:null,
  dayPairTransformationEstablished:alternatives.every(a=>a.dayPairTransformationEstablished===false)?false:null,
  transformationEstablished:null,transformedElement:null,
  scope:'Selected Sanming paragraph, visible day-stem pair only; not all stem combinations or a cross-edition verdict',
  normalization:'間之 is conservatively applied only between pair positions; 柱有 is tested over all visible stems. Absence never passes remaining conditions.',
  candidatePolicy:'Universal over supplied marginal combinations; partial assignments are not proved jointly feasible.',
  unresolved:['Hour wangqi, seasonal moderation and rescue precedence remain unadjudicated',
   'Ziping Jia-Ji 庚/乙 and Sanming 戊 clauses remain separate conventions',
   'A surviving second partner prevents a chart-wide veto; unknown hour cannot prove completeness']};
}
export function auditVisibleSupportShortcut() {
 // Deliberately rejected hypothesis: >=2 of the OTHER visible stems support the day.
 // This count is a diagnostic counterexample probe, not a strength algorithm for the app.
 const cases=strengthReferences.map(c=>{
  const supported=c.pillars.filter((_,i)=>i!==2).filter(p=>['same-element','target-produces-day'].includes(classifyTenGod(c.pillars[2][0],p[0]).direction)).length;
  const hypothesis=supported>=2?'strong':'weak';
  const sourceDirection=c.classification.includes('strong')?'strong':'weak';
  return {id:c.id,otherVisibleSupportCount:supported,hypothesis,sourceDirection,agrees:hypothesis===sourceDirection};
 });
 return {status:'rejected-counterexample-hypothesis',productionApproved:false,rule:'diagnostic >=2-of-3 visible support shortcut',
  cases,counterexamples:cases.filter(c=>!c.agrees).map(c=>c.id),
  limitation:'Extreme reference corpus only; agreement here would not validate a general strength classifier.'};
}
const allowedKeys=['version','components','directionPolicy','unknownHourPolicy','candidatePolicy','normalization','duplicatePolicy'];
export function auditScoreProposal(input) {
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!allowedKeys.includes(k))||
   input.version!=='score-proposal-v1'||!Array.isArray(input.components)||input.components.length<1||input.components.length>32||
   input.components.some(c=>!c||typeof c!=='object'||Array.isArray(c)||Object.keys(c).some(k=>!['ruleId','weight'].includes(k))||typeof c.ruleId!=='string'||!Number.isFinite(c.weight))||
   !['symmetric','unaggregated-direction'].includes(input.directionPolicy)||!['omit','invent-noon'].includes(input.unknownHourPolicy)||
   !['all-candidates','majority'].includes(input.candidatePolicy)||!['fixed-scale','cohort-minmax'].includes(input.normalization)||
   !['deduplicate-feature','count-duplicates'].includes(input.duplicatePolicy))throw new Error('INVALID_SCORE_PROPOSAL');
 const components=input.components.map(c=>{
  const symbol=ruleCatalog.rules.find(r=>r.id===c.ruleId);
  const strength=strengthReferences.find(r=>'strength:'+r.id===c.ruleId);
  const veto=transformationVetoes.find(r=>'veto:'+r.pair===c.ruleId);
  return {ruleId:c.ruleId,proposedWeight:c.weight,adoptedWeight:null,
   sourceScope:symbol?'symbol-definition':strength?'individual-reference-case':veto?'individual-transformation-veto':'unreviewed',
   sources:symbol?[{...symbol.source}]:strength?[adjudicationSource('ditian-1947',strength.pdfPage)]:veto?[adjudicationSource('sanming-1926',veto.page)]:[],
   blockers:[symbol?'NO_REVIEWED_RELATIONSHIP_EFFECT':strength||veto?'INDIVIDUAL_JUDGMENT_NOT_PAIRWISE_SCORE':'UNKNOWN_REVIEWED_SOURCE',
    'NO_REVIEWED_NUMERIC_WEIGHT']};
 });
 const blockers=unique(components.flatMap(c=>c.blockers));
 if(input.directionPolicy!=='symmetric')blockers.push('DIRECTIONAL_RELATIONS_NEED_AGGREGATION');
 if(input.unknownHourPolicy!=='omit')blockers.push('UNKNOWN_HOUR_MUST_NOT_BE_INVENTED');
 if(input.candidatePolicy!=='all-candidates')blockers.push('CANDIDATE_COUNTS_ARE_NOT_PROBABILITIES');
 if(input.normalization!=='fixed-scale')blockers.push('COHORT_NORMALIZATION_MOVES_EXISTING_PEOPLE');
 if(input.duplicatePolicy!=='deduplicate-feature'||new Set(input.components.map(c=>c.ruleId)).size!==input.components.length)blockers.push('DUPLICATE_CONTRIBUTION_NEEDS_REVIEW');
 return {ruleVersion:adjudicationVersion,status:'not-adoptable-from-reviewed-evidence',productionApproved:false,
  components,blockers:unique(blockers),score:null,normalizedCompatibility:null,mapRadius:null,
  policy:'Request fields cannot approve sources or weights; this pinned registry contains no adopted compatibility weights.'};
}
export function auditScaleCounterexamples() {
 const minmax=(score,cohort)=>(score-Math.min(...cohort))/(Math.max(...cohort)-Math.min(...cohort));
 return {productionApproved:false,scope:'Synthetic scale probes, not scores for real people',
  cohortNormalization:{probe:60,before:minmax(60,[40,60,80]),afterAddingAnother:minmax(60,[0,40,60,80]),status:'violates-fixed-existing-distance'},
  duplicateContribution:{single:10,duplicated:20,status:'same-feature-double-counted'},
  directionalLabels:{forward:classifyTenGod('갑','병').label,reverse:classifyTenGod('병','갑').label,status:'not-an-inherently-symmetric-effect'},
  conclusion:'Engineering invariants and numeric provenance must both pass; neither replaces the other.'};
}
export function reviewPairAdjudication(first,second) {
 const base=compareProfiles(first,second);
 return {ruleVersion:adjudicationVersion,productionApproved:false,coverage:base.coverage,
  individuals:[first,second].map(p=>({strength:adjudicateStrengthReference(p),transformation:adjudicateTransformationVetoes(p)})),
  score:null,normalizedCompatibility:null,mapRadius:null,
  reason:'Reviewed individual judgments and symbol definitions do not supply a pairwise numeric scale.'};
}

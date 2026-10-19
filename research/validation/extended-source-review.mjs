/** Edition-specific review. None of these screens establishes 合化 or predicts a person's life. */
import {readFileSync} from 'node:fs';
import {analyzeProfile} from './reading-analysis.mjs';
import {calculateProfile} from './adapter.mjs';
import {reviewStrengthAndTransformation,analyzeTransformationConditions} from './strength-transformation-review.mjs';
const positions=['year','month','day','hour'];
const unique=xs=>[...new Set(xs)].sort();
const options=(p,k)=>p.pillars[k]===null?p.candidates[k]:[p.pillars[k]];
const freeze=o=>{if(o&&typeof o==='object'){Object.values(o).forEach(freeze);Object.freeze(o);}return o;};
const manifest=JSON.parse(readFileSync(new URL('./fixtures/reading-sources/extended-sources.json',import.meta.url)));
const transcription=JSON.parse(readFileSync(new URL('./fixtures/reading-sources/extended-transcription.json',import.meta.url)));
export const extendedReviewVersion='cross-source-strength-transformation-review-v1';
export function extendedSource(sectionId) {
  const section=transcription.sections.find(s=>s.id===sectionId);
  if(!section) throw new Error('UNKNOWN_SOURCE_SECTION');
  const source=manifest.sources.find(s=>s.sourceId===section.sourceId);
  return {sourceId:source.sourceId,sectionId,pdfPages:[...section.pdfPages],url:source.url,pdfSha256:source.pdfSha256};
}
export const transformationCatalog=freeze([
  {pair:'갑기',targetElement:'토',primaryMonths:[...'진술축미'],additionalMonth:'오'},
  {pair:'을경',targetElement:'금',primaryMonths:[...'사유축'],additionalMonth:'신'},
  {pair:'병신',targetElement:'수',primaryMonths:[...'신자진'],additionalMonth:'해'},
  {pair:'정임',targetElement:'목',primaryMonths:[...'해묘미'],additionalMonth:'인'},
  {pair:'무계',targetElement:'화',primaryMonths:[...'인오술'],additionalMonth:'사'},
]);
export const moderationExamples=freeze([
  {id:'wood-too-strong',pillars:['갑진','정묘','갑자','무진'],sourceLabel:'木太旺',category:'too-strong'},
  {id:'wood-extremely-strong',pillars:['계묘','을묘','갑인','을해'],sourceLabel:'木旺極',category:'extremely-strong'},
  {id:'wood-too-weak',pillars:['을축','갑신','갑신','신미'],sourceLabel:'木太衰',category:'too-weak'},
  {id:'wood-extremely-weak',pillars:['기사','기사','을유','병술'],sourceLabel:'木衰極',category:'extremely-weak'},
]);
function* assignments(slots,i=0,a={}) {
  if(i===slots.length){yield a;return;}
  const [key,values]=slots[i];
  for(const value of values) yield* assignments(slots,i+1,{...a,[key]:value});
}
function assess(a,timeKnown) {
  const rule=transformationCatalog.find(r=>r.pair.includes(a.day));
  const stem=k=>k==='month'?a.month[0]:a[k];
  const partner=[...rule.pair].find(s=>s!==a.day);
  const partnerPositions=positions.filter(k=>k!=='day'&&stem(k)===partner);
  const counts=[...rule.pair].map(s=>positions.filter(k=>stem(k)===s).length);
  const presence=partnerPositions.length?'observed':timeKnown?'absent':'unknown';
  const cardinality=presence==='absent'?'not-applicable':counts.some(n=>n>1)?'source-rule-failed':
    !timeKnown?'unknown':'source-rule-met';
  const monthRoute=rule.primaryMonths.includes(a.month[1])?'primary-month':
    rule.additionalMonth===a.month[1]?'additional-month':'unlisted-month';
  // The same paragraph allows 時上旺氣 without 月中旺氣. An unlisted month is NOT proof of impossibility.
  return {pair:rule.pair,targetElement:rule.targetElement,monthRoute,
    presence,partnerPositions,cardinality,
    status:presence==='absent'?'no-day-combination':cardinality==='source-rule-failed'?'source-cardinality-conflict':
      presence==='unknown'||cardinality==='unknown'?'incomplete-observation':
      monthRoute==='unlisted-month'?'unlisted-season-needs-review':'listed-season-needs-review',
    hourSupportRoute:'not-adjudicated',moderation:'not-adjudicated',transformationEstablished:null,transformedElement:null};
}
export function analyzeFivePairConditions(profile) {
  const base=analyzeProfile(profile); // validate before projecting; preserve the correlated month pillar
  const slots=positions.map(k=>[k,k==='hour'&&!profile.timeKnown?[null]:unique(options(profile,k).map(p=>k==='month'?p:p[0]))]);
  const dedup=new Map();
  for(const a of assignments(slots)) {const r=assess(a,profile.timeKnown);dedup.set(JSON.stringify(r),r);}
  const alternatives=[...dedup.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([,v])=>v);
  const statuses=unique(alternatives.map(a=>a.status));
  const all=key=>{const values=unique(alternatives.map(a=>a[key]));return values.length===1?values[0]:null;};
  return {ruleVersion:extendedReviewVersion,productionApproved:false,coverage:base.coverage,
    status:statuses.length===1?statuses[0]:'candidate-dependent',alternatives,
    common:{pair:all('pair'),monthRoute:all('monthRoute'),presence:all('presence'),cardinality:all('cardinality')},
    transformationEstablished:null,transformedElement:null,
    candidatePolicy:'Universal over supplied marginal combinations; partial combinations are not proved jointly feasible. No probabilities.',
    sourcePolicy:'Mingli Jicheng quotation of Sanming Tonghui: one-of-each screen is an explicit research generalization of the paragraph, not a universal rule across editions.',
    unresolved:['Hour-only support route has no reviewed complete algorithm','Seasonal qualification and pair cardinality are not sufficient',
      'Day strength and transformation moderation are distinct; no threshold is transferred between them',
      'Competing source conventions and intervening obstruction require separate review'],
    sources:[extendedSource('five-pair-months'),extendedSource('pair-cardinality-and-hour-route'),extendedSource('true-false-not-binary-season')]};
}
export function analyzeModerationExamples(profile) {
  const base=analyzeProfile(profile);
  const matches=moderationExamples.flatMap(e=>{
    if(!positions.every((k,i)=>k==='hour'&&!profile.timeKnown||options(profile,k).includes(e.pillars[i]))) return [];
    const exact=profile.timeKnown&&positions.every(k=>options(profile,k).length===1);
    return [{exampleId:e.id,sourceLabel:e.sourceLabel,category:e.category,
      match:exact?'exact-source-chart':profile.timeKnown?'marginal-candidate-match':'partial-chart-hour-unobserved',
      jointFeasibility:exact?'fixed-chart':'not-established',source:extendedSource(e.id)}];
  });
  return {ruleVersion:extendedReviewVersion,productionApproved:false,coverage:base.coverage,
    status:matches.some(m=>m.match==='exact-source-chart')?'source-example-matched':matches.length?'partial-source-example':'outside-reviewed-examples',
    matches,classification:null,score:null,moderation:null,
    policy:'Exact reference-case recognition only. No nearest-neighbour inference, default balance, majority, numeric threshold or life outcome.',
    criteria:[
      {id:'season-not-sufficient',source:extendedSource('strength-extremes')},
      {id:'roots-not-visible-count',source:extendedSource('strength-extremes')},
      {id:'too-and-extreme-are-distinct',source:extendedSource('strength-extremes')},
      {id:'moderation-is-relational-not-a-zero-score',source:extendedSource('moderation')},
    ]};
}
export function reviewExtendedSources(input) {
  const profile=calculateProfile(input),previous=reviewStrengthAndTransformation(input);
  return {ruleVersion:extendedReviewVersion,productionApproved:false,
    dependencies:previous.dependencies,coverage:previous.coverage,
    seasonalCommand:previous.seasonalCommand,
    午Collation:{status:'29-days-corroborated-correction-unresolved',source:extendedSource('午-collation')},
    strength:{...previous.strength,sourceExamples:analyzeModerationExamples(profile)},
    transformation:analyzeFivePairConditions(profile),
    priorJiaJiConvention:analyzeTransformationConditions(profile),
    comparisonPolicy:'Keep the earlier restrictive Jia-Ji convention visible; do not replace it or turn conflicting screens into a final verdict.'};
}

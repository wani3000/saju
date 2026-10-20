/** Source-frame rescue observations and exact 化象 attributions, never a universal verdict. */
import {readFileSync} from 'node:fs';
import {analyzeProfile} from './reading-analysis.mjs';
import {classifyTenGod,natalCatalog} from './natal-rules.mjs';
import {analyzeHourAndInteractions} from './hour-balance-review.mjs';
import {analyzeTransformationConditions} from './strength-transformation-review.mjs';
const freeze=o=>{if(o&&typeof o==='object'){Object.values(o).forEach(freeze);Object.freeze(o);}return o;};
export const rescueSource=freeze(JSON.parse(readFileSync(new URL('./fixtures/reading-sources/rescue-wangqi-source.json',import.meta.url))));
export const rescueVersion=rescueSource.version;
const positions=['year','month','day','hour'];
const options=(p,k)=>k==='hour'&&!p.timeKnown?[null]:p.pillars[k]===null?p.candidates[k]:[p.pillars[k]];
const resource=['정인','편인'],wealth=['정재','편재'];
export const rescuePatterns=freeze([
 {id:'officer-injury-resource',frame:['정관'],groups:[{id:'injury',labels:['상관']},{id:'response',labels:resource}],resourceRole:'conditional-response',sectionId:'rescue-officer-injury-resource'},
 {id:'killing-food-resource-wealth',frame:['편관'],groups:[{id:'food-control',labels:['식신']},{id:'resource-obstacle',labels:resource},{id:'wealth-response',labels:wealth}],resourceRole:'conditional-obstacle',sectionId:'rescue-killing-food-resource-wealth'},
 {id:'wealth-rob-officer',frame:wealth,groups:[{id:'rob',labels:['겁재']},{id:'officer-response',labels:['정관']}],resourceRole:'not-the-listed-response',sectionId:'rescue-wealth-rob-officer'},
]);
export function rescueCitation(id) {
 const section=rescueSource.sections.find(s=>s.id===id);
 if(!section)throw new Error('UNKNOWN_RESCUE_SOURCE');
 const s=rescueSource.sources.find(s=>s.sourceId===section.sourceId);
 return {sourceId:s.sourceId,pdfPages:section.pdfPages,pdfSha256:s.pdfSha256,url:s.url,sectionId:id};
}
function* assign(slots,i=0,a={}) {
 if(i===slots.length){yield a;return;}
 const [k,values]=slots[i];for(const v of values)yield* assign(slots,i+1,{...a,[k]:v});
}
export function reviewRescueActors(profile) {
 const base=analyzeProfile(profile);
 // Preserve complete month pillar so frame-branch and visible-stem evidence stay together.
 const slots=positions.map(k=>[k,[...new Set(options(profile,k).map(p=>p===null?null:k==='month'?p:p[0]))]]);
 const found=new Map(rescuePatterns.map(r=>[r.id,new Map()]));
 for(const a of assign(slots)) {
  const visible=positions.filter(k=>k!=='day'&&a[k]!==null).map(position=>{
   const stem=position==='month'?a.month[0]:a[position];
   return {position,stem,label:classifyTenGod(a.day,stem).label};
  });
  const branch=a.month[1],hidden=natalCatalog.hiddenStems.find(h=>h.branch===branch);
  const frame=hidden.stems.map(stem=>({branch,stem,label:classifyTenGod(a.day,stem).label}));
  for(const rule of rescuePatterns) {
   const frameCandidates=frame.filter(o=>rule.frame.includes(o.label));
   const groups=rule.groups.map(g=>({id:g.id,evidence:visible.filter(o=>g.labels.includes(o.label))}));
   const complete=frameCandidates.length>0&&groups.every(g=>g.evidence.length>0);
   const otherVisibleActors=visible.filter(o=>!rule.groups.some(g=>g.labels.includes(o.label)));
   const r={frameCandidates,groups,otherVisibleActors,actorsObserved:complete,hourUnobserved:!profile.timeKnown,
    status:!frameCandidates.length?'outside-static-month-frame-candidates':complete?'frame-and-visible-actors-observed':
     profile.timeKnown?'not-all-visible-actors-observed':'hour-unobserved-actors-incomplete',
    frameEstablished:null,actualHarm:null,effectiveRescue:null};
   found.get(rule.id).set(JSON.stringify(r),r);
  }
 }
 const patterns=rescuePatterns.map(rule=>{
  const alternatives=[...found.get(rule.id).entries()].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([,r])=>r);
  return {id:rule.id,resourceRole:rule.resourceRole,source:rescueCitation(rule.sectionId),alternatives,
   actorsInEveryCandidate:alternatives.every(a=>a.actorsObserved),
   status:alternatives.every(a=>a.actorsObserved)?'actors-observed-all-candidates':alternatives.some(a=>a.actorsObserved)?'candidate-dependent':'actors-not-completely-observed',
   frameEstablished:null,actualHarm:null,effectiveRescue:null};
 });
 return {ruleVersion:rescueVersion,productionApproved:false,coverage:base.coverage,patterns,
  effectiveRescue:null,strength:null,score:null,
  scope:'Static monthly hidden stems propose frame candidates only. Non-day visible stems supply actors; presence is not effective control, 月令用神 or a proved 格局.',
  candidatePolicy:'Universal over supplied marginal assignments; partial observations have unproved joint feasibility and no probabilities.',
  normalizations:rescueSource.normalizations.slice(1),
  unresolved:['Frame selection, force, rooting, position, other harms and rescue priority remain unadjudicated.','These 用神/格局 rescue patterns are not automatically 合化 rescue rules.']};
}
export function reviewTransformationReference(profile) {
 const base=analyzeProfile(profile),fixed=profile.timeKnown&&positions.every(k=>options(profile,k).length===1);
 const matches=rescueSource.transformationCases.filter(c=>positions.every((k,i)=>k==='hour'&&!profile.timeKnown||options(profile,k).includes(c.pillars[i])));
 const exact=fixed?matches[0]:null;
 const someChen=positions.some(k=>options(profile,k).some(p=>p?.[1]==='진'));
 const allChen=positions.some(k=>options(profile,k).every(p=>p?.[1]==='진'));
 return {ruleVersion:rescueVersion,productionApproved:false,coverage:base.coverage,
  status:exact?'exact-source-transformation-case':matches.length?'partial-source-reference':'outside-reference-corpus',
  sourceClassification:exact?{id:exact.id,label:exact.sourceLabel,sourceSaysTrueTransformation:true,
   target:'transformed-qi',element:exact.targetElement,qiLabel:exact.qiLabel,qiCategory:exact.qiCategory,
   attributedPremises:exact.attributedPremises??[],premisesEstablishedByGenericRules:null,
   source:{sourceId:'ditian-1947',pdfPage:exact.pdfPage,pdfSha256:rescueSource.sources.find(s=>s.sourceId==='ditian-1947').pdfSha256}}:null,
  matches:matches.map(c=>({id:c.id,pdfPage:c.pdfPage,match:fixed?'exact-four-pillars':'partial-not-jointly-established'})),
  literalChen:{observedInSomeCandidate:someChen,observedInEveryCandidate:allChen,absenceConfirmed:profile.timeKnown&&!someChen},
  priorPreference:analyzeHourAndInteractions(profile).commonHourPreference,
  priorJiaJiConditions:analyzeTransformationConditions(profile),
  transformationEstablished:null,wangQiEstablished:null,originalDayStrength:null,moderation:null,score:null,
  policy:'Edition-specific exact source attribution only. Do not use this case or an already-true-transformation exception to prove its own premises, override other editions, or classify the original day stem.',
  phaseSources:[rescueCitation('true-transformation-exception'),rescueCitation('chen-metaphor'),rescueCitation('post-transformation-strength')]};
}
export function auditWeightSensitivity() {
 const pairA={combination:2,clash:1},pairB={combination:1,clash:0};
 const probes=[0.5,1,2].map(clashCost=>{
  const raw=p=>p.combination-clashCost*p.clash,a=raw(pairA),b=raw(pairB);
  return {hypotheticalCombinationWeight:1,hypotheticalClashCost:clashCost,rawA:a,rawB:b,ordering:a>b?'A-above-B':a<b?'B-above-A':'tie'};
 });
 return {scope:'Synthetic feature vectors and hypothetical raw utilities only; not approved compatibility scores, suggested weights or probabilities.',
  pairA,pairB,probes,orderingIdentified:false,adoptedWeights:null,score:null,
  uniformResourceBenefit:{adoptable:false,contexts:rescuePatterns.filter(r=>r.resourceRole!=='not-the-listed-response').map(r=>({id:r.id,resourceRole:r.resourceRole,source:rescueCitation(r.sectionId)})),
   reason:'The same resource class is a response in one source frame and an obstacle in another; no context-free relationship weight follows.'},
  evidenceStatus:'No pair-outcome observations or adopted quantitative effect sizes are available in these source passages.'};
}
export function reviewRescuePair(first,second) {
 return {ruleVersion:rescueVersion,productionApproved:false,
  individuals:[first,second].map(p=>({rescue:reviewRescueActors(p),transformation:reviewTransformationReference(p)})),
  score:null,normalizedCompatibility:null,mapRadius:null,
  reason:'Personal frame/phase observations and source-case judgments are not cross-person outcome effects or numeric weights.'};
}

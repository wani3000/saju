/** Direct source-position checks, not a universal strength/transformation/compatibility classifier. */
import {readFileSync} from 'node:fs';
import {analyzeProfile} from './reading-analysis.mjs';
import {analyzeHourAndInteractions} from './hour-balance-review.mjs';
import {adjudicateStrengthReference,strengthReferences} from './adjudication-review.mjs';
import {natalCatalog} from './natal-rules.mjs';
import {ruleCatalog} from './reading-rules.mjs';
const freeze=o=>{if(o&&typeof o==='object'){Object.values(o).forEach(freeze);Object.freeze(o);}return o;};
export const criteriaSource=freeze(JSON.parse(readFileSync(new URL('./fixtures/reading-sources/scoped-criteria-source.json',import.meta.url))));
export const criteriaVersion=criteriaSource.version;
const positions=['year','month','day','hour'];
function* assignments(slots,i=0,a={}) {
 if(i===slots.length){yield a;return;}
 const [k,values]=slots[i];for(const value of values)yield* assignments(slots,i+1,{...a,[k]:value});
}
export function reviewScopedGuards(profile) {
 const base=analyzeProfile(profile); // Validate engine, legal pillar parity, unknown hour and candidates.
 // Keep complete day/month/hour pillars, but collapse unused year branches.
 // 戊癸's 日時 includes the DAY branch; it cannot be projected to the day stem alone.
 const slots=positions.map(k=>{
  const ps=k==='hour'&&!profile.timeKnown?[null]:profile.pillars[k]===null?profile.candidates[k]:[profile.pillars[k]];
  return [k,[...new Set(ps.map(p=>p===null?null:k==='year'?p[0]:p))]];
 });
 const alternatives=new Map();
 for(const a of assignments(slots)) {
  const guard=criteriaSource.guards.find(g=>g.pair.includes(a.day[0]));
  const partner=[...guard.pair].find(s=>s!==a.day[0]);
  const partnerPositions=positions.filter(k=>k!=='day'&&a[k]?.[0]===partner);
  const contextMatched=guard.months.includes(a.month[1]);
  const triggers=contextMatched?guard.positions.filter(k=>a[k]&&guard.symbols.includes(a[k][guard.component==='stem'?0:1]))
   .map(position=>({position,component:guard.component,symbol:a[position][guard.component==='stem'?0:1]})):[];
  const r={pair:guard.pair,partnerPresence:partnerPositions.length?'observed':profile.timeKnown?'absent':'hour-unobserved',
   partnerPositions,contextMatched,triggers,hourUnobserved:!profile.timeKnown,
   status:!contextMatched?'outside-listed-month-context':triggers.length?'listed-trigger-observed':
    !profile.timeKnown?'hour-unobserved':'no-listed-trigger-observed',
   unresolved:[...guard.unresolved],source:{sourceId:criteriaSource.sourceId,pdfPage:129,pdfSha256:criteriaSource.pdfSha256},
   transformationEstablished:null,sourceClauseFinalVerdict:null};
  alternatives.set(JSON.stringify(r),r);
 }
 const list=[...alternatives.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([,v])=>v);
 return {ruleVersion:criteriaVersion,productionApproved:false,coverage:base.coverage,alternatives:list,
  status:new Set(list.map(a=>a.status)).size===1?list[0].status:'candidate-dependent',
  triggerInEveryCandidate:list.every(a=>a.triggers.length>0),
  listedPreference:analyzeHourAndInteractions(profile).commonHourPreference,
  transformationEstablished:null,sourceClauseFinalVerdict:null,
  scope:'The selected edition lists these day/hour symbols in a specific month paragraph. Trigger presence, partner presence, preference and final transformation are separate.',
  candidatePolicy:'Cartesian marginal combinations are a conservative review envelope; partial triggers are not proved jointly feasible or probabilistic.',
  unresolved:['生旺有氣, textual exceptions, repeated partners and rescue/conflict precedence are not resolved by a literal trigger check.',
   'No trigger is not a passed condition; an observed trigger is not a chart-wide failure or a cross-person penalty.']};
}
export function auditFiveElementShortcut() {
 const element=s=>ruleCatalog.stemElements.find(e=>e.symbol===s).element;
 const cases=strengthReferences.map(c=>{
  const symbols=c.pillars.flatMap(p=>[p[0],...natalCatalog.hiddenStems.find(h=>h.branch===p[1]).stems]);
  const observedElements=[...new Set(symbols.map(element))].sort();
  return {id:c.id,sourceLabel:c.sourceLabel,pdfPage:c.pdfPage,observedElements,
   allFivePresent:observedElements.length===5,sourceCategory:c.classification};
 });
 return {status:'rejected-as-sufficient-balance-criterion',scope:'Twenty source extreme cases, using the separately pinned static hidden-stem convention without weights.',
  cases,counterexamples:cases.filter(c=>c.allFivePresent).map(c=>c.id),
  generalStrength:null,moderation:null,
  limitation:'Five categories being present does not establish their relative strength. A missing category likewise does not prove imbalance; this corpus has no balanced reference class.'};
}
export function reviewScopedPair(first,second) {
 // Never gather an individual's 合化 partner or a guard from the other person's chart.
 return {ruleVersion:criteriaVersion,productionApproved:false,
  individuals:[first,second].map(p=>({strength:adjudicateStrengthReference(p),guards:reviewScopedGuards(p)})),
  score:null,normalizedCompatibility:null,mapRadius:null,
  reason:'Source statements about one chart contain no adopted relationship effect, numeric weight or pairwise aggregation scale.'};
}

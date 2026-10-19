/** Source-specific observations and explicit unresolved premises; never a strength/化 verdict. */
import {readFileSync} from 'node:fs';
import {analyzeProfile} from './reading-analysis.mjs';
import {analyzeNatal} from './natal-analysis.mjs';
import {natalCatalog,classifyTenGod} from './natal-rules.mjs';
import {calculateProfile} from './adapter.mjs';
import {reviewExtendedSources,extendedSource} from './extended-source-review.mjs';
const positions=['year','month','day','hour'];
const unique=xs=>[...new Set(xs)].sort();
const options=(p,k)=>k==='hour'&&!p.timeKnown?[null]:p.pillars[k]===null?p.candidates[k]:[p.pillars[k]];
const freeze=o=>{if(o&&typeof o==='object'){Object.values(o).forEach(freeze);Object.freeze(o);}return o;};
const manifest=JSON.parse(readFileSync(new URL('./fixtures/reading-sources/hour-balance-sources.json',import.meta.url)));
const tx=JSON.parse(readFileSync(new URL('./fixtures/reading-sources/hour-balance-transcription.json',import.meta.url)));
export const hourBalanceVersion='hour-damage-relational-balance-review-v1';
export function hourBalanceSource(id) {
  const section=tx.sections.find(s=>s.id===id);if(!section) throw new Error('UNKNOWN_SOURCE_SECTION');
  const s=manifest.sources.find(s=>s.sourceId===section.sourceId);
  return {sourceId:s.sourceId,sectionId:id,pdfPages:[...section.pdfPages],url:s.url,pdfSha256:s.pdfSha256};
}
export const preferredHours=freeze([
  {pair:'갑기',hour:'무진',months:[...'진술축미']},
  {pair:'을경',hour:'경진',months:[...'신유']},
  {pair:'병신',hour:'임진',months:[...'해자']},
  {pair:'정임',hour:'갑진',months:[...'인묘']},
  {pair:'무계',hour:'병진',months:[...'사오']},
]);
export const earthInteractions=freeze([
  {pair:'을경',hypotheticalElement:'금',kind:'damage',relation:'earth-produces-metal',sourceLabel:'盜洩土氣'},
  {pair:'정임',hypotheticalElement:'목',kind:'damage',relation:'wood-controls-earth',sourceLabel:'損傷土質'},
  {pair:'무계',hypotheticalElement:'화',kind:'assistance',relation:'fire-produces-earth',sourceLabel:'土之印'},
  {pair:'병신',hypotheticalElement:'수',kind:'assistance',relation:'earth-controls-water',sourceLabel:'土之財'},
]);
function* assignments(slots,i=0,a={}) {
  if(i===slots.length){yield a;return;}
  const [k,vs]=slots[i];for(const v of vs) yield* assignments(slots,i+1,{...a,[k]:v});
}
function assess(a,timeKnown) {
  const rule=preferredHours.find(r=>r.pair.includes(a.day));
  const stem=k=>['month','hour'].includes(k)?a[k]?.[0]:a[k];
  const visible=positions.map(stem).filter(Boolean);
  const partner=[...rule.pair].find(s=>s!==a.day);
  const presence=visible.includes(partner)?'observed':timeKnown?'absent':'unknown';
  const cardinality=[...rule.pair].some(s=>visible.filter(v=>v===s).length>1)?'conflict':timeKnown?'one-of-each-if-partner-present':'unknown';
  const hourMatch=a.hour===null?'unobserved':a.hour===rule.hour?'listed-preferred-hour':'outside-listed-example';
  const monthMatch=rule.months.includes(a.month[1]);
  const hourStatus=presence==='absent'?'no-day-partner':presence==='unknown'||a.hour===null?'incomplete-observation':
    hourMatch==='listed-preferred-hour'&&monthMatch?'preference-example-matched':'outside-complete-preference-example';
  const interactions=rule.pair!=='갑기'?[]:earthInteractions.filter(r=>[...r.pair].every(s=>visible.includes(s))).map(r=>({...r,
    status:presence==='observed'?'conditional-source-pattern':'base-earth-combination-unobserved',
    premises:{earthTransformation:null,additionalTransformation:null,effectiveDamageOrAssistance:null},
    source:hourBalanceSource('earth-damage-assistance')}));
  return {pair:rule.pair,partnerPresence:presence,cardinality,
    hourPreference:{hourMatch,monthMatch,status:hourStatus,wangQiEstablished:null,
      scope:'Listed 喜 hour/month example only; other nearby conditions remain unadjudicated.'},
    earthInteractions:interactions,transformationEstablished:null};
}
export function analyzeHourAndInteractions(profile) {
  const base=analyzeProfile(profile);
  // Keep the complete month AND hour pillars. Project only irrelevant year/day branches.
  // At most 10*60*10*60 assignments; no partial findings are merged into a synthetic all-clear.
  const slots=positions.map(k=>[k,unique(options(profile,k).map(p=>p===null?null:['month','hour'].includes(k)?p:p[0]))]);
  const results=new Map();
  for(const a of assignments(slots)){const r=assess(a,profile.timeKnown);results.set(JSON.stringify(r),r);}
  const alternatives=[...results.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([,r])=>r);
  const common=key=>unique(alternatives.map(a=>a.hourPreference[key])).length===1?alternatives[0].hourPreference[key]:null;
  return {ruleVersion:hourBalanceVersion,productionApproved:false,coverage:base.coverage,alternatives,
    commonHourPreference:{hourMatch:common('hourMatch'),monthMatch:common('monthMatch'),status:common('status')},
    transformationEstablished:null,
    candidatePolicy:'All Cartesian combinations of supplied marginals; partial combinations are not proved jointly feasible. No probabilities.',
    sources:[hourBalanceSource('hour-route'),hourBalanceSource('preferred-hours'),hourBalanceSource('hour-guards'),extendedSource('pair-cardinality-and-hour-route')],
    cardinalityPolicy:'Carry the prior Mingli one-of-each source screen; not a universal prohibition across sources.',
    unresolved:['Preferred hours are not a complete 時上旺氣 definition','生旺 and nearby avoidance conditions remain unadjudicated',
      'Mingli earth/fire assistance and Sanming earth/fire avoidance retain separate premises; no precedence inferred',
      'Conditional earth examples do not establish either transformation or extend to other target elements']};
}
export const relationalCriteria=freeze([
  {id:'wealth-peer',left:['편재','정재'],right:['겁재'],sourceLabel:'財輕劫重'},
  {id:'officer-output',left:['정관'],right:['상관'],sourceLabel:'官衰傷旺'},
  {id:'killing-control-review',left:['편관'],right:['식신','상관'],sourceLabel:'殺強制弱／制強殺弱'},
]);
// A two-bit presence set per criterion. Dynamic programming retains each pillar's
// internal correlation without enumerating up to 60^4 full marginal assignments.
function presenceMasks(profile,criterion) {
  const all=new Set();
  for(const day of options(profile,'day')) {
    let masks=new Set([0]);
    for(const k of positions) {
      const ps=k==='day'?[day]:options(profile,k);
      const slotMasks=new Set(ps.map(p=>{
        if(p===null) return 0;
        const hidden=natalCatalog.hiddenStems.find(r=>r.branch===p[1]).stems;
        const labels=[...(k==='day'?[]:[p[0]]),...hidden].map(s=>classifyTenGod(day[0],s).label);
        return (labels.some(l=>criterion.left.includes(l))?1:0)|(labels.some(l=>criterion.right.includes(l))?2:0);
      }));
      masks=new Set([...masks].flatMap(m=>[...slotMasks].map(s=>m|s)));
    }
    for(const m of masks) all.add(m);
  }
  return [...all].sort();
}
export function analyzeGeneralBalance(profile) {
  const natal=analyzeNatal(profile);
  const reviews=relationalCriteria.map(c=>{
    const masks=presenceMasks(profile,c),both=masks.includes(3);
    return {id:c.id,sourceLabel:c.sourceLabel,observedPresenceMasks:masks,
      status:both?masks.every(m=>m===3)?'both-groups-observed-in-all-candidates':'candidate-dependent-cooccurrence':
        profile.timeKnown?'not-both-observed':'hour-unobserved-not-both-observed',
      observations:natal.tenGods.filter(f=>[...c.left,...c.right].includes(f.label)),
      relativeStrength:null,sourceImbalanceEstablished:null,effectiveControl:null,
      source:hourBalanceSource('relational-moderation')};
  });
  return {ruleVersion:hourBalanceVersion,productionApproved:false,coverage:natal.coverage,
    classification:null,moderation:null,score:null,relationalReviews:reviews,
    generalCriteria:[{id:'month-important-not-sufficient',status:'requires-whole-chart-review'},
      {id:'roots-not-visible-stem-count',status:'requires-source-specific-root-review'},
      {id:'too-vs-extreme',status:'no-reviewed-exhaustive-boundary'}],
    sources:[hourBalanceSource('general-strength'),hourBalanceSource('relational-moderation')],
    policy:'Presence is not strength. Hidden stems are unweighted. No same-day extra peer, no default balance, no score. 食傷 is a candidate controlling relation, not an exhaustive definition or proof of 制殺. Partial cross-pillar matches have unproved joint feasibility.'};
}
export function reviewHourAndBalance(input) {
  const profile=calculateProfile(input);
  return {ruleVersion:hourBalanceVersion,productionApproved:false,
    previousReview:reviewExtendedSources(input),hourAndInteractions:analyzeHourAndInteractions(profile),
    generalBalance:analyzeGeneralBalance(profile)};
}

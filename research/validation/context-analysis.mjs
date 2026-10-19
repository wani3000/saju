/** Observational conditions for source review. Does not decide 合化, strength or luck. */
import {analyzeNatal} from './natal-analysis.mjs';
import {natalCatalog, stemDefinition, classifyTenGod} from './natal-rules.mjs';
import {classifySymbols} from './reading-rules.mjs';
import {contextCatalog, contextSource} from './context-rules.mjs';

const positions=['year','month','day','hour'];
const ordered = values => [...new Set(values)].sort();
const options = (profile,position) => ordered(profile.pillars[position] === null ? profile.candidates[position] : [profile.pillars[position]]);
const hidden = pillar => natalCatalog.hiddenStems.find(r => r.branch === pillar[1]).stems;
function pairs(profile,first,second) {
  return first === second ? options(profile,first).map(p => [p,p]) :
    options(profile,first).flatMap(a => options(profile,second).map(b => [a,b]));
}
function collectPairs(profile,first,second,derive) {
  const scenarios=pairs(profile,first,second), hits=new Map();
  for (const [a,b] of scenarios) for (const observation of derive(a,b)) {
    const key=JSON.stringify(observation);
    const entry=hits.get(key) ?? {...observation,witnesses:[]};
    entry.witnesses.push({[first]:a,[second]:b}); hits.set(key,entry);
  }
  return [...hits.entries()].sort(([a],[b]) => a<b ? -1 : a>b ? 1 : 0).map(([,entry]) => ({...entry,
    certainty:entry.witnesses.length === scenarios.length ? 'all-candidates' : 'candidate-dependent',
    jointFeasibility:entry.witnesses.length === scenarios.length ? 'universal-over-supplied-candidates' :
      first === second ? 'within-supplied-pillar-candidates' : 'not-established-from-marginal-candidates'}));
}
function* assignments(slots,index=0,assigned={}) {
  if (index === slots.length) {yield assigned; return;}
  const slot=slots[index];
  for (const stem of slot.stems) yield* assignments(slots,index+1,{...assigned,[slot.position]:stem});
}

function combinationContexts(profile,included) {
  const slots=included.map(position => ({position,stems:ordered(options(profile,position).map(p => p[0]))}));
  const total=slots.reduce((n,s) => n*s.stems.length,1); // <= 10^4, not full 60^4 pillar products.
  const hits=new Map();
  for (const assignment of assignments(slots)) {
    for (let i=0;i<included.length;i++) for (let j=i+1;j<included.length;j++) {
      const left=included[i],right=included[j];
      const rule=classifySymbols('stem',assignment[left],assignment[right])[0];
      if (!rule) continue;
      const gap=positions.indexOf(right)-positions.indexOf(left);
      const between=included.slice(i+1,j);
      const interveningControllers=between.flatMap(position => [left,right].flatMap(target =>
        classifyTenGod(assignment[position],assignment[target]).direction === 'day-controls-target'
          ? [{position,stem:assignment[position],target}] : []));
      const additionalPartners=[left,right].flatMap(endpoint => included.filter(p => p !== left && p !== right)
        .filter(p => classifySymbols('stem',assignment[endpoint],assignment[p]).length)
        .map(position => ({endpoint,position,stem:assignment[position],
          adjacent:Math.abs(positions.indexOf(position)-positions.indexOf(endpoint)) === 1})));
      const observations={interveningControllers,additionalPartners};
      const key=`${left}:${right}:${rule.id}`;
      const hit=hits.get(key) ?? {id:key,ruleId:rule.id,positions:[left,right],adjacent:gap === 1,
        interveningPositions:between,involvesDayStem:left === 'day' || right === 'day',count:0,contexts:new Map()};
      hit.count++;
      hit.contexts.set(JSON.stringify(observations),observations);
      hits.set(key,hit);
    }
  }
  return [...hits.values()].sort((a,b) => a.id<b.id ? -1 : a.id>b.id ? 1 : 0).map(({count,contexts,...hit}) => ({...hit,
    certainty:count === total ? 'all-candidates' : 'candidate-dependent',
    jointFeasibility:count === total ? 'universal-over-supplied-candidates' : 'not-established-from-marginal-candidates',
    contextAlternatives:[...contexts.entries()].sort(([a],[b]) => a<b ? -1 : a>b ? 1 : 0).map(([,v]) => v),
    contextScope:'conditional-on-pair-within-observed-positions',
    unobservedPositions:included.includes('hour') ? [] : ['hour'],
    transformation:{status:'not-adjudicated',element:null},
    sources:['intervening-stem','distant-pair','day-involvement','multiple-partners'].map(contextSource)}));
}

export function analyzeContext(profile) {
  const natal=analyzeNatal(profile); // Reuse v5 validation; no default birth time or arbitrary pillars.
  const included=natal.coverage[0].includedPositions;
  const rootObservations=included.flatMap(position => collectPairs(profile,'day',position,(day,pillar) =>
    hidden(pillar).filter(stem => stemDefinition(stem).element === stemDefinition(day[0]).element)
      .map(stem => ({position,hiddenStem:stem,match:stem === day[0] ? 'exact-stem' : 'same-element-other-polarity'}))))
    .map(f => ({...f,id:`root:${f.position}:${f.hiddenStem}:${f.match}`,
      sources:[contextSource('root-context'),{...natalCatalog.hiddenStems[0].source}],rootGrade:null}));
  const monthExposures=included.filter(p => p !== 'day').flatMap(position =>
    collectPairs(profile,'month',position,(month,target) => hidden(month).includes(target[0])
      ? [{position,stem:target[0]}] : []))
    .map(f => ({...f,id:`month-exposure:${f.position}:${f.stem}`,
      sources:[contextSource('month-exposure'),{...natalCatalog.hiddenStems[0].source}]}));
  return {ruleVersion:contextCatalog.version,productionApproved:false,
    dependencies:{natalRuleVersion:natal.ruleVersion,symbolRuleVersion:natal.relations.ruleVersion,engineVersion:natal.engineVersion},
    definitionReview:{...contextCatalog.definitionReview},interpretationReview:{...contextCatalog.interpretationReview},
    coverage:natal.coverage,monthContext:{...natal.monthContext,
      source:contextSource('month-as-context'),strengthPolicy:'month-alone-is-insufficient'},
    rootObservations,monthExposures,combinationContexts:combinationContexts(profile,included),
    coexistingBranchRelations:natal.relations.findings.filter(f => f.family.startsWith('branch-')),
    branchConflictPolicy:{status:'not-adjudicated',source:contextSource('coexisting-branch-relations')},
    strength:null,favorableElement:null,score:null,
    limitations:[
      'Same-stem/element hidden-stem matches are review evidence, not a complete 通根 definition or root grade.',
      'Exposures exclude the day reference; exact matching does not select a 格局 or 用神.',
      'Adjacency, intervening control and additional partners are observations, not sufficient 合化 conditions.',
      'Unknown hour is unobserved; absence from known positions is not absence from the complete chart.',
      'Stem context alternatives use marginal Cartesian combinations; partial combinations are not proved feasible.',
      'No 合/沖 cancellation, numeric root weight or whole-chart strength is inferred.',
    ]};
}

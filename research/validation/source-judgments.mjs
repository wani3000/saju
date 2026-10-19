/** Explicit examples from one edition. An unmatched example is NOT a negative judgment. */
import {readFileSync} from 'node:fs';
import {analyzeContext} from './context-analysis.mjs';
import {stems,branches} from './reading-rules.mjs';

const manifest=JSON.parse(readFileSync(new URL('./fixtures/reading-sources/judgment-source.json',import.meta.url)));
const freeze=value => {
  if (value && typeof value === 'object') {Object.values(value).forEach(freeze);Object.freeze(value);}
  return value;
};
const source=(sectionId,pdfPages=[21]) => ({id:manifest.sourceId,pdfSha256:manifest.pdfSha256,
  transcriptionSha256:manifest.transcriptionSha256,sectionId,pdfPages});
const examples=[
  ['갑','미','tomb','light','tomb-examples'],['병','술','tomb','light','tomb-examples'],
  ['을','술','excluded-as-tomb',null,'tomb-examples'],['정','축','excluded-as-tomb',null,'tomb-examples'],
  ['을','진','residual','light','residual-examples'],['정','미','residual','light','residual-examples'],
  ['갑','해','birth','heavy','heavy-root-examples'],['갑','인','salary','heavy','heavy-root-examples'],
  ['갑','묘','blade','heavy','heavy-root-examples'],
  ['을','오','yin-birth-root',null,'yin-birth-presence'],['정','유','yin-birth-root',null,'yin-birth-presence'],
];
export const judgmentCatalog=freeze({
  version:'ziping-explicit-judgments-research-v1',productionApproved:false,
  review:{status:'source-collated-partial-convention',reviewer:'Codex',date:'2026-10-19'},
  interpretationReview:{status:'pending'},
  scope:'Only explicit examples in this edition; no exhaustive 通根 or 合化 model.',
  roots:examples.map(([stem,branch,kind,grade,section]) => ({id:`root-example:${stem}${branch}`,stem,branch,kind,grade,
    weight:null,sources:[source(section,section === 'yin-birth-presence' ? [21,22] : [21]),
      ...(grade === null ? [] : [source('root-classes')])]})),
  obstruction:{pairRuleId:'stem-combination:갑기',interveningStems:['경','을'],
    conclusion:'source-obstruction-present',source:source('specific-intervening-obstruction',[20])},
  exclusions:['No inference from unmatched examples','No whole-chart strength from root grades or month alone',
    'No numeric grade weights or peer equivalence ratios','No automatic transformation from absence of obstruction',
    'No cross-profile extension or relationship prediction'],
});

export function classifySourceRoot(stem,branch) {
  if (typeof stem !== 'string' || stem.length !== 1 || !stems.includes(stem) ||
      typeof branch !== 'string' || branch.length !== 1 || !branches.includes(branch)) throw new Error('INVALID_ROOT_SYMBOL');
  const match=judgmentCatalog.roots.find(r=>r.stem === stem && r.branch === branch);
  return match ? {status:'source-example',...structuredClone(match)} :
    {status:'not-covered-by-selected-examples',stem,branch,kind:null,grade:null,weight:null,sources:[]};
}
const ordered=values => [...new Set(values)].sort();
const options=(profile,position) => ordered(profile.pillars[position] === null ? profile.candidates[position] : [profile.pillars[position]]);
function assessRoots(profile,included) {
  return included.map(position => {
    // Day stem and its own branch must come from the SAME pillar candidate.
    const scenarios=position === 'day' ? options(profile,'day').map(p=>[p,p]) :
      options(profile,'day').flatMap(day=>options(profile,position).map(p=>[day,p]));
    const groups=new Map();
    for (const [day,pillar] of scenarios) {
      const key=day[0]+pillar[1];
      const entry=groups.get(key) ?? {...classifySourceRoot(day[0],pillar[1]),witnesses:[]};
      entry.witnesses.push({day,...(position === 'day' ? {} : {[position]:pillar})});groups.set(key,entry);
    }
    const alternatives=[...groups.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([,entry])=>({...entry,
      certainty:entry.witnesses.length === scenarios.length ? 'all-candidates' : 'candidate-dependent',
      jointFeasibility:entry.witnesses.length === scenarios.length ? 'universal-over-supplied-candidates' :
        position === 'day' ? 'within-supplied-pillar-candidates' : 'not-established-from-marginal-candidates'}));
    return {position,alternatives,coverage:alternatives.every(a=>a.status === 'source-example') ? 'selected-examples-cover-all-candidates' :
      alternatives.some(a=>a.status === 'source-example') ? 'selected-examples-cover-some-candidates' : 'not-covered-by-selected-examples'};
  });
}
function assessObstructions(context) {
  return context.combinationContexts.map(pair => {
    const applicable=pair.ruleId === judgmentCatalog.obstruction.pairRuleId;
    const alternatives=pair.contextAlternatives.map(c => ({
      blockers:applicable ? c.interveningControllers.filter(b => judgmentCatalog.obstruction.interveningStems.includes(b.stem)) : [],
    }));
    const any=alternatives.some(c=>c.blockers.length > 0),every=alternatives.every(c=>c.blockers.length > 0);
    return {id:pair.id,positions:pair.positions,ruleId:pair.ruleId,pairCertainty:pair.certainty,
      status:any ? every && pair.certainty === 'all-candidates' ? 'source-obstruction-present' : 'candidate-dependent-obstruction' :
        'not-covered-by-selected-examples',
      contextScope:pair.contextScope,contextAlternatives:alternatives,
      pairJointFeasibility:pair.jointFeasibility,
      obstructionJointFeasibility:any ? every && pair.certainty === 'all-candidates' ?
        'universal-over-supplied-candidates' : 'not-established-from-marginal-candidates' : 'not-applicable',
      unobservedPositions:pair.unobservedPositions,
      sources:any ? [structuredClone(judgmentCatalog.obstruction.source)] : [],
      transformation:{status:'not-adjudicated',element:null}};
  });
}
export function analyzeSourceJudgments(profile) {
  const context=analyzeContext(profile); // Validate the complete research profile before inspecting candidates.
  return {ruleVersion:judgmentCatalog.version,productionApproved:false,
    dependencies:{contextRuleVersion:context.ruleVersion,...context.dependencies},
    review:structuredClone(judgmentCatalog.review),interpretationReview:{status:'pending'},
    coverage:context.coverage,rootAssessments:assessRoots(profile,context.coverage[0].includedPositions),
    combinationAssessments:assessObstructions(context),
    strength:null,favorableElement:null,score:null,
    limitations:[...judgmentCatalog.exclusions,
      'Qualitative light/heavy is this source convention, not a measured predictive strength.',
      'Yin-birth root examples may have no same-element hidden stem; the two definitions remain separate.',
      'Candidate-dependent evidence is not a confirmed feasible joint chart or probability.',
      'Unknown hour remains unobserved; selected examples do not exhaust roots or obstructions.']};
}
const names={year:'연주',month:'월주',day:'일주',hour:'시주'};
const kindNames={tomb:'묘고',residual:'여기',birth:'장생',salary:'록',blade:'인'};
export function buildSourceJudgmentDraft(profile) {
  const analysis=analyzeSourceJudgments(profile),statements=[];
  for (const slot of analysis.rootAssessments) for (const fact of slot.alternatives) {
    if (fact.certainty !== 'all-candidates' || fact.status !== 'source-example') continue;
    const conclusion=fact.kind === 'excluded-as-tomb' ? '묘고 뿌리의 예에서 제외합니다. 이는 다른 위치에도 뿌리가 없다는 뜻이 아닙니다.' :
      fact.kind === 'yin-birth-root' ? '음간 장생의 뿌리가 있는 예로 다루지만, 무거운 뿌리 등급은 적용하지 않습니다.' :
      `${kindNames[fact.kind]}의 예로 들며, 이 판본에서 ${fact.grade === 'heavy' ? '무거운' : '가벼운'} 뿌리로 분류합니다. 이 분류만으로 신강·신약을 정하지 않습니다.`;
    statements.push({id:`${slot.position}:${fact.id}`,text:`『子平真詮』의 해당 구절은 일간 ${fact.stem}·${names[slot.position]} 지지 ${fact.branch}의 조합을 ${conclusion}`,
      basis:'edition-specific-traditional-interpretation',sources:fact.sources});
  }
  for (const pair of analysis.combinationAssessments.filter(p=>p.status === 'source-obstruction-present')) {
    statements.push({id:`obstruction:${pair.id}`,
      text:`${pair.positions.map(p=>names[p]).join('·')}의 갑·기 합 짝 사이에서 원문이 합을 가로막는 예로 든 경 또는 을이 확인됩니다. 이 판본의 방해 조건에 해당하며, 다른 합화 조건 전체를 판정한 것은 아닙니다.`,
      basis:'edition-specific-traditional-interpretation',sources:pair.sources});
  }
  return {contentVersion:'source-judgment-copy-v1',ruleVersion:analysis.ruleVersion,dependencies:analysis.dependencies,
    productionApproved:false,status:'editorial-draft-not-approved',coverage:analysis.coverage,
    notice:'한 판본의 명시적 예에 한정한 연구용 해석입니다. 입력 후보 전체에서 확인된 문장만 싣습니다.',statements,
    omittedCandidateDependentFacts:analysis.rootAssessments.flatMap(s=>s.alternatives)
      .filter(a=>a.status === 'source-example' && a.certainty !== 'all-candidates').length +
      analysis.combinationAssessments.filter(p=>p.status === 'candidate-dependent-obstruction').length,
    strength:null,score:null};
}

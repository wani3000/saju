import {analyzeContext} from './context-analysis.mjs';
import {compareProfiles} from './reading-analysis.mjs';
import {ruleCatalog} from './reading-rules.mjs';
import {natalCatalog} from './natal-rules.mjs';
import {contextCatalog} from './context-rules.mjs';

const names={year:'연주',month:'월주',day:'일주',hour:'시주'};
const advice=Object.freeze({
  friend:'서로 편한 연락 빈도와 함께 하고 싶은 일을 이야기해 보세요.',
  family:'도움이 필요한 일과 각자 결정하고 싶은 일을 나눠 이야기해 보세요.',
  partner:'함께 보내는 시간과 혼자 쉬는 시간에 대해 원하는 바를 이야기해 보세요.',
});

export function buildContextDraft(profile) {
  const analysis=analyzeContext(profile);
  const statements=[];
  for (const f of analysis.monthExposures.filter(f => f.certainty === 'all-candidates')) {
    statements.push({id:f.id,
      text:`월지 지장간과 ${names[f.position]} 천간에서 ${f.stem}의 일치가 확인됩니다. 이 일치만으로 용신이나 격국을 정하지 않습니다.`,sources:f.sources});
  }
  for (const f of analysis.rootObservations.filter(f => f.certainty === 'all-candidates')) {
    statements.push({id:f.id,
      text:`${names[f.position]} 지장간 ${f.hiddenStem}에서 일간과 ${f.match === 'exact-stem' ? '같은 천간' : '같은 오행의 다른 음양'}이 확인됩니다. 뿌리의 강도는 아직 평가하지 않았습니다.`,sources:f.sources});
  }
  for (const f of analysis.combinationContexts.filter(f => f.certainty === 'all-candidates')) {
    const rule=ruleCatalog.rules.find(r => r.id === f.ruleId);
    const common=key => f.contextAlternatives[0][key].filter(value =>
      f.contextAlternatives.every(c => c[key].some(other => JSON.stringify(value) === JSON.stringify(other))));
    const cautions=[];
    if (common('interveningControllers').length) cautions.push('두 위치 사이에서 합 상대를 극하는 천간도 확인됩니다.');
    if (common('additionalPartners').length) cautions.push('같은 합 상대가 다른 위치에도 나타나므로 위치별 검토가 필요합니다.');
    if (f.involvesDayStem) cautions.push('일간 자신이 참여하는 합입니다.');
    statements.push({id:`combination:${f.id}`,
      text:`${names[f.positions[0]]}·${names[f.positions[1]]}에서 ${rule.symbols.join('·')}의 천간 합 짝이 확인되며 ${f.adjacent ? '두 위치는 인접해 있습니다' : '사이에 다른 기둥이 있습니다'}. ${cautions.join(' ')} 합화 성립은 판정하지 않았습니다.`.replace(/  +/g,' '),
      sources:[rule.source,...f.sources]});
  }
  for (const f of analysis.coexistingBranchRelations.filter(f => f.certainty === 'all-candidates')) {
    const rule=ruleCatalog.rules.find(r => r.id === f.ruleId);
    statements.push({id:`branch:${f.ruleId}:${f.endpoints.map(e => e.position).join(':')}`,
      text:`${f.endpoints.map(e => names[e.position]).join('·')}에서 ${rule.symbols.join('·')}의 ${rule.label} 짝이 확인됩니다. 다른 합·충과의 상쇄는 판정하지 않았습니다.`,
      sources:[f.source,analysis.branchConflictPolicy.source]});
  }
  return {ruleVersion:analysis.ruleVersion,contentVersion:'context-review-copy-v1',productionApproved:false,
    dependencies:{...analysis.dependencies},
    status:'editorial-draft-not-approved',coverage:analysis.coverage,
    notice:'입력 후보 전체에 공통인 관찰 사실만 설명합니다. 월령·뿌리·합의 조건을 길흉이나 관계 예측으로 바꾸지 않습니다.',
    statements,score:null};
}

export function buildRelationshipReview(first,second,relationship) {
  if (!Object.hasOwn(advice,relationship)) throw new Error('UNSUPPORTED_REVIEW_RELATIONSHIP');
  const pair=compareProfiles(first,second);
  const details=pair.findings.filter(f => f.certainty === 'all-candidates').map(f => {
    const rule=ruleCatalog.rules.find(r => r.id === f.ruleId);
    return {id:`${f.ruleId}:${f.endpoints.map(e => `${e.side}-${e.position}`).join(':')}`,
      text:`A의 ${names[f.endpoints[0].position]}와 B의 ${names[f.endpoints[1].position]}에서 선택한 규칙표에 따른 ${rule.symbols.join('·')}의 ${f.label} 짝이 확인됩니다.`,
      basis:'cross-profile-symbol-observation',sources:[f.source]};
  });
  return {contentVersion:'relationship-evidence-review-v1',productionApproved:false,
    dependencies:{symbolRuleVersion:pair.ruleVersion,contextRuleVersion:contextCatalog.version,
      natalRuleVersion:natalCatalog.version,engineVersion:pair.engineVersion},
    status:'editorial-draft-not-approved',relationship,
    summary:'두 사람의 기호를 비교한 감수 자료입니다. 개인 사주 안의 합화 조건을 두 사람 사이에 그대로 적용하지 않습니다.',
    strengths:[],differences:[],details,
    advice:[{id:`conversation:${relationship}`,text:advice[relationship],
      basis:'editorial-conversation-prompt-not-chart-derived'}],
    individualContexts:[{side:'a',draft:buildContextDraft(first)},{side:'b',draft:buildContextDraft(second)}],
    coverage:pair.coverage,
    omittedCandidateDependentFacts:pair.findings.filter(f => f.certainty !== 'all-candidates').length,
    metrics:{score:null,normalizedCompatibility:null,mapRadius:null,
      status:'unavailable-pending-rule-and-scale-review'},
    releaseBlockers:['Calendar approval pending','Context observations are not sufficient interpretation rules',
      'Relationship interpretation and compatibility weights pending','Comparable versioned map scale pending']};
}

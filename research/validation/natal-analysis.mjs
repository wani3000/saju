import {analyzeProfile} from './reading-analysis.mjs';
import {natalCatalog, classifyTenGod, stemDefinition} from './natal-rules.mjs';

const ordered = values => [...new Set(values)].sort();
const options = (profile, position) => ordered(profile.pillars[position] === null
  ? profile.candidates[position] : [profile.pillars[position]]);

export function analyzeNatal(profile) {
  // The existing v1 validator remains authoritative; do not accept guessed/default pillars.
  const relations = analyzeProfile(profile);
  const positions = relations.coverage[0].includedPositions;
  const dayOptions = options(profile, 'day');
  const dayStems = ordered(dayOptions.map(p => p[0]));
  const hiddenStems = positions.map(position => ({position,
    alternatives:options(profile, position).map(pillar => ({pillar, branch:pillar[1],
      stems:[...natalCatalog.hiddenStems.find(r => r.branch === pillar[1]).stems]})),
    source:{...natalCatalog.hiddenStems[0].source}, weights:null}));
  const tenGods = [];
  for (const position of positions) {
    const targetOptions = options(profile, position);
    // Day stem and its own hidden stems belong to the SAME pillar candidate.
    // Other pillars have marginal candidates only; partial cross products are not proved feasible.
    const scenarios = position === 'day' ? dayOptions.map(p => [p,p]) :
      dayOptions.flatMap(day => targetOptions.map(target => [day,target]));
    for (const layer of ['visible','hidden']) {
      if (position === 'day' && layer === 'visible') continue; // 日干 is the reference, not an extra 比肩.
      const hits = new Map();
      for (const [day, target] of scenarios) {
        const targets = layer === 'visible' ? [target[0]] :
          natalCatalog.hiddenStems.find(r => r.branch === target[1]).stems;
        for (const stem of targets) {
          const classification = classifyTenGod(day[0], stem);
          const key = `${stem}:${classification.label}`;
          const hit = hits.get(key) ?? {classification, witnesses:[]};
          hit.witnesses.push({dayPillar:day, targetPillar:target});
          hits.set(key, hit);
        }
      }
      for (const [key, {classification, witnesses}] of [...hits].sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0)) {
        const certain = witnesses.length === scenarios.length;
        tenGods.push({id:`${position}:${layer}:${key}`, position, layer,
          targetStem:classification.targetStem, label:classification.label,
          direction:classification.direction, samePolarity:classification.samePolarity,
          terminologyPolicy:classification.terminologyPolicy,
          certainty:certain ? 'all-candidates' : 'candidate-dependent',
          jointFeasibility:certain ? 'universal-over-supplied-candidates' : position === 'day'
            ? 'within-supplied-day-pillar-candidates' : 'not-established-from-marginal-candidates',
          witnesses, sources:[...classification.sources,
            ...(layer === 'hidden' ? [{...natalCatalog.hiddenStems[0].source}] : [])],
          weight:null, interpretation:null});
      }
    }
  }
  return {ruleVersion:natalCatalog.version, engineVersion:relations.engineVersion, productionApproved:false,
    definitionReview:{...natalCatalog.definitionReview}, terminologyReview:{...natalCatalog.terminologyReview},
    interpretationReview:{...natalCatalog.interpretationReview}, coverage:relations.coverage,
    dayReference:{alternatives:dayStems.map(stemDefinition), confirmedStem:dayStems.length === 1 ? dayStems[0] : null,
      source:{...natalCatalog.dayReferenceSource}},
    monthContext:{branches:ordered(options(profile,'month').map(p => p[1])),
      source:{...natalCatalog.monthContextSource}, seasonalStrength:null,
      note:'월지 후보만 보존. 절기 내 경과 일수·사령·통근·투간을 종합한 강약은 미판정.'},
    hiddenStems, tenGods, relations,
    score:null, interpretation:null,
    limitations:[...natalCatalog.exclusions,
      'Ten-god labels are directional classifications relative to the day stem, not personality or compatibility claims.',
      'Hidden stems are unweighted source lists. Repetition is not a whole-chart element proportion.',
      'All-candidates is limited to supplied research candidates, not calendar accuracy approval.',
      'Partial cross-pillar findings are upper-bound review possibilities, not probabilities.']};
}

const names = {year:'연주',month:'월주',day:'일주',hour:'시주'};
export function buildNatalDraft(profile) {
  const analysis = analyzeNatal(profile); // Validate and recompute; do not trust arbitrary supplied findings.
  const statements = [];
  if (analysis.dayReference.confirmedStem) {
    const day = analysis.dayReference.alternatives[0];
    statements.push({id:'day-reference', text:`입력 후보의 일간은 ${day.stem}이며, 천간 배속은 ${day.polarity}의 ${day.element}입니다.`,
      sources:[analysis.dayReference.source,day.source]});
  }
  statements.push({id:'month-context',text:`월지${analysis.monthContext.branches.length > 1 ? ' 후보' : ''}는 ${analysis.monthContext.branches.join('·')}입니다. 월령에 따른 강약은 아직 판단하지 않았습니다.`,
    sources:[analysis.monthContext.source]});
  for (const fact of analysis.tenGods.filter(f => f.certainty === 'all-candidates')) {
    statements.push({id:fact.id,
      text:`입력 후보 전체에서 ${names[fact.position]}의 ${fact.layer === 'visible' ? '천간' : '지장간'} ${fact.targetStem}의 일간 기준 분류는 ${fact.label}입니다. 연구용 용어표를 적용했습니다.`,
      sources:fact.sources});
  }
  return {ruleVersion:analysis.ruleVersion, contentVersion:'natal-review-copy-v1',
    status:'editorial-draft-not-approved', productionApproved:false,
    notice:'감수용 분류 설명입니다. 성격·관계의 좋고 나쁨·미래를 판단하는 풀이가 아닙니다.',
    coverage:analysis.coverage, statements,
    omittedCandidateDependentFacts:analysis.tenGods.filter(f => f.certainty !== 'all-candidates').length,
    score:null};
}

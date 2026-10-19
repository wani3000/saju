/** No web import: reviewed definitions, unapproved interpretation. No scoring. */
import {branches, stems, ruleCatalog, classifySymbols} from './reading-rules.mjs';

const positions = ['year', 'month', 'day', 'hour'];
const engineVersion = 'research-civil-midnight-v5';
const validPillars = new Set(Array.from({length:60}, (_, i) => stems[i % 10] + branches[i % 12]));
const ordered = values => [...new Set(values)].sort();

function normalize(profile, side) {
  if (profile?.policy?.version !== engineVersion || profile.policy.productionApproved !== false) {
    throw new Error('UNSUPPORTED_READING_ENGINE');
  }
  if (typeof profile.timeKnown !== 'boolean' || !profile.pillars ||
      Object.keys(profile.pillars).some(k => !positions.includes(k))) throw new Error('INVALID_READING_PROFILE');
  const candidates = profile.candidates ?? {};
  if (!candidates || typeof candidates !== 'object' || Array.isArray(candidates) ||
      Object.keys(candidates).some(k => !positions.includes(k))) throw new Error('INVALID_READING_CANDIDATES');
  const slots = [];
  for (const position of positions) {
    const value = profile.pillars[position];
    const options = candidates[position];
    if (position === 'hour' && !profile.timeKnown) {
      if (value !== null || options !== undefined) throw new Error('UNKNOWN_HOUR_HAS_VALUE');
      continue;
    }
    if (value === null) {
      if (!Array.isArray(options) || options.length < 2 || options.length > 60 ||
          options.some(p => !validPillars.has(p)) || new Set(options).size !== options.length) {
        throw new Error('INVALID_READING_CANDIDATES');
      }
    } else if (!validPillars.has(value) || options !== undefined) {
      throw new Error('INVALID_READING_PILLAR');
    }
    slots.push({side, position, options: ordered(value === null ? options : [value])});
  }
  return {side, timeKnown: profile.timeKnown, slots,
    // Copy only status flags; never echo date, UTC instant, alias or arbitrary source fields.
    clockReviewRequired: profile.clockReview !== undefined,
    boundaryReviewRequired: profile.boundaryReview !== undefined};
}

function relationsFor(first, second, sameProfile) {
  const findings = [];
  // Within a single profile, options on different pillars may be correlated.
  // All Cartesian matches are sufficient for a universal fact. A partial match
  // is only an upper-bound possibility, never a proved feasible joint chart.
  for (const component of ['stem', 'branch']) {
    const index = component === 'stem' ? 0 : 1;
    const left = ordered(first.options.map(p => p[index]));
    const right = ordered(second.options.map(p => p[index]));
    const hits = new Map();
    for (const a of left) for (const b of right) {
      for (const rule of classifySymbols(component, a, b)) {
        const matches = hits.get(rule.id) ?? [];
        matches.push([a, b]);
        hits.set(rule.id, matches);
      }
    }
    for (const [ruleId, witnesses] of hits) {
      const rule = ruleCatalog.rules.find(r => r.id === ruleId);
      const certain = witnesses.length === left.length * right.length;
      findings.push({ruleId, family: rule.family, label: rule.label,
        endpoints: [first, second].map(s => ({side: s.side, position: s.position})),
        certainty: certain ? 'all-candidates' : 'candidate-dependent',
        jointFeasibility: certain ? 'universal-over-supplied-candidates' :
          sameProfile ? 'not-established-from-marginal-candidates' : 'cross-profile-candidates',
        witnesses, source: {...rule.source}, interpretation: null, weight: null});
    }
  }
  return findings;
}

function result(profiles, scope, findings) {
  return {ruleVersion: ruleCatalog.version, engineVersion, scope,
    productionApproved: false, definitionReview: {...ruleCatalog.definitionReview},
    interpretationReview: {...ruleCatalog.interpretationReview}, score: null, interpretation: null,
    coverage: profiles.map(p => ({side: p.side, includedPositions: p.slots.map(s => s.position),
      omittedPositions: p.timeKnown ? [] : ['hour'], clockReviewRequired: p.clockReviewRequired,
      boundaryReviewRequired: p.boundaryReviewRequired})),
    stemElements: profiles.flatMap(p => p.slots.map(s => {
      const alternatives = ordered(s.options.map(v => v[0])).map(symbol => {
        const entry = ruleCatalog.stemElements.find(e => e.symbol === symbol);
        return {symbol, element: entry.element};
      });
      const elements = ordered(alternatives.map(a => a.element));
      return {side: s.side, position: s.position, alternatives,
        confirmedElement: elements.length === 1 ? elements[0] : null,
        source: {...ruleCatalog.stemElements[0].source}};
    })),
    findings,
    limitations: [
      'Symbol definitions only; no 合化, strength, favorable element, personality or relationship outcome inferred.',
      'Candidate-dependent findings are review material, not confirmed reading statements or probabilities.',
      'All-candidates means agreement within supplied research candidates, not validated astronomical accuracy.',
      'Visible stem elements are not whole-chart proportions; hidden stems, season and weights are not analyzed.',
      'All position pairs are inventoried without a priority rule. Coexisting 合/沖 are not cancelled or scored.',
      ...(scope === 'between-profiles' ? ['Cross-profile application is a research comparison choice, not a compatibility rule approved by the cited text.'] : []),
    ]};
}

export function analyzeProfile(profile) {
  const normalized = normalize(profile, 'self');
  const findings = normalized.slots.flatMap((a, i) => normalized.slots.slice(i + 1)
    .flatMap(b => relationsFor(a, b, true)));
  return result([normalized], 'within-profile', findings);
}

export function compareProfiles(first, second) {
  const a = normalize(first, 'a'), b = normalize(second, 'b');
  return result([a, b], 'between-profiles',
    a.slots.flatMap(left => b.slots.flatMap(right => relationsFor(left, right, false))));
}

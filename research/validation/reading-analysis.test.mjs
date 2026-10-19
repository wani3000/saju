import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {ruleCatalog, classifySymbols, stems, branches} from './reading-rules.mjs';
import {analyzeProfile, compareProfiles} from './reading-analysis.mjs';
import {calculateProfile} from './adapter.mjs';

const chart = (pillars, rest = {}) => ({policy:{version:'research-civil-midnight-v5', productionApproved:false},
  timeKnown:true, pillars, ...rest});
const a = chart({year:'갑자', month:'병인', day:'무진', hour:'경오'});
const b = chart({year:'기축', month:'신해', day:'계유', hour:'을미'});
const base = {calendar:'solar', leap:false, year:2024, month:2, day:10, timeKnown:false};
const at = (r, side, position) => r.stemElements.find(e => e.side === side && e.position === position);

test('definition lineage pins the visually reviewed scans and locates all 17 pairs in the transcription', () => {
  const dir = new URL('./fixtures/reading-sources/', import.meta.url);
  const source = JSON.parse(readFileSync(new URL('source.json', dir)));
  const transcription = JSON.parse(readFileSync(new URL('transcription.json', dir)));
  for (const page of source.pages) {
    const bytes = readFileSync(new URL(page.file, dir));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), page.sha256);
  }
  assert.equal(createHash('sha256').update(readFileSync(new URL('transcription.json', dir))).digest('hex'), source.transcriptionSha256);
  assert.equal(ruleCatalog.rules.length, 17);
  for (const rule of ruleCatalog.rules) {
    const section = transcription.sections.find(s => s.id === rule.source.sectionId);
    assert.equal(rule.source.id, source.sourceId);
    assert.equal(rule.source.pdfSha256, source.pdfSha256);
    assert.equal(section.pdfPage, rule.source.pdfPage);
    const [first, second] = rule.hanja;
    assert.match(section.text, new RegExp(`${first}(與)?${second}(相冲|合)`));
  }
});

test('all 100 stem pairs and 144 branch pairs have exactly the reviewed symmetric memberships', () => {
  // Independent index identities for the conventional circular arrangements,
  // including every negative pair, rather than merely iterating the rule table.
  for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) {
    const result = classifySymbols('stem', stems[i], stems[j]);
    assert.equal(result.length, Math.abs(i - j) === 5 ? 1 : 0);
    assert.deepEqual(result, classifySymbols('stem', stems[j], stems[i]));
  }
  for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) {
    const expected = [];
    if ((i + j) % 12 === 1) expected.push('branch-combination');
    if (Math.abs(i - j) === 6) expected.push('branch-clash');
    assert.deepEqual(classifySymbols('branch', branches[i], branches[j]).map(r => r.family), expected);
  }
  for (const args of [['stem','갑자','기'], ['branch','사',''], ['other','갑','기'], ['stem','甲','己']]) {
    assert.throws(() => classifySymbols(...args), /INVALID_SYMBOL_PAIR/);
  }
});

test('synthetic charts report exact locations and preserve simultaneous 合/沖 without ranking them', () => {
  const result = compareProfiles(a, b);
  assert.deepEqual(result.findings.map(f => f.ruleId), [
    'stem-combination:갑기','branch-combination:자축',
    'stem-combination:병신','branch-combination:인해',
    'stem-combination:무계','branch-combination:진유',
    'stem-combination:을경','branch-combination:오미',
  ]);
  assert.deepEqual(result.findings[0].endpoints, [{side:'a', position:'year'}, {side:'b', position:'year'}]);
  assert.ok(result.findings.every(f => f.certainty === 'all-candidates' && f.interpretation === null && f.weight === null));
  const mixed = analyzeProfile(chart({year:'갑자', month:'병오', day:'기축', hour:'을미'}));
  assert.deepEqual(new Set(mixed.findings.map(f => f.ruleId)), new Set([
    'branch-clash:자오','stem-combination:갑기','branch-combination:자축','branch-combination:오미','branch-clash:축미',
  ]));
  assert.equal(mixed.score, null);
  assert.equal(mixed.interpretation, null);
});

test('all 3600 day-pillar pairs preserve A/B symmetry including self-comparisons', () => {
  const sixty = Array.from({length:60}, (_, i) => stems[i % 10] + branches[i % 12]);
  const canonical = (result, swapped) => result.findings.map(f => {
    const endpoints = swapped ? [...f.endpoints].reverse().map(e => ({...e, side:e.side === 'a' ? 'b' : 'a'})) : f.endpoints;
    const witnesses = swapped ? f.witnesses.map(w => [...w].reverse()).sort() : [...f.witnesses].sort();
    return JSON.stringify({...f, endpoints, witnesses});
  }).sort();
  for (const first of sixty) for (const second of sixty) {
    const x = chart({...a.pillars, day:first, hour:null}, {timeKnown:false});
    const y = chart({...b.pillars, day:second, hour:null}, {timeKnown:false});
    const xy = compareProfiles(x, y), yx = compareProfiles(y, x);
    assert.deepEqual(canonical(xy, false), canonical(yx, true));
    assert.equal(xy.score, null);
    assert.equal(xy.productionApproved, false);
  }
  assert.equal(compareProfiles(a, a).score, null); // self is never a fabricated 100
});

test('partial candidate matches are not confirmed; common stem definitions survive different branches', () => {
  const uncertain = chart({...a.pillars, year:null}, {candidates:{year:['갑자','을축']}});
  const result = compareProfiles(uncertain, b);
  const hit = result.findings.find(f => f.ruleId === 'stem-combination:갑기' && f.endpoints[0].position === 'year');
  assert.equal(hit.certainty, 'candidate-dependent');
  assert.deepEqual(hit.witnesses, [['갑','기']]);
  assert.equal(at(result, 'a', 'year').confirmedElement, '목');
  const sameStem = chart({...a.pillars, year:null}, {candidates:{year:['갑자','갑인']}});
  assert.equal(compareProfiles(sameStem, b).findings.find(f => f.ruleId === 'stem-combination:갑기').certainty, 'all-candidates');
  const mixedElements = chart({...a.pillars, year:null}, {candidates:{year:['갑자','병인']}});
  assert.equal(at(compareProfiles(mixedElements, b), 'a', 'year').confirmedElement, null);
  assert.equal(analyzeProfile(uncertain).findings.find(f => f.certainty === 'candidate-dependent').jointFeasibility,
    'not-established-from-marginal-candidates');
  assert.deepEqual(compareProfiles(uncertain, b), compareProfiles({...uncertain, candidates:{year:['을축','갑자']}}, b));
});

test('real adapter boundary candidates and unknown hours remain visible without birth-data leakage', () => {
  const profile = calculateProfile({...base, day:4});
  const known = calculateProfile({...base, timeKnown:true, hour:12, minute:0});
  const result = compareProfiles(profile, known);
  assert.deepEqual(result.coverage[0].omittedPositions, ['hour']);
  assert.equal(result.coverage[0].boundaryReviewRequired, true);
  assert.equal(result.stemElements.filter(e => e.side === 'a').length, 3);
  assert.ok(result.findings.every(f => !f.endpoints.some(e => e.side === 'a' && e.position === 'hour')));
  const encoded = JSON.stringify(compareProfiles({...profile, privateData:'DO-NOT-EXPORT', alias:'DO-NOT-EXPORT'}, known));
  assert.ok(!encoded.includes('DO-NOT-EXPORT'));
  for (const key of ['solar','civilTime','birthDate','timezoneSourceSha256']) assert.ok(!encoded.includes(`"${key}"`));
  assert.equal(analyzeProfile(calculateProfile({...base, year:1954, month:3, day:21})).coverage[0].clockReviewRequired, true);
  assert.deepEqual(analyzeProfile(calculateProfile(base)), analyzeProfile(calculateProfile({...base, calendar:'lunar', month:1, day:1})));
});

test('malformed, contradictory and unsupported profiles cannot silently supply a convenient pillar', () => {
  for (const profile of [
    {...a, policy:{...a.policy, version:'future'}}, {...a, policy:{...a.policy, productionApproved:true}},
    {...a, timeKnown:false}, {...a, pillars:{...a.pillars, day:'갑축'}},
    {...a, pillars:{...a.pillars, day:undefined}}, {...a, pillars:{...a.pillars, month:null}},
    {...a, candidates:{year:['갑자','을축']}}, {...a, candidates:{unknown:['갑자','을축']}},
    {...a, pillars:{...a.pillars, month:null}, candidates:{month:['갑자','갑자']}},
    {...a, timeKnown:false, pillars:{...a.pillars, hour:null}, candidates:{hour:['갑자','을축']}},
  ]) assert.throws(() => analyzeProfile(profile));
  assert.throws(() => {ruleCatalog.rules[0].weight = 100;}, TypeError);
  const one = compareProfiles(a, b); one.findings[0].source.id = 'mutated';
  assert.equal(compareProfiles(a, b).findings[0].source.id, 'yuanhai-1926-ntl-9900014379');
});

test('saved review cases are reproducible and source collation does not open a release gate', () => {
  const script = new URL('./audit-reading-rules.mjs', import.meta.url).pathname;
  const check = spawnSync(process.execPath, [script, '--check'], {encoding:'utf8'});
  assert.equal(check.status, 0, check.stdout + check.stderr);
  const release = spawnSync(process.execPath, [script, '--release-check'], {encoding:'utf8'});
  assert.equal(release.status, 2, release.stdout + release.stderr);
  const report = JSON.parse(readFileSync(new URL('./reports/reading-rule-audit.json', import.meta.url)));
  for (const example of report.cases) {
    for (const statement of example.reviewStatements) {
      assert.ok(example.analysis.findings.some(f => f.ruleId === statement.ruleId && f.certainty === 'all-candidates'));
      assert.equal(statement.status, 'editorial-draft-not-approved');
    }
  }
  const uncertain = report.cases.find(c => c.id === 'candidate-dependent-pair');
  assert.ok(uncertain.analysis.findings.some(f => f.ruleId === 'stem-combination:갑기' && f.certainty === 'candidate-dependent'));
  assert.ok(!uncertain.reviewStatements.some(s => s.ruleId === 'stem-combination:갑기'));
});

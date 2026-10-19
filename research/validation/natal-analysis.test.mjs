import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {stems} from './reading-rules.mjs';
import {natalCatalog, classifyTenGod, stemDefinition} from './natal-rules.mjs';
import {analyzeNatal, buildNatalDraft} from './natal-analysis.mjs';
import {calculateProfile} from './adapter.mjs';

const chart = (changes={}) => ({policy:{version:'research-civil-midnight-v5',productionApproved:false},timeKnown:true,
  pillars:{year:'갑자',month:'병인',day:'무진',hour:'경오'},...changes});
const base = {calendar:'solar',leap:false,timeKnown:false,year:2024,month:2,day:10};
const dir = new URL('./fixtures/reading-sources/',import.meta.url);

test('natal primary-source scans and transcription hashes are pinned independently of v1', () => {
  const manifest = JSON.parse(readFileSync(new URL('natal-source.json',dir)));
  const transcription = JSON.parse(readFileSync(new URL('natal-transcription.json',dir)));
  const sha = bytes => createHash('sha256').update(bytes).digest('hex');
  assert.equal(sha(readFileSync(new URL('natal-transcription.json',dir))),manifest.transcriptionSha256);
  for (const page of manifest.pages) assert.equal(sha(readFileSync(new URL(page.file,dir))),page.sha256);
  const hanStems = '甲乙丙丁戊己庚辛壬癸';
  const pairs = transcription.sections.find(s => s.id === 'hidden-stems').pairs;
  assert.equal(pairs.length,12);
  for (const [branch,hidden] of pairs) {
    const rule = natalCatalog.hiddenStems.find(r => r.hanja === branch);
    assert.equal(rule.hanStems,hidden);
    assert.equal(rule.stems.map(s => hanStems[stems.indexOf(s)]).join(''),hidden);
    assert.equal(rule.weights,null);
  }
  for (const rule of natalCatalog.directions) for (const ref of rule.sources) {
    assert.equal(ref.pdfSha256,manifest.pdfSha256);
    assert.ok(transcription.sections.some(s => s.id === ref.sectionId && s.pdfPage === ref.pdfPage));
  }
  for (const [id,label] of [['indirect-wealth-examples','편재'],['food-god-examples','식신']]) {
    for (const [day,target] of transcription.sections.find(s => s.id === id).pairs) {
      assert.equal(classifyTenGod(stems[hanStems.indexOf(day)],stems[hanStems.indexOf(target)]).label,label);
    }
  }
});

test('100 directional ten-god classifications match an independently written expected table', () => {
  // Rows: day stem 甲..癸; columns: target 甲..癸. Do not derive expectations from catalog/formula.
  const expected = [
    '비견 겁재 식신 상관 편재 정재 편관 정관 편인 정인',
    '겁재 비견 상관 식신 정재 편재 정관 편관 정인 편인',
    '편인 정인 비견 겁재 식신 상관 편재 정재 편관 정관',
    '정인 편인 겁재 비견 상관 식신 정재 편재 정관 편관',
    '편관 정관 편인 정인 비견 겁재 식신 상관 편재 정재',
    '정관 편관 정인 편인 겁재 비견 상관 식신 정재 편재',
    '편재 정재 편관 정관 편인 정인 비견 겁재 식신 상관',
    '정재 편재 정관 편관 정인 편인 겁재 비견 상관 식신',
    '식신 상관 편재 정재 편관 정관 편인 정인 비견 겁재',
    '상관 식신 정재 편재 정관 편관 정인 편인 겁재 비견',
  ].map(row => row.split(' '));
  for (let i=0;i<10;i++) for (let j=0;j<10;j++) assert.equal(classifyTenGod(stems[i],stems[j]).label,expected[i][j]);
  assert.equal(classifyTenGod('갑','병').label,'식신');
  assert.equal(classifyTenGod('병','갑').label,'편인'); // NOT A/B symmetric.
  for (const value of ['',null,'甲','갑자',1]) assert.throws(() => classifyTenGod(value,'갑'),/INVALID_NATAL_STEM/);
  assert.throws(() => stemDefinition('자'),/INVALID_NATAL_STEM/);
  assert.throws(() => {natalCatalog.directions[0].labels[0]='approved';},TypeError);
});

test('day stem is reference only; hidden stems retain verse order without rank/weights', () => {
  const result = analyzeNatal(chart());
  assert.equal(result.dayReference.confirmedStem,'무');
  assert.equal(result.tenGods.filter(f => f.layer === 'visible').length,3);
  assert.ok(!result.tenGods.some(f => f.position === 'day' && f.layer === 'visible'));
  assert.deepEqual(result.hiddenStems.find(f => f.position === 'day').alternatives[0].stems,['을','무','계']);
  assert.equal(result.tenGods.find(f => f.position === 'day' && f.targetStem === '무').label,'비견');
  assert.ok(result.tenGods.every(f => f.weight === null && f.interpretation === null));
  assert.equal(result.monthContext.seasonalStrength,null);
  assert.equal(result.score,null);
});

test('uncertain day stem is correlated with its own branch instead of Cartesian mixing', () => {
  const uncertain = chart({pillars:{...chart().pillars,day:null},candidates:{day:['갑자','을축']}});
  const result = analyzeNatal(uncertain);
  const dayFacts = result.tenGods.filter(f => f.position === 'day');
  assert.equal(result.dayReference.confirmedStem,null);
  assert.ok(dayFacts.every(f => f.witnesses.every(w => w.dayPillar === w.targetPillar)));
  assert.deepEqual(dayFacts.filter(f => f.targetStem === '계').map(f => f.label).sort(),['정인','편인'].sort());
  assert.ok(!dayFacts.some(f => f.targetStem === '기' && f.label === '정재')); // only 乙丑 contains 己 => 偏財
  assert.equal(dayFacts.find(f => f.targetStem === '기').label,'편재');
  assert.ok(dayFacts.every(f => f.certainty === 'candidate-dependent'));
  assert.ok(!buildNatalDraft(uncertain).statements.some(s => s.id.startsWith('day:')));
  assert.deepEqual(result,analyzeNatal({...uncertain,candidates:{day:['을축','갑자']}}));
});

test('shared hidden stems can be certain while partial cross-pillar facts remain unconfirmed', () => {
  const uncertain = chart({pillars:{...chart().pillars,month:null},candidates:{month:['갑자','을축']}});
  const result = analyzeNatal(uncertain);
  const common = result.tenGods.find(f => f.position === 'month' && f.targetStem === '계');
  assert.equal(common.certainty,'all-candidates');
  const partial = result.tenGods.find(f => f.position === 'month' && f.targetStem === '신');
  assert.equal(partial.certainty,'candidate-dependent');
  assert.equal(partial.jointFeasibility,'not-established-from-marginal-candidates');
  const draft = buildNatalDraft(uncertain);
  assert.ok(draft.statements.some(s => s.id === common.id));
  assert.ok(!draft.statements.some(s => s.id === partial.id));
  assert.ok(draft.omittedCandidateDependentFacts > 0);
});

test('all sixty day pillars and their paired candidate sets preserve same-pillar witnesses', () => {
  const branches='자축인묘진사오미신유술해';
  const sixty=Array.from({length:60},(_,i) => stems[i%10]+branches[i%12]);
  for (let i=0;i<60;i++) {
    const fixed=analyzeNatal(chart({pillars:{...chart().pillars,day:sixty[i]}}));
    const uncertain=analyzeNatal(chart({pillars:{...chart().pillars,day:null},candidates:{day:[sixty[i],sixty[(i+1)%60]]}}));
    const own=fixed.tenGods.filter(f => f.position === 'day');
    assert.ok(own.every(f => f.certainty === 'all-candidates'));
    for (const fact of uncertain.tenGods.filter(f => f.position === 'day')) {
      assert.ok(fact.witnesses.every(w => w.dayPillar === w.targetPillar));
      if (fact.certainty === 'all-candidates') assert.ok(own.some(f => f.id === fact.id));
    }
  }
});

test('real boundaries, unknown hours and lunar correspondence preserve scope without personal data', () => {
  const profile=calculateProfile({...base,day:4});
  const result=analyzeNatal({...profile,privateData:'NEVER-EXPORT',alias:'NEVER-EXPORT'});
  assert.deepEqual(result.coverage[0].omittedPositions,['hour']);
  assert.equal(result.coverage[0].boundaryReviewRequired,true);
  assert.ok(!result.tenGods.some(f => f.position === 'hour'));
  assert.ok(!result.hiddenStems.some(f => f.position === 'hour'));
  assert.ok(!JSON.stringify(result).includes('NEVER-EXPORT'));
  assert.deepEqual(analyzeNatal(calculateProfile(base)),analyzeNatal(calculateProfile({...base,calendar:'lunar',month:1,day:1})));
  const historical=buildNatalDraft(calculateProfile({...base,year:1954,month:3,day:21}));
  assert.equal(historical.coverage[0].clockReviewRequired,true);
});

test('invalid input is rejected before generating descriptions; mutable outputs do not corrupt rules', () => {
  for (const invalid of [chart({policy:{version:'future'}}),chart({timeKnown:false}),
    chart({pillars:{...chart().pillars,day:'갑축'}}),chart({pillars:{...chart().pillars,month:null}})]) {
    assert.throws(() => analyzeNatal(invalid)); assert.throws(() => buildNatalDraft(invalid));
  }
  const result=analyzeNatal(chart());
  result.tenGods[0].sources[0].id='mutated';
  result.hiddenStems[0].alternatives[0].stems.push('갑');
  assert.ok(!JSON.stringify(analyzeNatal(chart())).includes('mutated'));
  assert.deepEqual(analyzeNatal(chart()).hiddenStems[0].alternatives[0].stems,['계']);
});

test('saved natal drafts reproduce and release is blocked even when definition tests pass', () => {
  const script=new URL('./audit-natal-rules.mjs',import.meta.url).pathname;
  for (const [flag,status] of [['--check',0],['--release-check',2]]) {
    const run=spawnSync(process.execPath,[script,flag],{encoding:'utf8'});
    assert.equal(run.status,status,run.stdout+run.stderr);
  }
  const report=JSON.parse(readFileSync(new URL('./reports/natal-rule-audit.json',import.meta.url)));
  assert.equal(report.cases.length,6);
  for (const c of report.cases) {
    assert.equal(c.analysis.productionApproved,false);
    assert.equal(c.draft.productionApproved,false);
    for (const s of c.draft.statements.filter(s => !['day-reference','month-context'].includes(s.id))) {
      assert.ok(c.analysis.tenGods.some(f => f.id === s.id && f.certainty === 'all-candidates'));
      assert.ok(s.sources.length > 0);
    }
  }
});

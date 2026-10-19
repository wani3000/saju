import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {judgmentCatalog,classifySourceRoot,analyzeSourceJudgments,buildSourceJudgmentDraft} from './source-judgments.mjs';
import {analyzeContext} from './context-analysis.mjs';
import {calculateProfile} from './adapter.mjs';
import {stems,branches} from './reading-rules.mjs';
const chart=(pillars={year:'갑자',month:'경오',day:'기축',hour:'정묘'},rest={}) => ({
  policy:{version:'research-civil-midnight-v5',productionApproved:false},timeKnown:true,pillars,...rest});
const pair=result => result.combinationAssessments.find(p=>p.id === 'year:day:stem-combination:갑기');

test('source judgment examples pin the original scan and new transcription without modifying prior versions',()=>{
  const dir=new URL('./fixtures/reading-sources/',import.meta.url);
  const manifest=JSON.parse(readFileSync(new URL('judgment-source.json',dir)));
  const transcription=JSON.parse(readFileSync(new URL(manifest.transcriptionFile,dir)));
  const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
  assert.equal(hash(readFileSync(new URL(manifest.pdfFile,dir))),manifest.pdfSha256);
  assert.equal(hash(readFileSync(new URL(manifest.transcriptionFile,dir))),manifest.transcriptionSha256);
  for (const page of manifest.pages) assert.equal(hash(readFileSync(new URL(page.file,dir))),page.sha256);
  for (const ref of [...judgmentCatalog.roots.flatMap(r=>r.sources),judgmentCatalog.obstruction.source]) {
    assert.deepEqual(ref.pdfPages,transcription.sections.find(s=>s.id === ref.sectionId).pdfPages);
    assert.equal(ref.transcriptionSha256,manifest.transcriptionSha256);
  }
  assert.throws(()=>{judgmentCatalog.roots[0].grade='heavy';},TypeError);
  const copy=classifySourceRoot('갑','미');copy.sources[0].pdfPages.push(900);copy.grade='heavy';
  assert.equal(classifySourceRoot('갑','미').grade,'light');
  assert.deepEqual(classifySourceRoot('갑','미').sources[0].pdfPages,[21]);
});

test('all 120 stem/branch pairs use only the eleven transcribed cases; unmatched is not rootless',()=>{
  const expected={갑미:['tomb','light'],병술:['tomb','light'],을술:['excluded-as-tomb',null],정축:['excluded-as-tomb',null],
    을진:['residual','light'],정미:['residual','light'],갑해:['birth','heavy'],갑인:['salary','heavy'],갑묘:['blade','heavy'],
    을오:['yin-birth-root',null],정유:['yin-birth-root',null]};
  let matches=0;
  for (const stem of stems) for (const branch of branches) {
    const actual=classifySourceRoot(stem,branch),known=expected[stem+branch];
    assert.equal(actual.weight,null);
    if (known) {matches++;assert.deepEqual([actual.kind,actual.grade],known);assert.equal(actual.status,'source-example');}
    else {assert.equal(actual.status,'not-covered-by-selected-examples');assert.equal(actual.kind,null);assert.equal(actual.grade,null);}
  }
  assert.equal(matches,11);
  // The text's tomb exclusion is local; it is not an assertion of no root anywhere.
  const out=buildSourceJudgmentDraft(chart({year:'갑인',month:'경술',day:'을축',hour:'정묘'}));
  assert.ok(out.statements.some(s=>s.text.includes('다른 위치에도 뿌리가 없다는 뜻이 아닙니다')));
  assert.equal(out.strength,null);
});

test('yin birth examples are not silently replaced by the hidden-stem matching convention',()=>{
  for (const [day,month] of [['을축','경오'],['정묘','신유']]) {
    const profile=chart({year:'임자',month,day,hour:'경신'});
    assert.equal(analyzeContext(profile).rootObservations.filter(r=>r.position === 'month').length,0);
    const fact=analyzeSourceJudgments(profile).rootAssessments.find(s=>s.position === 'month').alternatives[0];
    assert.equal(fact.kind,'yin-birth-root');assert.equal(fact.grade,null);
    assert.ok(buildSourceJudgmentDraft(profile).statements.some(s=>s.text.includes('무거운 뿌리 등급은 적용하지 않습니다')));
  }
});

test('day candidate correlation prevents borrowing a tomb or heavy root from another day',()=>{
  const result=analyzeSourceJudgments(chart({year:'임자',month:'경오',day:null,hour:'정묘'},
    {candidates:{day:['갑오','을미']}}));
  const own=result.rootAssessments.find(s=>s.position === 'day');
  assert.deepEqual(own.alternatives.map(f=>f.stem+f.branch).sort(),['갑오','을미']);
  assert.ok(own.alternatives.every(f=>f.status === 'not-covered-by-selected-examples'));
  assert.ok(own.alternatives.every(f=>f.jointFeasibility === 'within-supplied-pillar-candidates'));
});

test('a covered and uncovered month candidate cannot yield a confirmed root judgment',()=>{
  const profile=chart({year:'임자',month:null,day:'갑자',hour:'경신'},{candidates:{month:['정미','무신']}});
  const slot=analyzeSourceJudgments(profile).rootAssessments.find(s=>s.position === 'month');
  assert.equal(slot.coverage,'selected-examples-cover-some-candidates');
  const fact=slot.alternatives.find(f=>f.branch === '미');
  assert.equal(fact.certainty,'candidate-dependent');
  assert.equal(fact.jointFeasibility,'not-established-from-marginal-candidates');
  assert.ok(!buildSourceJudgmentDraft(profile).statements.some(s=>s.id.startsWith('month:')));
});

test('both explicitly transcribed intervening stems trigger only the source obstruction judgment',()=>{
  for (const month of ['경오','을묘']) {
    const profile=chart({year:'갑자',month,day:'기축',hour:'정묘'}),result=analyzeSourceJudgments(profile);
    assert.equal(pair(result).status,'source-obstruction-present');
    assert.deepEqual(pair(result).transformation,{status:'not-adjudicated',element:null});
    assert.ok(buildSourceJudgmentDraft(profile).statements.some(s=>s.id.startsWith('obstruction:')));
    assert.equal(result.strength,null);assert.equal(result.score,null);
    assert.ok(analyzeContext(profile).combinationContexts.some(p=>p.ruleId === 'stem-combination:갑기'));
  }
  const reversed=chart({year:'기축',month:'경오',day:'갑자',hour:'정묘'});
  assert.equal(pair(analyzeSourceJudgments(reversed)).status,'source-obstruction-present');
});

test('no obstruction example is not proof of transformation; outside positions and other pairs stay unclassified',()=>{
  for (const profile of [
    chart({year:'갑자',month:'병인',day:'기축',hour:'경오'}),
    chart({year:'갑자',month:'기축',day:'경오',hour:'정묘'}),
    chart({year:'을묘',month:'병인',day:'경오',hour:'정묘'}),
  ]) {
    const result=analyzeSourceJudgments(profile);
    assert.ok(result.combinationAssessments.every(p=>p.status === 'not-covered-by-selected-examples'));
    assert.ok(result.combinationAssessments.every(p=>p.transformation.element === null));
    assert.ok(!buildSourceJudgmentDraft(profile).statements.some(s=>s.id.startsWith('obstruction:')));
  }
});

test('obstruction alternatives distinguish a universal disjunction from partial or absent pairs',()=>{
  const base={year:'갑자',month:null,day:'기축',hour:'정묘'};
  const universal=chart(base,{candidates:{month:['경오','을묘']}});
  assert.equal(pair(analyzeSourceJudgments(universal)).status,'source-obstruction-present');
  const partial=chart(base,{candidates:{month:['경오','병인']}});
  const partialPair=pair(analyzeSourceJudgments(partial));
  assert.equal(partialPair.status,'candidate-dependent-obstruction');
  assert.equal(partialPair.pairJointFeasibility,'universal-over-supplied-candidates');
  assert.equal(partialPair.obstructionJointFeasibility,'not-established-from-marginal-candidates');
  assert.ok(!buildSourceJudgmentDraft(partial).statements.some(s=>s.id.startsWith('obstruction:')));
  const conditional=chart({...base,month:'경오',day:null},{candidates:{day:['기축','무진']}});
  const found=pair(analyzeSourceJudgments(conditional));
  assert.equal(found.pairCertainty,'candidate-dependent');assert.equal(found.status,'candidate-dependent-obstruction');
  assert.ok(!buildSourceJudgmentDraft(conditional).statements.some(s=>s.id.startsWith('obstruction:')));
});

test('source judgments agree with sixteen exhaustive fixed-chart assignments',()=>{
  const candidates={year:['갑자','병인'],month:['경오','을묘'],day:['기축','갑인'],hour:['정미','경신']};
  const uncertain=analyzeSourceJudgments(chart({year:null,month:null,day:null,hour:null},{candidates}));
  const fixed=[];
  for (const year of candidates.year) for (const month of candidates.month)
    for (const day of candidates.day) for (const hour of candidates.hour)
      fixed.push(analyzeSourceJudgments(chart({year,month,day,hour})));
  for (const slot of uncertain.rootAssessments) {
    const expected=[...new Set(fixed.flatMap(r=>r.rootAssessments.find(s=>s.position === slot.position).alternatives.map(f=>f.stem+f.branch)))].sort();
    assert.deepEqual(slot.alternatives.map(f=>f.stem+f.branch).sort(),expected);
    for (const fact of slot.alternatives) {
      const universal=fixed.every(r=>r.rootAssessments.find(s=>s.position === slot.position).alternatives.some(f=>f.stem===fact.stem && f.branch===fact.branch));
      assert.equal(fact.certainty,universal?'all-candidates':'candidate-dependent');
    }
  }
  for (const candidate of uncertain.combinationAssessments) {
    const statuses=fixed.map(r=>r.combinationAssessments.find(p=>p.id===candidate.id)?.status);
    const hits=statuses.filter(s=>s==='source-obstruction-present').length;
    assert.equal(candidate.status,hits===fixed.length?'source-obstruction-present':hits>0?'candidate-dependent-obstruction':'not-covered-by-selected-examples');
  }
  const reordered=chart({year:null,month:null,day:null,hour:null},
    {candidates:Object.fromEntries(Object.entries(candidates).map(([key,value])=>[key,[...value].reverse()]))});
  assert.deepEqual(analyzeSourceJudgments(reordered),uncertain);
});

test('unknown hours and historical/boundary review flags survive; solar and lunar counterparts agree',()=>{
  const base={calendar:'solar',leap:false,timeKnown:false,year:2024,month:2,day:4};
  const profile=calculateProfile(base),result=analyzeSourceJudgments(profile),draft=buildSourceJudgmentDraft(profile);
  assert.deepEqual(result.coverage[0].omittedPositions,['hour']);
  assert.ok(result.rootAssessments.every(s=>s.position!=='hour'));
  assert.ok(result.combinationAssessments.every(p=>p.unobservedPositions.includes('hour')));
  assert.equal(draft.coverage[0].boundaryReviewRequired,true);
  assert.equal(buildSourceJudgmentDraft(calculateProfile({...base,year:1954,month:3,day:21})).coverage[0].clockReviewRequired,true);
  assert.deepEqual(analyzeSourceJudgments(calculateProfile({...base,day:10})),
    analyzeSourceJudgments(calculateProfile({...base,calendar:'lunar',month:1,day:1})));
});

test('private fields and asserted grades cannot bypass validation or enter review outputs',()=>{
  for (const bad of [null,{},chart(undefined,{policy:{version:'future'}}),chart(undefined,{timeKnown:false}),
    chart({year:'갑축',month:'병인',day:'갑자',hour:'경오'})]) assert.throws(()=>analyzeSourceJudgments(bad));
  for (const [stem,branch] of [['甲','자'],['갑','子'],['','자'],['갑',''],[null,'자']]) assert.throws(()=>classifySourceRoot(stem,branch));
  const ordinary=chart(),privateInput={...ordinary,name:'PRIVATE-MARKER',birthDate:'PRIVATE-MARKER',score:100,strength:'strong',rootGrade:100};
  assert.deepEqual(analyzeSourceJudgments(privateInput),analyzeSourceJudgments(ordinary));
  assert.ok(!JSON.stringify(buildSourceJudgmentDraft(privateInput)).includes('PRIVATE-MARKER'));
  const mutated=analyzeSourceJudgments(ordinary);mutated.combinationAssessments[0].sources[0].pdfPages.push(999);
  assert.ok(!JSON.stringify(analyzeSourceJudgments(ordinary)).includes('999'));
});

test('new and previous reports reproduce and production release remains blocked',()=>{
  for (const file of ['audit-reading-rules.mjs','audit-natal-rules.mjs','audit-context-rules.mjs','audit-source-judgments.mjs']) {
    const run=spawnSync(process.execPath,[new URL(file,import.meta.url).pathname,'--check'],{encoding:'utf8'});
    assert.equal(run.status,0,run.stdout+run.stderr);
  }
  const release=spawnSync(process.execPath,[new URL('audit-source-judgments.mjs',import.meta.url).pathname,'--release-check'],{encoding:'utf8'});
  assert.equal(release.status,2,release.stdout+release.stderr);
});

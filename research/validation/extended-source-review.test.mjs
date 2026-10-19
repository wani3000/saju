import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {transformationCatalog,moderationExamples,analyzeFivePairConditions,analyzeModerationExamples,reviewExtendedSources,extendedSource} from './extended-source-review.mjs';
import {analyzeTransformationConditions} from './strength-transformation-review.mjs';
import {commandForRange} from './seasonal-command.mjs';
import {pairChart,chart} from './audit-extended-sources.mjs';
const branches=[...'자축인묘진사오미신유술해'];
const sourceChart=e=>chart(Object.fromEntries(['year','month','day','hour'].map((k,i)=>[k,e.pillars[i]])));

test('collation pins all original pages and selected transcriptions; preserves actual printed count conflict',()=>{
  const dir=new URL('./fixtures/reading-sources/',import.meta.url),hash=b=>createHash('sha256').update(b).digest('hex');
  const manifest=JSON.parse(readFileSync(new URL('extended-sources.json',dir)));
  assert.equal(manifest.sources.length,3);
  for(const s of manifest.sources) for(const p of s.pages) assert.equal(hash(readFileSync(new URL(p.file,dir))),p.sha256);
  assert.equal(hash(readFileSync(new URL(manifest.transcriptionFile,dir))),manifest.transcriptionSha256);
  const tx=JSON.parse(readFileSync(new URL(manifest.transcriptionFile,dir)));
  assert.ok(tx.sections.find(s=>s.id==='午-collation').text.includes('丁火十日九日己'));
  assert.ok(tx.sections.find(s=>s.id==='wood-extremely-strong').text.includes('七木兩水'));
  for(const day of [0,10,19,28,29]) assert.equal(commandForRange('오',day,day+1).confirmedStem,null);
  assert.throws(()=>{transformationCatalog[0].primaryMonths.push('자');},TypeError);
  assert.throws(()=>{moderationExamples[0].pillars[0]='갑자';},TypeError);
  const copy=extendedSource('five-pair-months');copy.pdfPages.push(999);
  assert.deepEqual(extendedSource('five-pair-months').pdfPages,[28]);
});

test('all five pairs in both day directions across twelve months use independently specified primary and secondary branches',()=>{
  const expected=[['갑기','토','진술축미','오'],['을경','금','사유축','신'],['병신','수','신자진','해'],['정임','목','해묘미','인'],['무계','화','인오술','사']];
  for(const [pair,element,primary,secondary] of expected) for(const reverse of [false,true]) for(const branch of branches) {
    const rule=transformationCatalog.find(r=>r.pair===pair),r=analyzeFivePairConditions(pairChart(rule,branch,reverse));
    assert.equal(r.common.pair,pair);assert.equal(r.common.presence,'observed');assert.equal(r.common.cardinality,'source-rule-met');
    assert.equal(r.common.monthRoute,primary.includes(branch)?'primary-month':secondary===branch?'additional-month':'unlisted-month');
    assert.equal(r.alternatives[0].targetElement,element);
    assert.equal(r.transformationEstablished,null);assert.equal(r.transformedElement,null);
  }
});

test('unlisted month keeps the same-source hour support route open rather than declaring transformation impossible',()=>{
  for(const rule of transformationCatalog) {
    const branch=branches.find(b=>!rule.primaryMonths.includes(b)&&b!==rule.additionalMonth);
    const r=analyzeFivePairConditions(pairChart(rule,branch));
    assert.equal(r.status,'unlisted-season-needs-review');
    assert.equal(r.alternatives[0].hourSupportRoute,'not-adjudicated');
    assert.equal(r.transformationEstablished,null);
  }
});

test('repeated same-side and opposite-side stems both trigger this source screen, for every pair and direction',()=>{
  for(const rule of transformationCatalog) for(const reverse of [false,true]) for(const side of ['day','hour']) {
    const p=pairChart(rule,rule.primaryMonths[0],reverse);p.pillars.year=p.pillars[side];
    const r=analyzeFivePairConditions(p);
    assert.equal(r.common.cardinality,'source-rule-failed');assert.equal(r.status,'source-cardinality-conflict');
    assert.equal(r.transformationEstablished,null); // Source conflict is not a cross-school final prohibition.
  }
});

test('unknown hour cannot prove uniqueness or absence, but cannot erase an observed duplication',()=>{
  const rule=transformationCatalog[1],p=pairChart(rule,'유');
  const absent=chart({...p.pillars,hour:'임자'});
  assert.equal(analyzeFivePairConditions(absent).status,'no-day-combination');
  const unknown={...p,timeKnown:false,pillars:{...p.pillars,hour:null}};
  const r=analyzeFivePairConditions(unknown);
  assert.equal(r.common.presence,'unknown');assert.equal(r.common.cardinality,'unknown');
  unknown.pillars.year=p.pillars.hour;
  assert.equal(analyzeFivePairConditions(unknown).common.presence,'observed');
  assert.equal(analyzeFivePairConditions(unknown).common.cardinality,'unknown');
  unknown.pillars.month='경신';
  assert.equal(analyzeFivePairConditions(unknown).common.cardinality,'source-rule-failed');
});

test('a visible pair elsewhere is not substituted for the day-based pair',()=>{
  const r=analyzeFivePairConditions(chart({year:'을축',month:'경신',day:'갑자',hour:'임자'}));
  assert.equal(r.common.pair,'갑기');assert.equal(r.status,'no-day-combination');
});

test('the newly reviewed 午 exception does not mutate the old strict Jia-Ji convention',()=>{
  const p=chart({year:'임자',month:'병오',day:'갑자',hour:'기축'});
  assert.equal(analyzeFivePairConditions(p).common.monthRoute,'additional-month');
  assert.equal(analyzeTransformationConditions(p).status,'necessary-condition-failed');
  assert.ok(analyzeTransformationConditions(p).commonFailedChecks.includes('month-earth-branch'));
});

test('new cardinality screen does not silently import or erase old intervening obstruction',()=>{
  const p=chart({year:'기축',month:'경진',day:'갑자',hour:'병인'});
  assert.equal(analyzeFivePairConditions(p).status,'listed-season-needs-review');
  assert.ok(analyzeTransformationConditions(p).commonFailedChecks.includes('no-explicit-intervening-obstruction'));
});

test('month stem/branch correlation is preserved: no fabricated season/cardinality combination',()=>{
  const p={...chart({year:'임자',month:null,day:'갑자',hour:'기축'}),candidates:{month:['갑진','병오']}};
  const r=analyzeFivePairConditions(p);
  assert.equal(r.status,'candidate-dependent');assert.equal(r.alternatives.length,2);
  assert.ok(r.alternatives.some(a=>a.monthRoute==='primary-month'&&a.cardinality==='source-rule-failed'));
  assert.ok(r.alternatives.some(a=>a.monthRoute==='additional-month'&&a.cardinality==='source-rule-met'));
  assert.equal(r.common.monthRoute,null);assert.equal(r.common.cardinality,null);
});

test('sixteen concrete assignments reproduce marginal alternatives, including changes of day pair',()=>{
  const candidates={year:['기축','경자'],month:['갑진','병오'],day:['갑자','을축'],hour:['기축','경자']};
  const p={...chart({year:null,month:null,day:null,hour:null}),candidates};
  const expected=new Set();
  for(const year of candidates.year) for(const month of candidates.month) for(const day of candidates.day) for(const hour of candidates.hour)
    for(const a of analyzeFivePairConditions(chart({year,month,day,hour})).alternatives) expected.add(JSON.stringify(a));
  const r=analyzeFivePairConditions(p);
  assert.deepEqual(r.alternatives.map(a=>JSON.stringify(a)).sort(),[...expected].sort());
  assert.equal(r.common.pair,null);
  assert.deepEqual(r,analyzeFivePairConditions({...p,candidates:Object.fromEntries(Object.entries(candidates).map(([k,v])=>[k,[...v].reverse()]))}));
});

test('four exact textual examples keep too/extreme distinctions without assigning a general strength or moderation result',()=>{
  const labels=['木太旺','木旺極','木太衰','木衰極'];
  for(const [i,e] of moderationExamples.entries()) {
    const r=analyzeModerationExamples(sourceChart(e));
    assert.equal(r.status,'source-example-matched');assert.equal(r.matches.length,1);assert.equal(r.matches[0].sourceLabel,labels[i]);
    assert.equal(r.matches[0].match,'exact-source-chart');
    assert.equal(r.classification,null);assert.equal(r.score,null);assert.equal(r.moderation,null);
  }
});

test('changing one branch with identical visible counts cannot inherit an example label or default to balance',()=>{
  const p=sourceChart(moderationExamples[0]);p.pillars.hour='무오';
  const r=analyzeModerationExamples(p);
  assert.equal(r.status,'outside-reviewed-examples');assert.deepEqual(r.matches,[]);assert.equal(r.moderation,null);
});

test('unknown hour and marginal source matches stay partial, never exact or jointly established',()=>{
  const p=sourceChart(moderationExamples[0]);
  const unknown=analyzeModerationExamples({...p,timeKnown:false,pillars:{...p.pillars,hour:null}});
  assert.equal(unknown.matches[0].match,'partial-chart-hour-unobserved');
  const candidates=analyzeModerationExamples({...p,pillars:{...p.pillars,hour:null},candidates:{hour:['무진','무오']}});
  assert.equal(candidates.matches[0].match,'marginal-candidate-match');assert.equal(candidates.matches[0].jointFeasibility,'not-established');
  assert.equal(candidates.classification,null);
});

test('both new entrypoints reject unsupported engines, invalid ganji and injected hour candidates',()=>{
  for(const f of [analyzeFivePairConditions,analyzeModerationExamples]) for(const p of [null,{},
    {...sourceChart(moderationExamples[0]),policy:{version:'future'}},chart({year:'갑축',month:'병인',day:'갑자',hour:'기축'}),
    {...sourceChart(moderationExamples[0]),timeKnown:false}]) assert.throws(()=>f(p));
});

test('integrated review retains unresolved 午, historical and term flags; ignores claimed strength and private data',()=>{
  const base={calendar:'solar',leap:false,timeKnown:false,year:2024,month:6,day:15};
  const r=reviewExtendedSources(base);
  assert.equal(r.seasonalCommand.confirmedStem,null);assert.equal(r.午Collation.status,'29-days-corroborated-correction-unresolved');
  assert.equal(r.strength.classification,null);assert.equal(r.transformation.transformationEstablished,null);
  assert.deepEqual(r,reviewExtendedSources({...base,name:'PRIVATE-MARKER',strength:'balanced',transformationEstablished:true}));
  assert.ok(!JSON.stringify(r).includes('PRIVATE-MARKER'));assert.ok(!JSON.stringify(r).includes('2024-06-15'));
  assert.equal(reviewExtendedSources({...base,month:2,day:4}).seasonalCommand.status,'solar-term-boundary-review');
  assert.equal(reviewExtendedSources({...base,year:1954,month:3,day:21}).seasonalCommand.status,'historical-clock-review');
});

test('new review is deterministic across lunar equivalence and process timezones',()=>{
  const base={calendar:'solar',leap:false,timeKnown:false,year:2024,month:2,day:10},r=reviewExtendedSources(base);
  assert.deepEqual(r,reviewExtendedSources({...base,calendar:'lunar',month:1,day:1}));
  const code=`import {reviewExtendedSources} from './extended-source-review.mjs';console.log(JSON.stringify(reviewExtendedSources(${JSON.stringify(base)})));`;
  const run=spawnSync(process.execPath,['--input-type=module','-e',code],{cwd:new URL('.',import.meta.url),encoding:'utf8',env:{...process.env,TZ:'America/New_York'}});
  assert.equal(run.status,0,run.stderr);assert.deepEqual(JSON.parse(run.stdout),r);
});

test('extended reports reproduce; release gate still blocks instead of approving source examples as general rules',()=>{
  for(const [flag,status] of [['--check',0],['--release-check',2]]) {
    const r=spawnSync(process.execPath,[new URL('audit-extended-sources.mjs',import.meta.url).pathname,flag],{encoding:'utf8'});
    assert.equal(r.status,status,r.stdout+r.stderr);
  }
});

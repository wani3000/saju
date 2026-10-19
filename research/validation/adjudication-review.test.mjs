import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {chart} from './audit-extended-sources.mjs';
import {sourceChart,vetoChart,pillar,scoreProposal} from './audit-adjudication.mjs';
import {strengthReferences,transformationVetoes,adjudicateStrengthReference,adjudicateTransformationVetoes,auditVisibleSupportShortcut,auditScoreProposal,auditScaleCounterexamples,reviewPairAdjudication,adjudicationSource} from './adjudication-review.mjs';
const only=p=>adjudicateTransformationVetoes(p).alternatives[0];

test('all newly collated and reused pages plus selected transcriptions are hashed; the source corpus is immutable',()=>{
 const dir=new URL('./fixtures/reading-sources/',import.meta.url),hash=b=>createHash('sha256').update(b).digest('hex');
 const m=JSON.parse(readFileSync(new URL('adjudication-sources.json',dir)));
 for(const s of m.sources)for(const p of s.pages)assert.equal(hash(readFileSync(new URL(p.file,dir))),p.sha256);
 assert.equal(hash(readFileSync(new URL(m.transcriptionFile,dir))),m.transcriptionSha256);
 assert.throws(()=>strengthReferences[0].pillars.push('갑자'),TypeError);assert.throws(()=>transformationVetoes[0].stem='경',TypeError);
 assert.throws(()=>adjudicationSource('ditian-1947',999));
});

test('twenty complete literal charts cover five elements and four distinct source classes with original labels',()=>{
 assert.equal(strengthReferences.length,20);assert.equal(new Set(strengthReferences.map(c=>c.id)).size,20);
 for(const element of ['목','화','토','금','수']){
  const cases=strengthReferences.filter(c=>c.element===element);assert.equal(cases.length,4);
  assert.deepEqual(cases.map(c=>c.classification).sort(),['extremely-strong','extremely-weak','too-strong','too-weak']);
 }
 for(const c of strengthReferences){const r=adjudicateStrengthReference(sourceChart(c));
  assert.equal(r.status,'exact-source-case');assert.equal(r.sourceClassification.category,c.classification);assert.equal(r.sourceClassification.label,c.sourceLabel);
  assert.equal(r.generalClassification,null);assert.equal(r.moderation,null);assert.equal(r.score,null);
 }
});

test('previous four wood reference charts are reproduced exactly without rewriting their earlier module',async()=>{
 const {moderationExamples,analyzeModerationExamples}=await import('./extended-source-review.mjs');
 for(const c of moderationExamples){const p=sourceChart(c),r=adjudicateStrengthReference(p);
  assert.equal(r.sourceClassification.category,c.category);assert.equal(analyzeModerationExamples(p).classification,null);}
});

test('unknown hour, marginal case match and nearby unlisted chart never inherit a source class or default balance',()=>{
 const c=strengthReferences[0],p=sourceChart(c);p.timeKnown=false;p.pillars.hour=null;
 assert.equal(adjudicateStrengthReference(p).sourceClassification,null);assert.equal(adjudicateStrengthReference(p).status,'partial-source-case');
 p.timeKnown=true;p.candidates={hour:[c.pillars[3],'갑자']};
 assert.equal(adjudicateStrengthReference(p).sourceClassification,null);
 const near=sourceChart(c);near.pillars.hour='갑자';assert.equal(adjudicateStrengthReference(near).status,'outside-reference-corpus');
 assert.equal(adjudicateStrengthReference(near).moderation,null);
});

test('source-attributed transformation belongs to year/month, not the day or two-person score',()=>{
 const c=strengthReferences.find(c=>c.id==='water-extremely-weak'),p=sourceChart(c),r=adjudicateStrengthReference(p);
 assert.deepEqual(c.pillars,['계묘','무오','임인','병오']);assert.equal(r.sourceAttributedTransformation.sourceSaysTransformation,true);
 assert.deepEqual(r.sourceAttributedTransformation.positions,['year','month']);assert.equal(r.sourceAttributedTransformation.element,'화');
 assert.equal(only(p).status,'no-visible-day-partner'); // This is a DIFFERENT, explicitly day-only scope.
 p.timeKnown=false;p.pillars.hour=null;assert.equal(adjudicateStrengthReference(p).sourceAttributedTransformation,null);
});

test('five distinct veto stems and their source wording are applied in both day directions',()=>{
 const expected=[['갑기','무','between-pair'],['을경','갑','between-pair'],['병신','정','visible-stems'],['정임','병','visible-stems'],['무계','기','visible-stems']];
 for(const [pair,stem,scope] of expected){const r=transformationVetoes.find(r=>r.pair===pair);assert.equal(r.stem,stem);assert.equal(r.scope,scope);
  for(const reverse of [false,true]){const p=vetoChart(r,reverse),a=only(p);assert.equal(a.status,'all-observed-day-pairs-vetoed');assert.equal(a.pairs[0].sourceVetoObserved,true);
   assert.equal(a.dayPairSourceClausePassed,false);assert.equal(a.dayPairTransformationEstablished,null);assert.equal(adjudicateTransformationVetoes(p).transformationEstablished,null);}}
});

test('between-pair clauses differ from visible-stem clauses; removing a veto never proves transformation',()=>{
 for(const r of transformationVetoes){const p=vetoChart(r);[p.pillars.month,p.pillars.hour]=[p.pillars.hour,p.pillars.month];const a=only(p);
  assert.equal(a.pairs[0].sourceVetoObserved,r.scope==='visible-stems');
  if(r.scope==='between-pair'){assert.equal(a.status,'remaining-conditions-unresolved');assert.equal(a.dayPairTransformationEstablished,null);}
 }
});

test('a second surviving adjacent partner prevents a chart-wide veto; unknown hour prevents completeness',()=>{
 const r=transformationVetoes[0],p=vetoChart(r);p.pillars.hour=p.pillars.year;
 const a=only(p);assert.equal(a.pairs.length,2);assert.ok(a.pairs.some(x=>x.sourceVetoObserved));assert.ok(a.pairs.some(x=>!x.sourceVetoObserved));assert.equal(a.dayPairTransformationEstablished,null);
 p.timeKnown=false;p.pillars.hour=null;const b=only(p);assert.equal(b.status,'observed-pairs-vetoed-hour-unobserved');assert.equal(b.dayPairTransformationEstablished,null);
});

test('veto and partner must coexist in the same candidate assignment; candidate order is deterministic',()=>{
 const r=transformationVetoes[0],p=vetoChart(r);p.pillars.year=null;p.pillars.month=null;
 p.candidates={year:[pillar('기'),pillar('임')],month:[pillar('무'),pillar('계')]};
 const observed=adjudicateTransformationVetoes(p);assert.equal(observed.status,'candidate-dependent');assert.equal(observed.dayPairTransformationEstablished,null);
 const brute=new Set();for(const year of p.candidates.year)for(const month of p.candidates.month)
  for(const a of adjudicateTransformationVetoes(chart({...p.pillars,year,month})).alternatives)brute.add(JSON.stringify(a));
 assert.deepEqual(new Set(observed.alternatives.map(a=>JSON.stringify(a))),brute);
 p.candidates.year.reverse();p.candidates.month.reverse();assert.deepEqual(adjudicateTransformationVetoes(p),observed);
});

test('day reference and branch candidates remain correlated in source-case lookup',()=>{
 const c=strengthReferences[0],p=sourceChart(c);p.pillars.day=null;p.candidates={day:['갑오','병자']};
 assert.equal(adjudicateStrengthReference(p).status,'outside-reference-corpus'); // must not invent 갑자 from separate candidates
});

test('the visible support majority shortcut has concrete counterexamples in opposite directions',()=>{
 const r=auditVisibleSupportShortcut();assert.ok(r.counterexamples.includes('wood-too-strong'));assert.ok(r.counterexamples.includes('wood-too-weak'));
 assert.equal(r.cases.find(c=>c.id==='wood-too-strong').hypothesis,'weak');assert.equal(r.cases.find(c=>c.id==='wood-too-weak').hypothesis,'strong');
 assert.equal(r.productionApproved,false);
});

test('reviewed symbol definitions, individual classes and vetoes cannot approve numeric compatibility weights',()=>{
 for(const ruleId of ['stem-combination:갑기','strength:wood-too-strong','veto:갑기','unreviewed']){
  const r=auditScoreProposal(scoreProposal([{ruleId,weight:10}]));assert.equal(r.score,null);assert.equal(r.normalizedCompatibility,null);assert.equal(r.mapRadius,null);
  assert.equal(r.components[0].adoptedWeight,null);assert.ok(r.blockers.includes('NO_REVIEWED_NUMERIC_WEIGHT'));}
 assert.ok(auditScoreProposal(scoreProposal([{ruleId:'stem-combination:갑기',weight:0}])).blockers.includes('NO_REVIEWED_RELATIONSHIP_EFFECT'));
});

test('engineering failure policies and duplicate contributions are flagged independently of source insufficiency',()=>{
 const c={ruleId:'stem-combination:갑기',weight:10},r=auditScoreProposal(scoreProposal([c,c],{
  directionPolicy:'unaggregated-direction',unknownHourPolicy:'invent-noon',candidatePolicy:'majority',normalization:'cohort-minmax',duplicatePolicy:'count-duplicates'}));
 for(const reason of ['DIRECTIONAL_RELATIONS_NEED_AGGREGATION','UNKNOWN_HOUR_MUST_NOT_BE_INVENTED','CANDIDATE_COUNTS_ARE_NOT_PROBABILITIES','COHORT_NORMALIZATION_MOVES_EXISTING_PEOPLE','DUPLICATE_CONTRIBUTION_NEEDS_REVIEW'])assert.ok(r.blockers.includes(reason));
});

test('requests cannot supply approval authority, executable expressions or non-finite weights',()=>{
 const p=scoreProposal([{ruleId:'stem-combination:갑기',weight:10}]);
 for(const extra of [{approved:true},{sourceApproval:'approved'},{formula:'eval(user)'}])assert.throws(()=>auditScoreProposal({...p,...extra}));
 for(const weight of [NaN,Infinity,'10',null])assert.throws(()=>auditScoreProposal({...p,components:[{ruleId:'stem-combination:갑기',weight}]}));
 assert.throws(()=>auditScoreProposal({...p,components:[]}));assert.throws(()=>auditScoreProposal({...p,components:[{...p.components[0],approved:true}]}));
});

test('cohort normalization, duplicate features and directional ten gods have reproducible scale counterexamples',()=>{
 const r=auditScaleCounterexamples();assert.equal(r.cohortNormalization.before,0.5);assert.equal(r.cohortNormalization.afterAddingAnother,0.75);
 assert.notEqual(r.directionalLabels.forward,r.directionalLabels.reverse);assert.equal(r.duplicateContribution.duplicated,2*r.duplicateContribution.single);
});

test('pair readiness keeps classifications individual, does not invent a score, and propagates review flags without private fields',()=>{
 const p=sourceChart(strengthReferences[0]);p.name='PRIVATE_ALIAS';p.birthDate='PRIVATE_BIRTH';p.boundaryReview={secret:'PRIVATE_FLAG'};p.clockReview={};
 const r=reviewPairAdjudication(p,p);assert.equal(r.individuals[0].strength.sourceClassification.category,'too-strong');assert.equal(r.score,null);
 assert.equal(r.coverage[0].boundaryReviewRequired,true);assert.equal(r.coverage[0].clockReviewRequired,true);assert.ok(!JSON.stringify(r).includes('PRIVATE_'));
 const swapped=reviewPairAdjudication(sourceChart(strengthReferences[1]),p);assert.equal(swapped.score,null);
});

test('new and previous reports reproduce; operating release remains blocked rather than treating checks as approval',()=>{
 for(const name of ['audit-adjudication.mjs','audit-selected-reading.mjs','audit-extended-sources.mjs','audit-hour-balance.mjs']){
  const r=spawnSync(process.execPath,[new URL(name,import.meta.url).pathname,'--check'],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);}
 const r=spawnSync(process.execPath,[new URL('audit-adjudication.mjs',import.meta.url).pathname,'--release-check'],{encoding:'utf8'});assert.equal(r.status,2,r.stderr);
});

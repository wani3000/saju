import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {chart,referenceProfile} from './beta-quality-pack.mjs';
import {rescueSource,reviewRescueActors,reviewTransformationReference,auditWeightSensitivity,reviewRescuePair} from './rescue-wangqi-review.mjs';
import {buildRescueWangqiAudit,rescueFixtures} from './audit-rescue-wangqi.mjs';
const fixtures=rescueFixtures(),ref=id=>rescueSource.transformationCases.find(c=>c.id===id);
const pattern=(p,id)=>reviewRescueActors(p).patterns.find(r=>r.id===id);
test('new source chart columns, page images and attribution reproduce against pinned source metadata',()=>{
 const r=buildRescueWangqiAudit();assert.equal(r.checksPassed,true);assert.equal(r.references.length,4);
 assert.deepEqual(rescueSource.transformationCases[0].pillars,['을축','갑신','갑진','기사']);
 assert.deepEqual(rescueSource.sources.flatMap(s=>s.pages.map(p=>p.pdfPage)),[25,26,374,375,376,377,378,379]);
});
test('source transformations and rescue fixtures satisfy month/hour anchor dependencies without asserting real birth dates',()=>{
 const tx=JSON.parse(readFileSync(new URL('./fixtures/reading-sources/month-hour-anchors.json',import.meta.url)));
 const han='甲乙丙丁戊己庚辛壬癸',ko='갑을병정무기경신임계';
 const expected=(kind,stem,offset)=>{const a=tx[kind].anchors.find(a=>a.stems.includes(han[ko.indexOf(stem)]));return ko[(han.indexOf(a.start)+offset)%10];};
 const profiles=[...rescueSource.transformationCases.map(referenceProfile),...fixtures.map(f=>f.profile)];
 for(const p of profiles) {
  assert.equal(p.pillars.month[0],expected('month',p.pillars.year[0],'인묘진사오미신유술해자축'.indexOf(p.pillars.month[1])));
  assert.equal(p.pillars.hour[0],expected('hour',p.pillars.day[0],'자축인묘진사오미신유술해'.indexOf(p.pillars.hour[1])));
 }
});
test('exact source classification targets transformed qi, with opposed earth surplus/insufficiency kept separate from day strength',()=>{
 const a=reviewTransformationReference(referenceProfile(ref('earth-true-qi-insufficient')));
 const b=reviewTransformationReference(referenceProfile(ref('earth-true-qi-surplus')));
 assert.equal(a.sourceClassification.target,'transformed-qi');assert.equal(a.sourceClassification.qiCategory,'insufficient');
 assert.equal(b.sourceClassification.qiCategory,'surplus');assert.equal(a.sourceClassification.element,b.sourceClassification.element);
 assert.equal(a.originalDayStrength,null);assert.equal(b.originalDayStrength,null);
 for(const r of [a,b]){assert.equal(r.transformationEstablished,null);assert.equal(r.wangQiEstablished,null);}
});
test('a named true-transformation source case without any Chen defeats a universal literal-Chen requirement',()=>{
 const r=reviewTransformationReference(referenceProfile(ref('wood-true-without-chen')));
 assert.equal(r.sourceClassification.sourceSaysTrueTransformation,true);assert.equal(r.literalChen.absenceConfirmed,true);
 assert.notEqual(r.priorPreference.hourMatch,'listed-preferred-hour');assert.equal(r.wangQiEstablished,null);
 const all=buildRescueWangqiAudit();assert.equal(all.shortcutCounterexamples.listedPreferredHourNecessary.length,3);
});
test('extra Jia/Eul source conflict is attributed rather than silently overriding prior clauses or proving its own true-transformation premise',()=>{
 const r=reviewTransformationReference(referenceProfile(ref('earth-true-qi-insufficient')));
 assert.equal(r.sourceClassification.sourceSaysTrueTransformation,true);
 assert.ok(r.priorJiaJiConditions.commonFailedChecks.includes('no-extra-jia'));
 assert.ok(r.priorJiaJiConditions.commonFailedChecks.includes('no-visible-eul'));
 assert.equal(r.transformationEstablished,null);
});
test('unknown hour or partial candidates never inherit the positive source case label',()=>{
 const p=referenceProfile(ref('earth-true-qi-insufficient'));p.timeKnown=false;p.pillars.hour=null;
 let r=reviewTransformationReference(p);assert.equal(r.status,'partial-source-reference');assert.equal(r.sourceClassification,null);
 const q=referenceProfile(ref('wood-true-without-chen'));q.pillars.hour=null;q.candidates={hour:['계묘','갑진']};
 r=reviewTransformationReference(q);assert.equal(r.sourceClassification,null);assert.equal(r.wangQiEstablished,null);
});
test('an unlisted source chart is not classified as weak, balanced or transformed by resemblance',()=>{
 const p=referenceProfile(ref('earth-true-qi-insufficient'));p.pillars.day='갑자';
 const r=reviewTransformationReference(p);assert.equal(r.status,'outside-reference-corpus');assert.equal(r.sourceClassification,null);
 assert.equal(r.originalDayStrength,null);assert.equal(r.moderation,null);
});
test('three source rescue patterns observe static month frame candidates and visible actors while leaving effective rescue unresolved',()=>{
 for(const f of fixtures){const r=pattern(f.profile,f.id);assert.equal(r.actorsInEveryCandidate,true,f.id);
  assert.equal(r.frameEstablished,null);assert.equal(r.actualHarm,null);assert.equal(r.effectiveRescue,null);}
});
test('the same resource class is a conditional response for officer/injury but an obstacle for killing/food',()=>{
 const a=pattern(fixtures[0].profile,fixtures[0].id),b=pattern(fixtures[1].profile,fixtures[1].id);
 assert.equal(a.resourceRole,'conditional-response');assert.equal(b.resourceRole,'conditional-obstacle');
 assert.ok(a.alternatives[0].groups.find(g=>g.id==='response').evidence.length);
 assert.ok(b.alternatives[0].groups.find(g=>g.id==='resource-obstacle').evidence.length);
 assert.equal(auditWeightSensitivity().uniformResourceBenefit.adoptable,false);
});
test('exclusive month options cannot donate the frame from one and resource actor from another',()=>{
 const p=chart({year:'신축',month:null,day:'무자',hour:'경신'});p.candidates={month:['신묘','병신']};
 const r=pattern(p,'officer-injury-resource');assert.equal(r.actorsInEveryCandidate,false);
 assert.ok(r.alternatives.every(a=>!a.actorsObserved));
 assert.ok(r.alternatives.some(a=>a.frameCandidates.length>0));
 assert.ok(r.alternatives.some(a=>a.groups.find(g=>g.id==='response').evidence.length>0));
});
test('day candidate polarity stays correlated with both frame and actor classification',()=>{
 const p=structuredClone(fixtures[0].profile);p.pillars.day=null;p.candidates={day:['무자','기축']};
 const r=pattern(p,'officer-injury-resource');assert.equal(r.status,'candidate-dependent');
 assert.ok(r.alternatives.some(a=>a.actorsObserved));assert.ok(r.alternatives.some(a=>!a.actorsObserved));
});
test('hidden day resources cannot be silently substituted for an explicitly visible rescue actor',()=>{
 const p=chart({year:'신축',month:'신묘',day:'무오',hour:'임자'});
 const r=pattern(p,'officer-injury-resource');assert.ok(r.alternatives.every(a=>a.frameCandidates.length>0));
 assert.ok(r.alternatives.every(a=>!a.groups.find(g=>g.id==='response').evidence.length));
 assert.equal(r.effectiveRescue,null);
});
test('unknown hour retains visible evidence without turning missing groups into a complete pattern or absence proof',()=>{
 const p=structuredClone(fixtures[0].profile);p.timeKnown=false;p.pillars.hour=null;
 const r=pattern(p,'officer-injury-resource');assert.equal(r.actorsInEveryCandidate,false);
 assert.ok(r.alternatives.every(a=>a.hourUnobserved));assert.ok(r.alternatives[0].groups.find(g=>g.id==='injury').evidence.length);
 assert.equal(r.actualHarm,null);assert.equal(r.effectiveRescue,null);
});
test('another person cannot provide a missing personal rescue actor, and pair output is symmetric without a score',()=>{
 const a=chart({year:'신축',month:'신묘',day:'무오',hour:'임자'}),b=fixtures[0].profile;
 const r=reviewRescuePair(a,b),back=reviewRescuePair(b,a);
 assert.equal(r.individuals[0].rescue.patterns.find(p=>p.id==='officer-injury-resource').actorsInEveryCandidate,false);
 assert.deepEqual(r.individuals,back.individuals.toReversed());
 for(const k of ['score','normalizedCompatibility','mapRadius'])assert.equal(r[k],null);
});
test('hypothetical pair ordering reverses when an ungrounded relative weight is varied, without adopting any numeric weight',()=>{
 const r=auditWeightSensitivity();assert.deepEqual(r.probes.map(p=>p.ordering),['A-above-B','tie','B-above-A']);
 assert.equal(r.orderingIdentified,false);assert.equal(r.adoptedWeights,null);assert.equal(r.score,null);
});
test('source review retains calendar coverage and rejects invalid profiles without copying personal fields',()=>{
 const p=structuredClone(fixtures[0].profile);p.name='PRIVATE_ALIAS';p.birth='PRIVATE_BIRTH';p.clockReview={raw:'PRIVATE_FLAG'};p.boundaryReview={};
 const r=reviewRescuePair(p,p);assert.equal(r.individuals[0].rescue.coverage[0].clockReviewRequired,true);
 assert.equal(r.individuals[0].transformation.coverage[0].boundaryReviewRequired,true);assert.ok(!JSON.stringify(r).includes('PRIVATE_'));
 assert.throws(()=>reviewRescueActors({...p,timeKnown:false}));
 const report=buildRescueWangqiAudit();assert.equal(report.calendarInputs.find(c=>c.id==='term-candidates').review.coverage[0].boundaryReviewRequired,true);
 assert.equal(report.calendarInputs.find(c=>c.id==='clock-source-dispute').review.coverage[0].clockReviewRequired,true);
});
test('new and previous reports reproduce with expert/general rule and compatibility approval still blocked',()=>{
 for(const name of ['audit-rescue-wangqi.mjs','audit-policy-criteria.mjs','audit-adjudication.mjs','audit-hour-balance.mjs']) {
  const r=spawnSync(process.execPath,[new URL(name,import.meta.url).pathname,'--check'],{encoding:'utf8'});assert.equal(r.status,0,r.stdout+r.stderr);
 }
 const r=spawnSync(process.execPath,[new URL('audit-rescue-wangqi.mjs',import.meta.url).pathname,'--release-check'],{encoding:'utf8'});
 assert.equal(r.status,2,r.stdout+r.stderr);
});

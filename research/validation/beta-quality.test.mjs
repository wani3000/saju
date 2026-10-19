import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {privateBetaScope,validateBetaScope,buildBetaReading} from './beta-reading.mjs';
import {buildSelectedReading} from './selected-reading.mjs';
import {analyzeProfile} from './reading-analysis.mjs';
import {betaQualityFixtures,buildBetaQualityPack,moderationReferenceCases,reviewModerationReference,referenceProfile} from './beta-quality-pack.mjs';
const fixture=id=>betaQualityFixtures().find(f=>f.id===id);
const read=f=>buildBetaReading(f.first,f.second,f.relationship);

test('frozen beta scope preserves the paid plan while excluding real charges, predictions and public release',()=>{
 const s=privateBetaScope;assert.equal(s.realCharges,false);assert.equal(s.productionApproved,false);
 assert.equal(s.paidProduct.status,'deferred-not-cancelled');assert.equal(s.paidProduct.additionalPartnerPriceKRW,2900);
 assert.equal(s.externalPilotStarted,false);assert.ok(s.excluded.includes('compatibility-score'));
 assert.throws(()=>s.copy.title='forged',TypeError);
 const copy=validateBetaScope(s);copy.copy.title='changed';assert.notEqual(s.copy.title,copy.copy.title);
});

test('unreviewed product scope expansions or fabricated approval cannot pass the contract',()=>{
 for(const mutate of [s=>s.realCharges=true,s=>s.productionApproved=true,s=>s.externalPilotStarted=true,
  s=>s.calendarApproval='approved',s=>s.review.expertInterpretationSignoff='approved',s=>s.included.push('compatibility-score'),
  s=>s.excluded=s.excluded.filter(x=>x!=='live-payments'),s=>s.comparisonPositions.push('hour'),s=>s.compatibilityScore=90,
  s=>delete s.copy.title,s=>s.supportedResearchInput.productionAccuracyApproved=true]){
  const s=structuredClone(privateBetaScope);mutate(s);assert.throws(()=>validateBetaScope(s));
 }
});

test('all 17 representative readings keep source evidence, display limits and scope checks',()=>{
 const p=buildBetaQualityPack();assert.equal(p.cases.length,17);assert.equal(p.sourceReferenceBank.length,22);assert.equal(p.checksPassed,true);
 for(const c of p.cases){assert.ok(Object.values(c.checks).every(Boolean),c.id);assert.equal(c.reading.ruleVersion,'source-observations-copy-v2');assert.equal(c.reading.score,null);}
 assert.equal(p.humanParticipantsObserved,0);assert.equal(p.paidReleaseApproved,false);
 assert.equal(p.reviewGates.find(g=>g.id==='expert-interpretation-review').status,'not-completed');
});

test('new copy revises explanations without changing source facts or mutating earlier version outputs',()=>{
 const f=fixture('different-elements'),old=buildSelectedReading(f.first,f.second,f.relationship),snapshot=structuredClone(old),next=read(f);
 assert.equal(old.ruleVersion,'source-observations-copy-v1');assert.equal(next.ruleVersion,'source-observations-copy-v2');assert.notEqual(old.strength,next.strength);
 assert.deepEqual(next.basis.observations.map(o=>({...o,text:undefined})),old.basis.observations.map(o=>({...o,text:undefined})));
 assert.deepEqual(next.basis.dayElements,old.basis.dayElements);assert.deepEqual(buildSelectedReading(f.first,f.second,f.relationship),snapshot);
 assert.ok(next.basis.cautions.includes(privateBetaScope.copy.positionGuide));
});

test('one uncertain day retains the other known element; neither side is silently filled or labelled balanced',()=>{
 const r=read(fixture('one-uncertain-day'));assert.deepEqual(r.basis.dayElements.map(e=>e.element),[null,'토']);
 assert.ok(r.strength.includes('나의 기준 오행은 후보가 여러 개'));assert.ok(r.strength.includes('상대방의 기준 오행은 토예요'));
 const both=read(fixture('both-uncertain-days'));assert.deepEqual(both.basis.dayElements.map(e=>e.element),[null,null]);
 assert.equal(both.basis.scoreStatus,'not-adopted');assert.ok(!both.strength.includes('중화'));
 const same=read(fixture('same-element-candidates'));assert.equal(same.basis.dayElements[0].element,'목');
});

test('no common pair and coexisting pairs produce clear, nonscoring fallback copy',()=>{
 const absent=read(fixture('no-common-pair'));assert.equal(absent.difference,privateBetaScope.copy.noMatch);assert.equal(absent.basis.totalCommonObservations,0);
 const coexist=read(fixture('coexisting-pairs'));for(const label of ['천간 합','지지 육합','지지 육충'])assert.ok(coexist.difference.includes(label));
 assert.ok(coexist.basis.omittedDisplayObservations>0);assert.equal(coexist.score,null);
});

test('source middle references are pinned and identify both a balanced example and a seasonal contrast',()=>{
 const dir=new URL('./fixtures/reading-sources/',import.meta.url),hash=b=>createHash('sha256').update(b).digest('hex');
 const m=JSON.parse(readFileSync(new URL('beta-quality-sources.json',dir)));
 for(const s of m.sources)for(const p of s.pages)assert.equal(hash(readFileSync(new URL(p.file,dir))),p.sha256);
 assert.equal(hash(readFileSync(new URL(m.transcriptionFile,dir))),m.transcriptionSha256);
 const cs=moderationReferenceCases();assert.deepEqual(cs[0].pillars,['신사','갑오','계묘','계해']);assert.deepEqual(cs[1].pillars,['기유','병자','계미','무오']);
 assert.equal(reviewModerationReference(referenceProfile(cs[0])).sourceClassification,'source-balanced-example');
 assert.equal(reviewModerationReference(referenceProfile(cs[1])).sourceClassification,'not-a-generic-balanced-label');
});

test('a source balanced case contains a clash; beta copy does not translate this into relationship quality or a balance algorithm',()=>{
 const c=moderationReferenceCases()[0],p=referenceProfile(c);
 assert.ok(analyzeProfile(p).findings.some(f=>f.ruleId==='branch-clash:사해'&&f.certainty==='all-candidates'));
 const r=reviewModerationReference(p);assert.equal(r.generalStrength,null);assert.equal(r.compatibilityScore,null);
 const beta=read(fixture('source-balanced-with-clash'));assert.equal(beta.score,null);
 assert.ok(!beta.strength.includes('중화'));assert.ok(!beta.difference.includes('中和'));
});

test('partial, unknown-hour or spliced day candidates cannot inherit a middle-case label',()=>{
 const c=moderationReferenceCases()[0],p=referenceProfile(c);p.timeKnown=false;p.pillars.hour=null;
 assert.equal(reviewModerationReference(p).sourceClassification,null);
 p.timeKnown=true;p.pillars.hour=c.pillars[3];p.pillars.day=null;p.candidates={day:['계축','신묘']};
 assert.equal(reviewModerationReference(p).status,'outside-reviewed-middle-cases');
 const near=referenceProfile(c);near.pillars.year='신축';assert.equal(reviewModerationReference(near).sourceClassification,null);
});

test('known/unknown hours and solar/lunar equivalents preserve common comparison facts; review flags survive',()=>{
 const lunar=read(fixture('solar-lunar-equivalent')),solar=read(fixture('unknown-hour-calendar'));
 assert.deepEqual(lunar,solar);
 const boundary=read(fixture('solar-term-boundary'));assert.ok(boundary.basis.coverage[0].boundaryReviewRequired);
 const clock=read(fixture('historical-clock-review'));assert.ok(clock.basis.coverage[0].clockReviewRequired);
 const known=read(fixture('known-hours'));assert.ok(known.basis.observations.every(o=>o.positions.every(p=>p.position!=='hour')));
});

test('relationship variants change only editorial prompts and user-supplied private fields do not leak',()=>{
 const fs=betaQualityFixtures().filter(f=>f.id.startsWith('relation-')),rs=fs.map(read);
 assert.equal(new Set(rs.map(r=>r.advice)).size,4);for(const r of rs)assert.deepEqual(r.basis,rs[0].basis);
 const f=fixture('different-elements');f.first.name='PRIVATE_NAME';f.first.birthDate='PRIVATE_DATE';
 assert.ok(!JSON.stringify(read(f)).includes('PRIVATE_'));
});

test('beta quality and previous version reports reproduce, and readiness is never inferred from passing tests',()=>{
 for(const file of ['audit-beta-quality.mjs','audit-selected-reading.mjs','audit-adjudication.mjs']){
  const r=spawnSync(process.execPath,[new URL(file,import.meta.url).pathname,'--check'],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);}
 const r=spawnSync(process.execPath,[new URL('audit-beta-quality.mjs',import.meta.url).pathname,'--release-check'],{encoding:'utf8'});assert.equal(r.status,2,r.stderr);
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reviewBoundaryPriority} from './boundary-priority-review.mjs';
import {synthesizeProfile,synthesizePair} from './whole-chart-synthesis.mjs';
import {moderationReferenceCases,referenceProfile,chart} from './beta-quality-pack.mjs';
const preferred=()=>chart({year:'무진',month:'정사',day:'계유',hour:'병진'});

test('balanced source case and seasonal counterexample now reach synthesis without becoming general judgments',()=>{
 for(const c of moderationReferenceCases()){
  const p=referenceProfile(c),r=synthesizeProfile(p),m=r.decisions.find(d=>d.id==='moderation');
  assert.equal(m.referenceOnly,c.classification);assert.equal(m.value,null);
  const source=r.reviews.boundaryPriority.moderationReference;
  assert.equal(source.matches[0].pdfPage,c.pdfPage);assert.equal(source.status,'exact-source-reference');
  const partial=structuredClone(p);partial.timeKnown=false;partial.pillars.hour=null;
  assert.equal(synthesizeProfile(partial).decisions.find(d=>d.id==='moderation').referenceOnly,null);
  const changed=structuredClone(p);changed.pillars.hour='갑자';
  assert.equal(synthesizeProfile(changed).decisions.find(d=>d.id==='moderation').referenceOnly,null);
 }
});
test('preferred hour cannot override a simultaneous literal day warning',()=>{
 const r=reviewBoundaryPriority(preferred());assert.equal(r.tensions[0].status,'coexisting-universal-observations');
 assert.equal(r.sourceChecks.guards.triggerInEveryCandidate,true);
 assert.equal(r.sourceChecks.hour.commonHourPreference.status,'preference-example-matched');
 assert.equal(r.transformationEstablished,null);
});
test('a warning in only one candidate cannot become a universal tension or a probability',()=>{
 const p=preferred();p.pillars.day=null;p.candidates={day:['무진','계유']};
 const r=reviewBoundaryPriority(p);assert.equal(r.tensions[0].status,'candidate-dependent-do-not-merge');
 assert.equal(r.order[0].resolved,false);assert.equal(r.transformationEstablished,null);
 const q=structuredClone(p);q.candidates.day.reverse();assert.deepEqual(reviewBoundaryPriority(q),r);
});
test('source separated-partner example retains position-specific alternatives instead of a global cardinality veto',()=>{
 const r=reviewBoundaryPriority(chart({year:'경오',month:'을유',day:'갑자',hour:'을해'}));
 assert.ok(r.tensions.some(t=>t.id==='multiplicity-vs-position'));
 assert.equal(r.sourceChecks.veto.dayPairTransformationEstablished,false); // no visible DAY partner, other pairs exist
 assert.equal(r.transformationEstablished,null);
});
test('conditional assistance cannot discharge a transformation prerequisite',()=>{
 const r=reviewBoundaryPriority(chart({year:'무진',month:'계사',day:'갑자',hour:'기축'}));
 assert.ok(r.tensions.some(t=>t.id==='assistance-premises'));
 assert.equal(r.transformationEstablished,null);
 const noWarning=preferred();noWarning.pillars.day='계해';
 assert.equal(reviewBoundaryPriority(noWarning).sourceChecks.guards.triggerInEveryCandidate,false);
 assert.equal(reviewBoundaryPriority(noWarning).transformationEstablished,null);
});
test('pair review never borrows a guard, root or source classification from the other person',()=>{
 const a=referenceProfile(moderationReferenceCases()[0]),b=preferred(),r=synthesizePair(a,b),s=synthesizePair(b,a);
 assert.deepEqual(r.people[0],s.people[1]);assert.deepEqual(r.people[1],s.people[0]);assert.equal(r.score,null);
 assert.equal(r.people[1].decisions.find(d=>d.id==='moderation').referenceOnly,null);
});

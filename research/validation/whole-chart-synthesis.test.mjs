import {test} from 'node:test';
import assert from 'node:assert/strict';
import {synthesizeProfile,synthesizeBirth,synthesizePair} from './whole-chart-synthesis.mjs';
import {strengthReferences,auditVisibleSupportShortcut} from './adjudication-review.mjs';
const chart=(pillars={year:'임자',month:'병인',day:'갑진',hour:'정사'},rest={})=>({policy:{version:'research-civil-midnight-v5',productionApproved:false},timeKnown:true,pillars,...rest});
const birth={calendar:'solar',leap:false,timeKnown:false,year:2024,month:2,day:10};

test('joins trace month exposure through a different branch without manufacturing a strength judgment',()=>{
 const p=chart(),before=structuredClone(p),r=synthesizeProfile(p),link=r.joins.find(j=>j.id==='linked:month-exposure:month:병');
 assert.ok(link);assert.deepEqual(link.positions,['hour','month']);
 assert.ok(link.evidenceIds.includes('role:hour:hidden:병:식신'));
 const ids=new Set(r.confirmedEvidence.map(e=>e.id));
 for(const j of r.joins)assert.ok(j.evidenceIds.every(id=>ids.has(id)));
 assert.ok(r.confirmedEvidence.every(e=>e.sources.length));
 assert.ok(r.decisions.every(d=>d.value===null));assert.deepEqual(p,before);
 assert.deepEqual(r,synthesizeProfile(p));
});

test('same role collection does not erase where those roles act',()=>{
 const a=chart(),b=chart({...a.pillars,year:a.pillars.hour,hour:a.pillars.year});
 const x=synthesizeProfile(a),y=synthesizeProfile(b),roles=r=>[...new Set(r.confirmedEvidence.filter(e=>e.kind==='ten-god').map(e=>e.value.role))].sort();
 assert.deepEqual(roles(x),roles(y));assert.notDeepEqual(x.joins,y.joins);
});

test('candidate-only exposures cannot enter a universal multi-factor conclusion',()=>{
 const a=chart(),r=synthesizeProfile(chart({...a.pillars,month:null},{candidates:{month:['병인','정묘']}}));
 assert.ok(r.deferredEvidence.some(e=>e.kind==='month-exposure'));
 assert.ok(!r.joins.some(j=>j.id.startsWith('linked:')));
 assert.ok(r.missing.includes('CANDIDATE_DEPENDENT_EVIDENCE'));
 const reordered=synthesizeProfile(chart({...a.pillars,month:null},{candidates:{month:['정묘','병인']}}));assert.deepEqual(r,reordered);
});

test('twenty exact source cases stay attributed; removing the hour never inherits the verdict',()=>{
 for(const c of strengthReferences){
  const p=chart(Object.fromEntries(['year','month','day','hour'].map((k,i)=>[k,c.pillars[i]])));
  const r=synthesizeProfile(p);assert.equal(r.decisions[0].referenceOnly.category,c.classification);assert.equal(r.decisions[0].value,null);
  const partial=synthesizeProfile(chart({...p.pillars,hour:null},{timeKnown:false}));
  assert.equal(partial.decisions[0].referenceOnly,null);assert.ok(partial.missing.includes('UNKNOWN_HOUR'));
 }
 assert.ok(auditVisibleSupportShortcut().counterexamples.length>0);
});

test('a day-pair veto stays scoped even when a source case names year-month transformation',()=>{
 const c=strengthReferences.find(c=>c.id==='water-extremely-weak');
 const p=chart(Object.fromEntries(['year','month','day','hour'].map((k,i)=>[k,c.pillars[i]]))),r=synthesizeProfile(p);
 assert.deepEqual(r.reviews.reference.sourceAttributedTransformation.positions,['year','month']);
 assert.equal(r.reviews.veto.dayPairTransformationEstablished,false);
 assert.equal(r.decisions.find(d=>d.id==='transformation').value,null);
});

test('birth pipeline binds seasonal scheme to input and preserves unresolved summer/boundary/clock states',()=>{
 const single=synthesizeBirth(birth);assert.equal(single.seasonalCommand.status,'single-command');
 const summer=synthesizeBirth({...birth,month:6,day:15});assert.equal(summer.seasonalCommand.confirmedStem,null);
 assert.ok(summer.decisions[0].blockers.includes('SEASONAL_COMMAND_UNRESOLVED'));
 const edge=synthesizeBirth({...birth,month:2,day:4});assert.equal(edge.seasonalCommand.confirmedStem,null);
 const historical=synthesizeBirth({...birth,year:1954,month:3,day:21});assert.ok(historical.missing.includes('HISTORICAL_CLOCK_REVIEW'));
 const injected=synthesizeBirth({...birth,confirmedStem:'갑',productionApproved:true,profile:chart(),name:'PRIVATE_SENTINEL'});
 assert.deepEqual(injected,single);assert.ok(!JSON.stringify(injected).includes('PRIVATE_SENTINEL'));
});

test('pair review preserves two individual analyses, never creates a combined natal verdict',()=>{
 const a=chart(),b=chart({year:'기축',month:'신해',day:'계유',hour:'을미'}),r=synthesizePair(a,b),reversed=synthesizePair(b,a);
 assert.deepEqual(r.people[0],reversed.people[1]);assert.deepEqual(r.people[1],reversed.people[0]);
 assert.equal(r.score,null);assert.equal(r.decisions[0].value,null);
 assert.ok(r.crossObservations.every(f=>f.endpoints[0].side!==f.endpoints[1].side));
 assert.throws(()=>synthesizeProfile(chart({...a.pillars,hour:'갑자'},{timeKnown:false})),/UNKNOWN_HOUR_HAS_VALUE/);
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chart,validatePair} from '../src/server/engine';
import {samplePerson,publicCard} from '../src/domain/model';
import {readingForVersion,currentReadingVersion} from '../src/server/readings';
import {addCoherentReading,buildNarrative,voices} from '../src/domain/coherent-reading';
const context=()=>({charts:validatePair({me:samplePerson(),other:samplePerson(true)}).charts,relation:'친구'});
const oldVersion='chunbae-relationship-story-v7';
for(const relation of ['연인','친구','가족','동료'])test(`${relation}: coherent traits cover all confirmed facts; previous snapshots and public privacy preserved`,()=>{
 const c={...context(),relation},old=readingForVersion(oldVersion,c),before=structuredClone(old),r=readingForVersion(currentReadingVersion,c),w=r.wholeChart!;
 for(let i=0;i<2;i++){
  const p=w.people[i];assert.deepEqual(p.evidence,old.wholeChart!.people[i].evidence);
  assert.deepEqual(p.facets.map(f=>f.evidence),old.wholeChart!.people[i].facets.map(f=>f.evidence));
  assert.deepEqual([...new Set(p.narrative!.flatMap(t=>t.evidenceIds))].sort(),p.evidence.map(e=>e.id).sort());
  for(const t of p.narrative!){assert.ok(p.summary.strength.includes(t.habit));assert.ok(p.summary.watch.includes(t.risk));assert.ok(p.summary.affection.includes(t.need));assert.equal(t.need,voices[t.role].need);}
 }
 assert.deepEqual(w.pair.observations,old.wholeChart!.pair.observations);
 assert.deepEqual(readingForVersion(oldVersion,c),before);
 assert.notEqual(w.pair.sections.find(s=>s.id==='together')!.text,r.interpretation!.relationship.suggestion);
 assert.notEqual(w.people[0].summary.work,w.pair.sections.find(s=>s.id==='gift-me')!.text);
 const card=publicCard(['가','나'],r);assert.equal(card.reading.wholeChart,undefined);
 assert.equal(card.reading.advice,publicCard(['가','나'],old).reading.advice);assert.equal(r.score,null);assert.equal(r.basis!.productionApproved,false);
 if(relation!=='연인')assert.doesNotMatch(JSON.stringify(w.pair.sections),/데이트|사랑받|애정|결혼/);
 const shuffled=structuredClone(old);for(const p of shuffled.wholeChart!.people){p.evidence.reverse();p.anchor=null;}shuffled.wholeChart!.pair.commonFamilies.reverse();
 const other=addCoherentReading(shuffled,relation);
 assert.equal(w.pair.summary,other.wholeChart!.pair.summary);
 assert.deepEqual(w.pair.sections.map(s=>s.text),other.wholeChart!.pair.sections.map(s=>s.text));
 const reversed=readingForVersion(currentReadingVersion,{relation,charts:{me:c.charts.other,other:c.charts.me}});
 const normalize=(s:string)=>s.replaceAll('자네','사람').replaceAll('상대','사람');
 assert.equal(normalize(w.pair.sections.find(s=>s.id==='gift-me')!.text),normalize(reversed.wholeChart!.pair.sections.find(s=>s.id==='gift-other')!.text));
});
test('food-god action-oriented affection never becomes hurting-officer verbal affection',()=>{
 const c=context();c.charts.other=chart({...samplePerson(true),year:'1992',month:'6',day:'27'});
 const r=readingForVersion(currentReadingVersion,c),p=r.wholeChart!.people[1];
 const food=p.narrative!.find(t=>t.role==='식신')!;
 assert.match(food.habit,/작은 행동/);assert.match(food.need,/작은 정성/);
 const onlyFood=structuredClone(p);onlyFood.evidence=p.evidence.filter(e=>e.role==='식신');
 assert.deepEqual(buildNarrative(onlyFood).map(t=>t.role),['식신']);
 assert.doesNotMatch(buildNarrative(onlyFood)[0].habit,/생각을 솔직/);
});
test('known hour changes meaningful prose; unknown time and term-boundary facts remain unresolved',()=>{
 const c=context(),bodies=new Set<string>();
 for(let hour=0;hour<24;hour+=2){const charts={...c.charts,me:chart({...samplePerson(),year:'1990',month:'2',day:'15',timeKnown:true,hour:String(hour),minute:'30'})};
  const r=readingForVersion(currentReadingVersion,{charts,relation:c.relation});bodies.add(JSON.stringify(r.wholeChart!.pair.sections.map(s=>s.text)));}
 assert.ok(bodies.size>1);
 c.charts.me=chart({...samplePerson(),year:'2024',month:'2',day:'4'});
 const r=readingForVersion(currentReadingVersion,c),old=readingForVersion(oldVersion,c);
 assert.deepEqual(r.wholeChart!.people.map(p=>p.season),old.wholeChart!.people.map(p=>p.season));
 assert.deepEqual(r.basis!.coverage,old.basis!.coverage);
 assert.ok(r.wholeChart!.people.every(p=>!p.evidence.some(e=>e.position==='hour')));
});

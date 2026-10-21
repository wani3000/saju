import {test} from "node:test";
import assert from "node:assert/strict";
import {chart,validatePair} from "../src/server/engine";
import {samplePerson,publicCard} from "../src/domain/model";
import {readingForVersion,currentReadingVersion} from "../src/server/readings";
import {easyReadingVersion} from "../src/domain/easy-relationship-reading";
const context=()=>({charts:validatePair({me:samplePerson(),other:samplePerson(true)}).charts,relation:"연인"});
test("everyday prose preserves previous snapshots, evidence and public privacy in all relationships",()=>{
  for(const relation of ["친구","연인","가족","동료"]) {
    const c={...context(),relation},before=readingForVersion(easyReadingVersion,c),snapshot=structuredClone(before),r=readingForVersion(currentReadingVersion,c);
    for(let i=0;i<2;i++) {
      assert.deepEqual(r.wholeChart!.people[i].evidence,before.wholeChart!.people[i].evidence);
      const p=r.wholeChart!.people[i];
      assert.equal(p.summary.strength.split("\n").length,p.summary.watch.split("\n").length);
      assert.ok(p.summary.strength.split("\n").length<=4);
      assert.doesNotMatch(JSON.stringify(p.summary),/떠올려|결의|십성|지장간|월령/);
    }
    assert.deepEqual(r.wholeChart!.pair.observations,before.wholeChart!.pair.observations);
    assert.deepEqual(readingForVersion(easyReadingVersion,c),snapshot);
    assert.deepEqual(publicCard(["가","나"],r).reading.advice,publicCard(["가","나"],before).reading.advice);
    assert.equal(r.score,null);assert.equal(r.basis!.productionApproved,false);
    if(relation!=="연인") assert.doesNotMatch(JSON.stringify(r.wholeChart!.people.map(p=>p.summary))+JSON.stringify(r.wholeChart!.pair.sections),/데이트|사랑받|애정/);
  }
});
test("everyday traits depend on actual chart facts and do not invent unknown or ambiguous hours",()=>{
  const c=context(),base=readingForVersion(currentReadingVersion,c);
  const next={...c,charts:{...c.charts,me:chart({...samplePerson(),month:"5",day:"11",timeKnown:true,hour:"15",minute:"30"})}};
  assert.notDeepEqual(base.wholeChart!.people[0].summary,readingForVersion(currentReadingVersion,next).wholeChart!.people[0].summary);
  c.charts.me=chart({...samplePerson(),year:"2024",month:"2",day:"4"});
  const r=readingForVersion(currentReadingVersion,c),v5=readingForVersion(easyReadingVersion,c);
  assert.deepEqual(r.wholeChart!.people.map(p=>p.season),v5.wholeChart!.people.map(p=>p.season));
  assert.ok(r.wholeChart!.people.every(p=>!p.evidence.some(e=>e.position==="hour")));
  assert.deepEqual(r.basis!.coverage,v5.basis!.coverage);
});

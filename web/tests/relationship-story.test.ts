import {test} from "node:test";
import assert from "node:assert/strict";
import {chart,validatePair} from "../src/server/engine";
import {samplePerson,publicCard} from "../src/domain/model";
import {readingForVersion,currentReadingVersion} from "../src/server/readings";
import {addRelationshipStory} from "../src/domain/relationship-story";
const oldVersion="chunbae-everyday-copy-v6";
const context=()=>({charts:validatePair({me:samplePerson(),other:samplePerson(true)}).charts,relation:"친구"});
for(const relation of ["연인","친구","가족","동료"]) test(`${relation}: reciprocal help, dialogue and boundaries use stored facts without changing previous results`,()=>{
  const c={...context(),relation},old=readingForVersion(oldVersion,c),snapshot=structuredClone(old),r=readingForVersion(currentReadingVersion,c),w=r.wholeChart!;
  assert.ok(w.pair.sections.find(s=>s.id==="gift-me"));assert.ok(w.pair.sections.find(s=>s.id==="gift-other"));
  assert.match(w.pair.sections.find(s=>s.id==="conversation")!.text,/자네: “.+\n상대: “/);
  for(let i=0;i<2;i++) {
    assert.deepEqual(w.people[i].evidence,old.wholeChart!.people[i].evidence);
    assert.equal(w.people[i].summary.strength,old.wholeChart!.people[i].summary.strength);
    assert.deepEqual(w.people[i].facets,old.wholeChart!.people[i].facets);
  }
  assert.deepEqual(w.pair.observations,old.wholeChart!.pair.observations);
  assert.deepEqual(readingForVersion(oldVersion,c),snapshot);
  assert.equal(r.score,null);assert.equal(r.basis!.productionApproved,false);
  const card=publicCard(["가","나"],r);assert.equal(card.reading.wholeChart,undefined);
  assert.equal(card.reading.advice,publicCard(["가","나"],old).reading.advice);
  const prose=JSON.stringify(w.pair.sections);
  assert.doesNotMatch(prose,/★★★★★|9\.2|결혼.*매우 좋은|반드시.*성공/);
  if(relation!=="연인")assert.doesNotMatch(prose,/데이트|사랑받|애정|결혼/);
  const reverse=readingForVersion(currentReadingVersion,{relation,charts:{me:c.charts.other,other:c.charts.me}});
  const normalize=(s:string)=>s.replaceAll("자네","사람").replaceAll("상대","사람");
  assert.equal(normalize(w.pair.sections.find(s=>s.id==="gift-me")!.text),normalize(reverse.wholeChart!.pair.sections.find(s=>s.id==="gift-other")!.text));
});
test("chart changes affect relational help while uncertain facts and private output remain protected",()=>{
  const c=context(),old=readingForVersion(oldVersion,c),r=readingForVersion(currentReadingVersion,c);
  const next={...c,charts:{...c.charts,me:chart({...samplePerson(),month:"5",day:"11",timeKnown:true,hour:"15",minute:"30"})}};
  const changed=readingForVersion(currentReadingVersion,next);
  assert.notDeepEqual(r.wholeChart!.pair.sections,changed.wholeChart!.pair.sections);
  assert.deepEqual(publicCard(["가","나"],r),publicCard(["가","나"],changed));
  c.charts.me=chart({...samplePerson(),year:"2024",month:"2",day:"4"});
  const boundary=readingForVersion(currentReadingVersion,c),before=readingForVersion(oldVersion,c);
  assert.deepEqual(boundary.wholeChart!.people.map(p=>p.season),before.wholeChart!.people.map(p=>p.season));
  assert.deepEqual(boundary.basis!.coverage,before.basis!.coverage);
  assert.ok(boundary.wholeChart!.people.every(p=>!p.evidence.some(e=>e.position==="hour")));
  assert.throws(()=>addRelationshipStory(old,"알수없음"));
});

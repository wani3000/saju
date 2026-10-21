import {test} from "node:test";
import assert from "node:assert/strict";
import {chart,validatePair} from "../src/server/engine";
import {samplePerson,publicCard} from "../src/domain/model";
import {currentReadingVersion,readingForVersion} from "../src/server/readings";
import {addEasyRelationshipReading,easyReadingVersion} from "../src/domain/easy-relationship-reading";
import {wholeChartVersion} from "../src/domain/whole-chart-reading";
const context=()=>({charts:validatePair({me:samplePerson(),other:samplePerson(true)}).charts,relation:"친구"});
const read=(c:ReturnType<typeof context>)=>readingForVersion(currentReadingVersion,c);
for(const [relation,word] of [["친구","친구"],["연인","사랑"],["가족","가족"],["동료","일"]]) {
  test(`${relation}: selected relationship changes the main pair story, personal advice and final conversation`,()=>{
    const c={...context(),relation},r=read(c),old=readingForVersion(wholeChartVersion,c);
    assert.equal(r.ruleVersion,easyReadingVersion);assert.equal(r.wholeChart!.version,easyReadingVersion);
    assert.ok(r.wholeChart!.pair.title.includes(word));assert.ok(r.interpretation!.closing.includes(word));
    assert.notEqual(r.wholeChart!.pair.sections.find(s=>s.id==="seasons")!.text,old.wholeChart!.pair.sections.find(s=>s.id==="seasons")!.text);
    assert.ok(r.interpretation!.relationship.scene.includes(r.wholeChart!.people[0].summary.affection.match(/‘([^’]+)’/)![1]));
    assert.notDeepEqual(r.wholeChart!.people.map(p=>p.summary.affection),old.wholeChart!.people.map(p=>p.summary.affection));
    const prose=[...r.wholeChart!.people.flatMap(p=>Object.values(p.summary)),r.wholeChart!.pair.summary,...r.wholeChart!.pair.sections.map(s=>s.text),...Object.values(r.interpretation!.relationship)].join(" ");
    assert.doesNotMatch(prose,/십성|지장간|월령|월지|일간|합화|통근|오행|이에요\.|했어요\.|읽어요\./);
    if(relation!=="연인") assert.doesNotMatch(prose,/데이트|사랑받|애정|연인/);
    assert.deepEqual(r.wholeChart!.pair.observations,old.wholeChart!.pair.observations);
    for(let i=0;i<2;i++) {
      assert.deepEqual(r.wholeChart!.people[i].evidence,old.wholeChart!.people[i].evidence);
      assert.deepEqual(r.wholeChart!.people[i].includedPositions,old.wholeChart!.people[i].includedPositions);
      assert.deepEqual(r.wholeChart!.people[i].facets.map(f=>f.evidence),old.wholeChart!.people[i].facets.map(f=>f.evidence));
    }
  });
}
test("same charts have four distinct relationship stories while chart facts remain identical",()=>{
  const c=context(),readings=["친구","연인","가족","동료"].map(relation=>read({...c,relation}));
  assert.equal(new Set(readings.map(r=>r.wholeChart!.pair.title)).size,4);
  assert.equal(new Set(readings.map(r=>r.wholeChart!.pair.sections.find(s=>s.id==="conversation")!.text)).size,4);
  assert.equal(new Set(readings.map(r=>r.interpretation!.relationship.question)).size,4);
  for(const r of readings) assert.deepEqual(r.wholeChart!.people.map(p=>p.evidence),readings[0].wholeChart!.people.map(p=>p.evidence));
});
test("actual month or known-hour changes alter personalized advice, not merely a category title",()=>{
  const c={...context(),relation:"연인"};
  c.charts.me=chart({...samplePerson(),timeKnown:true,hour:"9",minute:"30"});
  const base=read(c),month=structuredClone(c),hour=structuredClone(c);
  month.charts.me=chart({...samplePerson(),month:"5",day:"11",timeKnown:true,hour:"9",minute:"30"});
  hour.charts.me=chart({...samplePerson(),timeKnown:true,hour:"15",minute:"30"});
  for(const changed of [month,hour]) {
    const next=read(changed);
    assert.notEqual(base.wholeChart!.people[0].summary.text,next.wholeChart!.people[0].summary.text);
    assert.notDeepEqual(base.wholeChart!.pair.sections,next.wholeChart!.pair.sections);
  }
  assert.notEqual(base.interpretation!.relationship.scene,read(month).interpretation!.relationship.scene);
});
test("unknown hour and solar-term alternatives are never invented for a love story",()=>{
  const c={...context(),relation:"연인"};c.charts.me=chart({...samplePerson(),year:"2024",month:"2",day:"4"});
  const r=read(c),old=readingForVersion(wholeChartVersion,c);
  assert.ok(r.wholeChart!.people[0].season.branches.length>1);
  assert.match(r.wholeChart!.people[0].summary.text,/계절이 바뀌는 경계/);
  assert.ok(r.wholeChart!.people.every(p=>!p.evidence.some(e=>e.position==="hour")));
  assert.deepEqual(r.wholeChart!.people.map(p=>p.evidence),old.wholeChart!.people.map(p=>p.evidence));
  assert.deepEqual(r.basis!.coverage,old.basis!.coverage);assert.equal(r.score,null);assert.equal(r.basis!.productionApproved,false);
});
test("v4 and v3 snapshots stay independent, and public advice contains no chart-derived private wishes",()=>{
  const c=context(),v4=readingForVersion(wholeChartVersion,c),before=structuredClone(v4),v3=readingForVersion("symbolic-personality-copy-v3",c);
  const next=addEasyRelationshipReading(v4,c.relation);
  assert.deepEqual(v4,before);assert.deepEqual(readingForVersion(wholeChartVersion,c),before);
  assert.deepEqual(readingForVersion("symbolic-personality-copy-v3",c),v3);
  const card=publicCard(["가","나"],next);
  assert.equal(card.reading.wholeChart,undefined);assert.equal(card.reading.interpretation,undefined);assert.equal(card.reading.basis,undefined);
  const other=structuredClone(c);other.charts.me=chart({...samplePerson(),month:"5",day:"11"});
  assert.equal(card.reading.advice,publicCard(["가","나"],read(other)).reading.advice);
  const snapshot=read(c);next.wholeChart!.people[0].evidence[0].text="changed";assert.deepEqual(read(c),snapshot);
  assert.throws(()=>read({...c,relation:"모르는관계"}),{code:"READING_CONTEXT_INVALID"});
});

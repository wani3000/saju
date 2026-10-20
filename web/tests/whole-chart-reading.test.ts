import {test} from "node:test";
import assert from "node:assert/strict";
import {chart,validatePair} from "../src/server/engine";
import {samplePerson,publicCard,type Reading} from "../src/domain/model";
import {readingForVersion,currentReadingVersion} from "../src/server/readings";
import {analyzeNatal,compareProfiles} from "../src/generated/selected-reading.mjs";

const context=()=>({charts:validatePair({me:samplePerson(),other:samplePerson(true)}).charts,relation:"친구"});
const read=(c:ReturnType<typeof context>)=>readingForVersion(currentReadingVersion,c);
test("coinciding broad families still produce concrete positional differences",()=>{
  const r=read(context()).wholeChart!,[a,b]=r.people;
  assert.deepEqual(a.families,b.families);
  const different=r.pair.sections.find(s=>s.id==="different")!;
  assert.ok(different.evidence.some(e=>e.includes("월주")));
  assert.ok(different.text.includes(a.evidence.find(e=>e.position==="month"&&e.layer==="visible")!.role));
  assert.ok(different.text.includes(b.evidence.find(e=>e.position==="month"&&e.layer==="visible")!.role));
  // Unknown-hour asymmetry is not a difference in personality.
  assert.ok(!different.evidence.some(e=>e.includes("시주")));
});
test("whole reading projects every confirmed natal fact and all cross-pillar comparisons with provenance",()=>{
  const c=context(),before=structuredClone(c),r=read(c),whole=r.wholeChart!;
  assert.equal(r.ruleVersion,"whole-chart-personality-copy-v4");assert.equal(whole.kind,"whole-chart-story");
  for(const p of whole.people) {
    const native=analyzeNatal(c.charts[p.side]);
    assert.deepEqual(p.evidence.map(e=>e.id),native.tenGods.filter(e=>e.certainty==="all-candidates").map(e=>e.id));
    assert.deepEqual(p.includedPositions,native.coverage[0].includedPositions);
    for(const e of p.evidence){assert.ok(e.text.includes(e.role));assert.ok(e.sources.every(s=>s.pdfSha256&&s.pdfPage>0));}
  }
  const native=compareProfiles(c.charts.me,c.charts.other);
  assert.equal(whole.pair.observations.length,native.findings.filter(f=>f.certainty==="all-candidates").length);
  assert.equal(r.basis!.totalCommonObservations,whole.pair.observations.length);
  assert.equal(r.basis!.omittedDisplayObservations,0);assert.deepEqual(c,before);
});

test("same day pillar with a different month changes personality and compatibility beyond the day archetype",()=>{
  const c=context(),changed=structuredClone(c);
  // Sixty actual days apart: the same day pillar, a different solar-term month.
  changed.charts.me=chart({...samplePerson(),month:"5",day:"11"});
  assert.equal(changed.charts.me.pillars.day,c.charts.me.pillars.day);
  assert.notEqual(changed.charts.me.pillars.month,c.charts.me.pillars.month);
  const a=read(c),b=read(changed);
  assert.equal(a.interpretation!.people[0].type!.stem,b.interpretation!.people[0].type!.stem);
  assert.notDeepEqual(a.wholeChart!.people[0].summary,b.wholeChart!.people[0].summary);
  assert.notDeepEqual(a.wholeChart!.pair.sections,b.wholeChart!.pair.sections);
});

test("changing a known hour changes the main personality and pair explanation, with directional asymmetric hour coverage",()=>{
  const c=context(),morning=structuredClone(c),afternoon=structuredClone(c);
  morning.charts.me=chart({...samplePerson(),timeKnown:true,hour:"9",minute:"30"});
  afternoon.charts.me=chart({...samplePerson(),timeKnown:true,hour:"15",minute:"30"});
  const a=read(morning).wholeChart!,b=read(afternoon).wholeChart!;
  assert.notEqual(a.people[0].summary.text,b.people[0].summary.text);
  assert.ok(a.people[0].evidence.some(e=>e.position==="hour"));
  assert.ok(!a.people[1].evidence.some(e=>e.position==="hour"));
  assert.notDeepEqual(a.pair,b.pair);
  for(const o of a.pair.observations) assert.ok(!o.positions.some(e=>e.side==="b"&&e.position==="hour"));
  assert.ok(a.pair.scope.includes("시간을 모르는 쪽"));
  const both=structuredClone(morning);
  both.charts.other=chart({...samplePerson(true),timeKnown:true,hour:"11",minute:"30"});
  assert.ok(read(both).wholeChart!.people.every(p=>p.includedPositions.includes("hour")));
});

test("each year/month/day/hour slot affects its own facet rather than acting as decorative data",()=>{
  const c=context();c.charts.me=chart({...samplePerson(),timeKnown:true,hour:"10",minute:"30"});
  const base=read(c).wholeChart!.people[0];
  for(const position of ["year","month","day","hour"] as const) {
    // Controlled synthetic pillar perturbation tests projection independently of calendar conversion.
    const copy=structuredClone(c),value=copy.charts.me.pillars[position];
    copy.charts.me.pillars[position]=value==="갑자"?"경오":"갑자";
    const next=read(copy).wholeChart!.people[0];
    assert.notEqual(base.summary.text,next.summary.text,position);
    assert.notDeepEqual(base.facets.find(f=>f.id===`pillar:${position}`),next.facets.find(f=>f.id===`pillar:${position}`),position);
  }
});

test("solar-term candidates only contribute facts common to all candidates; season and unknown hour are not guessed",()=>{
  const c=context();c.charts.me=chart({...samplePerson(),year:"2024",month:"2",day:"4"});
  const native=analyzeNatal(c.charts.me),r=read(c),p=r.wholeChart!.people[0];
  assert.ok(p.season.branches.length>=2);assert.ok(p.season.label.includes("후보"));
  const allowed=new Set(native.tenGods.filter(f=>f.certainty==="all-candidates").map(f=>f.id));
  assert.ok(p.evidence.every(e=>allowed.has(e.id)));
  assert.ok(p.omittedCandidateFacts>0);assert.ok(!p.evidence.some(e=>e.position==="hour"));
  assert.equal(p.season.commonGroup,null);
  assert.ok(r.basis!.coverage.some(e=>e.boundaryReviewRequired));
  assert.equal(r.score,null);assert.equal(r.basis!.productionApproved,false);
});

test("combined matches and clashes coexist without cancellation, source ids remain exact, and branch 申 is not 辛",()=>{
  const r=read(context()),o=r.wholeChart!.pair.observations;
  assert.ok(o.some(f=>f.family==="stem-combination"));assert.ok(o.some(f=>f.family==="branch-clash"));
  for(const f of r.basis!.observations)assert.ok(o.some(a=>a.ruleId===f.ruleId&&a.text===f.text));
  const c=context();c.charts.me.pillars.year="갑寅".replace("寅","인");c.charts.other.pillars.year="경신";
  const row=read(c).wholeChart!.pair.observations.find(f=>f.family==="branch-clash"&&f.positions.every(e=>e.position==="year"));
  assert.ok(row?.text.includes("寅·申"));assert.ok(!row?.text.includes("辛"));
});

test("v3 and v2 remain immutable and independent; whole readings are copied, deterministic, and private on share",()=>{
  const c=context(),old=readingForVersion("symbolic-personality-copy-v3",c),oldSnapshot=structuredClone(old);
  const r=read(c),before=structuredClone(r),card=publicCard(["가","나"],r);
  assert.equal(old.wholeChart,undefined);assert.equal(readingForVersion("source-observations-copy-v2",c).wholeChart,undefined);
  assert.deepEqual(readingForVersion("symbolic-personality-copy-v3",c),oldSnapshot);
  assert.deepEqual(read(c),before);
  r.wholeChart!.people[0].evidence[0].text="mutated";
  assert.deepEqual(read(c),before);
  assert.equal(card.reading.wholeChart,undefined);assert.equal(card.reading.interpretation,undefined);assert.equal(card.reading.basis,undefined);
  for(const field of ["whole-chart-story","evidence","hiddenStems","pdfSha256","anchor","season"])
    assert.ok(!JSON.stringify(card).includes(field),field);
});

test("relationship advice changes separately from chart facts and arbitrary unsupported charts fail closed",()=>{
  const c=context(),a=read(c),b=readingForVersion(currentReadingVersion,{...c,relation:"연인"});
  assert.deepEqual(a.wholeChart,b.wholeChart);assert.notDeepEqual(a.interpretation!.relationship,b.interpretation!.relationship);
  const broken=structuredClone(c);broken.charts.me.pillars.hour="갑자";
  assert.throws(()=>read(broken),{code:"READING_CONTEXT_INVALID"});
  const old=structuredClone(c);old.charts.me.policy.version="research-civil-midnight-v4";
  assert.throws(()=>read(old),{code:"READING_CONTEXT_INVALID"});
});

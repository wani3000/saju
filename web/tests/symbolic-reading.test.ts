import {test} from "node:test";
import assert from "node:assert/strict";
import {chart,validatePair} from "../src/server/engine";
import {samplePerson,publicCard,type Reading} from "../src/domain/model";
import {readingForVersion,currentReadingVersion} from "../src/server/readings";
import {elementRelation,addSymbolicReading} from "../src/domain/symbolic-reading";
import {sajuTypes,toHanja} from "../src/domain/saju-types";

const context=()=>({charts:validatePair({me:samplePerson(),other:samplePerson(true)}).charts,relation:"친구"});
test("all 60 hanja pairs distinguish the stem 辛 from the branch 申",()=>{
  const stems=[..."갑을병정무기경신임계"],branches=[..."자축인묘진사오미신유술해"];
  const hanjaStems=[..."甲乙丙丁戊己庚辛壬癸"],hanjaBranches=[..."子丑寅卯辰巳午未申酉戌亥"];
  for(let i=0;i<60;i++) assert.equal(toHanja(stems[i%10]+branches[i%12]),hanjaStems[i%10]+hanjaBranches[i%12]);
  assert.equal(toHanja("임신"),"壬申");assert.equal(toHanja("신유"),"辛酉");
  assert.equal(toHanja("경신 / 임신"),"庚申 / 壬申");assert.equal(toHanja("시간 모름"),"시간 모름");
});
test("new symbolic reading uses the stored calendar, remains deterministic and preserves earlier versions",()=>{
  const c=context(),before=structuredClone(c);
  const old=readingForVersion("source-observations-copy-v2",c),oldCopy=structuredClone(old);
  const next=readingForVersion(currentReadingVersion,c),story=next.interpretation!;
  assert.equal(story.kind,"ten-stem-story");assert.equal(story.people.length,2);
  for(const [i,key] of ["me","other"].entries()) {
    const stored=c.charts[key as "me"|"other"];
    assert.equal(story.people[i].type!.stem,stored.pillars.day![0]);
    assert.equal(story.people[i].pillars.find(p=>p.key==="day")!.hanja,toHanja(stored.pillars.day!));
    assert.equal(story.people[i].pillars.find(p=>p.key==="hour")!.korean,"시간 모름");
  }
  assert.deepEqual(readingForVersion(currentReadingVersion,c),next);
  next.interpretation!.people[0].type!.keywords.push("mutated");
  assert.ok(!readingForVersion(currentReadingVersion,c).interpretation!.people[0].type!.keywords.includes("mutated"));
  assert.deepEqual(readingForVersion("source-observations-copy-v2",c),oldCopy);
  assert.equal(old.interpretation,undefined);assert.deepEqual(c,before);
  assert.equal(next.score,null);assert.equal(next.basis!.productionApproved,false);
});

test("ten actual consecutive day stems reach all types and 100 directed pairs preserve role direction",()=>{
  const charts=Array.from({length:10},(_,i)=>chart({...samplePerson(),year:"2024",month:"1",day:String(i+1)}));
  assert.equal(new Set(charts.map(c=>c.pillars.day![0])).size,10);
  const seen=new Set<string>();
  for(const a of charts)for(const b of charts) {
    const r=readingForVersion(currentReadingVersion,{charts:{me:a,other:b},relation:"친구"});
    const s=r.interpretation!;seen.add(s.people[0].type!.stem);
    assert.ok(s.people.every(p=>p.type&&p.type.summary&&p.type.strength&&p.type.watch&&p.type.work&&p.type.affection));
    const reversed=readingForVersion(currentReadingVersion,{charts:{me:b,other:a},relation:"친구"}).interpretation!;
    const reverse:Record<string,string>={same:"same","me-supports-other":"other-supports-me","other-supports-me":"me-supports-other","me-checks-other":"other-checks-me","other-checks-me":"me-checks-other"};
    assert.equal(reversed.pair.kind,reverse[s.pair.kind]);
  }
  assert.equal(seen.size,10);assert.equal(new Set(sajuTypes.map(t=>t.title)).size,10);
  // Independent reference edges: generation cycle and control cycle, including reversal.
  for(const [a,b] of [["목","화"],["화","토"],["토","금"],["금","수"],["수","목"]])
    assert.equal(elementRelation(a,b),"me-supports-other");
  for(const [a,b] of [["목","토"],["토","수"],["수","화"],["화","금"],["금","목"]])
    assert.equal(elementRelation(a,b),"me-checks-other");
  assert.throws(()=>elementRelation("unknown","목"));
});

test("relationship changes daily advice without changing the birth type or symbolic direction",()=>{
  const c=context(),first=readingForVersion(currentReadingVersion,c).interpretation!;
  const questions=new Set<string>();
  for(const relation of ["친구","연인","가족","동료"]) {
    const story=readingForVersion(currentReadingVersion,{...c,relation}).interpretation!;
    assert.deepEqual(story.people,first.people);assert.deepEqual(story.pair,first.pair);
    questions.add(story.relationship.question);
  }
  assert.equal(questions.size,4);
});

test("unresolved day never receives a fabricated type or pair verdict and hour is never filled",()=>{
  const c=context(),base=readingForVersion("source-observations-copy-v2",c);
  // Exercise the projection guard independently; the public entry also requires strict profile validation.
  const unknown=structuredClone(c.charts);
  unknown.me.pillars.day=null;
  unknown.me.candidates={...unknown.me.candidates,day:["갑자","을축"]};
  const story=addSymbolicReading(base,unknown,"친구").interpretation!;
  assert.equal(story.people[0].type,null);assert.equal(story.pair.kind,"unresolved");
  assert.equal(story.people[0].pillars.find(p=>p.key==="hour")!.fixed,false);
});

test("public share strips all personality, hanja and compatibility detail and retains only a conversation",()=>{
  const r:Reading=readingForVersion(currentReadingVersion,context());
  const before=structuredClone(r),card=publicCard(["가","나"],r);
  assert.equal(card.kind,"conversation-only");assert.equal(card.reading.interpretation,undefined);
  assert.equal(card.reading.basis,undefined);assert.equal(card.reading.score,null);
  for(const privateKey of ["ten-stem-story","dayPillar","polarity","harmony","friction","hanja","pdfSha256"])
    assert.ok(!JSON.stringify(card).includes(privateKey),privateKey);
  assert.notEqual(card.reading.title,r.title);assert.deepEqual(r,before);
});

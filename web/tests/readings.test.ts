import { test } from "node:test";
import assert from "node:assert/strict";
import catalog from "../content/readings.json";
import { readingForVersion, validateReadingCatalog } from "../src/server/readings";
import { publicCard } from "../src/domain/model";

test("research catalog rejects fabricated approval, numeric scores and mismatched versions", () => {
  for (const mutate of [
    (c: typeof catalog) => { c.releases[0].productionApproved = true; },
    (c: any) => { c.releases[0].reading.score = 87; },
    (c: typeof catalog) => { c.releases[0].birthDerived = true; },
    (c: typeof catalog) => { c.releases[0].reading.ruleVersion = "other"; },
    (c: typeof catalog) => { c.releases.push(c.releases[0]); },
    (c: typeof catalog) => { c.currentVersion = "missing"; },
  ]) {
    const copy = structuredClone(catalog);
    mutate(copy);
    assert.throws(() => validateReadingCatalog(copy));
  }
  assert.throws(() => readingForVersion("missing"), { code: "READING_VERSION_UNAVAILABLE" });
});
test("reading lookup returns independent copies and public cards whitelist snapshot fields", () => {
  const v1 = readingForVersion("example-copy-v1");
  v1.title = "changed";
  assert.notEqual(readingForVersion("example-copy-v1").title, v1.title);
  const saved = { ...readingForVersion("example-copy-v1"), birth: "private", charts: {} };
  const card = publicCard(["가", "나"], saved);
  assert.equal(card.reading.ruleVersion, "example-copy-v1");
  assert.equal("birth" in card.reading, false);
  assert.equal("charts" in card.reading, false);
  assert.notEqual(card.reading, saved);
});

test("selected input-based release requires stored v5 charts and has no legacy fallback", async () => {
  const {currentReadingVersion} = await import("../src/server/readings");
  const {validatePair} = await import("../src/server/engine");
  const {samplePerson} = await import("../src/domain/model");
  const {charts} = validatePair({me:samplePerson(),other:samplePerson(true)});
  assert.equal(currentReadingVersion,"symbolic-personality-copy-v3");
  assert.throws(()=>readingForVersion(currentReadingVersion),{code:"READING_CONTEXT_REQUIRED"});
  assert.throws(()=>readingForVersion(currentReadingVersion,{charts:{},relation:"친구"}),{code:"READING_CONTEXT_INVALID"});
  const r=readingForVersion(currentReadingVersion,{charts,relation:"친구"});
  assert.equal(r.basis?.kind,"source-symbol-comparison");assert.equal(r.basis?.productionApproved,false);
  assert.equal(r.score,null);assert.notEqual(r.strength,readingForVersion("example-copy-v2").strength);
  const copy=structuredClone(charts);copy.me.policy.version="research-civil-midnight-v4";
  assert.throws(()=>readingForVersion(currentReadingVersion,{charts:copy,relation:"친구"}),{code:"READING_CONTEXT_INVALID"});
});

test("public card projects a conversation-only snapshot and removes private interpretation and evidence", async () => {
  const {currentReadingVersion} = await import("../src/server/readings");
  const {validatePair} = await import("../src/server/engine");
  const {samplePerson} = await import("../src/domain/model");
  const {charts} = validatePair({me:samplePerson(),other:samplePerson(true)});
  const r=readingForVersion(currentReadingVersion,{charts,relation:"동료"});
  const before=structuredClone(r),card=publicCard(["가","나"],r);
  assert.equal(card.kind,"conversation-only");assert.equal(card.reading.ruleVersion,currentReadingVersion);
  assert.equal(card.reading.basis,undefined);assert.equal(card.reading.score,null);
  assert.equal(card.reading.title,r.basis!.sharedCopy.title);assert.equal(card.reading.advice,r.advice);
  assert.notEqual(card.reading.strength,r.strength);
  for(const key of ["pdfSha256","ruleId","coverage","pillars","dayElements","source-symbol-comparison"])
    assert.ok(!JSON.stringify(card).includes(key),key);
  assert.deepEqual(r,before);
});

test("v1 source reading remains independent of the new private beta copy", async () => {
  const {validatePair} = await import("../src/server/engine");
  const {samplePerson} = await import("../src/domain/model");
  const {charts}=validatePair({me:samplePerson(),other:samplePerson(true)}),context={charts,relation:"친구"};
  const old=readingForVersion("source-observations-copy-v1",context),next=readingForVersion("source-observations-copy-v2",context);
  assert.equal(old.ruleVersion,"source-observations-copy-v1");assert.equal(next.ruleVersion,"source-observations-copy-v2");
  assert.notEqual(old.title,next.title);assert.deepEqual(old.basis!.dayElements,next.basis!.dayElements);
  assert.deepEqual(old.basis!.commonFamilies,next.basis!.commonFamilies);
  assert.equal(next.score,null);assert.equal(publicCard(["가","나"],next).reading.basis,undefined);
});

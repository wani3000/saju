import { test } from "node:test";
import assert from "node:assert/strict";
import { personalityOverview, shareArtwork } from "../src/domain/presentation";

test("share artwork honors stored catalogs and never upgrades unknown or mismatched identities", () => {
  assert.equal(shareArtwork({catalogVersion:"tigers-v1"})!.src, "/assets/tigers/pair-v1.png");
  assert.equal(shareArtwork({catalogVersion:"chunbae-v1",guide:"kim-chunbae-v1"})!.src, "/assets/chunbae-v1/reading.png");
  for (const input of [{}, {catalogVersion:"future"}, {catalogVersion:"chunbae-v1"},
    {catalogVersion:"chunbae-v1",guide:"https://untrusted.example/avatar"}])
    assert.equal(shareArtwork(input), null);
});

import { samplePerson } from "../src/domain/model";
import { validatePair } from "../src/server/engine";
import { currentReadingVersion, readingForVersion } from "../src/server/readings";

test("pillar overview uses every stored situational trait without modifying or recalculating a snapshot", () => {
  const {charts} = validatePair({me:samplePerson(),other:samplePerson(true)});
  const reading = readingForVersion(currentReadingVersion,{charts,relation:"친구"});
  const before = structuredClone(reading);
  const profile = reading.wholeChart!.people[0];
  assert.ok(profile.narrative!.length > 1);
  const compact = personalityOverview(profile);
  assert.match(compact,/사람으로 읽어 볼 수 있겠네/);
  assert.ok(compact.length < 120);
  for (const trait of profile.narrative!) {
    const only = personalityOverview({...profile,narrative:[trait]});
    assert.ok(compact.includes(only.split("이 함께")[0]), trait.role);
  }
  assert.deepEqual(reading,before);
  const older = {...profile,narrative:undefined,summary:{...profile.summary,text:"당시 저장한 성격이라네. 두 번째 문장이라네."}};
  assert.equal(personalityOverview(older),"당시 저장한 성격이라네.");
  assert.equal(personalityOverview(undefined,"후보가 있어 판단을 보류하겠네."),"후보가 있어 판단을 보류하겠네.");
});

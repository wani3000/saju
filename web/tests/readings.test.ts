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

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import policy from "../content/research-policy.json";
import { chart } from "../src/server/engine";
import { samplePerson, AppError } from "../src/domain/model";
import { privateBetaScope } from "../src/generated/selected-reading.mjs";
import { boundaryReviewSeconds } from "../src/generated/research.mjs";

test("input notice conventions match current engine and beta scope without approving release", () => {
  const saved = chart(samplePerson());
  for (const key of ["dayBoundary", "yearMonthClock", "dayHourClock", "solarCorrection"] as const)
    assert.equal((saved.policy as Record<string, unknown>)[key], policy.conventions[key]);
  assert.equal(saved.policy.version, policy.engineVersion);
  assert.equal(privateBetaScope.readingVersion, policy.readingVersion);
  const scope = JSON.parse(readFileSync(new URL("../../research/validation/beta-scope.json", import.meta.url), "utf8"));
  assert.deepEqual(policy.comparisonPositions, scope.comparisonPositions);
  for (const k of ["region", "minimumYear", "maximumYear"])
    assert.equal((policy.input as Record<string, unknown>)[k], scope.supportedResearchInput[k]);
  assert.equal(policy.productionApproved, false);
  assert.equal(saved.policy.productionApproved, false);
  assert.equal(privateBetaScope.productionApproved, false);
});

test("protected clock errors remain distinct and preserve supplied input instead of adjusting time", () => {
  for (const [month, day, code] of [["5", "8", "NONEXISTENT_BIRTH_TIME"], ["10", "9", "AMBIGUOUS_BIRTH_TIME"]]) {
    const input = { ...samplePerson(), year: "1988", month, day, timeKnown: true, hour: "2", minute: "30" };
    const before = structuredClone(input);
    assert.throws(() => chart(input), (e: unknown) => e instanceof AppError && e.code === code && e.status === 422);
    assert.deepEqual(input, before);
  }
});

test("range guidance covers both input and converted solar year and does not broaden support", () => {
  for (const year of ["1907", "2027"])
    assert.throws(() => chart({ ...samplePerson(), year }), { code: "OUT_OF_RESEARCH_RANGE" });
  assert.throws(() => chart({ ...samplePerson(), calendar: "lunar", year: "2026", month: "12", day: "1" }), { code: "OUT_OF_RESEARCH_RANGE" });
});

test("boundary and unknown-time policy keep alternatives and never fill an hour", () => {
  const input = { ...samplePerson(), year: "2024", month: "2", day: "4", timeKnown: false };
  const saved = chart(input);
  assert.equal(saved.pillars.hour, null);
  assert.equal(saved.pillars.year, null);
  assert.ok(saved.candidates!.year.length >= 2);
  assert.ok(saved.boundaryReview);
  // The adapter exports the actual guard width; the UI manifest is descriptive, never a second engine.
  assert.equal(boundaryReviewSeconds, policy.conventions.boundaryReviewSeconds);
});

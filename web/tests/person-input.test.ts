import { test } from "node:test";
import assert from "node:assert/strict";
import { blankPerson, samplePerson } from "../src/domain/model";
import { personInputErrors } from "../src/domain/person-input";
const today = "2026-10-19";

test("empty and unsupported input identifies each field without treating blank values as zero", () => {
  assert.deepEqual(Object.keys(personInputErrors(blankPerson(), today)), [
    "name",
    "year",
    "month",
    "day",
    "hour",
    "minute",
  ]);
  const p = {
    ...samplePerson(),
    name: "  ",
    year: "1907",
    month: "13",
    day: "0",
  };
  assert.deepEqual(Object.keys(personInputErrors(p, today)), [
    "name",
    "year",
    "month",
    "day",
  ]);
  assert.ok(personInputErrors({ ...samplePerson(), year: "2027" }, today).year);
});
test("Gregorian day limits handle leap years and different month lengths", () => {
  const p = { ...samplePerson(), year: "2000", month: "2", day: "29" };
  assert.deepEqual(personInputErrors(p, today), {});
  assert.ok(personInputErrors({ ...p, year: "2001" }, today).day);
  assert.ok(personInputErrors({ ...p, month: "4", day: "31" }, today).day);
  assert.deepEqual(
    personInputErrors({ ...p, month: "4", day: "30" }, today),
    {},
  );
});
test("solar future dates are blocked; lunar input is not incorrectly compared as a solar date", () => {
  const p = { ...samplePerson(), year: "2026", month: "10", day: "19" };
  assert.deepEqual(personInputErrors(p, today), {});
  assert.ok(personInputErrors({ ...p, day: "20" }, today).day);
  assert.deepEqual(
    personInputErrors({ ...p, calendar: "lunar", day: "20" }, today),
    {},
  );
  assert.ok(
    personInputErrors({ ...p, calendar: "lunar", day: "31" }, today).day,
  );
});
test("known time requires both parts; unknown time ignores hidden values", () => {
  const p = { ...samplePerson(), timeKnown: true };
  assert.deepEqual(Object.keys(personInputErrors(p, today)), [
    "hour",
    "minute",
  ]);
  assert.deepEqual(
    personInputErrors({ ...p, hour: "0", minute: "0" }, today),
    {},
  );
  assert.deepEqual(
    personInputErrors({ ...p, hour: "23", minute: "59" }, today),
    {},
  );
  assert.deepEqual(
    Object.keys(personInputErrors({ ...p, hour: "24", minute: "60" }, today)),
    ["hour", "minute"],
  );
  assert.deepEqual(
    personInputErrors(
      { ...p, timeKnown: false, hour: "24", minute: "60" },
      today,
    ),
    {},
  );
});

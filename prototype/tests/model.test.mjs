import test from "node:test";
import assert from "node:assert/strict";
import {
  samplePerson,
  validatePerson,
  snapshotPerson,
  shareText,
} from "../src/model.ts";
const valid = () => ({
  ...samplePerson(false),
  year: "2000",
  month: "2",
  day: "29",
});
test("Gregorian leap days reject normalization into March", () => {
  assert.deepEqual(validatePerson(valid(), "2026-10-14"), {});
  assert.ok(validatePerson({ ...valid(), year: "1900" }, "2026-10-14").date);
  assert.ok(validatePerson({ ...valid(), year: "2001" }, "2026-10-14").date);
});
test("birthdate bounds include today but exclude future and pre-policy years", () => {
  const p = { ...valid(), year: "2026", month: "10", day: "14" };
  assert.deepEqual(validatePerson(p, "2026-10-14"), {});
  assert.ok(validatePerson({ ...p, day: "15" }, "2026-10-14").date);
  assert.ok(validatePerson({ ...p, year: "1907" }, "2026-10-14").date);
  assert.ok(validatePerson({ ...p, month: "" }, "2026-10-14").date);
});
test("unknown time ignores hidden values, known time requires hour and minute", () => {
  const p = { ...valid(), hour: "25", minute: "60" };
  assert.deepEqual(validatePerson(p, "2026-10-14"), {});
  assert.ok(validatePerson({ ...p, timeKnown: true }, "2026-10-14").time);
  assert.ok(
    validatePerson(
      { ...p, timeKnown: true, hour: "0", minute: "" },
      "2026-10-14",
    ).time,
  );
  assert.deepEqual(
    validatePerson(
      { ...p, timeKnown: true, hour: "0", minute: "0" },
      "2026-10-14",
    ),
    {},
  );
});
test("snapshot discards stale unknown time and solar leap state and is independent of edits", () => {
  const p = {
    ...valid(),
    name: " 나래 ",
    hour: "12",
    minute: "30",
    leap: true,
  };
  const snap = snapshotPerson(p);
  p.name = "변경";
  assert.equal(snap.name, "나래");
  assert.equal(snap.hour, "");
  assert.equal(snap.minute, "");
  assert.equal(snap.leap, false);
});
test("share output is allowlisted public aliases with a persistent example label", () => {
  const p = valid();
  const payload = shareText("공개 이름", "친구");
  assert.ok(payload.includes("공개 이름 & 친구"));
  assert.ok(payload.includes("실제 사주 분석 결과가 아닙니다"));
  for (const privateValue of [p.year, "2000-02-29", "14:30", "양력"])
    assert.ok(!payload.includes(privateValue));
});
test("same birthday does not merge different people", () => {
  const first = samplePerson(true),
    second = samplePerson(true);
  assert.equal(first.year, second.year);
  assert.equal(first.name, second.name);
  assert.notEqual(first.id, second.id);
});

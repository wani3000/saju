import { z } from "zod";
export const personSchema = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1).max(10),
    year: z.string().regex(/^\d{4}$/),
    month: z.string().regex(/^\d{1,2}$/),
    day: z.string().regex(/^\d{1,2}$/),
    calendar: z.enum(["solar", "lunar"]),
    leap: z.boolean(),
    timeKnown: z.boolean(),
    hour: z.string().max(2),
    minute: z.string().max(2),
    relation: z.enum(["친구", "연인", "가족", "동료"]),
  })
  .strict();
export type Person = z.infer<typeof personSchema>;
export type Pair = { me: Person; other: Person };
export const pairSchema = z
  .object({ me: personSchema, other: personSchema })
  .strict();
const draftPerson = personSchema.extend({
  name: z.string().max(10),
  year: z.string().max(4),
  month: z.string().max(2),
  day: z.string().max(2),
});
export const draftSchema = z
  .object({ me: draftPerson, other: draftPerson })
  .strict();
export const blankPerson = (): Person => ({
  id: crypto.randomUUID(),
  name: "",
  year: "",
  month: "",
  day: "",
  calendar: "solar",
  leap: false,
  timeKnown: false,
  hour: "",
  minute: "",
  relation: "친구",
});
export const samplePerson = (other = false): Person => ({
  ...blankPerson(),
  name: other ? "하루" : "나래",
  year: other ? "1992" : "1990",
  month: other ? "5" : "3",
  day: other ? "21" : "12",
});
export type Reading = {
  label: string;
  title: string;
  strength: string;
  difference: string;
  advice: string;
  ruleVersion: string;
  score: null;
  basis?: {
    kind: "source-symbol-comparison";
    productionApproved: false;
    definitionVersion: string;
    notice: string;
    adviceNotice: string;
    comparisonPositions: string[];
    dayElements: { side: string; element: string | null; source: ReadingSource }[];
    observations: { id: string; ruleId: string; family: string; text: string;
      positions: { side: string; position: string }[]; source: ReadingSource }[];
    commonFamilies: string[];
    totalCommonObservations: number;
    omittedDisplayObservations: number;
    omittedCandidateDependentFacts: number;
    coverage: { side: string; hourKnown: boolean; boundaryReviewRequired: boolean; clockReviewRequired: boolean }[];
    cautions: string[];
    scoreStatus: "not-adopted";
    mapStatus: "collection-only-not-ranked";
    sharedCopy: { title: string; strength: string };
  };
};
export type ReadingSource = { id: string; pdfSha256: string; pdfPage: number; sectionId: string };
export type SavedResult = {
  id: string;
  me: Person;
  other: Person;
  reading: Reading;
  charts: Record<string, unknown>;
  createdAt: string;
};
export type ShareCard = {
  kind?: "conversation-only";
  aliases: [string, string];
  reading: Reading;
  avatars: ["orange-v1", "cream-v1"];
  catalogVersion: "tigers-v1";
};
export class AppError extends Error {
  constructor(
    public code: string,
    public status = 422,
    public message = "요청을 확인해 주세요.",
  ) {
    super(message);
  }
}
export function publicCard(aliases: [string, string], reading: Reading): ShareCard {
  if (reading.basis?.kind === "source-symbol-comparison") {
    return {
      kind: "conversation-only", aliases,
      reading: { label: "함께 나누는 대화",
        title: reading.basis.sharedCopy.title, strength: reading.basis.sharedCopy.strength,
        difference: "생년월일과 사주 기호는 이 카드에 공개하지 않아요.",
        advice: reading.advice, ruleVersion: reading.ruleVersion, score: null },
      avatars: ["orange-v1", "cream-v1"], catalogVersion: "tigers-v1",
    };
  }
  return {
    aliases,
    reading: { label: reading.label, title: reading.title, strength: reading.strength,
      difference: reading.difference, advice: reading.advice,
      ruleVersion: reading.ruleVersion, score: null },
    avatars: ["orange-v1", "cream-v1"],
    catalogVersion: "tigers-v1",
  };
}

// Group only comparable snapshots. Private birth data is never used in public URLs.
export function selfGroup(result: SavedResult): string {
  const chart = result.charts.me as {
    solar: { year: number; month: number; day: number };
    policy: { version: string };
  };
  return JSON.stringify([
    [chart.solar.year, chart.solar.month, chart.solar.day],
    chart.policy.version,
    result.me.timeKnown,
    result.me.timeKnown ? +result.me.hour : null,
    result.me.timeKnown ? +result.me.minute : null,
  ]);
}

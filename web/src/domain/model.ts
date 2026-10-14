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
};
export type SavedResult = {
  id: string;
  me: Person;
  other: Person;
  reading: Reading;
  charts: Record<string, unknown>;
  createdAt: string;
};
export type ShareCard = {
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
export const sampleReading: Reading = {
  label: "감수 전 예시 풀이",
  title: "서로의 하루에 작은 다정함을 더해요",
  strength: "함께 좋아하는 일을 찾고, 편안한 시간을 조금씩 쌓아 보세요.",
  difference:
    "같은 일에도 느끼는 속도는 다를 수 있어요. 서로의 이야기를 끝까지 들어 주세요.",
  advice: "오늘 고마웠던 일을 한 가지씩 말해 보는 건 어떨까요?",
  ruleVersion: "example-copy-v1",
  score: null,
};
export function publicCard(aliases: [string, string]): ShareCard {
  return {
    aliases,
    reading: { ...sampleReading },
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

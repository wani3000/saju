import { calculateProfile } from "../generated/research.mjs";
import { AppError, pairSchema, type Person } from "../domain/model";
export const engineVersion = "manseryeok-research-civil-midnight-v3";
export function chart(p: Person) {
  if (p.timeKnown && (!/^\d{1,2}$/.test(p.hour) || !/^\d{1,2}$/.test(p.minute)))
    throw new AppError("INVALID_TIME", 422, "출생 시와 분을 확인해 주세요.");
  let result;
  try {
    result = calculateProfile({
      calendar: p.calendar,
      year: +p.year,
      month: +p.month,
      day: +p.day,
      leap: p.calendar === "lunar" && p.leap,
      timeKnown: p.timeKnown,
      ...(p.timeKnown ? { hour: +p.hour, minute: +p.minute } : {}),
    });
  } catch {
    throw new AppError(
      "INVALID_BIRTH",
      422,
      "날짜·윤달·출생 시간을 확인해 주세요. 1908~2026년 국내 출생을 연구 지원하며, 과거 시계 변경으로 중복되거나 없어진 시각은 지원하지 않아요.",
    );
  }
  const { year, month, day } = result.solar;
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  if (
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` >
    today
  )
    throw new AppError(
      "FUTURE_BIRTH",
      422,
      "오늘 이후의 생일은 입력할 수 없어요.",
    );
  return result;
}
export function validatePair(input: unknown) {
  const parsed = pairSchema.safeParse(input);
  if (!parsed.success)
    throw new AppError(
      "INVALID_INPUT",
      422,
      "별명과 생년월일을 모두 확인해 주세요.",
    );
  const pair = parsed.data;
  for (const p of [pair.me, pair.other]) {
    if (!p.timeKnown) {
      p.hour = "";
      p.minute = "";
    }
    if (p.calendar === "solar") p.leap = false;
  }
  if (pair.me.id === pair.other.id)
    throw new AppError("SAME_PERSON", 422, "상대방을 새로 추가해 주세요.");
  return { pair, charts: { me: chart(pair.me), other: chart(pair.other) } };
}

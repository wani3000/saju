import { calculateProfile } from "../generated/research.mjs";
import { AppError, pairSchema, type Person } from "../domain/model";
export const engineVersion = "manseryeok-research-civil-midnight-v5";
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
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const protectedErrors: Record<string, string> = {
      NONEXISTENT_BIRTH_TIME: "이 시각은 과거 시계 변경으로 존재하지 않는 시각이에요. 출생 기록의 날짜와 시각을 확인해 주세요. 다른 시각으로 자동 보정하지 않았어요.",
      AMBIGUOUS_BIRTH_TIME: "이 시각은 과거 시계 변경으로 두 번 나타나요. 어느 시각인지 확정할 수 없어 계산을 보류했어요. 출생 기록을 확인해 주세요.",
      OUT_OF_RESEARCH_RANGE: "입력 연도와 양력 환산 연도가 모두 1908~2026년 범위여야 해요. 음력 입력이라면 양력 환산 날짜도 확인해 주세요.",
    };
    if (Object.hasOwn(protectedErrors, code))
      throw new AppError(code, 422, protectedErrors[code]);
    if (error instanceof Error && error.message === "HISTORICAL_CLOCK_SOURCE_DISPUTE")
      throw new AppError("HISTORICAL_CLOCK_SOURCE_DISPUTE", 422,
        "이 출생 시각은 과거 표준시 변경 자료가 서로 달라 지금은 계산할 수 없어요. 입력한 시각을 그대로 보관해 주세요.");
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

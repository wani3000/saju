export type PersonDraft = {
  id: string;
  name: string;
  year: string;
  month: string;
  day: string;
  calendar: "solar" | "lunar";
  leap: boolean;
  timeKnown: boolean;
  hour: string;
  minute: string;
  relation: string;
};
export type PreviewResult = { id: string; me: PersonDraft; other: PersonDraft };
export const blankPerson = (): PersonDraft => ({
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
export const samplePerson = (other: boolean): PersonDraft => ({
  ...blankPerson(),
  name: other ? "하루" : "나래",
  year: other ? "1992" : "1990",
  month: other ? "5" : "3",
  day: other ? "21" : "12",
});
export function koreaToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function validatePerson(
  p: PersonDraft,
  today = koreaToday(),
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!p.name.trim() || [...p.name.trim()].length > 10)
    errors.name = "별명을 1~10자로 적어 주세요.";
  const y = Number(p.year),
    m = Number(p.month),
    d = Number(p.day);
  if (!/^\d{4}$/.test(p.year) || y < 1908 || y > Number(today.slice(0, 4)))
    errors.date = `연도를 1908~${today.slice(0, 4)} 사이의 네 자리 숫자로 적어 주세요.`;
  else if (
    !/^\d{1,2}$/.test(p.month) ||
    !/^\d{1,2}$/.test(p.day) ||
    m < 1 ||
    m > 12 ||
    d < 1 ||
    d > (p.calendar === "lunar" ? 30 : 31)
  )
    errors.date = "월과 일을 다시 확인해 주세요.";
  else if (p.calendar === "solar") {
    const date = new Date(Date.UTC(y, m - 1, d));
    const iso = `${p.year}-${p.month.padStart(2, "0")}-${p.day.padStart(2, "0")}`;
    if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d)
      errors.date = "달력에 없는 날짜예요. 월과 일을 확인해 주세요.";
    else if (iso > today) errors.date = "오늘 이후의 생일은 입력할 수 없어요.";
  }
  if (
    p.timeKnown &&
    (!/^\d{1,2}$/.test(p.hour) ||
      !/^\d{1,2}$/.test(p.minute) ||
      +p.hour > 23 ||
      +p.minute > 59)
  )
    errors.time = "시는 0~23, 분은 0~59로 적어 주세요.";
  return errors;
}
export function snapshotPerson(p: PersonDraft): PersonDraft {
  return {
    ...p,
    name: p.name.trim(),
    leap: p.calendar === "lunar" && p.leap,
    hour: p.timeKnown ? p.hour : "",
    minute: p.timeKnown ? p.minute : "",
  };
}
export function birthLabel(p: PersonDraft): string {
  return `${p.calendar === "solar" ? "양력" : `음력${p.leap ? "·윤달" : ""}`} ${p.year}.${p.month.padStart(2, "0")}.${p.day.padStart(2, "0")}`;
}
export function shareText(myAlias: string, otherAlias: string): string {
  return `[가까운 사이 · 예시 카드]\n${myAlias.trim()} & ${otherAlias.trim()}\n서로의 하루에 작은 다정함을 더하는 사이\n이 내용은 화면 미리보기용 예시이며 실제 사주 분석 결과가 아닙니다.`;
}

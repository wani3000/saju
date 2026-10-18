import type { Person } from "./model";

export type InputField = "name" | "year" | "month" | "day" | "hour" | "minute";
export type InputErrors = Partial<Record<InputField, string>>;

// Immediate form guidance only. The server still validates lunar conversion,
// historical clock boundaries and the final pair with the research engine.
export function personInputErrors(
  person: Person,
  today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()),
): InputErrors {
  const errors: InputErrors = {};
  if (!person.name.trim() || person.name.trim().length > 10)
    errors.name = "부를 이름을 1~10자로 입력해 주세요.";
  const year = Number(person.year),
    month = Number(person.month),
    day = Number(person.day);
  if (!/^\d{4}$/.test(person.year) || year < 1908 || year > 2026)
    errors.year = "1908~2026년 사이의 네 자리 연도를 입력해 주세요.";
  if (!/^\d{1,2}$/.test(person.month) || month < 1 || month > 12)
    errors.month = "월은 1~12 사이로 입력해 주세요.";
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const maxDay =
    person.calendar === "lunar"
      ? 30
      : !errors.year && !errors.month
        ? [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][
            month - 1
          ]
        : 31;
  if (!/^\d{1,2}$/.test(person.day) || day < 1 || day > maxDay)
    errors.day = `일은 선택한 달에 맞게 1~${maxDay} 사이로 입력해 주세요.`;
  if (
    person.calendar === "solar" &&
    !errors.year &&
    !errors.month &&
    !errors.day &&
    `${person.year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` >
      today
  )
    errors.day = "오늘 이후의 생일은 입력할 수 없어요.";
  if (person.timeKnown) {
    if (!/^\d{1,2}$/.test(person.hour) || +person.hour > 23)
      errors.hour = "태어난 시를 0~23 사이로 입력해 주세요.";
    if (!/^\d{1,2}$/.test(person.minute) || +person.minute > 59)
      errors.minute = "태어난 분을 0~59 사이로 입력해 주세요.";
  }
  return errors;
}

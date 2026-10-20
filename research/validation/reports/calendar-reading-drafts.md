# 달력·풀이 연결 감수

16개 연도·24개월·730일, 윤달 78일. 실제 사용자의 출생 자료가 아닙니다.

- solarToLunar: 730 통과 / 0 실패
- lunarToSolar: 730 통과 / 0 실패
- publishedDayLabelUnknownTime: 730 통과 / 0 실패
- noInventedHour: 730 통과 / 0 실패
- publishedDayLabelKnownMinutes: 5100 통과 / 0 실패
- calendarToReadingEvidence: 730 통과 / 0 실패
- noCalendarApprovalOrScore: 730 통과 / 0 실패
- lunarProfileEquivalent: 699 통과 / 0 실패

풀이 조합 100개: 통과. 오행·관계·순서 교환·시간 제외의 일관성 검사이며 해석 승인과 구분합니다.

역사 시각 거절 재현: {"NONEXISTENT_BIRTH_TIME":6,"AMBIGUOUS_BIRTH_TIME":2,"HISTORICAL_CLOCK_SOURCE_DISPUTE":2}
양력 1908년에 속하지만 음력 입력 범위 밖인 날짜: 31개. 원시 왕복 변환은 별도로 검사했습니다.

음력 연·월 표기와 절입 사주 연·월의 차이: 139건. 서로 다른 기준이므로 실패로 세지 않습니다.

- 24 selected months are not continuous verification of the supported years.
- Published calendar date labels do not prove birth-clock practice, hour pillars or a universally correct day-boundary convention.
- No new strength, transformation, compatibility score or relationship prediction is introduced.
- 2026 fixtures include dates after the review date; calendar arithmetic tests do not relax the web future-birth rejection.

전문가 감수·계산 운영 승인은 미완료입니다.

[세부 수치](calendar-reading-audit.json) · [출처](../fixtures/kasi-months/sources.json) · [감수와 출시 준비](../../../docs/calendar-reading-release-review.md)

/** Render the saved chart's convention; never recalculate or substitute the current engine. */
const versions = ["research-civil-midnight-v3", "research-civil-midnight-v4", "research-civil-midnight-v5"];
const labels = { year: "연주", month: "월주", day: "일주", hour: "시주" };
const validPillars = new Set(Array.from({length:60},(_,i)=>"갑을병정무기경신임계"[i%10]+"자축인묘진사오미신유술해"[i%12]));
export function reviewStoredChart(value: unknown) {
  const c = value && typeof value === "object" ? value as Record<string, any> : {};
  const policy = c.policy ?? {};
  const supported = versions.includes(policy.version) && policy.productionApproved === false;
  const conventions: string[] = [], warnings: string[] = [];
  if (supported) {
    if (policy.dayBoundary === "midnight") conventions.push("일주는 현지 시계의 자정(00:00)에 바뀌는 기준을 사용했어요.");
    if (policy.yearMonthClock === "historical-utc") conventions.push("연주·월주는 절입과 당시 시간대 자료를 기준으로 계산했어요. 음력의 해·달 이름과 다를 수 있어요.");
    if (policy.dayHourClock === "civil-wall" && policy.solarCorrection === false)
      conventions.push("일주·시주는 현지 시계를 사용하며 태양시 보정은 적용하지 않았어요.");
  }
  if (!conventions.length) conventions.push("이 결과의 저장 당시 계산 기준은 아직 화면에서 확인할 수 없어요. 현재 기준으로 바꾸어 표시하지 않았어요.");
  const s = c.solar;
  const date = s && [s.year,s.month,s.day].every(Number.isInteger) ? new Date(Date.UTC(s.year,s.month-1,s.day)) : null;
  const solarKnown = date && date.getUTCFullYear()===s.year && date.getUTCMonth()+1===s.month && date.getUTCDate()===s.day && s.year>=1908 && s.year<=2026;
  const solarLabel = solarKnown ? `${s.year}년 ${s.month}월 ${s.day}일` : null;
  if (supported && solarKnown && s.year===1908 && s.month<4)
    warnings.push("1908년 4월 이전에는 서울 지역 평균시를 사용한 연구 계산이에요. 실제 출생지 기록의 시계 기준은 확인하지 못했어요.");
  if (supported && solarKnown && s.year<1972)
    warnings.push("1972년 이전 날짜의 시간 기준은 추가 검토 중이에요. 현재 계산을 당시 시계 기록의 확정으로 보지 않아요.");
  if (c.clockReview?.reason==="HISTORICAL_CLOCK_SOURCE_DISPUTE")
    warnings.push("이 날짜는 과거 표준시 변경 자료가 서로 달라 검토 중이에요. 출생 시간은 확정하지 않았어요.");
  if (c.boundaryReview?.reason==="SOLAR_TERM_PRECISION_UNRESOLVED")
    warnings.push("절입 경계의 계산 후보를 함께 보관했어요. 후보는 확률이나 정확도 순서가 아니에요.");
  const pillars = Object.entries(labels).map(([key,label])=>{
    const fixed = c.pillars?.[key], options = c.candidates?.[key];
    if (key==="hour" && c.timeKnown===false) return {key,label,value:"시간 모름"};
    if (validPillars.has(fixed) && options===undefined) return {key,label,value:fixed as string};
    if (fixed===null && Array.isArray(options) && options.length>=2 && options.length<=60 &&
      options.every(p=>validPillars.has(p)) && new Set(options).size===options.length)
      return {key,label,value:options.join(" / ")};
    return {key,label,value:"미확정"};
  });
  return {solarLabel,conventions,warnings,pillars};
}

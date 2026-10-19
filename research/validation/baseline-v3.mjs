/** Research-only adapter. Not approved for paid production readings. */
import {getSolarTermsOfYear, lunarToSolar, solarToLunar} from './build/manseryeok.mjs';
import {computeFourPillars} from './build/pillars.mjs';
import {resolveSeoulDate, resolveSeoulWallTime} from './resolve-wall-time.mjs';

const policy = Object.freeze({
  version: 'research-civil-midnight-v3',
  dayBoundary: 'midnight',
  solarCorrection: false,
  yearMonthClock: 'historical-utc',
  dayHourClock: 'civil-wall',
  productionApproved: false,
});
const researchLimit = 'Historical solar-term accuracy and civil-wall day/hour convention still require review.';

function pillarsAt(instantUTCms, wallMs, calendarYear) {
  // Engine core accepts separate clocks. Its default wrapper assumes UTC+9.
  // apparentMs intentionally carries civil wall fields: no solar-time correction.
  const result = computeFourPillars({instantUTCms, apparentMs:wallMs}, calendarYear, 'midnight');
  return Object.fromEntries(Object.entries(result).map(([key, value]) => [key, value.heavenlyStem + value.earthlyBranch]));
}

export function calculateProfile(input) {
  if (!input || !['solar', 'lunar'].includes(input.calendar)) throw new Error('INVALID_CALENDAR');
  const {year, month, day} = input;
  if (![year, month, day].every(Number.isInteger)) throw new Error('INVALID_DATE');
  if (year < 1908 || year > 2026) throw new Error('OUT_OF_RESEARCH_RANGE');
  if (typeof input.timeKnown !== 'boolean') throw new Error('TIME_KNOWN_REQUIRED');
  if (typeof input.leap !== 'boolean') throw new Error('LEAP_FLAG_REQUIRED');
  if (input.calendar === 'solar' && input.leap) throw new Error('LEAP_REQUIRES_LUNAR');
  const solar = input.calendar === 'lunar' ? lunarToSolar(year, month, day, input.leap) : {year, month, day};
  solarToLunar(solar.year, solar.month, solar.day); // no overflow normalization
  if (solar.year < 1908 || solar.year > 2026) throw new Error('OUT_OF_RESEARCH_RANGE');

  if (input.timeKnown) {
    if (!Number.isInteger(input.hour) || !Number.isInteger(input.minute)) throw new Error('INVALID_TIME');
    const civilTime = resolveSeoulWallTime({...solar, hour:input.hour, minute:input.minute});
    if (civilTime.status === 'nonexistent') throw new Error('NONEXISTENT_BIRTH_TIME');
    if (civilTime.status === 'ambiguous') throw new Error('AMBIGUOUS_BIRTH_TIME');
    const wallMs = Date.UTC(solar.year, solar.month - 1, solar.day, input.hour, input.minute);
    const pillars = pillarsAt(Date.parse(civilTime.candidates[0].utc), wallMs, solar.year);
    return {solar, timeKnown:true, civilTime, pillars, policy, limitations:[researchLimit]};
  }
  if (input.hour != null || input.minute != null) throw new Error('UNKNOWN_TIME_HAS_VALUE');

  const civilDate = resolveSeoulDate(solar);
  if (!civilDate.intervals.length) throw new Error('NONEXISTENT_BIRTH_DATE');
  const terms = [solar.year - 1, solar.year, solar.year + 1]
    .flatMap(y => getSolarTermsOfYear(y)).filter(t => t.index % 2 === 0)
    .map(t => t.date.getTime());
  const charts = [];
  for (const interval of civilDate.intervals) {
    // Probe every real interval and any contained term: never invent a birth time.
    const probes = new Set([interval.startUTCms, interval.endUTCms - 1]);
    for (const term of terms) {
      if (term >= interval.startUTCms && term < interval.endUTCms) {
        probes.add(term);
        if (term > interval.startUTCms) probes.add(term - 1);
      }
    }
    for (const instant of [...probes].sort((a,b) => a-b)) {
      charts.push(pillarsAt(instant, instant + interval.offsetSeconds * 1000, solar.year));
    }
  }
  const pillars = {};
  const candidates = {};
  for (const key of ['year', 'month', 'day']) {
    const options = [...new Set(charts.map(chart => chart[key]))];
    pillars[key] = options.length === 1 ? options[0] : null;
    if (options.length > 1) candidates[key] = options;
  }
  pillars.hour = null;
  return {solar, timeKnown:false, pillars, candidates, policy,
    timezoneSourceSha256:civilDate.sourceSha256,
    limitations:[researchLimit, 'No hour pillar or hour-derived analysis.',
      ...(Object.keys(candidates).length ? ['Solar-term boundary occurs on this date; no single year/month pillar is asserted.'] : [])]};
}

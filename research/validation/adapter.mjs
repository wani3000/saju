/** Research-only boundary guard; this margin is NOT a proven astronomical error bound. */
import {calculateProfile as baseline} from './baseline-v3.mjs';
import {getSolarTermsOfYear} from './build/manseryeok.mjs';
import {computeFourPillars} from './build/pillars.mjs';
import {resolveSeoulDate} from './resolve-wall-time.mjs';

export const boundaryReviewSeconds = 120;
const margin = boundaryReviewSeconds * 1000;
const policy = Object.freeze({
  version: 'research-civil-midnight-v4', dayBoundary: 'midnight',
  solarCorrection: false, yearMonthClock: 'historical-utc', dayHourClock: 'civil-wall',
  solarTermReviewSeconds: boundaryReviewSeconds,
  birthMinuteInterval: 'start-inclusive-end-exclusive', productionApproved: false,
});

export function calculateProfile(input) {
  // Retain v3 as an explicit baseline for historical comparison reports.
  const result = baseline(input);
  const {solar} = result;
  const intervals = input.timeKnown
    ? [{startUTCms: Date.parse(result.civilTime.candidates[0].utc),
        endUTCms: Date.parse(result.civilTime.candidates[0].utc) + 60000}]
    : resolveSeoulDate(solar).intervals;
  const near = [solar.year - 1, solar.year, solar.year + 1]
    .flatMap(y => getSolarTermsOfYear(y)).filter(t => t.index % 2 === 0)
    .filter(t => intervals.some(i => i.startUTCms <= t.date.getTime() + margin &&
      i.endUTCms > t.date.getTime() - margin));
  const pillars = {...result.pillars};
  const candidates = {...result.candidates};
  // Only year/month depend on the solar-term instant. Do not shift the known
  // birth wall clock, day/hour pillars, timezone resolution, or saved snapshots.
  for (const key of ['year', 'month']) {
    const options = new Set(candidates[key] ?? (pillars[key] ? [pillars[key]] : []));
    for (const term of near) {
      for (const delta of [-margin - 1, margin + 1]) {
        const p = computeFourPillars({instantUTCms: term.date.getTime() + delta,
          apparentMs: Date.UTC(solar.year, solar.month - 1, solar.day)}, solar.year, 'midnight')[key];
        options.add(p.heavenlyStem + p.earthlyBranch);
      }
    }
    if (options.size > 1) {
      pillars[key] = null;
      candidates[key] = [...options];
    }
  }
  return {...result, pillars, ...(Object.keys(candidates).length ? {candidates} : {}), policy,
    ...(near.length ? {boundaryReview: {reason: 'SOLAR_TERM_PRECISION_UNRESOLVED',
      marginSeconds: boundaryReviewSeconds, verifiedErrorBound: false,
      terms: near.map(t => ({index: t.index, engineUTC: t.date.toISOString()}))}} : {}),
    limitations: [...result.limitations, ...(near.length ? [
      'Within a provisional solar-term review window; year/month candidates are retained. This window does not establish accuracy outside it.',
    ] : [])]};
}

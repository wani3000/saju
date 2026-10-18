import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { calculateProfile } from './adapter.mjs';
import { getSolarTerm } from './build/manseryeok.mjs';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/naoj-terms.json', import.meta.url)));
const zone = JSON.parse(readFileSync(new URL('./fixtures/seoul-transitions.json', import.meta.url)));
const branches = ['축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해', '자'];

function localMinute(ut, direction) {
  let offset = zone.initialOffsetSeconds;
  for (const transition of zone.transitions) {
    if (ut < transition.utcSeconds * 1000) break;
    offset = transition.offsetSeconds;
  }
  // 1908 starts with a seconds-level offset. Round away from the source boundary
  // so minute-only app input is never closer than the declared probe distance.
  const wall = (direction < 0 ? Math.floor : Math.ceil)((ut + offset * 1000) / 60000) * 60000;
  const date = new Date(wall);
  return {
    year: date.getUTCFullYear(), month: date.getUTCMonth() + 1,
    day: date.getUTCDate(), hour: date.getUTCHours(), minute: date.getUTCMinutes(),
  };
}

export function compareNaoj() {
  const differences = fixture.terms.map(term => ({
    year: term.sourceYear, index: term.index, longitude: term.longitude,
    sourceUT: term.ut,
    engineUTC: getSolarTerm(term.sourceYear, term.index).date.toISOString(),
    differenceSeconds: (getSolarTerm(term.sourceYear, term.index).date.getTime() - Date.parse(term.ut)) / 1000,
  }));
  const boundaries = [1, 2].map(minutes => {
    const probes = [];
    for (const term of fixture.terms.filter(t => t.index % 2 === 0)) {
      for (const direction of [-1, 1]) {
        const local = localMinute(Date.parse(term.ut) + direction * minutes * 60000, direction);
        const profile = calculateProfile({ ...local, calendar: 'solar', leap: false, timeKnown: true });
        const expectedBranch = branches[(term.index / 2 + (direction < 0 ? 11 : 0)) % 12];
        probes.push({ sourceYear: term.sourceYear, index: term.index, direction, local,
          expectedBranch, actualBranch: profile.pillars.month[1] });
      }
    }
    return { minutesFromSource: minutes, probes: probes.length,
      mismatches: probes.filter(p => p.expectedBranch !== p.actualBranch) };
  });
  return {
    source: 'NAOJ long-term phenomena, UT+0, default delta-T, minute precision',
    years: fixture.sources.map(s => s.year), timestamps: differences.length,
    sameDisplayedMinute: differences.filter(d => d.differenceSeconds === 0).length,
    maxAbsoluteDifferenceSeconds: Math.max(...differences.map(d => Math.abs(d.differenceSeconds))),
    differences: differences.filter(d => d.differenceSeconds !== 0), boundaries,
    productionApproved: false,
    conclusion: 'Independent-source comparison only. Minute differences and one-minute boundary disagreements require adjudication; two-minute agreement does not establish exact boundaries or approve production.',
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = compareNaoj();
  const serialized = JSON.stringify(result, null, 2) + '\n';
  const output = new URL('./reports/naoj-comparison.json', import.meta.url);
  if (process.argv.includes('--check')) {
    if (readFileSync(output, 'utf8') !== serialized) throw new Error('NAOJ_REPORT_DRIFT');
  } else writeFileSync(output, serialized);
  console.log(JSON.stringify({ timestamps: result.timestamps,
    sameDisplayedMinute: result.sameDisplayedMinute,
    differingTimestamps: result.differences.length,
    boundaryMismatches: result.boundaries.map(b => ({minutes: b.minutesFromSource, count: b.mismatches.length})),
    productionApproved: false }));
  // A release check must not interpret a reproduced research report as approval.
  if (process.argv.includes('--release-check')) process.exitCode = 2;
}

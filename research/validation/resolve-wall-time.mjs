/** Research conversion only: pinned IANA data; no astronomical/pillar policy. */
import {readFileSync} from 'node:fs';
const data = JSON.parse(readFileSync(new URL('./fixtures/seoul-transitions.json', import.meta.url)));
const offsets = [...new Set([data.initialOffsetSeconds, ...data.transitions.map(t => t.offsetSeconds)])];

export function resolveSeoulWallTime({year, month, day, hour, minute, second = 0} = {}) {
  if (![year, month, day, hour, minute, second].every(Number.isInteger)) throw new Error('INVALID_WALL_TIME');
  if (year < data.minYear || year > data.maxYear) throw new Error('OUT_OF_TIMEZONE_RANGE');
  const stamp = Date.UTC(year, month - 1, day, hour, minute, second);
  const date = new Date(stamp);
  const actual = [date.getUTCFullYear(), date.getUTCMonth()+1, date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()];
  if (actual.some((n, i) => n !== [year, month, day, hour, minute, second][i])) throw new Error('INVALID_WALL_TIME');
  const candidates = [];
  for (const offset of offsets) {
    const utcSeconds = stamp / 1000 - offset;
    let active = data.initialOffsetSeconds;
    for (const transition of data.transitions) {
      if (utcSeconds < transition.utcSeconds) break;
      active = transition.offsetSeconds;
    }
    if (active === offset) candidates.push({utc: new Date(utcSeconds * 1000).toISOString(), offsetSeconds: offset});
  }
  candidates.sort((a, b) => a.utc.localeCompare(b.utc));
  return {status: ['nonexistent', 'unique', 'ambiguous'][candidates.length], candidates,
    zone: data.zone, sourceSha256: data.sourceSha256};
}

/** Actual UTC intervals belonging to a civil date, including gap/fold days.
 * Each half-open interval has one offset; no assumed birth time is chosen.
 */
export function resolveSeoulDate({year, month, day} = {}) {
  resolveSeoulWallTime({year, month, day, hour:12, minute:0}); // date/range validation only
  const startWallMs = Date.UTC(year, month - 1, day);
  const endWallMs = startWallMs + 86400000;
  let startUTCms = -Infinity;
  let offsetSeconds = data.initialOffsetSeconds;
  const intervals = [];
  for (let i = 0; i <= data.transitions.length; i++) {
    const transition = data.transitions[i];
    const endUTCms = transition ? transition.utcSeconds * 1000 : Infinity;
    const start = Math.max(startUTCms, startWallMs - offsetSeconds * 1000);
    const end = Math.min(endUTCms, endWallMs - offsetSeconds * 1000);
    if (start < end) intervals.push({startUTCms:start, endUTCms:end, offsetSeconds});
    if (transition) {
      startUTCms = endUTCms;
      offsetSeconds = transition.offsetSeconds;
    }
  }
  return {zone:data.zone, sourceSha256:data.sourceSha256, intervals};
}

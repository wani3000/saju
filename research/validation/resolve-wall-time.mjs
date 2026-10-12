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

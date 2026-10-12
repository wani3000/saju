import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveSeoulWallTime} from './resolve-wall-time.mjs';
const fixture = JSON.parse(readFileSync(new URL('./fixtures/seoul-wall-times.json', import.meta.url)));

test('1,918 monthly and transition cases agree with Python zoneinfo round-trips', () => {
  const statuses = new Set();
  for (const sample of fixture.cases) {
    const actual = resolveSeoulWallTime(sample.wall);
    assert.equal(actual.sourceSha256, fixture.sourceSha256);
    assert.equal(actual.status, sample.status, JSON.stringify(sample.wall));
    assert.deepEqual(actual.candidates, sample.candidates, JSON.stringify(sample.wall));
    statuses.add(actual.status);
  }
  assert.deepEqual([...statuses].sort(), ['ambiguous', 'nonexistent', 'unique']);
});
test('1988 DST gap is not normalized to a later birth time', () => {
  assert.deepEqual(resolveSeoulWallTime({year:1988,month:5,day:8,hour:2,minute:30}).candidates, []);
});
test('1988 repeated hour preserves both possible instants', () => {
  const result = resolveSeoulWallTime({year:1988,month:10,day:9,hour:2,minute:30});
  assert.equal(result.status, 'ambiguous');
  assert.deepEqual(result.candidates.map(c => c.offsetSeconds), [36000,32400]);
});
test('1900 retains seconds in local mean time offset', () => {
  assert.equal(resolveSeoulWallTime({year:1900,month:1,day:15,hour:12,minute:0}).candidates[0].offsetSeconds, 30472);
});
test('invalid dates, overflow, noninteger and unsupported years fail closed', () => {
  const base = {year:2024,month:2,day:29,hour:12,minute:0};
  for (const change of [{year:2023}, {month:13}, {day:0}, {hour:24}, {minute:-1}, {second:60}, {hour:1.5}, {year:'2024'}, {year:1899}, {year:2027}]) {
    assert.throws(() => resolveSeoulWallTime({...base,...change}));
  }
});

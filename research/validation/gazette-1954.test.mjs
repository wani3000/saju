import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {compare1954Clocks} from './compare-1954-clocks.mjs';
import {resolveSeoulWallTime, resolveSeoulDate} from './resolve-wall-time.mjs';
import {calculateProfile} from './adapter.mjs';
const base = {year:1954, month:3, calendar:'solar', leap:false, timeKnown:true};

test('gazette original, viewer page path and secondary meridian image retain archived byte hashes', () => {
  const dir = new URL('./fixtures/time-standards/', import.meta.url);
  const sources = JSON.parse(readFileSync(new URL('sources.json', dir)));
  for (const entry of sources) assert.equal(createHash('sha256').update(readFileSync(new URL(entry.file, dir))).digest('hex'), entry.sha256);
  const viewer = readFileSync(new URL('gazette-1954-viewer.html', dir), 'utf8');
  assert.match(viewer, /ba0185690_1\.jpg/);
  assert.match(viewer, /0027975450/);
});

test('two full civil days expose exactly 60 disputed minutes and v5 rejects their union', () => {
  let different = 0, same = 0;
  for (const day of [20,21]) for (let n = 0; n < 1440; n++) {
    const input = {...base, day, hour:Math.floor(n / 60), minute:n % 60};
    const result = compare1954Clocks(input);
    const iana = resolveSeoulWallTime(input);
    assert.deepEqual(result.models[0].candidates.map(({prolepticUtc:utc,...r}) => ({utc,...r})), iana.candidates);
    if (!result.agreed) {
      different++;
      assert.ok(day === 20 && n >= 1410 || day === 21 && n < 30);
      assert.throws(() => calculateProfile(input), day === 20 ? /AMBIGUOUS_BIRTH_TIME/ : /HISTORICAL_CLOCK_SOURCE_DISPUTE/);
    } else {
      same++;
      assert.equal(result.models[0].status, 'unique');
      assert.equal(calculateProfile(input).civilTime.status, 'unique');
    }
  }
  assert.equal(different, 60); assert.equal(same, 2820);
});

test('half-open fold endpoints and explicit assumptions do not turn a hypothesis into UTC evidence', () => {
  const cases = [
    [20,23,29,59,true], [20,23,30,0,false], [20,23,59,59,false],
    [21,0,0,0,false], [21,0,29,59,false], [21,0,30,0,true],
  ];
  for (const [day,hour,minute,second,agreed] of cases) {
    const r = compare1954Clocks({...base,day,hour,minute,second});
    assert.equal(r.agreed, agreed);
    assert.equal(r.productionApproved, false);
  }
  const r = compare1954Clocks({...base,day:21,hour:0,minute:15});
  assert.deepEqual(r.models[1].candidates, [
    {prolepticUtc:'1954-03-20T15:15:00.000Z',offsetSeconds:32400},
    {prolepticUtc:'1954-03-20T15:45:00.000Z',offsetSeconds:30600},
  ]);
  // IANA puts the extra half-hour on Mar 20; the outgoing-clock hypothesis on Mar 21.
  assert.equal(resolveSeoulDate({...base,day:20}).intervals.reduce((sum,i) => sum + i.endUTCms - i.startUTCms,0), 24.5 * 3600000);
  for (const input of [{...base,day:22,hour:0,minute:0}, {...base,day:21,hour:24,minute:0}, {...base,day:21,hour:0,minute:0,second:60}]) {
    assert.throws(() => compare1954Clocks(input), /OUT_OF_1954_REVIEW_RANGE/);
  }
});

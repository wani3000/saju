import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { calculateProfile } from './baseline-v4.mjs';
import { compareNaoj } from './compare-naoj.mjs';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/naoj-terms.json', import.meta.url)));
const branches = ['축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해', '자'];
const zone = JSON.parse(readFileSync(new URL('./fixtures/seoul-transitions.json', import.meta.url)));
const base = { calendar: 'solar', leap: false };

test('independent NAOJ source bytes, requested years and 192 term coordinates are pinned', () => {
  assert.equal(fixture.sources.length, 8);
  assert.equal(fixture.terms.length, 192);
  for (const source of fixture.sources) {
    const bytes = readFileSync(new URL(`./fixtures/naoj/${source.file}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), source.sha256);
    assert.equal(new URL(source.url).searchParams.get('year'), String(source.year));
    assert.equal(new URL(source.url).searchParams.get('lst'), '0');
    const terms = fixture.terms.filter(t => t.sourceYear === source.year);
    assert.deepEqual(terms.map(t => t.longitude), Array.from({length: 24}, (_, i) => (285 + 15 * i) % 360));
    assert.ok(terms.every(t => t.deltaT && t.ut.startsWith(String(source.year))));
  }
});

test('comparison reproduces three one-minute differences without declaring production approval', () => {
  const report = compareNaoj();
  const pinned = JSON.parse(readFileSync(new URL('./reports/naoj-comparison.json', import.meta.url)));
  assert.deepEqual(report, pinned);
  assert.equal(report.sameDisplayedMinute, 189);
  assert.deepEqual(report.differences.map(d => [d.year, d.index, d.differenceSeconds]), [
    [1954, 22, -60], [1988, 18, 60], [2024, 21, 60],
  ]);
  assert.equal(report.productionApproved, false);
});

test('one-minute boundary disagreement remains explicit; two-minute probes agree in this sample', () => {
  const [oneMinute, twoMinute] = compareNaoj().boundaries;
  assert.equal(oneMinute.probes, 192);
  assert.equal(oneMinute.mismatches.length, 1);
  assert.deepEqual(oneMinute.mismatches[0].local, {year: 1954, month: 12, day: 7, hour: 23, minute: 58});
  assert.equal(oneMinute.mismatches[0].expectedBranch, '해');
  assert.equal(oneMinute.mismatches[0].actualBranch, '자');
  assert.equal(twoMinute.probes, 192);
  assert.deepEqual(twoMinute.mismatches, []);
});

test('time unknown preserves both month candidates on all 96 independent term dates', () => {
  for (const term of fixture.terms.filter(t => t.index % 2 === 0)) {
    const ut = Date.parse(term.ut);
    let offset = zone.initialOffsetSeconds;
    for (const transition of zone.transitions) {
      if (ut < transition.utcSeconds * 1000) break;
      offset = transition.offsetSeconds;
    }
    const local = new Date(ut + offset * 1000);
    const result = calculateProfile({ ...base, timeKnown: false,
      year: local.getUTCFullYear(), month: local.getUTCMonth() + 1, day: local.getUTCDate() });
    const expected = [branches[(term.index / 2 + 11) % 12], branches[term.index / 2]].sort();
    assert.equal(result.pillars.hour, null);
    assert.equal(result.pillars.month, null);
    assert.deepEqual(result.candidates.month.map(p => p[1]).sort(), expected);
    assert.equal(result.policy.productionApproved, false);
  }
});

test('reproduced report cannot pass the explicit release gate', () => {
  const result = spawnSync(process.execPath, [new URL('./compare-naoj.mjs', import.meta.url).pathname, '--check', '--release-check'], {encoding: 'utf8'});
  assert.equal(result.status, 2);
  assert.equal(JSON.parse(result.stdout).productionApproved, false);
});

test('v4 retains the independent expected month among candidates for every one-minute probe', () => {
  for (const term of fixture.terms.filter(t=>t.index%2===0)) for (const direction of [-1,1]) {
    const ut=Date.parse(term.ut)+direction*60000;
    let offset=zone.initialOffsetSeconds;
    for (const t of zone.transitions) {if(ut<t.utcSeconds*1000) break;offset=t.offsetSeconds;}
    const wall=new Date((direction<0?Math.floor:Math.ceil)((ut+offset*1000)/60000)*60000);
    const result=calculateProfile({...base,timeKnown:true,year:wall.getUTCFullYear(),
      month:wall.getUTCMonth()+1,day:wall.getUTCDate(),hour:wall.getUTCHours(),minute:wall.getUTCMinutes()});
    const options=result.candidates?.month??[result.pillars.month];
    const expected=branches[(term.index/2+(direction<0?11:0))%12];
    assert.ok(options.some(p=>p[1]===expected));
  }
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calculateProfile} from './adapter.mjs';
import {calculateProfile as baseline} from './baseline-v3.mjs';
import {getSolarTerm} from './build/manseryeok.mjs';
import {resolveSeoulDate} from './resolve-wall-time.mjs';
const base = {calendar:'solar', leap:false, timeKnown:true};
const fields = ms => {
  const d = new Date(ms);
  return {year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate(),hour:d.getUTCHours(),minute:d.getUTCMinutes()};
};

test('known 1954 disagreement preserves both months and the original day/hour', () => {
  const input = {...base,year:1954,month:12,day:7,hour:23,minute:58};
  const original = baseline(input), guarded = calculateProfile(input);
  assert.equal(original.pillars.month[1],'자');
  assert.equal(guarded.pillars.month,null);
  assert.deepEqual(guarded.candidates.month.map(p=>p[1]).sort(),['자','해'].sort());
  for (const key of ['year','day','hour']) assert.equal(guarded.pillars[key],original.pillars[key]);
  assert.deepEqual(guarded.civilTime,original.civilTime);
  assert.equal(guarded.boundaryReview.verifiedErrorBound,false);
  assert.equal(guarded.policy.version,'research-civil-midnight-v4');
  assert.equal(guarded.policy.productionApproved,false);
});

test('all supported years preserve both months near every monthly term, including historical clocks', () => {
  let count = 0;
  for(let year=1908;year<=2026;year++) for(let index=0;index<24;index+=2) {
    const term=getSolarTerm(year,index).date.getTime();
    // Find the actual pinned Seoul offset at the term, including seconds in 1908.
    const utcDate=fields(term);
    const interval=resolveSeoulDate(utcDate).intervals.find(i=>i.startUTCms<=term&&term<i.endUTCms)
      ?? resolveSeoulDate(fields(term+86400000)).intervals.find(i=>i.startUTCms<=term&&term<i.endUTCms);
    assert.ok(interval);
    const input={...base,...fields(term+interval.offsetSeconds*1000)};
    const actual=calculateProfile(input), old=baseline(input);
    assert.equal(actual.pillars.month,null,JSON.stringify(input));
    assert.equal(actual.candidates.month.length,2);
    assert.equal(actual.pillars.day,old.pillars.day);
    assert.equal(actual.pillars.hour,old.pillars.hour);
    if(index===2) {assert.equal(actual.pillars.year,null);assert.equal(actual.candidates.year.length,2);}
    else assert.equal(actual.pillars.year,old.pillars.year);
    count++;
  }
  assert.equal(count,1428);
});

test('minute input interval intersects the review window at defined endpoints', () => {
  const term=getSolarTerm(2024,2).date.getTime();
  for(const delta of [-3,-2,-1,0,1,2,3]) {
    const input={...base,...fields(term+(540+delta)*60000)};
    const r=calculateProfile(input);
    assert.equal(r.pillars.month===null,Math.abs(delta)<=2,`offset ${delta}`);
    if(Math.abs(delta)>2) assert.deepEqual(r.pillars,baseline(input).pillars);
  }
});

test('middle terms do not trigger year/month ambiguity', () => {
  const term=getSolarTerm(2024,21).date.getTime();
  const input={...base,...fields(term+540*60000)};
  const r=calculateProfile(input);
  assert.deepEqual(r.pillars,baseline(input).pillars);
  assert.equal(r.boundaryReview,undefined);
});

test('unknown time retains hour null and boundary candidates; guard does not mutate baseline', () => {
  const input={...base,year:2024,month:2,day:4,timeKnown:false};
  const before=baseline(input);
  const actual=calculateProfile(input);
  assert.equal(actual.pillars.hour,null);
  assert.deepEqual(actual.candidates,before.candidates);
  assert.deepEqual(baseline(input),before);
  assert.throws(()=>calculateProfile({...input,timeKnown:true,hour:undefined,minute:0}),/INVALID_TIME/);
});

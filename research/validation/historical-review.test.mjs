import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calculateProfile} from './adapter.mjs';
import {calculateProfile as v4} from './baseline-v4.mjs';
import {solarToLunar} from './build/manseryeok.mjs';
const base={calendar:'solar',leap:false,timeKnown:true,year:1954,month:3};
test('1954 source dispute remains explicit while old v4 reproduces the former accepted minutes',()=>{
  const source=readFileSync(new URL('./fixtures/time-standards/archives-1954.html',import.meta.url),'utf8');
  assert.match(source,/1954년 3월 21일 오전 0시 30분/);
  for(let minute=0;minute<30;minute++) {
    const input={...base,day:21,hour:0,minute};
    assert.equal(v4(input).civilTime.status,'unique');
    assert.throws(()=>calculateProfile(input),/HISTORICAL_CLOCK_SOURCE_DISPUTE/);
    assert.throws(()=>calculateProfile({...base,day:20,hour:23,minute:minute+30}),/AMBIGUOUS_BIRTH_TIME/);
  }
  for(const input of [{...base,day:20,hour:23,minute:29},{...base,day:21,hour:0,minute:30}]) {
    assert.deepEqual(calculateProfile(input).pillars,v4(input).pillars);
    assert.deepEqual(calculateProfile(input).civilTime,v4(input).civilTime);
  }
});
test('lunar inputs cannot bypass the clock review and unknown time never confirms an instant',()=>{
  const lunar=solarToLunar(1954,3,21);
  assert.throws(()=>calculateProfile({...base,...lunar,calendar:'lunar',leap:lunar.isLeapMonth,hour:0,minute:15}),/HISTORICAL_CLOCK_SOURCE_DISPUTE/);
  for(const day of [20,21]) {
    const result=calculateProfile({...base,day,timeKnown:false});
    assert.equal(result.pillars.hour,null);
    assert.equal(result.civilTime,undefined);
    assert.equal(result.clockReview.instantConfirmed,false);
    assert.equal(result.policy.version,'research-civil-midnight-v5');
    assert.equal(result.policy.productionApproved,false);
    assert.deepEqual(result.pillars,v4({...base,day,timeKnown:false}).pillars);
  }
});

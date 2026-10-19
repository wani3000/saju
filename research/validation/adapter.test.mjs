import {test} from 'node:test'; import assert from 'node:assert/strict'; import {calculateProfile} from './adapter.mjs';
const base={year:2024,month:2,day:10,calendar:'solar',leap:false,timeKnown:false};
test('unknown time yields no hour pillar or invented hour-dependent analysis',()=>{const r=calculateProfile(base);assert.equal(r.pillars.hour,null);assert.equal(r.pillars.day,'갑진');assert.equal(r.timeKnown,false);assert.equal('fiveElements' in r,false);});
test('unknown time on 입춘 preserves both year/month candidates',()=>{const r=calculateProfile({...base,day:4});assert.equal(r.pillars.year,null);assert.equal(r.pillars.month,null);assert.deepEqual(r.candidates.year,['계묘','갑진']);assert.equal(r.pillars.hour,null);});
test('known minute near independent KASI 입춘 retains both years under v4',()=>{
  for (const minute of [26,28]) {
    const r=calculateProfile({...base,day:4,timeKnown:true,hour:17,minute});
    assert.equal(r.pillars.year,null);
    assert.deepEqual([...r.candidates.year].sort(),['계묘','갑진'].sort());
  }
});
test('solar and corresponding lunar birthday yield same pillars',()=>{assert.deepEqual(calculateProfile({...base,calendar:'lunar',month:1,day:1}).pillars,calculateProfile(base).pillars);});
test('invalid solar date is rejected',()=>assert.throws(()=>calculateProfile({...base,year:2023,day:29})));
test('nonexistent leap lunar month is rejected',()=>assert.throws(()=>calculateProfile({...base,calendar:'lunar',month:1,day:1,leap:true})));
test('valid leap month uses independent KASI date',()=>assert.deepEqual(calculateProfile({...base,year:2023,calendar:'lunar',month:2,day:1,leap:true}).solar,{year:2023,month:3,day:22}));
test('unknown time cannot sneak in a clock time',()=>assert.throws(()=>calculateProfile({...base,hour:12,minute:0})));
test('known time requires a real hour and minute',()=>{assert.throws(()=>calculateProfile({...base,timeKnown:true}));assert.throws(()=>calculateProfile({...base,timeKnown:true,hour:24,minute:0}));});
test('unvalidated pre-1908 era is rejected',()=>assert.throws(()=>calculateProfile({...base,year:1900})));
test('solar input cannot carry lunar leap flag',()=>assert.throws(()=>calculateProfile({...base,leap:true})));
test('deterministic and no production approval claim',()=>{const a=calculateProfile(base);assert.deepEqual(a,calculateProfile(base));assert.equal(a.policy.productionApproved,false);});

test('historical nonexistent birth time is rejected before chart output',()=>assert.throws(()=>calculateProfile({...base,year:1988,month:5,day:8,timeKnown:true,hour:2,minute:30}),/NONEXISTENT_BIRTH_TIME/));
test('historical duplicated birth time is not silently resolved',()=>assert.throws(()=>calculateProfile({...base,year:1988,month:10,day:9,timeKnown:true,hour:2,minute:30}),/AMBIGUOUS_BIRTH_TIME/));
test('valid historical time exposes civil instant but retains research status',()=>{const r=calculateProfile({...base,year:1988,month:5,day:8,timeKnown:true,hour:3,minute:0});assert.equal(r.civilTime.candidates[0].utc,'1988-05-07T17:00:00.000Z');assert.equal(r.policy.productionApproved,false);});
test('unknown time on a DST date stays unknown',()=>{const r=calculateProfile({...base,year:1988,month:5,day:8});assert.equal(r.pillars.hour,null);assert.equal(r.civilTime,undefined);});
test('callers cannot mutate the shared policy for later profiles',()=>{const r=calculateProfile(base);assert.throws(()=>{r.policy.productionApproved=true;},TypeError);assert.equal(calculateProfile(base).policy.productionApproved,false);});

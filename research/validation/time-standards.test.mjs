import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {calculateProfile} from './adapter.mjs';
import {resolveSeoulWallTime} from './resolve-wall-time.mjs';
import {getSolarTerm} from './build/manseryeok.mjs';
import {computeFourPillars} from './build/pillars.mjs';
import {ttEpochToUtcMs,termUtcMs,leapRows,utcCoverageEnd} from './time-scales.mjs';
const load=name=>JSON.parse(readFileSync(new URL(`./fixtures/${name}`,import.meta.url)));
const terms=load('jpl-de440s-terms.json').terms;
const zone=load('seoul-transitions.json');
const base={calendar:'solar',leap:false,timeKnown:true};
function fields(ms){const d=new Date(ms);return {year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate(),hour:d.getUTCHours(),minute:d.getUTCMinutes()};}
function local(ms){let offset=zone.initialOffsetSeconds;for(const t of zone.transitions){if(ms<t.utcSeconds*1000)break;offset=t.offsetSeconds;}return fields(ms+offset*1000);}

test('archived IANA 2025b reproduces all pinned historical changes without host tzdata',()=>{
  const run=spawnSync('python3',[new URL('./check-time-standards.py',import.meta.url).pathname],{encoding:'utf8'});
  assert.equal(run.status,0,run.stdout+run.stderr);
});
test('modern UTC conversion respects all leap insertions and refuses unsupported scales',()=>{
  assert.equal(leapRows.length,28);
  for(const [i,row] of leapRows.entries()) {
    assert.equal(ttEpochToUtcMs(row.ttMs),row.utcMs);
    assert.equal(ttEpochToUtcMs(row.ttMs+60000),row.utcMs+60000);
    if(i) {
      assert.equal(ttEpochToUtcMs(row.ttMs-1001),row.utcMs-1);
      assert.throws(()=>ttEpochToUtcMs(row.ttMs-1000),/LEAP_SECOND_NOT_REPRESENTABLE/);
      assert.throws(()=>ttEpochToUtcMs(row.ttMs-1),/LEAP_SECOND_NOT_REPRESENTABLE/);
    }
  }
  assert.throws(()=>ttEpochToUtcMs(Date.UTC(1954,0,1)),/PRE_1972/);
  assert.throws(()=>ttEpochToUtcMs(leapRows[0].ttMs-1),/PRE_1972/);
  assert.throws(()=>ttEpochToUtcMs(utcCoverageEnd+69184),/EXPIRED/);
});
test('660 independent modern UTC month boundaries preserve candidates and 1320 outside probes',()=>{
  let count=0;
  const branches=['축','인','묘','진','사','오','미','신','유','술','해','자'];
  for(const term of terms.filter(t=>t.year>=1972&&t.index%2===0)) {
    const instant=termUtcMs(term);
    const result=calculateProfile({...base,...local(instant)});
    assert.equal(result.pillars.month,null);
    assert.deepEqual(new Set(result.candidates.month.map(x=>x[1])),new Set([branches[(term.index/2+11)%12],branches[term.index/2]]));
    for(const delta of [-240000,240000]) {
      const outside=calculateProfile({...base,...local(instant+delta)});
      assert.equal(outside.pillars.month[1],branches[(term.index/2+(delta<0?11:0))%12]);
    }
    assert.ok(Math.abs(getSolarTerm(term.year,term.index).date.getTime()-instant)<120000);
    count++;
  }
  assert.equal(count,660);
});
test('historical discontinuities reject every missing or duplicated input minute',()=>{
  let before=zone.initialOffsetSeconds,checked=0;
  for(const t of zone.transitions) {
    const a=(t.utcSeconds+Math.min(before,t.offsetSeconds))*1000;
    const b=(t.utcSeconds+Math.max(before,t.offsetSeconds))*1000;
    for(let wall=Math.ceil(a/60000)*60000;wall<b;wall+=60000) {
      const input={...base,...fields(wall)};
      const error=t.offsetSeconds>before?'NONEXISTENT_BIRTH_TIME':'AMBIGUOUS_BIRTH_TIME';
      assert.throws(()=>calculateProfile(input),new RegExp(error));
      checked++;
    }
    before=t.offsetSeconds;
  }
  assert.equal(checked,1533);
  // The 1908 jump ends at 00:02:08; minute 00:02 is conservatively rejected.
  assert.equal(resolveSeoulWallTime({year:1908,month:4,day:1,hour:0,minute:2,second:7}).status,'nonexistent');
  assert.equal(resolveSeoulWallTime({year:1908,month:4,day:1,hour:0,minute:2,second:8}).status,'unique');
});
test('civil midnight policy follows a KASI anchored 60-day cycle over the supported dates',()=>{
  const anchor=load('kasi-derived.json').dates[0];
  const stems='갑을병정무기경신임계',branches='자축인묘진사오미신유술해';
  const anchorMs=Date.UTC(anchor.solar[0],anchor.solar[1]-1,anchor.solar[2]);
  let checked=0;
  for(let ms=Date.UTC(1908,0,1);ms<Date.UTC(2027,0,1);ms+=86400000) {
    const date=fields(ms),days=(ms-anchorMs)/86400000;
    const mod=(n,d)=>((n%d)+d)%d;
    const expected=stems[mod(stems.indexOf(anchor.dayPillar[0])+days,10)]+branches[mod(branches.indexOf(anchor.dayPillar[1])+days,12)];
    // Core checks the declared convention, not the historic truth of that convention.
    for(const minute of [0,1379,1380,1439]) {
      const p=computeFourPillars({instantUTCms:ms-9*3600000+minute*60000,apparentMs:ms+minute*60000},date.year,'midnight');
      assert.equal(p.day.heavenlyStem+p.day.earthlyBranch,expected);
    }
    checked++;
  }
  assert.equal(checked,43465);
});
test('late zi convention and daylight clock choices are visible alternatives, not hidden corrections',()=>{
  const wall=Date.UTC(1988,5,1,23,30),instant=wall-10*3600000;
  const core=(clock,rule)=>computeFourPillars({instantUTCms:instant,apparentMs:clock},1988,rule);
  const civil=core(wall,'midnight'),jasi=core(wall,'jasi'),split=core(wall,'splitJasi');
  assert.notDeepEqual(civil.day,jasi.day);
  assert.deepEqual(civil.day,split.day);
  assert.deepEqual(jasi.hour,split.hour);
  assert.notDeepEqual(civil.hour,core(wall-3600000,'midnight').hour);
  const profile=calculateProfile({...base,...fields(wall)});
  assert.equal(profile.pillars.day,civil.day.heavenlyStem+civil.day.earthlyBranch);
  assert.equal(profile.pillars.hour,civil.hour.heavenlyStem+civil.hour.earthlyBranch);
  assert.equal(profile.policy.solarCorrection,false);
  assert.equal(profile.policy.productionApproved,false);
});

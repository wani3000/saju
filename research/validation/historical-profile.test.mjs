import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
// Preserve original v3 transmission/accuracy probes; v4 guard has separate tests.
import {calculateProfile} from './baseline-v3.mjs';
import {resolveSeoulDate} from './resolve-wall-time.mjs';
import {calculateFourPillars, getSolarTerm} from './build/manseryeok.mjs';
const kasi = JSON.parse(readFileSync(new URL('./fixtures/kasi-derived.json', import.meta.url)));
const wallCases = JSON.parse(readFileSync(new URL('./fixtures/seoul-wall-times.json', import.meta.url))).cases;
const base = {calendar:'solar', leap:false, timeKnown:true};
const localFields = ms => {
  const d=new Date(ms);
  return {year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate(),hour:d.getUTCHours(),minute:d.getUTCMinutes()};
};

test('adapter retains 738 independent-source day pillars and lunar equivalence', () => {
  for (const sample of kasi.dates) {
    const [year,month,day] = sample.solar;
    const solar=calculateProfile({...base,year,month,day,hour:12,minute:0});
    assert.equal(solar.pillars.day,sample.dayPillar,JSON.stringify(sample.solar));
    const [ly,lm,ld,leap]=sample.lunar;
    const lunar=calculateProfile({...base,calendar:'lunar',year:ly,month:lm,day:ld,leap,hour:12,minute:0});
    assert.deepEqual(lunar.pillars,solar.pillars);
  }
});
test('adapter preserves independent KASI minute-rounded month boundaries (48 probes)', () => {
  const monthBranch=['축','인','묘','진','사','오','미','신','유','술','해','자'];
  for (const term of kasi.terms.filter(t => t.index%2 === 0)) {
    const [y,m,d,h,min]=term.local;
    const wall=Date.UTC(y,m-1,d,h,min);
    for(const delta of [-1,1]) {
      const chart=calculateProfile({...base,...localFields(wall+delta*60000)});
      const index=(term.index/2+(delta<0?11:0))%12;
      assert.equal(chart.pillars.month[1],monthBranch[index],`${term.year} ${term.name} ${delta}`);
    }
  }
});
test('historical offsets reach year/month computation without shifting civil day/hour', () => {
  // Mechanism tests use the candidate's own term times, NOT astronomical accuracy oracles.
  for (const [year,index,offsetMinutes] of [[1954,6,510],[1988,10,600]]) {
    const term=getSolarTerm(year,index).date.getTime();
    for (const delta of [-1,1]) {
      const instant=term+delta*60000;
      const local=localFields(instant+offsetMinutes*60000);
      const profile=calculateProfile({...base,...local});
      // UTC+9 wrapper on the equivalent instant must yield same year/month.
      const utc9=calculateFourPillars({...localFields(instant+540*60000),dayBoundary:'midnight'}).toObject();
      assert.equal(profile.pillars.year,utc9.year);
      assert.equal(profile.pillars.month,utc9.month);
      const civil=calculateFourPillars({...local,dayBoundary:'midnight'}).toObject();
      assert.equal(profile.pillars.day,civil.day);
      assert.equal(profile.pillars.hour,civil.hour);
      assert.equal(Date.parse(profile.civilTime.candidates[0].utc),instant);
    }
    const unknown=calculateProfile({...base,...localFields(term+offsetMinutes*60000),timeKnown:false,hour:null,minute:null});
    assert.equal(unknown.pillars.month,null);
    assert.equal(unknown.pillars.hour,null);
    assert.equal(unknown.candidates.month.length,2);
  }
});
test('real birth dates cover 23/25 hour DST dates with half-open intervals', () => {
  for(const [month,day,hours] of [[5,8,23],[10,9,25]]) {
    const {intervals}=resolveSeoulDate({year:1988,month,day});
    assert.equal(intervals.reduce((sum,i)=>sum+i.endUTCms-i.startUTCms,0),hours*3600000);
    for(let i=1;i<intervals.length;i++) assert.ok(intervals[i-1].endUTCms<=intervals[i].startUTCms);
  }
});
test('civil-date intervals contain every pinned Python UTC candidate exactly once', () => {
  for(const sample of wallCases) {
    const {intervals}=resolveSeoulDate(sample.wall);
    const wall=Date.UTC(sample.wall.year,sample.wall.month-1,sample.wall.day,sample.wall.hour,sample.wall.minute,sample.wall.second);
    const candidates=intervals.filter(i=>wall-i.offsetSeconds*1000>=i.startUTCms && wall-i.offsetSeconds*1000<i.endUTCms)
      .map(i=>({utc:new Date(wall-i.offsetSeconds*1000).toISOString(),offsetSeconds:i.offsetSeconds}));
    assert.deepEqual(candidates,sample.candidates,JSON.stringify(sample.wall));
  }
});
test('unknown time covers civil dates that begin inside a clock gap', () => {
  const result=calculateProfile({...base,year:1961,month:8,day:10,timeKnown:false});
  assert.equal(result.pillars.hour,null);
  assert.equal(result.civilTime,undefined);
  assert.equal(result.policy.dayHourClock,'civil-wall');
  assert.equal(result.policy.productionApproved,false);
});
test('civil midnight still changes day pillar rather than adopting UTC date', () => {
  const before=calculateProfile({...base,year:1954,month:4,day:5,hour:23,minute:59});
  const after=calculateProfile({...base,year:1954,month:4,day:6,hour:0,minute:0});
  assert.notEqual(before.pillars.day,after.pillars.day);
  assert.equal(after.civilTime.candidates[0].utc,'1954-04-05T15:30:00.000Z');
});

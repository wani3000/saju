import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {auditSolarModels,referenceTerms,referenceUtMs} from './audit-solar-models.mjs';
import {preciseUpstreamTerm} from './term-precision.mjs';
import {calculateProfile} from './adapter.mjs';
import {calculateProfile as baseline} from './baseline-v3.mjs';
import {getSolarTerm} from './build/manseryeok.mjs';
const zone=JSON.parse(readFileSync(new URL('./fixtures/seoul-transitions.json',import.meta.url)));
const branches=['축','인','묘','진','사','오','미','신','유','술','해','자'];
const fixture=JSON.parse(readFileSync(new URL('./fixtures/jpl-de440s-terms.json',import.meta.url)));
const report=auditSolarModels();
function wallFields(ut) {
  let offset=zone.initialOffsetSeconds;
  for(const transition of zone.transitions){if(ut<transition.utcSeconds*1000) break;offset=transition.offsetSeconds;}
  const date=new Date(ut+offset*1000);
  return {year:date.getUTCFullYear(),month:date.getUTCMonth()+1,day:date.getUTCDate(),hour:date.getUTCHours(),minute:date.getUTCMinutes()};
}
const base={calendar:'solar',leap:false,timeKnown:true};

test('independent TT fixture is hash pinned, covers 119 complete years and preserves its time scale',()=>{
  const bytes=readFileSync(new URL('./fixtures/jpl-de440s-terms.json',import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),readFileSync(new URL('./fixtures/jpl-de440s-terms.sha256',import.meta.url),'utf8').trim());
  assert.deepEqual(fixture.provenance,JSON.parse(readFileSync(new URL('./ephemeris.lock.json',import.meta.url))));
  assert.equal(referenceTerms.length,2856);
  assert.match(fixture.provenance.timeScale,/^TT/);
  assert.equal(fixture.provenance.productionApproved,false);
  for(let year=1908;year<=2026;year++) {
    const terms=referenceTerms.filter(t=>t.year===year);
    assert.deepEqual(terms.map(t=>t.index),Array.from({length:24},(_,i)=>i));
    for(let i=1;i<terms.length;i++) assert.ok(terms[i].ttJulianDay>terms[i-1].ttJulianDay);
  }
  assert.throws(()=>referenceUtMs(referenceTerms[0],undefined),/DELTA_T_REQUIRED/);
});

test('remaining minute differences reproduce as small TT model offsets, partially due to nutation',()=>{
  assert.deepEqual(report,JSON.parse(readFileSync(new URL('./reports/solar-model-audit.json',import.meta.url))));
  for(const [i,expected] of [1.388,1.305].entries())
    assert.ok(Math.abs(report.cases[i].upstreamMinusReferenceSeconds-expected)<0.002);
  for(const c of report.cases) {
    assert.equal(c.naojTransition.referenceInsideConditionalInterval,true);
    assert.match(c.naojTransition.assumption,/If/);
    assert.ok(c.nutationSensitivity.replacementShiftSeconds<0);
    assert.ok(c.nutationSensitivity.residualAfterReplacementSeconds>0);
    assert.ok(c.nutationSensitivity.residualAfterReplacementSeconds<c.upstreamMinusReferenceSeconds);
  }
  assert.equal(report.naojDisplayedMinuteCheck.compared,192);
  assert.deepEqual(report.naojDisplayedMinuteCheck.mismatches,[]);
});

test('each NAOJ threshold control retains verified query, header and raw bytes',()=>{
  const controls=JSON.parse(readFileSync(new URL('./fixtures/naoj-threshold/sources.json',import.meta.url)));
  assert.equal(controls.length,8);
  for(const c of controls) {
    assert.equal(new URL(c.url).searchParams.get('dt'),c.deltaTInput);
    assert.equal(new URL(c.url).searchParams.get('dtm'),'99');
    assert.equal(createHash('sha256').update(readFileSync(new URL(`./fixtures/naoj-threshold/${c.file}`,import.meta.url))).digest('hex'),c.sha256);
  }
});

test('continuous-root comparison removes 37 double-rounding discrepancies without changing locked baseline',()=>{
  let count=0;
  for(const term of referenceTerms) {
    const precise=preciseUpstreamTerm(term.year,term.index);
    const legacy=getSolarTerm(term.year,term.index).date.getTime();
    assert.equal(legacy,Math.round(precise.publicSecondEpochMs/60000)*60000);
    assert.equal(precise.singleRoundedMinuteMs,Math.round(precise.utEpochMs/60000)*60000);
    if(legacy!==precise.singleRoundedMinuteMs) {
      assert.equal(legacy-precise.singleRoundedMinuteMs,60000);
      const seconds=((precise.utEpochMs%60000)+60000)%60000/1000;
      assert.ok(seconds>=29.5&&seconds<30);
      count++;
    }
  }
  assert.equal(count,37);
  // These two defects are separate: single rounding cannot fix model offsets.
  for(const c of report.cases) assert.equal(preciseUpstreamTerm(c.year,c.index).singleRoundedMinuteMs,getSolarTerm(c.year,c.index).date.getTime());
  assert.throws(()=>preciseUpstreamTerm(2024,24),/INVALID_TERM/);
});

test('v4 preserves both possible month branches at all 1428 independent monthly roots',()=>{
  let count=0;
  for(const term of referenceTerms.filter(t=>t.index%2===0)) {
    const deltaT=preciseUpstreamTerm(term.year,term.index).deltaTSeconds;
    const input={...base,...wallFields(referenceUtMs(term,deltaT))};
    const result=calculateProfile(input),old=baseline(input);
    assert.equal(result.pillars.month,null,JSON.stringify(input));
    assert.deepEqual(result.candidates.month.map(p=>p[1]).sort(),[branches[(term.index/2+11)%12],branches[term.index/2]].sort());
    assert.equal(result.pillars.day,old.pillars.day);
    assert.equal(result.pillars.hour,old.pillars.hour);
    if(term.index===2) assert.equal(result.pillars.year,null);
    count++;
  }
  assert.equal(count,1428);
});

test('all 2856 independent monthly probes four minutes away retain expected side of the boundary',()=>{
  let count=0;
  for(const term of referenceTerms.filter(t=>t.index%2===0)) for(const direction of [-1,1]) {
    const ut=referenceUtMs(term,preciseUpstreamTerm(term.year,term.index).deltaTSeconds)+direction*240000;
    const result=calculateProfile({...base,...wallFields(ut)});
    assert.equal(result.pillars.month[1],branches[(term.index/2+(direction<0?11:0))%12]);
    assert.equal(result.boundaryReview,undefined);
    count++;
  }
  assert.equal(count,2856);
});

test('independent reference audit still cannot approve a production release',()=>{
  const run=spawnSync(process.execPath,[new URL('./audit-solar-models.mjs',import.meta.url).pathname,'--check','--release-check'],{encoding:'utf8'});
  assert.equal(run.status,2);
  assert.equal(JSON.parse(run.stdout).productionApproved,false);
});

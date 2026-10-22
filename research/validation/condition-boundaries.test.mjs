import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildConditionBoundaryAudit,conditionMatrix} from './audit-condition-boundaries.mjs';
import {synthesizeProfile,synthesizeBirth} from './whole-chart-synthesis.mjs';
import {chart} from './beta-quality-pack.mjs';
const profile=()=>chart({year:'임자',month:'병인',day:'갑진',hour:'정사'});
test('between-pair clauses never become a whole-chart blocker; column-presence clauses retain their scope',()=>{
 const rows=conditionMatrix();assert.equal(rows.length,60);
 for(const r of rows){assert.equal(r.observedVeto,r.expectedVeto);assert.equal(r.finalTransformation,null);assert.equal(r.unknownHourFinal,null);}
 assert.equal(rows.find(r=>r.id==='갑:year:month').observedVeto,true);
 assert.equal(rows.find(r=>r.id==='갑:year:hour').observedVeto,false);
 assert.equal(rows.find(r=>r.id==='기:month:hour').observedVeto,false);
 assert.equal(rows.find(r=>r.id==='을:hour:year').observedVeto,false);
 assert.equal(rows.find(r=>r.id==='병:month:hour').observedVeto,true);
 assert.equal(rows.find(r=>r.id==='임:hour:year').observedVeto,true);
 assert.equal(rows.find(r=>r.id==='계:month:year').observedVeto,true);
});
test('review-flag presence cannot be cleared by falsy values in synthesis or downstream personality blockers',()=>{
 for(const flag of ['boundaryReview','clockReview'])for(const value of [false,null,{}]){
  const p={...profile(),[flag]:value},r=synthesizeProfile(p),reason=flag==='boundaryReview'?'SOLAR_TERM_BOUNDARY_REVIEW':'HISTORICAL_CLOCK_REVIEW';
  assert.ok(r.missing.includes(reason));assert.ok(r.decisions.every(d=>d.blockers.includes(reason)));
  assert.equal(r.reviews.boundaryPriority.order[0].resolved,false);assert.ok(r.decisions.every(d=>d.value===null));
 }
 assert.equal(synthesizeProfile(profile()).reviews.boundaryPriority.order[0].resolved,true);
 assert.equal(synthesizeProfile({...profile(),clockReview:undefined,boundaryReview:undefined}).reviews.boundaryPriority.order[0].resolved,true);
});
test('profile-only analysis awaits seasonal input; resolving it clears only that reason, never a final judgment',()=>{
 const pure=synthesizeProfile(profile());assert.equal(pure.seasonalCommand.status,'birth-input-required');
 for(const d of pure.decisions.filter(d=>d.id!=='personality'))assert.ok(d.blockers.includes('SEASONAL_COMMAND_UNRESOLVED'));
 const birth={calendar:'solar',leap:false,timeKnown:false,year:2024,month:2,day:10};
 const known=synthesizeBirth(birth);assert.equal(known.seasonalCommand.status,'single-command');
 assert.ok(known.decisions.every(d=>!d.blockers.includes('SEASONAL_COMMAND_UNRESOLVED')));
 assert.ok(known.decisions.every(d=>d.blockers.includes('UNKNOWN_HOUR')));assert.ok(known.decisions.every(d=>d.value===null));
 const summer=synthesizeBirth({...birth,month:6,day:15});assert.ok(summer.decisions[0].blockers.includes('SEASONAL_COMMAND_UNRESOLVED'));
});
test('22 exact source cases, 88 altered charts and missing hours remain distinct; source hashes reproduce',()=>{
 const report=buildConditionBoundaryAudit();assert.equal(report.metrics.exactSourceCases,22);assert.equal(report.metrics.onePillarMutationCases,88);
 assert.equal(report.metrics.unknownHourCases,22);assert.equal(report.metrics.clauseMismatches,0);assert.equal(report.metrics.reviewFlagCases,6);
 assert.equal(report.productionApproved,false);assert.deepEqual(report,buildConditionBoundaryAudit());
});

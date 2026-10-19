import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {chart} from './audit-extended-sources.mjs';
import {ruleCatalog,stems,branches} from './reading-rules.mjs';
import {compareProfiles} from './reading-analysis.mjs';
import {calculateProfile} from './adapter.mjs';
import {buildSelectedReading,selectedReadingPolicy as policy} from './selected-reading.mjs';
const a=()=>chart({year:'갑자',month:'갑자',day:'갑자',hour:'갑자'});
const b=()=>chart({year:'기축',month:'기축',day:'기축',hour:'기축'});
const pillar=(c,component)=>component==='stem'?c+(stems.indexOf(c)%2?'축':'자'):(branches.indexOf(c)%2?'을':'갑')+c;

test('selected policy adopts exactly the 17 reviewed symbolic definitions and three shared positions, with frozen pending approval',()=>{
 assert.deepEqual([...policy.includedRuleIds].sort(),ruleCatalog.rules.map(r=>r.id).sort());
 assert.deepEqual(policy.comparisonPositions,['year','month','day']);assert.equal(policy.productionApproved,false);
 assert.equal(policy.review.domainInterpretationApproval,'pending');assert.equal(policy.review.calendarProductionApproval,'pending');
 assert.throws(()=>policy.copy.title='forged',TypeError);
 assert.ok(policy.excluded.includes('compatibility-score'));assert.ok(policy.excluded.includes('transformation-verdict'));
});

test('every adopted pair is observed in both directions at the same known year positions with its original source',()=>{
 for(const r of ruleCatalog.rules) for(const reverse of [false,true]){
  const x=a(),y=a();x.pillars.year=pillar(r.symbols[reverse?1:0],r.component);y.pillars.year=pillar(r.symbols[reverse?0:1],r.component);
  const result=buildSelectedReading(x,y,'친구');
  assert.ok(result.basis.commonFamilies.includes(r.label),r.id);
  const raw=compareProfiles(x,y).findings.find(f=>f.ruleId===r.id&&f.endpoints.every(e=>e.position==='year'));
  assert.equal(raw.certainty,'all-candidates');
  for(const f of result.basis.observations)assert.deepEqual(f.source,ruleCatalog.rules.find(r=>r.id===f.ruleId).source);
  assert.equal(result.score,null);
 }
});

test('input-specific day elements and comparison copy replace the fixed generic example',()=>{
 const x=buildSelectedReading(a(),b(),'친구'),y=buildSelectedReading(a(),a(),'친구');
 assert.notEqual(x.strength,y.strength);assert.notEqual(x.difference,y.difference);
 assert.deepEqual(x.basis.dayElements.map(d=>d.element),['목','토']);
 assert.ok(x.difference.includes('천간 합'));assert.ok(x.difference.includes('지지 육합'));
 assert.equal(y.basis.totalCommonObservations,0);assert.equal(y.difference,policy.copy.noMatch);
 assert.equal(y.score,null);assert.equal(y.basis.mapStatus,'collection-only-not-ranked');
});

test('editorial display cap never hides a coexisting family from the summary or cancels clashes',()=>{
 const x=a(),y=b();y.pillars.day='병오';
 const r=buildSelectedReading(x,y,'친구');
 assert.ok(r.basis.commonFamilies.includes('지지 육충'));assert.ok(r.basis.commonFamilies.includes('천간 합'));
 assert.ok(r.difference.includes('지지 육충'));assert.equal(r.basis.observations.length,6);
 assert.equal(r.basis.totalCommonObservations-r.basis.observations.length,r.basis.omittedDisplayObservations);
 assert.ok(r.basis.omittedDisplayObservations>0);assert.equal(r.score,null);
});

test('partial day candidates are omitted, including uncertain day element, without candidate probabilities',()=>{
 const x=a(),y=b();x.pillars.day=null;x.candidates={day:['갑자','병자']};
 const r=buildSelectedReading(x,y,'연인');assert.equal(r.basis.dayElements[0].element,null);
 assert.equal(r.strength,policy.copy.uncertainDay);assert.ok(r.basis.omittedCandidateDependentFacts>0);
 assert.ok(r.basis.observations.every(o=>!(o.family==='stem-combination'&&o.positions.some(p=>p.side==='a'&&p.position==='day'))));
 const common=compareProfiles(x,y).findings.filter(f=>f.certainty==='all-candidates');
 for(const o of r.basis.observations)assert.ok(common.some(f=>f.ruleId===o.ruleId&&JSON.stringify(f.endpoints)===JSON.stringify(o.positions)));
 assert.ok(!JSON.stringify(r).includes('probability'));
});

test('known hour changes and unknown-hour exclusion do not alter the shared year-month-day comparison',()=>{
 const x=a(),y=b(),known=buildSelectedReading(x,y,'친구');
 x.pillars.hour='병오';y.pillars.hour='임자';const changed=buildSelectedReading(x,y,'친구');
 assert.equal(known.strength,changed.strength);assert.equal(known.difference,changed.difference);
 assert.deepEqual(known.basis.observations,changed.basis.observations);
 x.timeKnown=false;x.pillars.hour=null;const unknown=buildSelectedReading(x,y,'친구');
 assert.deepEqual(known.basis.observations,unknown.basis.observations);assert.equal(unknown.basis.coverage[0].hourKnown,false);
 assert.ok(unknown.basis.cautions.some(t=>t.includes('시주는 보충하지')));
 assert.ok(unknown.basis.observations.every(o=>o.positions.every(p=>p.position!=='hour')));
});

test('relationship changes only the editorial prompt; invalid relationships fail closed',()=>{
 const rs=['친구','가족','연인','동료'].map(t=>buildSelectedReading(a(),b(),t));
 assert.equal(new Set(rs.map(r=>r.advice)).size,4);
 for(const r of rs){assert.deepEqual(r.basis,rs[0].basis);assert.equal(r.difference,rs[0].difference);assert.equal(r.score,null);}
 assert.throws(()=>buildSelectedReading(a(),b(),'unsupported'));
});

test('swapping A/B preserves family set and total facts without manufacturing a symmetric numeric score',()=>{
 const x=a(),y=b();y.pillars.month='경오';
 const r=buildSelectedReading(x,y,'친구'),s=buildSelectedReading(y,x,'친구');
 assert.deepEqual(r.basis.commonFamilies,s.basis.commonFamilies);assert.equal(r.basis.totalCommonObservations,s.basis.totalCommonObservations);
 assert.deepEqual(r.basis.dayElements.map(e=>e.element),s.basis.dayElements.map(e=>e.element).reverse());assert.equal(s.score,null);
});

test('private metadata is not copied, calendar review flags survive, and unsupported historical engines do not get silently upgraded',()=>{
 const x=a();Object.assign(x,{name:'PRIVATE_ALIAS',birth:'PRIVATE_BIRTH',clockReview:{secret:'PRIVATE_CLOCK'},boundaryReview:{secret:'PRIVATE_BOUNDARY'}});
 const r=buildSelectedReading(x,b(),'친구');assert.ok(!JSON.stringify(r).includes('PRIVATE_'));
 assert.equal(r.basis.coverage[0].clockReviewRequired,true);assert.equal(r.basis.coverage[0].boundaryReviewRequired,true);
 assert.ok(r.basis.cautions.some(t=>t.includes('절기 경계')));assert.ok(r.basis.cautions.some(t=>t.includes('표준시')));
 x.policy.version='research-civil-midnight-v4';assert.throws(()=>buildSelectedReading(x,b(),'친구'));
});

test('real solar/lunar equivalents and input-candidate permutations give deterministic identical copy',()=>{
 const p=calculateProfile({calendar:'solar',leap:false,timeKnown:false,year:2024,month:2,day:10});
 const q=calculateProfile({calendar:'lunar',leap:false,timeKnown:false,year:2024,month:1,day:1});
 assert.deepEqual(buildSelectedReading(p,p,'친구'),buildSelectedReading(q,q,'친구'));
 const x=a();x.pillars.month=null;x.candidates={month:['갑자','병자']};const r=buildSelectedReading(x,b(),'친구');x.candidates.month.reverse();
 assert.deepEqual(buildSelectedReading(x,b(),'친구'),r);
});

test('selected reading report reproduces and production release check stays explicit',()=>{
 const file=new URL('./audit-selected-reading.mjs',import.meta.url).pathname;
 const r=spawnSync(process.execPath,[file,'--check'],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
 const blocked=spawnSync(process.execPath,[file,'--release-check'],{encoding:'utf8'});assert.equal(blocked.status,2,blocked.stderr);
 const doc=readFileSync(new URL('./reports/selected-reading-drafts.md',import.meta.url),'utf8');assert.ok(doc.includes('동료'));
});

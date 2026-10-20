import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {criteriaSource,reviewScopedGuards,auditFiveElementShortcut,reviewScopedPair} from './scoped-criteria.mjs';
import {buildPolicyCriteriaAudit,guardFixtures} from './audit-policy-criteria.mjs';
import {chart} from './beta-quality-pack.mjs';
const f=guardFixtures(),one=p=>reviewScopedGuards(p).alternatives[0];
test('all five source pairs in both directions retain their directly named hour trigger',()=>{
 assert.equal(f.slice(0,10).length,10);
 for(const c of f.slice(0,10)) {
  const r=reviewScopedGuards(c.profile);assert.equal(r.triggerInEveryCandidate,true,c.id);
  assert.equal(r.alternatives[0].partnerPresence,'observed',c.id);
  assert.equal(r.alternatives[0].triggers[0].position,'hour');
  assert.equal(r.transformationEstablished,null);
 }
});
test('synthetic guard fixtures respect pinned year-month and day-hour stem anchor dependencies',()=>{
 const anchors=JSON.parse(readFileSync(new URL('./fixtures/reading-sources/month-hour-anchors.json',import.meta.url)));
 const han='甲乙丙丁戊己庚辛壬癸',ko='갑을병정무기경신임계';
 const expected=(part,stem,offset)=>{
  const a=anchors[part].anchors.find(a=>a.stems.includes(han[ko.indexOf(stem)]));
  return ko[(han.indexOf(a.start)+offset)%10];
 };
 for(const {profile:p} of f) {
  assert.equal(p.pillars.month[0],expected('month',p.pillars.year[0],'인묘진사오미신유술해자축'.indexOf(p.pillars.month[1])));
  if(p.timeKnown)assert.equal(p.pillars.hour[0],expected('hour',p.pillars.day[0],'자축인묘진사오미신유술해'.indexOf(p.pillars.hour[1])));
 }
});
test('preferred full hour can coexist with the explicit Wu-Gui day-branch warning',()=>{
 const r=reviewScopedGuards(f[10].profile);
 assert.equal(r.listedPreference.status,'preference-example-matched');
 assert.deepEqual(r.alternatives[0].triggers,[{position:'day',component:'branch',symbol:'유'}]);
 assert.equal(r.transformationEstablished,null);
});
test('unknown hour preserves a known day trigger but never invents an hour or final veto',()=>{
 const r=reviewScopedGuards(f[11].profile);
 assert.equal(r.triggerInEveryCandidate,true);assert.equal(r.alternatives[0].hourUnobserved,true);
 assert.ok(r.alternatives[0].triggers.every(t=>t.position==='day'));
 assert.equal(r.sourceClauseFinalVerdict,null);
 const p=structuredClone(f[0].profile);p.timeKnown=false;p.pillars.hour=null;
 assert.equal(one(p).status,'hour-unobserved');
});
test('day stem and branch remain one candidate rather than fabricating an impossible Wu-You day',()=>{
 const p=structuredClone(f[10].profile);p.pillars.day=null;p.candidates={day:['무진','계유']};
 const r=reviewScopedGuards(p);assert.equal(r.status,'candidate-dependent');
 assert.equal(r.triggerInEveryCandidate,false);
 assert.deepEqual(r.alternatives.map(a=>a.triggers.length).sort(),[0,1]);
});
test('month stem partner and month branch context cannot be borrowed from exclusive candidates',()=>{
 const p=chart({year:'임자',month:null,day:'계유',hour:'병진'});p.candidates={month:['무진','정사']};
 const r=reviewScopedGuards(p);
 assert.ok(r.alternatives.some(a=>a.contextMatched&&a.partnerPresence==='absent'));
 assert.ok(r.alternatives.some(a=>!a.contextMatched&&a.partnerPresence==='observed'));
 assert.ok(!r.alternatives.some(a=>a.contextMatched&&a.partnerPresence==='observed'));
});
test('listed month context and direct symbol absence do not prove a passed transformation condition',()=>{
 const p=structuredClone(f[2].profile);p.pillars.month='무진';
 assert.equal(one(p).status,'outside-listed-month-context');
 const q=structuredClone(f[10].profile);q.pillars.day='계해';
 assert.equal(one(q).status,'no-listed-trigger-observed');
 assert.equal(one(q).sourceClauseFinalVerdict,null);assert.equal(one(q).transformationEstablished,null);
});
test('ambiguous Jia-Ji exception and Wu/Ji wording are preserved without automatic emendation or blanket veto',()=>{
 assert.ok(criteriaSource.guards[0].unresolved.some(t=>t.includes('余月')));
 assert.equal(criteriaSource.textCollation.adoptedAsScanCorrection,false);
 const r=one(f[10].profile);assert.equal(r.partnerPresence,'observed');
 assert.ok(r.unresolved.some(t=>t.includes('若犯戊己')));assert.equal(r.sourceClauseFinalVerdict,null);
});
test('all five elements can occur in a source extreme chart and cannot be used as sufficient balance',()=>{
 const r=auditFiveElementShortcut();assert.equal(r.cases.length,20);assert.equal(r.counterexamples.length,8);
 const fire=r.cases.find(c=>c.id==='fire-too-strong');assert.equal(fire.allFivePresent,true);assert.equal(fire.sourceCategory,'too-strong');
 assert.equal(r.generalStrength,null);assert.equal(r.moderation,null);
});
test('individual guard partners are not supplied by the other person and cannot become a compatibility penalty',()=>{
 const a=chart({year:'경진',month:'경진',day:'갑자',hour:'병인'});
 const b=chart({year:'신축',month:'신축',day:'기축',hour:'을축'});
 const r=reviewScopedPair(a,b),reverse=reviewScopedPair(b,a);
 assert.equal(r.individuals[0].guards.alternatives[0].partnerPresence,'absent');
 assert.equal(r.individuals[1].guards.alternatives[0].partnerPresence,'absent');
 for(const k of ['score','normalizedCompatibility','mapRadius'])assert.equal(r[k],null);
 assert.deepEqual(r.individuals,reverse.individuals.toReversed());
});
test('calendar policy edges test half-open minute intersection without changing day/hour or claiming an error bound',()=>{
 const r=buildPolicyCriteriaAudit();assert.equal(r.calendar.monthBoundaryProbes,1296);
 assert.deepEqual(r.calendar.failures,[]);assert.equal(r.calendar.productionApproved,false);
 assert.equal(r.calendar.choices.find(c=>c.id==='production-adoption').value,null);
 assert.ok(r.calendar.choices.find(c=>c.id==='review-margin').value.includes('not an astronomical error bound'));
});
test('strict profile validation and privacy coverage persist in the new research review',()=>{
 const p=structuredClone(f[10].profile);p.name='PRIVATE_ALIAS';p.birth='PRIVATE_BIRTH';p.clockReview={private:'PRIVATE_FLAG'};p.boundaryReview={};
 const r=reviewScopedGuards(p);assert.equal(r.coverage[0].clockReviewRequired,true);
 assert.equal(r.coverage[0].boundaryReviewRequired,true);assert.ok(!JSON.stringify(r).includes('PRIVATE_'));
 assert.throws(()=>reviewScopedGuards({...p,policy:{version:'research-civil-midnight-v4',productionApproved:false}}));
 assert.throws(()=>reviewScopedGuards({...p,timeKnown:false}));
 assert.throws(()=>reviewScopedGuards({...p,pillars:{...p.pillars,day:'무유'}}));
});
test('actual calendar paths retain unknown hour, term candidates and historical clock review without final verdicts',()=>{
 const r=buildPolicyCriteriaAudit(),byId=id=>r.calendarInputs.find(c=>c.id===id).review;
 assert.equal(r.calendarInputs.length,4);
 assert.ok(byId('unknown-time').alternatives.every(a=>a.hourUnobserved));
 assert.equal(byId('term-candidates').coverage[0].boundaryReviewRequired,true);
 assert.equal(byId('clock-source-dispute').coverage[0].clockReviewRequired,true);
 assert.ok(r.calendarInputs.every(c=>c.review.transformationEstablished===null&&c.review.sourceClauseFinalVerdict===null));
});
test('new and previous reports reproduce, with release still blocked',()=>{
 for(const name of ['audit-policy-criteria.mjs','audit-adjudication.mjs','audit-hour-balance.mjs','audit-month-hour.mjs']) {
  const r=spawnSync(process.execPath,[new URL(name,import.meta.url).pathname,'--check'],{encoding:'utf8'});assert.equal(r.status,0,r.stdout+r.stderr);
 }
 const r=spawnSync(process.execPath,[new URL('audit-policy-criteria.mjs',import.meta.url).pathname,'--release-check'],{encoding:'utf8'});
 assert.equal(r.status,2,r.stdout+r.stderr);
});

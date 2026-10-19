import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {chart} from './audit-extended-sources.mjs';
import {preferredChart,interactionChart} from './audit-hour-balance.mjs';
import {preferredHours,earthInteractions,analyzeHourAndInteractions,analyzeGeneralBalance,reviewHourAndBalance,hourBalanceSource} from './hour-balance-review.mjs';
const fixed=p=>analyzeHourAndInteractions(p).alternatives[0];
const relation=(p,id)=>analyzeGeneralBalance(p).relationalReviews.find(x=>x.id===id);

test('new original and reused pages and transcriptions are pinned without altering earlier manifests',()=>{
 const dir=new URL('./fixtures/reading-sources/',import.meta.url),hash=b=>createHash('sha256').update(b).digest('hex');
 const m=JSON.parse(readFileSync(new URL('hour-balance-sources.json',dir)));
 for(const s of m.sources)for(const p of s.pages)assert.equal(hash(readFileSync(new URL(p.file,dir))),p.sha256);
 assert.equal(hash(readFileSync(new URL(m.transcriptionFile,dir))),m.transcriptionSha256);
 assert.throws(()=>preferredHours[0].months.push('자'),TypeError);
 assert.throws(()=>earthInteractions[0].pair='갑기',TypeError);
 const s=hourBalanceSource('preferred-hours');s.pdfPages.push(0);assert.deepEqual(hourBalanceSource('preferred-hours').pdfPages,[129]);
});

test('all five explicit preferred hours work in both day directions; matching never establishes wangqi or transformation',()=>{
 const expected=[['갑기','무진','진술축미'],['을경','경진','신유'],['병신','임진','해자'],['정임','갑진','인묘'],['무계','병진','사오']];
 for(const [pair,hour,months] of expected){
  const r=preferredHours.find(x=>x.pair===pair);assert.equal(r.hour,hour);assert.equal(r.months.join(''),months);
  for(const reverse of [false,true]){const a=fixed(preferredChart(r,reverse));assert.equal(a.hourPreference.status,'preference-example-matched');assert.equal(a.hourPreference.wangQiEstablished,null);assert.equal(a.transformationEstablished,null);}
 }
});

test('same hour stem with a different branch is not the preferred hour; nonlisting is not a rejection',()=>{
 for(const r of preferredHours){const p=preferredChart(r);p.pillars.hour=r.hour[0]+'자';const a=fixed(p);assert.equal(a.hourPreference.hourMatch,'outside-listed-example');assert.equal(a.transformationEstablished,null);}
});

test('preferred hour outside the accompanying month keeps general hour-only route unresolved',()=>{
 const p=preferredChart(preferredHours[0]);p.pillars.month='병자';const a=fixed(p);
 assert.equal(a.hourPreference.hourMatch,'listed-preferred-hour');assert.equal(a.hourPreference.monthMatch,false);
 assert.equal(a.hourPreference.status,'outside-complete-preference-example');assert.equal(a.hourPreference.wangQiEstablished,null);
});

test('unknown hour remains unobserved; missing partner cannot become a successful preference',()=>{
 const p=preferredChart(preferredHours[0]);p.timeKnown=false;p.pillars.hour=null;
 assert.equal(fixed(p).hourPreference.status,'incomplete-observation');assert.equal(fixed(p).hourPreference.hourMatch,'unobserved');
 p.timeKnown=true;p.pillars.hour='무진';p.pillars.year='임자';assert.equal(fixed(p).hourPreference.status,'no-day-partner');
});

test('duplicate partner is retained even when the preferred hour and month match',()=>{
 const p=preferredChart(preferredHours[0]);p.pillars.month='기축';const a=fixed(p);
 assert.equal(a.cardinality,'conflict');assert.equal(a.hourPreference.status,'preference-example-matched');assert.equal(a.transformationEstablished,null);
});

test('all four earth interaction patterns remain conditional and require both transformation premises',()=>{
 const expected=[['을경','damage','금'],['정임','damage','목'],['무계','assistance','화'],['병신','assistance','수']];
 for(const [pair,kind,el] of expected){const e=earthInteractions.find(x=>x.pair===pair);const a=fixed(interactionChart(e));assert.equal(a.earthInteractions.length,1);
  const x=a.earthInteractions[0];assert.equal(x.kind,kind);assert.equal(x.hypotheticalElement,el);assert.equal(x.status,'conditional-source-pattern');assert.ok(Object.values(x.premises).every(v=>v===null));}
});

test('missing base partner and other day pairs do not establish earth interaction or generalize it',()=>{
 const p=interactionChart(earthInteractions[0]);p.pillars.hour='임자';assert.equal(fixed(p).earthInteractions[0].status,'base-earth-combination-unobserved');
 p.pillars.day='병자';assert.deepEqual(fixed(p).earthInteractions,[]);
});

test('month candidate correlation cannot create an interaction requiring mutually exclusive stems',()=>{
 const p=chart({year:'경자',month:null,day:'갑자',hour:'임자'});p.candidates={month:['을축','기축']};
 const as=analyzeHourAndInteractions(p).alternatives;
 assert.ok(as.some(a=>a.earthInteractions.length));
 assert.ok(as.every(a=>!a.earthInteractions.some(e=>e.status==='conditional-source-pattern')));
});

test('hour candidates keep preferred branch and interaction stem correlated and output order stable',()=>{
 const p=chart({year:'기축',month:'경진',day:'갑자',hour:null});p.candidates={hour:['무진','을축']};
 const r=analyzeHourAndInteractions(p);assert.equal(r.commonHourPreference.hourMatch,null);
 assert.ok(r.alternatives.every(a=>!(a.hourPreference.hourMatch==='listed-preferred-hour'&&a.earthInteractions.length)));
 p.candidates.hour.reverse();assert.deepEqual(analyzeHourAndInteractions(p),r);
});

test('relational observations are not inequalities, balance, control or strength labels',()=>{
 const p=chart({year:'을축',month:'신유',day:'갑자',hour:'정묘'}),r=analyzeGeneralBalance(p);
 assert.equal(r.relationalReviews[0].status,'both-groups-observed-in-all-candidates');assert.equal(r.relationalReviews[1].status,'both-groups-observed-in-all-candidates');
 assert.equal(r.classification,null);assert.equal(r.moderation,null);assert.equal(r.score,null);
 for(const x of r.relationalReviews){assert.equal(x.relativeStrength,null);assert.equal(x.sourceImbalanceEstablished,null);assert.equal(x.effectiveControl,null);}
});

test('two groups in exclusive month candidates are not merged; unknown hour cannot prove absence',()=>{
 const p=chart({year:'갑자',month:null,day:'갑자',hour:'갑자'});p.candidates={month:['기축','을묘']};
 assert.equal(relation(p,'wealth-peer').status,'not-both-observed');assert.deepEqual(relation(p,'wealth-peer').observedPresenceMasks,[1,2]);
 p.timeKnown=false;p.pillars.hour=null;assert.equal(relation(p,'wealth-peer').status,'hour-unobserved-not-both-observed');
});

test('relational dynamic program agrees with exhaustive fixed-chart evaluation, preserving day and hidden-stem correlation',()=>{
 const candidates={year:['을축','정묘'],month:['기축','을묘'],day:['갑인','을묘'],hour:['병자','신유']};
 const p={...chart({year:null,month:null,day:null,hour:null}),candidates};
 const actual=analyzeGeneralBalance(p).relationalReviews,expected=actual.map(()=>new Set());
 for(const year of candidates.year)for(const month of candidates.month)for(const day of candidates.day)for(const hour of candidates.hour){
  const r=analyzeGeneralBalance(chart({year,month,day,hour}));r.relationalReviews.forEach((v,i)=>v.observedPresenceMasks.forEach(m=>expected[i].add(m)));}
 actual.forEach((v,i)=>assert.deepEqual(v.observedPresenceMasks,[...expected[i]].sort()));
});

test('strict validation and privacy/boundary flags propagate; day reference is never an extra peer',()=>{
 const p=chart({year:'갑인',month:'갑인',day:'갑인',hour:'갑인'});
 assert.throws(()=>analyzeHourAndInteractions({...p,timeKnown:false}));
 assert.throws(()=>analyzeGeneralBalance({...p,policy:{version:'untrusted'}}));
 p.name='PRIVATE_NAME';p.birthDate='PRIVATE_DATE';p.boundaryReview={};p.clockReview={};
 for(const r of [analyzeHourAndInteractions(p),analyzeGeneralBalance(p)]){assert.equal(r.coverage[0].boundaryReviewRequired,true);assert.equal(r.coverage[0].clockReviewRequired,true);assert.ok(!JSON.stringify(r).includes('PRIVATE_'));}
 const r=analyzeGeneralBalance(p);assert.ok(r.relationalReviews.every(x=>x.observations.every(o=>!(o.position==='day'&&o.layer==='visible'))));
});

test('integrated unknown-hour and 午 command uncertainty survive; reports reproduce and release stays blocked',()=>{
 const r=reviewHourAndBalance({calendar:'solar',leap:false,timeKnown:false,year:2024,month:6,day:15});
 assert.equal(r.previousReview.seasonalCommand.confirmedStem,null);assert.equal(r.generalBalance.classification,null);
 assert.equal(r.hourAndInteractions.commonHourPreference.hourMatch,'unobserved');
 for(const name of ['audit-extended-sources.mjs','audit-hour-balance.mjs']){const p=spawnSync(process.execPath,[new URL(name,import.meta.url).pathname,'--check'],{encoding:'utf8'});assert.equal(p.status,0,p.stderr);}
 const p=spawnSync(process.execPath,[new URL('audit-hour-balance.mjs',import.meta.url).pathname,'--release-check'],{encoding:'utf8'});assert.equal(p.status,2,p.stderr);
});

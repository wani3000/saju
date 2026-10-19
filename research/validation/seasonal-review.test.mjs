import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {seasonalCatalog,commandForRange,calculateSeasonalCommand} from './seasonal-command.mjs';
import {analyzeTransformationConditions,reviewStrengthAndTransformation} from './strength-transformation-review.mjs';
import {getSolarTermsOfYear} from './build/manseryeok.mjs';
import {natalCatalog} from './natal-rules.mjs';
const input={calendar:'solar',leap:false,timeKnown:false,year:2024,month:2,day:10};
const chart=(pillars={year:'기축',month:'무진',day:'갑자',hour:'병인'},rest={})=>({
  policy:{version:'research-civil-midnight-v5',productionApproved:false},timeKnown:true,pillars,...rest});
const knownInput=utc=>{const d=new Date(utc+9*3600000);return {...input,timeKnown:true,year:d.getUTCFullYear(),
  month:d.getUTCMonth()+1,day:d.getUTCDate(),hour:d.getUTCHours(),minute:d.getUTCMinutes()};};

test('new source manifest pins selected original pages, transcription and preserves printed ambiguities',()=>{
  const dir=new URL('./fixtures/reading-sources/',import.meta.url),hash=b=>createHash('sha256').update(b).digest('hex');
  const manifest=JSON.parse(readFileSync(new URL('seasonal-source.json',dir)));
  assert.equal(hash(readFileSync(new URL(manifest.transcriptionFile,dir))),manifest.transcriptionSha256);
  for(const p of manifest.pages) assert.equal(hash(readFileSync(new URL(p.file,dir))),p.sha256);
  assert.equal(manifest.pdfSha256,JSON.parse(readFileSync(new URL('source.json',dir))).pdfSha256);
  const transcription=JSON.parse(readFileSync(new URL(manifest.transcriptionFile,dir)));
  assert.ok(transcription.sections[0].text.includes('丁火十日九日己'));
  assert.ok(transcription.sections[2].text.includes('甲乙日生人'));
  assert.throws(()=>{seasonalCatalog.months[0].segments[0].days=30;},TypeError);
  const copy=commandForRange('인',1,2);copy.source.pdfPages.push(999);
  assert.deepEqual(commandForRange('인',1,2).source.pdfPages,[53,54]);
});

test('twelve literal allocation sequences match the reviewed poem rather than a substitute popular table',()=>{
  const expected={자:'임10 계20',축:'계9 신3 기18',인:'무7 병7 갑16',묘:'갑10 을20',진:'을9 계3 무18',
    사:'경9 병16 무5',오:'병10 정10 기9',미:'정9 을3 기18',신:'기7 무3 임3 경17',유:'경10 신20',술:'신9 정3 무18',해:'무7 갑5 임18'};
  for(const month of seasonalCatalog.months) assert.equal(month.segments.map(s=>s.stem+s.days).join(' '),expected[month.branch]);
  assert.equal(seasonalCatalog.months.length,12);
  assert.equal(seasonalCatalog.months.find(m=>m.branch==='오').nominalDays,29);
  assert.ok(seasonalCatalog.months.filter(m=>m.branch!=='오').every(m=>m.nominalDays===30));
  assert.ok(!natalCatalog.hiddenStems.find(r=>r.branch==='자').stems.includes('임'));
  assert.equal(commandForRange('자',0,1).confirmedStem,'임');
  assert.ok(!natalCatalog.hiddenStems.find(r=>r.branch==='신').stems.includes('기'));
  assert.equal(commandForRange('신',0,1).confirmedStem,'기');
});

test('every complete source segment obeys half-open boundaries and preserves straddling candidates',()=>{
  for(const m of seasonalCatalog.months.filter(m=>m.status==='source-scheme')) {
    for(let i=0;i<m.segments.length;i++) {
      const s=m.segments[i];
      assert.equal(commandForRange(m.branch,s.startDay,s.endDay).confirmedStem,s.stem);
      if(i) {
        const r=commandForRange(m.branch,s.startDay-1/86400,s.startDay+1/86400);
        assert.equal(r.confirmedStem,null);assert.deepEqual(r.candidateStems,[m.segments[i-1].stem,s.stem]);
      }
    }
  }
});

test('the 29-day 午 contradiction blocks the entire month instead of inventing a missing final day',()=>{
  for(const [a,b] of [[0,1],[9,10],[19,20],[28,29],[29,30],[30,31]]) {
    const r=commandForRange('오',a,b);assert.equal(r.status,'source-duration-conflict');
    assert.equal(r.confirmedStem,null);assert.equal(r.unallocated,true);assert.deepEqual(r.candidateStems,[]);
  }
});

test('real months longer than thirty days are not clamped or proportionally stretched',()=>{
  assert.equal(commandForRange('인',30,31).status,'outside-source-scheme');
  assert.equal(commandForRange('인',29,31).confirmedStem,null);
  assert.deepEqual(commandForRange('인',29,31).candidateStems,['갑']);
  assert.equal(commandForRange('인',29,30).confirmedStem,'갑');
  for(const args of [['인',-1,1],['인',2,2],['인',NaN,2],['인',1,Infinity],['인',0,367],['x',0,1],['인','0',1]])
    assert.throws(()=>commandForRange(...args),/INVALID_COMMAND_RANGE/);
});

test('actual elapsed time propagates the two-minute review margin to internal command boundaries',()=>{
  const term=getSolarTermsOfYear(2024).find(t=>t.name==='입춘').date.getTime();
  // Select the named 입춘 (index 2 in this engine), then independently check the resulting month branch.
  const boundary=term+7*86400000;
  const before=calculateSeasonalCommand(knownInput(boundary-4*60000));
  assert.deepEqual(before.monthBranches,['인']);assert.equal(before.confirmedStem,'무');
  const during=calculateSeasonalCommand(knownInput(boundary));
  assert.equal(during.status,'command-boundary');assert.equal(during.confirmedStem,null);
  assert.deepEqual(during.alternatives[0].candidateStems,['무','병']);
  assert.equal(calculateSeasonalCommand(knownInput(boundary+3*60000)).confirmedStem,'병');
});

test('unknown time uses the whole date, not noon, across an internal command boundary',()=>{
  const term=getSolarTermsOfYear(2024).find(t=>t.name==='입춘').date.getTime();
  const known=knownInput(term+7*86400000),{hour,minute,...date}=known;
  const result=calculateSeasonalCommand({...date,timeKnown:false});
  assert.equal(result.confirmedStem,null);assert.equal(result.status,'command-boundary');
  assert.deepEqual(result.alternatives[0].candidateStems,['무','병']);
});

test('real solar-term and historical ambiguity cannot be turned into a definite command',()=>{
  assert.equal(calculateSeasonalCommand({...input,day:4}).status,'solar-term-boundary-review');
  assert.equal(calculateSeasonalCommand({...input,year:1954,month:3,day:21}).status,'historical-clock-review');
  assert.throws(()=>calculateSeasonalCommand({...input,year:1954,month:3,day:21,timeKnown:true,hour:0,minute:15}),/HISTORICAL_CLOCK_SOURCE_DISPUTE/);
  assert.equal(calculateSeasonalCommand({...input,month:6,day:15}).status,'source-scheme-unresolved');
});

test('solar/lunar counterpart, ignored injected fields, and timezone-independent command results agree',()=>{
  const solar=calculateSeasonalCommand(input);
  assert.equal(solar.confirmedStem,'무');
  assert.deepEqual(solar,calculateSeasonalCommand({...input,calendar:'lunar',month:1,day:1}));
  assert.deepEqual(solar,calculateSeasonalCommand({...input,confirmedStem:'갑',elapsedDays:20}));
  const code=`import {calculateSeasonalCommand} from './seasonal-command.mjs'; console.log(JSON.stringify(calculateSeasonalCommand(${JSON.stringify(input)})));`;
  for(const TZ of ['UTC','America/New_York']) {
    const run=spawnSync(process.execPath,['--input-type=module','-e',code],{cwd:new URL('.',import.meta.url),encoding:'utf8',env:{...process.env,TZ}});
    assert.equal(run.status,0,run.stderr);assert.deepEqual(JSON.parse(run.stdout),solar);
  }
});

test('甲己 month condition checks all twelve branches and both day directions without claiming sufficiency',()=>{
  for(const branch of '자축인묘진사오미신유술해') for(const reverse of [false,true]) {
    const index=[...'자축인묘진사오미신유술해'].indexOf(branch);
    const profile=chart({year:reverse?'갑자':'기축',month:(index%2?'정':'병')+branch,day:reverse?'기축':'갑자',hour:'임자'});
    const result=analyzeTransformationConditions(profile);
    assert.equal(result.status,[...'진술축미'].includes(branch)?'reviewed-necessary-conditions-met':'necessary-condition-failed');
    assert.equal(result.transformationEstablished,false);assert.equal(result.transformedElement,null);
  }
});

test('visible extra 甲 and 乙 are concrete failures; duplicate 己 scope is not silently generalized',()=>{
  const extraJia=analyzeTransformationConditions(chart({year:'기축',month:'갑진',day:'갑자',hour:'병인'}));
  assert.ok(extraJia.commonFailedChecks.includes('no-extra-jia'));
  const eul=analyzeTransformationConditions(chart({year:'기축',month:'을미',day:'갑자',hour:'병인'}));
  assert.ok(eul.commonFailedChecks.includes('no-visible-eul'));
  const repeatedJi=analyzeTransformationConditions(chart({year:'갑자',month:'기축',day:'기미',hour:'병인'}));
  assert.equal(repeatedJi.status,'insufficient-data');
  assert.ok(repeatedJi.alternatives[0].reasons.includes('multiple-ji-scope-unreviewed'));
});

test('explicit intermediate control fails the combined review without deleting the original pair',()=>{
  const result=analyzeTransformationConditions(chart({year:'기축',month:'경진',day:'갑자',hour:'병인'}));
  assert.ok(result.commonFailedChecks.includes('no-explicit-intervening-obstruction'));
  assert.equal(result.status,'necessary-condition-failed');
});

test('unknown hour cannot pass absence/uniqueness checks but cannot rescue an already failed month',()=>{
  const base=chart({year:'기축',month:'무진',day:'갑자',hour:null},{timeKnown:false});
  assert.equal(analyzeTransformationConditions(base).status,'insufficient-data');
  assert.equal(analyzeTransformationConditions({...base,pillars:{...base.pillars,month:'병인'}}).status,'necessary-condition-failed');
  const noKnownPartner=chart({year:'병인',month:'무진',day:'갑자',hour:null},{timeKnown:false});
  assert.equal(analyzeTransformationConditions(noKnownPartner).status,'insufficient-data');
});

test('month candidates retain their stem/branch correlation through necessary-condition checks',()=>{
  const base=chart({year:'기축',month:null,day:'갑자',hour:'정묘'},{candidates:{month:['을사','병진']}});
  const result=analyzeTransformationConditions(base);
  assert.equal(result.status,'candidate-dependent');assert.equal(result.alternatives.length,2);
  const failed=result.alternatives.find(a=>a.status==='necessary-condition-failed');
  assert.deepEqual(failed.reasons,['month-earth-branch','no-visible-eul','no-explicit-intervening-obstruction']);
  assert.deepEqual(result.commonFailedChecks,[]);
});

test('all condition alternatives agree with sixteen projected fixed charts',()=>{
  const candidates={year:['기축','병인'],month:['을사','병진'],day:['갑자','기축'],hour:['갑인','정묘']};
  const profile=chart({year:null,month:null,day:null,hour:null},{candidates});
  const expected=new Set();
  for(const year of candidates.year) for(const month of candidates.month) for(const day of candidates.day) for(const hour of candidates.hour)
    for(const outcome of analyzeTransformationConditions(chart({year,month,day,hour})).alternatives) expected.add(JSON.stringify(outcome));
  const result=analyzeTransformationConditions(profile);
  assert.deepEqual(result.alternatives.map(a=>JSON.stringify(a)).sort(),[...expected].sort());
  assert.deepEqual(result,analyzeTransformationConditions({...profile,candidates:Object.fromEntries(Object.entries(candidates).map(([k,v])=>[k,[...v].reverse()]))}));
});

test('the reviewed pair is day-based, not any two stems or a universal five-combination model',()=>{
  assert.equal(analyzeTransformationConditions(chart({year:'갑자',month:'기축',day:'병인',hour:'정묘'})).status,'outside-reviewed-pair');
  assert.equal(analyzeTransformationConditions(chart({year:'경오',month:'무진',day:'을묘',hour:'정묘'})).status,'outside-reviewed-pair');
  assert.equal(analyzeTransformationConditions(chart({year:'병인',month:'무진',day:'갑자',hour:'정묘'})).status,'no-day-combination');
});

test('integrated strength review includes command, roots, exposures and opposing relations without counting a majority',()=>{
  const r=reviewStrengthAndTransformation(input);
  assert.equal(r.seasonalCommand.confirmedStem,'무');
  assert.equal(r.strength.classification,null);assert.equal(r.strength.score,null);
  assert.ok(r.strength.commandRelations.length);assert.ok(r.strength.sourceRootAssessments.length);
  assert.ok(r.strength.factors.some(f=>f.role==='support-relation'));
  assert.ok(r.strength.factors.some(f=>f.role==='output-wealth-or-control-relation'));
  assert.ok(r.strength.reviewReasons.includes('HOUR_UNOBSERVED'));
  assert.ok(r.strength.factors.every(f=>!(f.position==='day' && f.layer==='visible')));
  assert.deepEqual(r,reviewStrengthAndTransformation({...input,name:'PRIVATE-MARKER',birthDate:'PRIVATE-MARKER',strength:'strong',score:100}));
  assert.ok(!JSON.stringify(r).includes('PRIVATE-MARKER'));
  assert.ok(!JSON.stringify(r).includes('2024-02-10'));
  assert.deepEqual(r,reviewStrengthAndTransformation({...input,calendar:'lunar',month:1,day:1}));
});

test('invalid research profiles fail closed before transformation enumeration',()=>{
  for(const bad of [null,{},chart(undefined,{policy:{version:'future'}}),chart(undefined,{timeKnown:false}),
    chart({year:'갑축',month:'병인',day:'갑자',hour:'정묘'})]) assert.throws(()=>analyzeTransformationConditions(bad));
});

test('all twelve real month starts select the correct branch and first command segment',()=>{
  const expectedBranches=[...'축인묘진사오미신유술해자'];
  for(const term of getSolarTermsOfYear(2024).filter(t=>t.index%2===0)) {
    const result=calculateSeasonalCommand(knownInput(term.date.getTime()+2*86400000));
    const branch=expectedBranches[term.index/2];
    assert.deepEqual(result.monthBranches,[branch]);
    assert.equal(result.confirmedStem,branch==='오'?null:seasonalCatalog.months.find(m=>m.branch===branch).segments[0].stem);
  }
});

test('a real long solar-term month remains unresolved beyond the nominal source duration',()=>{
  const actual=calculateSeasonalCommand({...input,month:5,day:5,timeKnown:true,hour:0,minute:0});
  assert.deepEqual(actual.monthBranches,['진']);
  assert.equal(actual.status,'source-scheme-unresolved');
  assert.equal(actual.alternatives[0].status,'outside-source-scheme');
  assert.equal(actual.confirmedStem,null);
});

test('new seasonal audit and all prior reading snapshots reproduce while release stays blocked',()=>{
  for(const file of ['audit-reading-rules.mjs','audit-natal-rules.mjs','audit-context-rules.mjs','audit-source-judgments.mjs','audit-seasonal-review.mjs']) {
    const result=spawnSync(process.execPath,[new URL(file,import.meta.url).pathname,'--check'],{encoding:'utf8'});
    assert.equal(result.status,0,result.stdout+result.stderr);
  }
  const release=spawnSync(process.execPath,[new URL('audit-seasonal-review.mjs',import.meta.url).pathname,'--release-check'],{encoding:'utf8'});
  assert.equal(release.status,2,release.stdout+release.stderr);
});

test('universal failure can have different candidate reasons without inventing a common failed condition',()=>{
  const result=analyzeTransformationConditions(chart({year:'기축',month:null,day:'갑자',hour:'병인'},
    {candidates:{month:['갑진','을미']}}));
  assert.equal(result.status,'necessary-condition-failed');
  assert.deepEqual(result.commonFailedChecks,[]);
  assert.ok(result.alternatives.some(a=>a.reasons.includes('no-extra-jia')));
  assert.ok(result.alternatives.some(a=>a.reasons.includes('no-visible-eul')));
});

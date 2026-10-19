import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {contextCatalog,contextSource} from './context-rules.mjs';
import {analyzeContext} from './context-analysis.mjs';
import {buildContextDraft,buildRelationshipReview} from './context-drafts.mjs';
import {calculateProfile} from './adapter.mjs';

const chart=(pillars={year:'갑자',month:'병인',day:'무진',hour:'경오'},rest={}) => ({
  policy:{version:'research-civil-midnight-v5',productionApproved:false},timeKnown:true,pillars,...rest});
const a=chart(),b=chart({year:'기축',month:'신해',day:'계유',hour:'을미'});
const pairAt=(r,first,second) => r.combinationContexts.find(f => f.positions[0] === first && f.positions[1] === second);

test('context sources pin the full primary PDF, reviewed pages and selected transcription', () => {
  const dir=new URL('./fixtures/reading-sources/',import.meta.url);
  const source=JSON.parse(readFileSync(new URL('context-source.json',dir)));
  const transcription=JSON.parse(readFileSync(new URL('context-transcription.json',dir)));
  const hash=bytes => createHash('sha256').update(bytes).digest('hex');
  const pdf=readFileSync(new URL(source.pdfFile,dir));
  assert.equal(hash(pdf),source.pdfSha256); assert.equal(pdf.length,source.pdfBytes);
  assert.equal(hash(readFileSync(new URL('context-transcription.json',dir))),source.transcriptionSha256);
  for (const page of source.pages) assert.equal(hash(readFileSync(new URL(page.file,dir))),page.sha256);
  for (const rule of contextCatalog.rules) {
    const section=transcription.sections.find(s => s.id === rule.id);
    assert.deepEqual(rule.source.pdfPages,section.pdfPages);
    assert.equal(rule.source.pdfSha256,source.pdfSha256);
  }
  assert.throws(() => {contextCatalog.rules[0].effect='approve';},TypeError);
  const copied=contextSource('root-context'); copied.pdfPages.push(99);
  assert.deepEqual(contextSource('root-context').pdfPages,[21,22]);
});

test('monthly exposure respects the actual month-pillar correlation and excludes day reference', () => {
  const fixed=analyzeContext(chart({year:'임자',month:'병인',day:'갑진',hour:'정묘'}));
  assert.deepEqual(fixed.monthExposures.map(f => [f.position,f.stem]),[['month','병']]);
  assert.ok(!fixed.monthExposures.some(f => f.position === 'day'));
  const uncertain=chart({...a.pillars,month:null},{candidates:{month:['병인','정묘']}});
  const result=analyzeContext(uncertain);
  assert.ok(!result.monthExposures.some(f => f.position === 'month' && f.stem === '정'));
  assert.equal(result.monthExposures.find(f => f.position === 'month').certainty,'candidate-dependent');
  assert.ok(!buildContextDraft(uncertain).statements.some(s => s.id.startsWith('month-exposure:')));
});

test('root observations distinguish same-stem from same-element without assigning a root grade', () => {
  const result=analyzeContext(chart({year:'을미',month:'병인',day:'갑진',hour:'정묘'}));
  assert.ok(result.rootObservations.some(f => f.position === 'month' && f.hiddenStem === '갑' && f.match === 'exact-stem'));
  assert.ok(result.rootObservations.some(f => f.position === 'year' && f.hiddenStem === '을' && f.match === 'same-element-other-polarity'));
  assert.ok(result.rootObservations.every(f => f.rootGrade === null));
  assert.equal(result.strength,null); assert.equal(result.favorableElement,null);
  assert.equal(result.monthContext.strengthPolicy,'month-alone-is-insufficient');
});

test('day candidates never borrow roots from a different candidate of the same pillar', () => {
  const result=analyzeContext(chart({...a.pillars,day:null},{candidates:{day:['갑자','을묘']}}));
  const own=result.rootObservations.filter(f => f.position === 'day');
  assert.equal(own.length,1); assert.equal(own[0].hiddenStem,'을');
  assert.equal(own[0].match,'exact-stem'); assert.equal(own[0].certainty,'candidate-dependent');
  assert.deepEqual(own[0].witnesses,[{day:'을묘'}]);
});

test('source example records intervening control and day involvement without declaring transformation', () => {
  const result=analyzeContext(chart({year:'갑자',month:'경오',day:'기축',hour:'정묘'}));
  const pair=pairAt(result,'year','day');
  assert.equal(pair.adjacent,false); assert.equal(pair.involvesDayStem,true);
  assert.deepEqual(pair.contextAlternatives[0].interveningControllers,[{position:'month',stem:'경',target:'year'}]);
  assert.deepEqual(pair.transformation,{status:'not-adjudicated',element:null});
  assert.equal(result.score,null);
});

test('distant and adjacent pairs retain geometry independently of pair membership', () => {
  const distant=pairAt(analyzeContext(chart({year:'갑자',month:'병인',day:'무진',hour:'기축'})),'year','hour');
  assert.deepEqual(distant.interveningPositions,['month','day']);
  assert.equal(distant.involvesDayStem,false); assert.equal(distant.adjacent,false);
  const adjacent=pairAt(analyzeContext(chart({year:'갑자',month:'기축',day:'무진',hour:'경오'})),'year','month');
  assert.equal(adjacent.adjacent,true); assert.deepEqual(adjacent.interveningPositions,[]);
  assert.equal(adjacent.transformation.element,null);
});

test('source separated-partner example is not reduced to automatic competing-combination judgement', () => {
  const profile=chart({year:'경오',month:'을유',day:'갑자',hour:'을해'});
  const result=analyzeContext(profile);
  const near=pairAt(result,'year','month'),far=pairAt(result,'year','hour');
  assert.deepEqual(near.contextAlternatives[0].additionalPartners,[{endpoint:'year',position:'hour',stem:'을',adjacent:false}]);
  assert.deepEqual(far.contextAlternatives[0].additionalPartners,[{endpoint:'year',position:'month',stem:'을',adjacent:true}]);
  assert.ok(result.combinationContexts.every(f => f.transformation.status === 'not-adjudicated'));
  assert.ok(!JSON.stringify(buildContextDraft(profile)).includes('쟁합이 성립'));
});

test('conditional blockers cannot become unconditional draft claims when pair itself is common', () => {
  const profile=chart({year:'갑자',month:null,day:'기축',hour:'정묘'},{candidates:{month:['경오','병인']}});
  const pair=pairAt(analyzeContext(profile),'year','day');
  assert.equal(pair.certainty,'all-candidates'); assert.equal(pair.contextAlternatives.length,2);
  const draft=buildContextDraft(profile).statements.find(s => s.id === `combination:${pair.id}`);
  assert.ok(draft); assert.ok(!draft.text.includes('두 위치 사이에서 합 상대를 극하는'));
  assert.deepEqual(analyzeContext(profile),analyzeContext({...profile,candidates:{month:['병인','경오']}}));
});

test('pair-conditioned contexts never mix mutually exclusive values of an endpoint', () => {
  const profile=chart({year:'갑자',month:null,day:'갑인',hour:'정묘'},{candidates:{month:['기축','경오']}});
  const pair=pairAt(analyzeContext(profile),'year','month');
  assert.equal(pair.certainty,'candidate-dependent');
  assert.equal(pair.contextAlternatives.length,1);
  assert.deepEqual(pair.contextAlternatives[0].additionalPartners,[{endpoint:'month',position:'day',stem:'갑',adjacent:true}]);
  assert.ok(!JSON.stringify(pair.contextAlternatives).includes('경'));
  assert.ok(!buildContextDraft(profile).statements.some(s => s.id === `combination:${pair.id}`));
});

test('branch combinations and clashes coexist; neither suppresses the other', () => {
  const result=analyzeContext(chart({year:'갑자',month:'병오',day:'기축',hour:'을미'}));
  const ids=new Set(result.coexistingBranchRelations.map(f => f.ruleId));
  for (const id of ['branch-combination:자축','branch-clash:자오','branch-combination:오미','branch-clash:축미']) assert.ok(ids.has(id));
  assert.equal(result.branchConflictPolicy.status,'not-adjudicated');
});

test('uncertain observations equal exhaustive fixed-chart comparisons over sixteen marginal combinations', () => {
  const candidates={year:['갑자','을축'],month:['기축','경오'],day:['갑인','을묘'],hour:['기미','경신']};
  const uncertain=analyzeContext(chart({year:null,month:null,day:null,hour:null},{candidates}));
  const fixed=[];
  for (const year of candidates.year) for (const month of candidates.month)
    for (const day of candidates.day) for (const hour of candidates.hour)
      fixed.push(analyzeContext(chart({year,month,day,hour})));
  for (const field of ['rootObservations','monthExposures','combinationContexts']) {
    const allIds=[...new Set(fixed.flatMap(r => r[field].map(f => f.id)))].sort();
    assert.deepEqual(uncertain[field].map(f => f.id).sort(),allIds);
    for (const fact of uncertain[field]) {
      const universal=fixed.every(r => r[field].some(f => f.id === fact.id));
      assert.equal(fact.certainty,universal ? 'all-candidates' : 'candidate-dependent');
      if (field === 'combinationContexts') {
        const expected=[...new Set(fixed.flatMap(r => r[field].filter(f => f.id === fact.id)
          .flatMap(f => f.contextAlternatives.map(c => JSON.stringify(c)))))].sort();
        assert.deepEqual(fact.contextAlternatives.map(c => JSON.stringify(c)).sort(),expected);
      }
    }
  }
});

test('unknown hour and real boundary/clock review survive all new review outputs', () => {
  const base={calendar:'solar',leap:false,timeKnown:false,year:2024,month:2,day:4};
  const profile=calculateProfile(base),result=analyzeContext(profile);
  assert.equal(result.coverage[0].boundaryReviewRequired,true);
  assert.deepEqual(result.coverage[0].omittedPositions,['hour']);
  assert.ok(result.rootObservations.every(f => f.position !== 'hour'));
  assert.ok(result.monthExposures.every(f => f.position !== 'hour'));
  assert.ok(result.combinationContexts.every(f => f.unobservedPositions.includes('hour')));
  const historical=calculateProfile({...base,year:1954,month:3,day:21});
  assert.equal(buildContextDraft(historical).coverage[0].clockReviewRequired,true);
  const known=calculateProfile({...base,day:10});
  assert.deepEqual(analyzeContext(known),analyzeContext(calculateProfile({...base,calendar:'lunar',month:1,day:1})));
});

test('relationship type changes only editorial prompts, never evidence or fake metrics', () => {
  const drafts=['friend','family','partner'].map(type => buildRelationshipReview(a,b,type));
  for (const draft of drafts) {
    assert.deepEqual(draft.details,drafts[0].details);
    assert.deepEqual(draft.dependencies,{symbolRuleVersion:'symbol-relations-research-v1',
      contextRuleVersion:'month-combination-context-research-v1',natalRuleVersion:'natal-definitions-research-v1',
      engineVersion:'research-civil-midnight-v5'});
    assert.deepEqual(draft.individualContexts,drafts[0].individualContexts);
    assert.deepEqual(draft.strengths,[]); assert.deepEqual(draft.differences,[]);
    assert.equal(draft.metrics.score,null); assert.equal(draft.metrics.normalizedCompatibility,null);
    assert.equal(draft.metrics.mapRadius,null); assert.equal(draft.productionApproved,false);
    assert.equal(draft.advice[0].basis,'editorial-conversation-prompt-not-chart-derived');
  }
  assert.equal(new Set(drafts.map(d => d.advice[0].text)).size,3);
  assert.equal(buildRelationshipReview(a,a,'friend').metrics.score,null);
  const reversed=buildRelationshipReview(b,a,'friend');
  const canonical=d => d.details.map(f => f.id.split(':').slice(0,2).join(':')).sort();
  assert.deepEqual(canonical(drafts[0]),canonical(reversed));
});

test('invalid engines and relationship names fail closed; private and forced score fields are ignored', () => {
  for (const bad of [{...a,policy:{version:'future'}},{...a,timeKnown:false},{...a,pillars:{...a.pillars,day:'갑축'}}]) {
    assert.throws(() => analyzeContext(bad)); assert.throws(() => buildRelationshipReview(bad,b,'friend'));
  }
  for (const name of ['unknown','toString','__proto__']) assert.throws(() => buildRelationshipReview(a,b,name),/UNSUPPORTED_REVIEW_RELATIONSHIP/);
  const result=buildRelationshipReview({...a,alias:'PRIVATE-MARKER',birthDate:'PRIVATE-MARKER',score:99},b,'friend');
  assert.ok(!JSON.stringify(result).includes('PRIVATE-MARKER')); assert.equal(result.metrics.score,null);
  const copy=analyzeContext(a); copy.monthExposures[0].sources[0].pdfPages.push(999);
  assert.ok(!JSON.stringify(analyzeContext(a)).includes('999'));
});

test('new context and relationship review snapshots reproduce without changing earlier releases', () => {
  for (const file of ['audit-reading-rules.mjs','audit-natal-rules.mjs','audit-context-rules.mjs']) {
    const result=spawnSync(process.execPath,[new URL(file,import.meta.url).pathname,'--check'],{encoding:'utf8'});
    assert.equal(result.status,0,result.stdout+result.stderr);
  }
  const release=spawnSync(process.execPath,[new URL('audit-context-rules.mjs',import.meta.url).pathname,'--release-check'],{encoding:'utf8'});
  assert.equal(release.status,2,release.stdout+release.stderr);
});

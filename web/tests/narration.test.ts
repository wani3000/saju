import {test} from 'node:test';
import assert from 'node:assert/strict';
import {narrationCases,blindModels,reviewTemplate} from '../scripts/narration-cases';
import {buildNarrationPacket,validateNarration} from '../src/server/narration-contract';
import {generateNarrationCandidate,narrationRequest,requestAllowance,estimatedCost} from '../src/server/narration-candidate';
import {readingForVersion} from '../src/server/readings';
import {coherentReadingVersion as evaluationReadingVersion} from '../src/domain/coherent-reading';
import {samplePerson,publicCard} from '../src/domain/model';
import {chart} from '../src/server/engine';
import {summarizeNarrationReviews} from '../src/server/narration-review';
const cases=narrationCases(),packet=cases.find(c=>c.packet.relation==='친구')!.packet;
test('offline model comparison stays pinned to v8 and does not silently accept a new app release',()=>{
 const c=chart(samplePerson()),next=readingForVersion('chunbae-reviewed-dialogue-v9',{charts:{me:c,other:c},relation:'친구'});
 assert.equal(packet.ruleVersion,evaluationReadingVersion);
 assert.throws(()=>buildNarrationPacket(next,'친구'),/INVALID_NARRATION_CONTEXT/);
});
// Fabricated adapter responses test contracts only. These are never model quality evidence.
const example=()=>({packetId:packet.packetId,relation:packet.relation,blocks:packet.blocks.map(b=>({id:b.id,text:'의견이 다를 때는 먼저 원하는 것을 말해 보게.',evidenceIds:[...b.evidenceIds]}))});
const response=(output:unknown,extra:Record<string,unknown>={})=>new Response(JSON.stringify({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(output)}]}],usage:{input_tokens:200,output_tokens:300,output_tokens_details:{reasoning_tokens:25}},...extra}));
test('160 synthetic packets contain only allowlisted facts; unknown hours/candidates stay omitted',()=>{
 assert.equal(cases.length,160);assert.equal(new Set(cases.map(c=>c.id)).size,160);
 assert.equal(new Set(cases.map(c=>c.packet.relation)).size,4);
 assert.ok(cases.some(c=>c.packet.unresolved.includes('me:SOLAR_BOUNDARY')));
 for(const n of [0,1,2])assert.ok(cases.some(c=>c.packet.unresolved.filter(x=>x.endsWith('UNKNOWN_HOUR')).length===n));
 for(const {packet:p} of cases){
  for(const b of p.blocks){for(const id of b.evidenceIds)assert.ok(p.facts.some(f=>f.id===id));if(b.subject!=='pair')assert.ok(b.evidenceIds.every(id=>id.startsWith(b.subject+':')));}
  for(const side of ['me','other'])if(p.unresolved.includes(`${side}:UNKNOWN_HOUR`))assert.ok(p.facts.every(f=>f.side!==side||f.position!=='hour'));
  assert.doesNotMatch(JSON.stringify(p),/合成|합성 입력|@|"solar"|"calendar"|"name"|"minute"|"day"\s*:\s*"?\d{1,2}/);
 }
});
test('packet stable across input names, ordering and copies; public reading unchanged',()=>{
 const a=chart(samplePerson()),b=chart(samplePerson(true)),r=readingForVersion(evaluationReadingVersion,{charts:{me:a,other:b},relation:'친구'}),before=structuredClone(r),p=buildNarrationPacket(r,'친구');
 const shuffled=structuredClone(r);shuffled.wholeChart!.people.forEach(p=>p.evidence.reverse());
 assert.deepEqual(buildNarrationPacket(shuffled,'친구'),p);assert.deepEqual(r,before);
 assert.deepEqual(publicCard(['가','나'],r),publicCard(['가','나'],before));
 assert.throws(()=>buildNarrationPacket({...r,ruleVersion:'old'},'친구'));
 assert.equal(p.blocks.find(x=>x.id==='pair:gift-me')?.direction?.from,'me');
 assert.equal(p.blocks.find(x=>x.id==='pair:gift-other')?.direction?.from,'other');
});
test('block/packet/relation identity and side-specific evidence are checked, even for equal local IDs',()=>{
 const out=example();assert.equal(validateNarration(packet,out).ok,true);
 const reversed={...out,blocks:[...out.blocks].reverse()};const valid=validateNarration(packet,reversed);assert.equal(valid.ok,true);if(valid.ok)assert.deepEqual(valid.output.blocks.map(b=>b.id),packet.blocks.map(b=>b.id));
 for(const mutate of [
  (o:typeof out)=>{o.packetId='stale';},(o:typeof out)=>{o.relation='연인';},
  (o:typeof out)=>{o.blocks.pop();},(o:typeof out)=>{o.blocks.push(o.blocks[0]);},
  (o:typeof out)=>{o.blocks[0].evidenceIds=o.blocks[0].evidenceIds.map(id=>id.replace(/^me:/,'other:'));},
  (o:typeof out)=>{o.blocks[0].evidenceIds.push(o.blocks[0].evidenceIds[0]);},
 ]){const changed=structuredClone(out);mutate(changed);assert.equal(validateNarration(packet,changed).ok,false);}
 assert.equal(validateNarration(packet,{...out,score:99}).ok,false);
});
test('mechanical scope bans catch score, unsupported verdict, romance leak and markup',()=>{
 for(const text of ['궁합은 98점이라네.','신강이 확실하네.','둘이 데이트를 해 보게.','<script>doIt()</script>','This is English only.']){
  const out=example();out.blocks[0].text=text;assert.equal(validateNarration(packet,out).ok,false);
 }
 const out=example();out.blocks[0].text='약속 전에 10분만 함께 이야기해 보게.';assert.equal(validateNarration(packet,out).ok,true);
 const checked=validateNarration(packet,example());assert.ok(checked.warnings.includes('DUPLICATE_PARAGRAPH'));
 // Passing citations cannot prove semantic consistency; human ratings remain empty.
 assert.equal(reviewTemplate('case','packet','A').ratings.consistency,null);
});
test('blind labels are deterministic and order is counterbalanced; no winner is preselected',()=>{
 const keys=cases.map(c=>blindModels(c.id));assert.ok(keys.some(k=>k.A==='gpt-5-nano'));assert.ok(keys.some(k=>k.A==='gpt-6-luna'));
 assert.deepEqual(blindModels('case'),blindModels('case'));assert.equal(reviewTemplate('a','b','B').completed,false);
});
test('request settings are model specific, tool free, fixed endpoint and bounded',()=>{
 const luna=narrationRequest(packet,'gpt-6-luna'),nano=narrationRequest(packet,'gpt-5-nano');
 assert.equal(luna.reasoning?.effort,'none');assert.equal(nano.reasoning,undefined);assert.equal(luna.store,false);assert.equal(luna.max_output_tokens,9000);assert.ok(!('tools' in luna));
 assert.throws(()=>narrationRequest(packet,'unapproved' as any));assert.ok(requestAllowance(packet,'gpt-6-luna')>0);
 assert.equal(estimatedCost('gpt-6-luna',{inputTokens:4000,outputTokens:2000,reasoningTokens:100}),0.0014);
});
test('candidate adapter returns validated pending-review output, usage and zero baseline mutation',async()=>{
 const before=JSON.stringify(packet);let calls=0;
 const result=await generateNarrationCandidate(packet,'gpt-6-luna',{apiKey:'test-not-a-real-key',fetchImpl:async(url,opts)=>{
  calls++;assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(opts?.method,'POST');assert.ok(opts?.signal);return response(example());
 }});
 assert.equal(calls,1);assert.equal(result.ok,true);if(result.ok){assert.equal(result.productionApproved,false);assert.equal(result.semanticReview,'pending');assert.equal(result.usage?.reasoningTokens,25);}
 assert.equal(JSON.stringify(packet),before);
});
test('missing key fails without network; provider details and secrets never escape on errors',async()=>{
 let calls=0;const fetchImpl:typeof fetch=async()=>{calls++;throw new Error('secret-provider-message');};
 assert.equal((await generateNarrationCandidate(packet,'gpt-5-nano',{fetchImpl})).ok,false);assert.equal(calls,0);
 const fail=await generateNarrationCandidate(packet,'gpt-5-nano',{apiKey:'sensitive-secret',fetchImpl});assert.equal(fail.ok,false);assert.doesNotMatch(JSON.stringify(fail),/sensitive-secret|secret-provider-message/);assert.equal(calls,1);
 const http=await generateNarrationCandidate(packet,'gpt-5-nano',{apiKey:'mock',fetchImpl:async()=>new Response('sensitive-secret',{status:401})});
 assert.equal(http.ok,false);if(!http.ok)assert.equal(http.code,'AUTHENTICATION_FAILED');assert.doesNotMatch(JSON.stringify(http),/sensitive-secret/);
});
test('refusal, truncated JSON and mismatched evidence cannot become a candidate',async()=>{
 const bad=example();bad.blocks[0].evidenceIds=['other:unrelated'];
 for(const res of [response(example(),{status:'incomplete'}),response(example(),{output:[{type:'message',role:'assistant',content:[{type:'refusal',refusal:'no'}]}]}),response(bad),response(example(),{output:[]}),new Response('not-json')]){
  const result=await generateNarrationCandidate(packet,'gpt-6-luna',{apiKey:'mock',fetchImpl:async()=>res});assert.equal(result.ok,false);
 }
});
test('uncompleted and duplicate reviews cannot become quality evidence or a winner',()=>{
 const blank=reviewTemplate('case','packet','A'),trial={caseId:'case',packetId:'packet',label:'A' as const,model:'gpt-6-luna' as const,ok:true,elapsedMs:1500,usage:null};
 assert.equal(summarizeNarrationReviews([trial],[blank]).status,'no-quality-evidence');
 const review={...blank,completed:true,reviewer:'감수자',ratings:{voice:4,specificity:4,consistency:5,faithfulness:5,repetition:4},examples:['인용한 문장과 근거를 대조한 기록']};
 const report=summarizeNarrationReviews([trial],[review]);assert.equal(report.winner,null);assert.equal(report.pairedReviewedCases,0);assert.equal(report.models['gpt-6-luna'].reviewed,1);
 assert.throws(()=>summarizeNarrationReviews([trial],[review,review]));
 assert.throws(()=>summarizeNarrationReviews([{...trial,ok:false}],[review]));
 assert.throws(()=>summarizeNarrationReviews([trial],[{...review,packetId:'other'}]));
 assert.throws(()=>summarizeNarrationReviews([trial],[{...review,ratings:{...review.ratings,voice:6}}]));
});

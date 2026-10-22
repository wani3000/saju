import {mkdir,writeFile,appendFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {narrationCases,blindModels,reviewTemplate} from './narration-cases';
import {candidatePrices,generateNarrationCandidate,narrationModels,requestAllowance,estimatedCost} from '../src/server/narration-candidate';
import {narrationVersion} from '../src/server/narration-contract';

const args=process.argv.slice(2),live=args.includes('--live');
const value=(key:string)=>args.find(a=>a.startsWith(`${key}=`))?.slice(key.length+1);
const limit=Number(value('--limit')??160),budget=Number(value('--max-cost-usd')??0);
if(args.some(a=>!['--live','--offline'].includes(a)&&!['--out=','--limit=','--max-cost-usd='].some(k=>a.startsWith(k))))throw new Error('UNKNOWN_ARGUMENT');
if(args.includes('--live')&&args.includes('--offline'))throw new Error('CONFLICTING_MODE');
if(!Number.isInteger(limit)||limit<1||limit>160)throw new Error('LIMIT_MUST_BE_1_TO_160');
if(live&&(!process.env.OPENAI_API_KEY?.trim()||!Number.isFinite(budget)||budget<=0))throw new Error('LIVE_REQUIRES_KEY_AND_POSITIVE_BUDGET');
const out=resolve(value('--out')??`.data/narration-${live?'live':'offline'}-${Date.now()}`);
const cases=narrationCases().slice(0,limit);
await mkdir(out,{recursive:true,mode:0o700});
const put=(name:string,v:unknown)=>writeFile(resolve(out,name),JSON.stringify(v,null,2)+'\n',{flag:'wx',mode:0o600});
// Never overwrite an evaluation. A new prompt/run gets its own directory.
await put('manifest.json',{version:narrationVersion,mode:live?'live':'offline-no-api',createdAt:new Date().toISOString(),cases:cases.length,
 requestedModels:narrationModels,requestLimit:live?cases.length*2:0,planningBudgetUsd:live?budget:null,prices:candidatePrices,
 generationSettings:{'gpt-6-luna':{reasoning:'none'},'gpt-5-nano':{reasoning:'provider-default'},maxOutputTokens:9000,retries:0},
 qualification:'Mechanical checks do not establish semantic fidelity or choose a winner. Real comparison and integration remain pending until outputs are reviewed.'});
await put('packets.json',cases);
const key=Object.fromEntries(cases.map(c=>[c.id,blindModels(c.id)]));
await put('blind-key.json',key);
await put('review-template.json',cases.flatMap(c=>(['A','B'] as const).map(label=>reviewTemplate(c.id,c.packet.packetId,label))));
if(!live){console.log(JSON.stringify({mode:'offline',cases:cases.length,modelCalls:0,outputDirectory:out,winner:null}));process.exit(0);}

let allowanceSpent=0,estimatedUsageCost=0,attempts=0,missingUsage=0,passed=0,stopReason:string|null=null;
for(const c of cases){
 const blind:{caseId:string;packetId:string;relation:string;baseline:unknown;A:unknown;B:unknown}={caseId:c.id,packetId:c.packet.packetId,relation:c.packet.relation,baseline:c.packet.blocks.map(({id,title,baseline})=>({id,title,text:baseline})),A:null,B:null};
 for(const label of ['A','B'] as const){
  const model=key[c.id][label],allowance=requestAllowance(c.packet,model);
  if(allowanceSpent+allowance>budget){stopReason='PLANNING_BUDGET_REACHED';break;}
  allowanceSpent+=allowance;attempts++;
  const result=await generateNarrationCandidate(c.packet,model,{apiKey:process.env.OPENAI_API_KEY});
  if(result.usage)estimatedUsageCost+=estimatedCost(model,result.usage);else missingUsage++;
  // Outputs contain synthetic evidence only. Provider errors are reduced to safe codes.
  await appendFile(resolve(out,'results.jsonl'),JSON.stringify({caseId:c.id,label,...result})+'\n',{mode:0o600});
  blind[label]=result.ok?{blocks:result.output.blocks,status:'needs-semantic-review'}:{status:'generation-failed'};
  if(result.ok)passed++;
  console.log(JSON.stringify({caseId:c.id,label,ok:result.ok,attempts,elapsedMs:result.elapsedMs}));
  if(!result.ok&&['AUTHENTICATION_FAILED','QUOTA_OR_RATE_LIMIT','HTTP_403','HTTP_404'].includes(result.code)){stopReason=result.code;break;}
 }
 await appendFile(resolve(out,'blind-review.jsonl'),JSON.stringify(blind)+'\n',{mode:0o600});
 if(stopReason)break;
}
await put('summary.json',{attempts,mechanicalPasses:passed,missingUsage,estimatedUsageCostUsd:estimatedUsageCost,
 planningAllowanceReservedUsd:allowanceSpent,stopReason,winner:null,semanticReview:'pending',productionApproved:false});
console.log(JSON.stringify({attempts,mechanicalPasses:passed,stopReason,outputDirectory:out,winner:null}));

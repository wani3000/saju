import {narrationInstructions,narrationJsonSchema,validateNarration,type NarrationPacket} from './narration-contract';

// Only the explicitly requested comparison candidates. No selected production model yet.
export const narrationModels=['gpt-6-luna','gpt-5-nano'] as const;
export type NarrationModel=typeof narrationModels[number];
export const candidatePrices={asOf:'2026-10-22',unit:'USD per million Standard text tokens',models:{
 'gpt-6-luna':{input:0.10,output:0.50},'gpt-5-nano':{input:0.05,output:0.40},
}};
const maxOutputTokens=9000;
export function narrationRequest(packet:NarrationPacket,model:NarrationModel){
 if(!narrationModels.includes(model))throw new Error('UNSUPPORTED_NARRATION_MODEL');
 const body={model,store:false,service_tier:'default',max_output_tokens:maxOutputTokens,
  ...(model==='gpt-6-luna'?{reasoning:{effort:'none'}}:{}),
  input:[{role:'system',content:narrationInstructions},{role:'user',content:JSON.stringify(packet)}],
  text:{format:{type:'json_schema',name:'chunbae_narration',strict:true,schema:narrationJsonSchema}}};
 if(Buffer.byteLength(JSON.stringify(body))>128_000)throw new Error('NARRATION_INPUT_TOO_LARGE');
 return body;
}
export type NarrationUsage={inputTokens:number;outputTokens:number;reasoningTokens:number|null};
export function estimatedCost(model:NarrationModel,usage:NarrationUsage){const p=candidatePrices.models[model];return (p.input*usage.inputTokens+p.output*usage.outputTokens)/1_000_000;}
// A conservative planning allowance, not a provider-enforced billing limit. Reserve before each attempt.
export function requestAllowance(packet:NarrationPacket,model:NarrationModel){
 return estimatedCost(model,{inputTokens:Buffer.byteLength(JSON.stringify(narrationRequest(packet,model)))+2048,outputTokens:maxOutputTokens,reasoningTokens:null});
}
const count=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0?v:null;
function usageOf(input:any):NarrationUsage|null{
 const inputTokens=count(input?.input_tokens),outputTokens=count(input?.output_tokens);
 return inputTokens===null||outputTokens===null?null:{inputTokens,outputTokens,reasoningTokens:count(input?.output_tokens_details?.reasoning_tokens)};
}
// Isolated server-side candidate generation. Not imported by the public app, worker or preview.
// It cannot mutate a saved Reading, select a winner, or publish unreviewed model prose.
export async function generateNarrationCandidate(packet:NarrationPacket,model:NarrationModel,options:{apiKey?:string;fetchImpl?:typeof fetch;timeoutMs?:number}={}){
 const started=Date.now(),usageBase={model,packetId:packet.packetId};
 const fail=(code:string,usage:NarrationUsage|null=null)=>({ok:false as const,...usageBase,code,usage,elapsedMs:Date.now()-started});
 if(!options.apiKey?.trim())return fail('MISSING_API_KEY');
 let request;try{request=narrationRequest(packet,model);}catch{return fail('INVALID_REQUEST');}
 const timeoutMs=options.timeoutMs??60_000;
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>60_000)return fail('INVALID_TIMEOUT');
 try{
  const response=await (options.fetchImpl??fetch)('https://api.openai.com/v1/responses',{
   method:'POST',headers:{Authorization:`Bearer ${options.apiKey}`,'Content-Type':'application/json'},body:JSON.stringify(request),signal:AbortSignal.timeout(timeoutMs),
  });
  if(!response.ok)return fail(response.status===401?'AUTHENTICATION_FAILED':response.status===429?'QUOTA_OR_RATE_LIMIT':`HTTP_${response.status}`);
  const raw=await response.text();if(Buffer.byteLength(raw)>1_048_576)return fail('RESPONSE_TOO_LARGE');
  let data:any;try{data=JSON.parse(raw);}catch{return fail('INVALID_API_RESPONSE');}
  const usage=usageOf(data.usage);
  if(data.status!=='completed')return fail('INCOMPLETE_RESPONSE',usage);
  const parts=(Array.isArray(data.output)?data.output:[]).filter((x:any)=>x.type==='message'&&x.role==='assistant').flatMap((x:any)=>Array.isArray(x.content)?x.content:[]);
  if(parts.some((p:any)=>p.type==='refusal'))return fail('REFUSAL',usage);
  const texts=parts.filter((p:any)=>p.type==='output_text'&&typeof p.text==='string');
  if(texts.length!==1)return fail('MISSING_OUTPUT_TEXT',usage);
  let output;try{output=JSON.parse(texts[0].text);}catch{return fail('INVALID_OUTPUT_JSON',usage);}
  const checked=validateNarration(packet,output);
  if(!checked.ok)return {...fail('OUTPUT_VALIDATION_FAILED',usage),checks:checked};
  return {ok:true as const,...usageBase,providerModel:typeof data.model==='string'&&/^gpt-[\w.-]+$/.test(data.model)?data.model:null,usage,elapsedMs:Date.now()-started,output:checked.output,warnings:checked.warnings,
   semanticReview:'pending' as const,productionApproved:false as const};
 }catch{return fail('NETWORK_OR_TIMEOUT');} // Never echo provider bodies, request headers or exception messages.
}

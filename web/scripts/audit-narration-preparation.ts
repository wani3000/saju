import {writeFileSync} from 'node:fs';
import {narrationCases,blindModels} from './narration-cases';
import {narrationRequest,requestAllowance,narrationModels} from '../src/server/narration-candidate';
const cases=narrationCases();
const report={version:'narration-offline-readiness-v1',mode:'offline-only',apiCalls:0,qualityEvaluations:0,winner:null,productionApproved:false,
 cases:cases.length,relations:Object.fromEntries(['연인','친구','가족','동료'].map(r=>[r,cases.filter(c=>c.packet.relation===r).length])),
 unknownHourPackets:cases.filter(c=>c.packet.unresolved.some(x=>x.endsWith('UNKNOWN_HOUR'))).length,
 unknownHourCountDistribution:Object.fromEntries([0,1,2].map(n=>[n,cases.filter(c=>c.packet.unresolved.filter(x=>x.endsWith('UNKNOWN_HOUR')).length===n).length])),
 boundaryReviewPackets:cases.filter(c=>c.packet.unresolved.some(x=>x.endsWith('SOLAR_BOUNDARY'))).length,
 clockReviewPackets:cases.filter(c=>c.packet.unresolved.some(x=>x.endsWith('CLOCK_REVIEW'))).length,
 candidateFactPackets:cases.filter(c=>c.packet.unresolved.some(x=>x.endsWith('CANDIDATE_FACTS_OMITTED'))).length,
 blockRange:[Math.min(...cases.map(c=>c.packet.blocks.length)),Math.max(...cases.map(c=>c.packet.blocks.length))],
 models:Object.fromEntries(narrationModels.map(model=>[model,{
  requestsPrepared:cases.length,blindFirstPositions:cases.filter(c=>blindModels(c.id).A===model).length,
  largestRequestUtf8Bytes:Math.max(...cases.map(c=>Buffer.byteLength(JSON.stringify(narrationRequest(c.packet,model))))),
  planningAllowanceUsd:cases.reduce((sum,c)=>sum+requestAllowance(c.packet,model),0),
 }])),
 limitations:['Synthetic input preparation is not model quality or saju accuracy.','UTF-8 request bytes are not measured API tokens. Planning allowance is not provider billing enforcement.','The app, worker and public preview do not import or activate the candidate generator.'],
};
writeFileSync(new URL('../../docs/audits/narration-offline-readiness.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));

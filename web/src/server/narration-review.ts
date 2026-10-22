import {z} from 'zod';
import {narrationModels,type NarrationModel} from './narration-candidate';
const score=z.number().int().min(1).max(5);
export const completedReview=z.object({caseId:z.string(),packetId:z.string(),label:z.enum(['A','B']),reviewer:z.string().trim().min(1),completed:z.literal(true),
 ratings:z.object({voice:score,specificity:score,consistency:score,faithfulness:score,repetition:score}).strict(),
 criticalErrors:z.array(z.string().trim().min(1)),examples:z.array(z.string().trim().min(1)).min(1),notes:z.string(),
}).strict();
const dimensions=['voice','specificity','consistency','faithfulness','repetition'] as const;
type Trial={caseId:string;packetId:string;label:'A'|'B';model:NarrationModel;ok:boolean;elapsedMs:number;usage:{inputTokens:number;outputTokens:number}|null};
// No auto-selection: small differences in subjective ratings are not proof of superiority.
export function summarizeNarrationReviews(trials:Trial[],input:unknown){
 if(!Array.isArray(input))throw new Error('REVIEWS_MUST_BE_ARRAY');
 const pending=input.filter(r=>r?.completed!==true).length;
 const reviews=input.filter(r=>r?.completed===true).map(r=>completedReview.parse(r));
 const identities=new Set<string>();
 for(const review of reviews){
  const key=`${review.caseId}:${review.label}`;if(identities.has(key))throw new Error('DUPLICATE_REVIEW');identities.add(key);
  const matches=trials.filter(t=>t.caseId===review.caseId&&t.label===review.label);
  if(matches.length!==1||!matches[0].ok||matches[0].packetId!==review.packetId)throw new Error('REVIEW_WITHOUT_VALID_TRIAL');
 }
 if(new Set(trials.map(t=>`${t.caseId}:${t.label}`)).size!==trials.length)throw new Error('DUPLICATE_TRIAL');
 const pairedCases=[...new Set(trials.map(t=>t.caseId))].filter(id=>narrationModels.every(model=>trials.some(t=>t.caseId===id&&t.model===model&&t.ok)&&reviews.some(r=>r.caseId===id&&trials.some(t=>t.caseId===id&&t.label===r.label&&t.model===model))));
 const models=Object.fromEntries(narrationModels.map(model=>{
  const attempts=trials.filter(t=>t.model===model),matched=reviews.filter(r=>attempts.some(t=>t.caseId===r.caseId&&t.label===r.label));
  const latency=attempts.map(t=>t.elapsedMs).sort((a,b)=>a-b);
  const percentile=(q:number)=>latency.length?latency[Math.ceil(q*latency.length)-1]:null;
  return [model,{attempts:attempts.length,mechanicalPasses:attempts.filter(t=>t.ok).length,reviewed:matched.length,
   criticalFailures:matched.filter(r=>r.criticalErrors.length>0).length,
   means:Object.fromEntries(dimensions.map(d=>[d,matched.length?matched.reduce((n,r)=>n+r.ratings[d],0)/matched.length:null])),
   p50Ms:percentile(.5),p95Ms:percentile(.95),missingUsage:attempts.filter(t=>!t.usage).length}];
 }));
 return {pairedReviewedCases:pairedCases.length,pendingTemplateEntries:pending,models,winner:null,
  status:reviews.length?'review-in-progress':'no-quality-evidence',
  qualification:'Five editorial ratings are not saju accuracy. Mechanical pass and valid evidence IDs do not prove that prose preserves their meaning. No public activation from this report.'};
}

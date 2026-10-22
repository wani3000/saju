/** Regressions of scoped clauses and uncertainty handling, not new sufficient conditions. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {synthesizeProfile,synthesisVersion} from './whole-chart-synthesis.mjs';
import {strengthReferences,adjudicateTransformationVetoes} from './adjudication-review.mjs';
import {moderationReferenceCases,referenceProfile,chart} from './beta-quality-pack.mjs';
const positions=['year','month','day','hour'],stems=[...'갑을병정무기경신임계'];
const pillar=stem=>stem+(stems.indexOf(stem)%2?'축':'자');
// Independently keyed to the two re-read source pages. 間之 and 柱有 retain different scopes.
const clauses=[
 {pair:'갑기',blocker:'무',betweenOnly:true,page:128},
 {pair:'을경',blocker:'갑',betweenOnly:true,page:128},
 {pair:'병신',blocker:'정',betweenOnly:false,page:129},
 {pair:'정임',blocker:'병',betweenOnly:false,page:129},
 {pair:'무계',blocker:'기',betweenOnly:false,page:129},
];
export function conditionMatrix(){
 return clauses.flatMap(c=>[...c.pair].flatMap(day=>['year','month','hour'].flatMap(partnerPosition=>{
  const partner=[...c.pair].find(s=>s!==day),filler=stems.find(s=>![day,partner,c.blocker].includes(s));
  return positions.filter(k=>!['day',partnerPosition].includes(k)).map(blockerPosition=>{
   const pillars=Object.fromEntries(positions.map(k=>[k,pillar(k==='day'?day:k===partnerPosition?partner:k===blockerPosition?c.blocker:filler)]));
   // Only a year/day pair has an intervening position (month); other day pairs are adjacent.
   const expectedVeto=c.betweenOnly?partnerPosition==='year'&&blockerPosition==='month':true;
   const profile=chart(pillars),review=adjudicateTransformationVetoes(profile),pair=review.alternatives[0].pairs.find(p=>p.partnerPosition===partnerPosition);
   const unknown=adjudicateTransformationVetoes({...profile,timeKnown:false,pillars:{...pillars,hour:null}});
   return {id:`${day}:${partnerPosition}:${blockerPosition}`,sourcePair:c.pair,pdfPage:c.page,partnerPosition,blockerPosition,expectedVeto,
    observedVeto:pair.sourceVetoObserved,dayClause:review.dayPairSourceClausePassed,finalTransformation:review.transformationEstablished,
    unknownHourFinal:unknown.transformationEstablished,unknownHourClause:unknown.dayPairSourceClausePassed};
  });
 })));
}
export function buildConditionBoundaryAudit(){
 const matrix=conditionMatrix();
 if(matrix.some(r=>r.expectedVeto!==r.observedVeto||r.finalTransformation!==null||r.unknownHourFinal!==null||r.unknownHourClause!==null))throw new Error('SOURCE_SCOPE_REGRESSION');
 const references=[...strengthReferences,...moderationReferenceCases()],cases=references.map(c=>({id:c.id,profile:referenceProfile(c)}));
 const referenceIds=r=>[
  ...r.reviews.reference.matches.filter(m=>m.match==='exact-four-pillars').map(m=>m.id),
  ...(r.reviews.boundaryPriority.moderationReference.status==='exact-source-reference'?r.reviews.boundaryPriority.moderationReference.matches.map(m=>m.id):[]),
 ];
 const mutations=cases.flatMap(c=>positions.map(position=>{
  const pillars={...c.profile.pillars},old=pillars[position];pillars[position]=stems[(stems.indexOf(old[0])+2)%10]+old[1];
  const r=synthesizeProfile({...c.profile,pillars}),expected=cases.filter(x=>positions.every(p=>x.profile.pillars[p]===pillars[p])).map(x=>x.id);
  const actual=referenceIds(r);
  if(JSON.stringify([...actual].sort())!==JSON.stringify(expected.sort()))throw new Error('SOURCE_REFERENCE_EXTRAPOLATED');
  if(r.decisions.some(d=>d.value!==null))throw new Error('UNSUPPORTED_FINAL_DECISION');
  return {sourceCase:c.id,changedPosition:position,exactReferenceIds:actual};
 }));
 for(const c of cases){
  const r=synthesizeProfile(c.profile);if(!referenceIds(r).includes(c.id))throw new Error('EXACT_SOURCE_REFERENCE_LOST');
  const partial=synthesizeProfile({...c.profile,timeKnown:false,pillars:{...c.profile.pillars,hour:null}});
  if(referenceIds(partial).length)throw new Error('UNKNOWN_HOUR_INHERITED_REFERENCE');
 }
 const flags=['boundaryReview','clockReview'].flatMap(flag=>[false,null,{}].map(value=>{
  const r=synthesizeProfile({...cases[0].profile,[flag]:value});
  const reason=flag==='boundaryReview'?'SOLAR_TERM_BOUNDARY_REVIEW':'HISTORICAL_CLOCK_REVIEW';
  if(!r.missing.includes(reason)||r.reviews.boundaryPriority.order[0].resolved||r.decisions.some(d=>!d.blockers.includes(reason)))throw new Error('REVIEW_FLAG_DROPPED');
  return {flag,value,requiredReason:reason,coverageResolved:false};
 }));
 const manifest=JSON.parse(readFileSync(new URL('./fixtures/reading-sources/adjudication-sources.json',import.meta.url)));
 const source=manifest.sources.find(s=>s.sourceId==='sanming-1926');
 const pages=source.pages.map(p=>{
  const sha256=createHash('sha256').update(readFileSync(new URL('./fixtures/reading-sources/'+p.file,import.meta.url))).digest('hex');
  if(sha256!==p.sha256)throw new Error('SOURCE_PAGE_CHANGED');return {pdfPage:p.pdfPage,file:p.file,sha256};
 });
 return {version:'condition-boundaries-audit-v1',synthesisVersion,productionApproved:false,
  metrics:{sourceClauseCases:matrix.length,clauseMismatches:0,exactSourceCases:cases.length,onePillarMutationCases:mutations.length,unknownHourCases:cases.length,reviewFlagCases:flags.length,unsupportedFinalDecisions:0},
  source:{sourceId:source.sourceId,url:source.url,pdfSha256:source.pdfSha256,pages},matrix,mutations,reviewFlags:flags,
  limitations:['Synthetic arrangement/one-pillar perturbations are regression probes, not new source judgments or real birth charts.',
   'Source-scoped veto observation does not prove final transformation failure or success across editions.',
   'No general strength/moderation threshold or personality/compatibility accuracy is established.']};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const args=process.argv.slice(2);if(args.some(x=>x!=='--check')||args.length>1)throw new Error('UNKNOWN_ARGUMENT');
 const report=buildConditionBoundaryAudit(),text=JSON.stringify(report,null,2)+'\n',file=new URL('./reports/condition-boundaries.json',import.meta.url);
 if(args.length){if(readFileSync(file,'utf8')!==text)throw new Error('CONDITION_BOUNDARY_REPORT_STALE');}else writeFileSync(file,text);
 console.log(JSON.stringify(report.metrics));
}

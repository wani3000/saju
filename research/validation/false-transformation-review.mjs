/** 假化 source attributions are neither a universal rejection rule nor a sufficient-condition classifier. */
import {readFileSync} from 'node:fs';
import {analyzeProfile} from './reading-analysis.mjs';
const source=JSON.parse(readFileSync(new URL('./fixtures/reading-sources/false-transformation-source.json',import.meta.url)));
export const falseTransformationSource=()=>structuredClone(source);
const positions=['year','month','day','hour'];
export function reviewFalseTransformationReference(profile){
 const {coverage}=analyzeProfile(profile);
 const options=k=>k==='hour'&&!profile.timeKnown?[null]:profile.pillars[k]===null?profile.candidates[k]:[profile.pillars[k]];
 const fixed=profile.timeKnown&&positions.every(k=>options(k).length===1);
 const matches=source.cases.filter(c=>positions.every((k,i)=>k==='hour'&&!profile.timeKnown||options(k).includes(c.pillars[i])));
 const exact=fixed?matches[0]:null;
 return {version:source.version,productionApproved:false,coverage,
  status:exact?'exact-source-reference':matches.length?'partial-source-reference':'outside-reference-corpus',
  sourceClassification:exact?{id:exact.id,sourceTerm:exact.sourceTerm,attributedObservations:[...exact.attributedObservations],distinction:exact.distinction,
   source:{sourceId:source.source.sourceId,pdfSha256:source.source.pdfSha256,pdfPage:exact.pdfPage}}:null,
  matches:matches.map(c=>({id:c.id,match:fixed?'exact-four-pillars':'partial-not-jointly-established'})),
  transformationEstablished:null,originalDayStrength:null,moderation:null,score:null,
  policy:'The chapter distinguishes 合神/化神 and multiple 假化 forms. Do not equate a true combination or absence of jealousy with a true transformation, or extrapolate a chapter term to other charts.'};
}

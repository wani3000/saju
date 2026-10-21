import {writeFileSync} from 'node:fs';
import {synthesizeProfile,synthesizeBirth,synthesizePair,synthesisVersion} from './whole-chart-synthesis.mjs';
import {moderationReferenceCases,referenceProfile} from './beta-quality-pack.mjs';
import {strengthReferences} from './adjudication-review.mjs';
const chart=pillars=>({policy:{version:'research-civil-midnight-v5',productionApproved:false},timeKnown:true,pillars});
const refs=strengthReferences.map(c=>({id:c.id,analysis:synthesizeProfile(chart(Object.fromEntries(['year','month','day','hour'].map((k,i)=>[k,c.pillars[i]]))))}));
const birth={calendar:'solar',leap:false,timeKnown:false,year:2024,month:2,day:10};
const middle=moderationReferenceCases().map(c=>({id:c.id,analysis:synthesizeProfile(referenceProfile(c))}));
const cases=[['ordinary',birth],['hour-known',{...birth,timeKnown:true,hour:10,minute:30}],['summer-source-gap',{...birth,month:6,day:15}],['solar-boundary',{...birth,day:4}],['historical-clock',{...birth,year:1954,month:3,day:21}]].map(([id,input])=>({id,analysis:synthesizeBirth(input)}));
const a=chart({year:'임자',month:'병인',day:'갑진',hour:'정사'}),b=chart({...a.pillars,year:a.pillars.hour,hour:a.pillars.year});
const pair=synthesizePair(a,b),all=[...refs,...middle,...cases];
const metrics={version:synthesisVersion,sourceCases:refs.length+middle.length,moderationSourceMatches:middle.filter(c=>c.analysis.reviews.boundaryPriority.moderationReference.status==='exact-source-reference').length,birthCases:cases.length,
 exactSourceMatches:refs.filter(c=>c.analysis.reviews.reference.status==='exact-source-case').length,
 unsupportedFinalVerdicts:all.flatMap(c=>c.analysis.decisions).filter(d=>d.value!==null).length,
 danglingEvidence:all.flatMap(({analysis:a})=>a.joins.flatMap(j=>j.evidenceIds.filter(id=>!a.confirmedEvidence.some(e=>e.id===id)))).length,
 candidateEvidencePromoted:all.flatMap(({analysis:a})=>a.joins.flatMap(j=>j.evidenceIds.filter(id=>a.deferredEvidence.some(e=>e.id===id)))).length,
 sameRolesDifferentPositions:{sameRoleSet:JSON.stringify(pair.people.map(a=>[...new Set(a.confirmedEvidence.filter(e=>e.kind==='ten-god').map(e=>e.value.role))].sort())[0])===JSON.stringify(pair.people.map(a=>[...new Set(a.confirmedEvidence.filter(e=>e.kind==='ten-god').map(e=>e.value.role))].sort())[1]),distinctStructure:JSON.stringify(pair.people[0].joins)!==JSON.stringify(pair.people[1].joins)},
 qualification:'Software/source-case regression, not held-out classifier accuracy or real-person validation.'};
const compact=a=>({dependencies:a.dependencies,confirmedEvidence:a.confirmedEvidence,deferredEvidence:a.deferredEvidence,month:a.month,coverage:a.coverage,joins:a.joins,decisions:a.decisions,seasonalCommand:a.seasonalCommand,missing:a.missing,moderationReference:a.reviews.boundaryPriority.moderationReference,tensions:a.reviews.boundaryPriority.tensions,reference:a.reviews.reference.sourceClassification,vetoStatus:a.reviews.veto.status});
writeFileSync(new URL('./reports/whole-chart-synthesis.json',import.meta.url),JSON.stringify({metrics,references:[...refs,...middle].map(c=>({id:c.id,...compact(c.analysis)})),birthCases:cases.map(c=>({id:c.id,...compact(c.analysis)})),positionComparison:pair.people.map(compact)},null,2)+'\n');
const lines=['# 전체 구조 종합 검토 v2','', '기존 분석을 하나의 근거 흐름으로 연결한 연구 보고서. 일반 강약·성격·궁합 판정은 아님.','',JSON.stringify(metrics,null,2),''];
for(const c of cases){lines.push(`## ${c.id}`,`사령: ${c.analysis.seasonalCommand.status}`,...c.analysis.joins.map(j=>`- ${j.text}`),...c.analysis.decisions.map(d=>`- ${d.id}: ${d.status} — ${d.blockers.join(', ')}`),'');}
writeFileSync(new URL('./reports/whole-chart-synthesis.md',import.meta.url),lines.join('\n')+'\n');
console.log(JSON.stringify(metrics,null,2));

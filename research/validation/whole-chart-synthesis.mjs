/** Research synthesis: evidence joins and explicit decision dependencies, not personality weights. */
import {calculateProfile} from './adapter.mjs';
import {analyzeNatal} from './natal-analysis.mjs';
import {analyzeContext} from './context-analysis.mjs';
import {calculateSeasonalCommand} from './seasonal-command.mjs';
import {adjudicateStrengthReference,adjudicateTransformationVetoes} from './adjudication-review.mjs';
import {analyzeGeneralBalance,analyzeHourAndInteractions} from './hour-balance-review.mjs';
import {reviewRescueActors,reviewTransformationReference} from './rescue-wangqi-review.mjs';
import {reviewBoundaryPriority} from './boundary-priority-review.mjs';
import {compareProfiles} from './reading-analysis.mjs';

export const synthesisVersion='whole-chart-evidence-synthesis-research-v2';
const names={year:'연주',month:'월주',day:'일주',hour:'시주'};
const unique=xs=>[...new Set(xs)].sort();
const certain=f=>f.certainty==='all-candidates';

export function synthesizeProfile(profile) {
 const natal=analyzeNatal(profile),context=analyzeContext(profile);
 const facts=[
  ...natal.tenGods.map(f=>({id:`role:${f.id}`,kind:'ten-god',certainty:f.certainty,positions:[f.position],value:{stem:f.targetStem,role:f.label,layer:f.layer},sources:f.sources})),
  ...context.rootObservations.map(f=>({id:f.id,kind:'day-root-observation',certainty:f.certainty,positions:[f.position],value:{stem:f.hiddenStem,match:f.match},sources:f.sources})),
  ...context.monthExposures.map(f=>({id:f.id,kind:'month-exposure',certainty:f.certainty,positions:[f.position],value:{stem:f.stem},sources:f.sources})),
  ...context.combinationContexts.map(f=>({id:`combination:${f.id}`,kind:'combination-context',certainty:f.certainty,positions:f.positions,value:{adjacent:f.adjacent,involvesDay:f.involvesDayStem,alternatives:f.contextAlternatives},sources:f.sources})),
 ];
 const confirmed=facts.filter(certain),deferred=facts.filter(f=>!certain(f));
 const joins=[];
 // Presence across different pillars is structural distribution, never independent weight votes.
 for(const role of unique(confirmed.filter(f=>f.kind==='ten-god').map(f=>f.value.role))) {
  const rows=confirmed.filter(f=>f.kind==='ten-god'&&f.value.role===role);
  const positions=unique(rows.flatMap(f=>f.positions));
  joins.push({id:`distribution:${role}`,rule:'same-role-across-confirmed-positions',kind:'structural-observation',evidenceIds:rows.map(f=>f.id),positions,
   text:`${role}은 ${positions.map(p=>names[p]).join('·')}에서 확인되네. 나타난 자리를 함께 기록하되, 반복 횟수를 성격의 강도로 바꾸지는 않았네.`});
 }
 for(const exposure of confirmed.filter(f=>f.kind==='month-exposure')) {
  const roots=confirmed.filter(f=>f.kind==='ten-god'&&f.value.layer==='hidden'&&f.value.stem===exposure.value.stem&&!f.positions.includes('month'));
  if(roots.length)joins.push({id:`linked:${exposure.id}`,rule:'month-hidden-exposed-and-present-in-other-branch',kind:'structural-observation',
   evidenceIds:[exposure.id,...roots.map(f=>f.id)],positions:unique(['month',...exposure.positions,...roots.flatMap(f=>f.positions)]),
   text:`월지 안의 ${exposure.value.stem}이 ${names[exposure.positions[0]]} 천간에 드러나고, ${unique(roots.flatMap(f=>f.positions)).map(p=>names[p]).join('·')} 지장간에도 이어지네. 계절의 자리·겉의 글자·다른 기둥의 연결을 함께 살필 항목이라네. 이것만으로 격국이나 용신을 정하지는 않겠네.`});
 }
 const reference=adjudicateStrengthReference(profile),veto=adjudicateTransformationVetoes(profile);
 const balance=analyzeGeneralBalance(profile),hour=analyzeHourAndInteractions(profile),rescue=reviewRescueActors(profile),transformationReference=reviewTransformationReference(profile);
 const boundaryPriority=reviewBoundaryPriority(profile);
 const missing=[];
 if(!profile.timeKnown)missing.push('UNKNOWN_HOUR');
 if(natal.dayReference.confirmedStem===null)missing.push('UNRESOLVED_DAY_REFERENCE');
 if(deferred.length)missing.push('CANDIDATE_DEPENDENT_EVIDENCE');
 if(profile.boundaryReview)missing.push('SOLAR_TERM_BOUNDARY_REVIEW');
 if(profile.clockReview)missing.push('HISTORICAL_CLOCK_REVIEW');
 return {version:synthesisVersion,productionApproved:false,scope:'individual-structure-review',coverage:natal.coverage,
  dependencies:{natal:natal.ruleVersion,context:context.ruleVersion,reference:reference.ruleVersion,hour:hour.ruleVersion,rescue:rescue.ruleVersion,boundaryPriority:boundaryPriority.version},
  month:natal.monthContext,confirmedEvidence:confirmed,deferredEvidence:deferred,joins,
  reviews:{reference,veto,balance,hour,rescue,transformationReference,boundaryPriority},
  decisions:[
   {id:'strength',status:'deferred',value:null,dependsOn:['month','day-root-observation','month-exposure','seasonal-command','transformation'],blockers:unique([...missing,'NO_REVIEWED_GENERAL_STRENGTH_BOUNDARY']),referenceOnly:reference.sourceClassification},
   {id:'moderation',status:'deferred',value:null,dependsOn:['strength','balance','boundaryPriority'],blockers:unique([...missing,'NO_REVIEWED_GENERAL_MODERATION_BOUNDARY']),referenceOnly:boundaryPriority.moderationReference.sourceClassification},
   {id:'transformation',status:'deferred',value:null,dependsOn:['combination-context','veto','hour','rescue','seasonal-command','boundaryPriority'],blockers:unique([...missing,'SOURCE_PRECEDENCE_AND_SUFFICIENT_CONDITIONS_UNRESOLVED']),sourceClauseStatus:veto.status},
   {id:'personality',status:'deferred',value:null,dependsOn:['strength','transformation','joins'],blockers:['NO_REVIEWED_STRUCTURE_TO_PERSONALITY_RULE']},
  ],
  seasonalCommand:{status:'birth-input-required',confirmedStem:null},
  missing,score:null,policy:'All joins require universal facts. Marginal candidate witnesses are not jointly feasible charts. Counts, absent roles and structural recurrence are not strength, deficiency or probability. Source cases stay edition-attributed.'};
}

export function synthesizeBirth(input) {
 // Never accept a caller-provided profile or command as authority.
 const result=synthesizeProfile(calculateProfile(input));
 const command=calculateSeasonalCommand(input);
 result.seasonalCommand=command;
 result.dependencies.seasonal=command.ruleVersion;
 if(command.status!=='single-command')for(const d of result.decisions.filter(d=>d.id!=='personality'))d.blockers=unique([...d.blockers,'SEASONAL_COMMAND_UNRESOLVED']);
 return result;
}

export function synthesizePair(first,second) {
 const a=synthesizeProfile(first),b=synthesizeProfile(second),cross=compareProfiles(first,second);
 return {version:synthesisVersion,productionApproved:false,people:[a,b],crossObservations:cross.findings.filter(certain),
  deferredCrossObservations:cross.findings.filter(f=>!certain(f)),
  decisions:[{id:'compatibility',status:'deferred',value:null,blockers:['INDIVIDUAL_STRUCTURE_REVIEW_PENDING','NO_REVIEWED_PAIRWISE_EFFECT_RULE']}],
  score:null,policy:'Do not merge two people into an eight-pillar natal chart or reuse personal transformation vetoes as compatibility penalties.'};
}

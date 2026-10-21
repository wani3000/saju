/** Source-scoped adjudication order. No invented weights or cross-edition winner. */
import {analyzeContext} from './context-analysis.mjs';
import {reviewModerationReference} from './beta-quality-pack.mjs';
import {reviewScopedGuards} from './scoped-criteria.mjs';
import {analyzeHourAndInteractions} from './hour-balance-review.mjs';
import {analyzeFivePairConditions} from './extended-source-review.mjs';
import {adjudicateTransformationVetoes} from './adjudication-review.mjs';
export const boundaryPriorityVersion='source-boundary-priority-review-v1';

export function reviewBoundaryPriority(profile) {
 const context=analyzeContext(profile),moderation=reviewModerationReference(profile);
 const guards=reviewScopedGuards(profile),hour=analyzeHourAndInteractions(profile),cardinality=analyzeFivePairConditions(profile),veto=adjudicateTransformationVetoes(profile);
 const anyPreference=hour.alternatives.some(a=>a.hourPreference.status==='preference-example-matched');
 const allPreference=hour.alternatives.every(a=>a.hourPreference.status==='preference-example-matched');
 const anyGuard=guards.alternatives.some(a=>a.triggers.length>0);
 const allGuard=guards.triggerInEveryCandidate;
 const tensions=[];
 if(anyPreference&&anyGuard)tensions.push({id:'preferred-hour-vs-guard',status:allPreference&&allGuard?'coexisting-universal-observations':'candidate-dependent-do-not-merge',
  action:'retain-both-no-automatic-override',scope:'same source, listed example and scoped warning are different predicates',
  sources:[...hour.sources,...guards.alternatives.map(a=>a.source)]});
 const competing=context.combinationContexts.filter(c=>c.certainty==='all-candidates'&&c.contextAlternatives.every(a=>a.additionalPartners.length>0));
 if(competing.length)tensions.push({id:'multiplicity-vs-position',status:'source-conventions-require-separate-review',
  action:'do-not-promote-mingli-cardinality-screen-to-universal-veto',pairIds:competing.map(c=>c.id),
  sources:[...cardinality.sources,...competing.flatMap(c=>c.sources)]});
 const conditionalAssistance=hour.alternatives.some(a=>a.earthInteractions.some(x=>x.kind==='assistance'));
 if(conditionalAssistance)tensions.push({id:'assistance-premises',status:'base-and-additional-transformations-unproved',action:'do-not-use-assistance-to-clear-a-veto',sources:hour.sources});
 return {version:boundaryPriorityVersion,productionApproved:false,moderationReference:moderation,
  sourceChecks:{guards,hour,cardinality,veto},tensions,
  order:[
   {id:'coverage',rule:'validate-input-and-preserve-candidates',resolved:profile.timeKnown&&!profile.clockReview&&!profile.boundaryReview&&Object.values(profile.pillars).every(p=>p!==null)},
   {id:'scope',rule:'match-source-target-pair-month-and-position-before-applying-clause'},
   {id:'counterconditions',rule:'check-warnings-and-all-partners-before-considering-a-preference'},
   {id:'premises',rule:'do-not-use-conditional-rescue-or-assistance-until-its-premises-are-proved'},
   {id:'source-conventions',rule:'no-cross-edition-priority-without-explicit-review'},
   {id:'conclusion',rule:'no-final-true-from-absence-of-a-warning-or-preferred-hour'}
  ],
  classification:null,moderation:null,transformationEstablished:null,score:null,
  policy:'Order is an engineering safeguard for source interpretation, not a newly discovered traditional total precedence order. An exact balanced source case is not a general strong/weak boundary.'};
}

/** Source-grounded necessary checks and an integrated evidence review; no invented strength score. */
import {calculateProfile} from './adapter.mjs';
import {analyzeNatal} from './natal-analysis.mjs';
import {analyzeContext} from './context-analysis.mjs';
import {analyzeSourceJudgments} from './source-judgments.mjs';
import {classifyTenGod} from './natal-rules.mjs';
import {calculateSeasonalCommand,seasonalSource,seasonalCatalog} from './seasonal-command.mjs';
const positions=['year','month','day','hour'];
const sorted=values=>[...new Set(values)].sort();
const options=(profile,position)=>profile.pillars[position]===null?profile.candidates[position]:[profile.pillars[position]];
const source=()=>[seasonalSource('transformation-general',[167]),seasonalSource('jia-ji-month-and-rivals',[171])];
export const reviewVersion='seasonal-strength-transformation-review-v1';

function* assignments(slots,index=0,assigned={}) {
  if(index===slots.length){yield assigned;return;}
  const {position,values}=slots[index];
  for(const value of values) yield* assignments(slots,index+1,{...assigned,[position]:value});
}
function assessAssignment(a,timeKnown) {
  const day=a.day,stemAt=p=>p==='month'?a.month[0]:a[p];
  if(!['갑','기'].includes(day)) return {status:'outside-reviewed-pair',reasons:['day-stem-not-jia-or-ji'],checks:[]};
  const partner=day==='갑'?'기':'갑';
  const targets=positions.filter(p=>p!=='day' && stemAt(p)===partner);
  if(!targets.length && timeKnown) return {status:'no-day-combination',reasons:['no-visible-day-partner'],checks:[]};
  const visible=positions.filter(p=>stemAt(p)!==null).map(stemAt);
  const checks=[
    {id:'month-earth-branch',state:[...'진술축미'].includes(a.month[1])?'met':'failed'},
    {id:'one-visible-partner',state:targets.length>1?'failed':!timeKnown?'unknown':targets.length===1?'met':'failed'},
    {id:'no-extra-jia',state:visible.filter(s=>s==='갑').length>1?'failed':timeKnown?'met':'unknown'},
    {id:'no-visible-eul',state:visible.includes('을')?'failed':timeKnown?'met':'unknown'},
  ];
  // Explicit 子平真詮 obstruction examples are checked as a separate source convention.
  const blockedTargets=targets.filter(p=>{
    const lo=Math.min(positions.indexOf(p),2),hi=Math.max(positions.indexOf(p),2);
    return positions.slice(lo+1,hi).some(m=>['경','을'].includes(stemAt(m)));
  });
  checks.push({id:'no-explicit-intervening-obstruction',state:blockedTargets.length?'failed':timeKnown?'met':'unknown'});
  if(day==='기' && visible.filter(s=>s==='기').length>1)
    checks.push({id:'multiple-ji-scope-unreviewed',state:'unknown'});
  const failed=checks.filter(c=>c.state==='failed').map(c=>c.id);
  const unknown=checks.filter(c=>c.state==='unknown').map(c=>c.id);
  return {status:failed.length?'necessary-condition-failed':unknown.length?'insufficient-data':'reviewed-necessary-conditions-met',
    reasons:failed.length?failed:unknown,checks};
}

export function analyzeTransformationConditions(profile) {
  const context=analyzeContext(profile); // strict v5/candidate validation
  const slots=positions.map(position=>({position,values:position==='hour'&&!profile.timeKnown?[null]:
    sorted(options(profile,position).map(p=>position==='month'?p:p[0]))}));
  // Preserve month stem+branch correlation. Collapse irrelevant branches, bounded by 10*60*10*10.
  const unique=new Map();
  for(const assignment of assignments(slots)) {
    const assessed=assessAssignment(assignment,profile.timeKnown);
    unique.set(JSON.stringify(assessed),assessed);
  }
  const alternatives=[...unique.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([,a])=>a);
  const statuses=sorted(alternatives.map(a=>a.status));
  const status=statuses.length===1?statuses[0]:'candidate-dependent';
  return {ruleVersion:reviewVersion,productionApproved:false,
    scope:'Jia-Ji day-stem combination only; other pairs have no condition model here.',
    dependencies:{contextRuleVersion:context.ruleVersion,...context.dependencies},coverage:context.coverage,
    status,alternatives,commonFailedChecks:alternatives[0].checks.filter(c=>c.state==='failed' &&
      alternatives.every(a=>a.checks.some(other=>other.id===c.id && other.state==='failed'))).map(c=>c.id),
    candidatePolicy:'Universal over supplied marginal combinations; partial assignments not proved jointly feasible; no probabilities.',
    targetElement:'토',transformedElement:null,transformationEstablished:false,
    sources:[...source(),...context.combinationContexts.flatMap(c=>c.sources).filter(s=>s.sectionId==='intervening-stem').slice(0,1)],
    unresolvedConditions:['Source moderation (太過/不及) has no reviewed numeric or exhaustive qualitative criterion',
      'Other 合化 pairs and conflicts between source conventions remain unreviewed',
      'Printed 甲乙 wording on page 171 is preserved, not silently emended',
      'Passing necessary checks is not a sufficient proof of transformation']};
}

export function reviewStrengthAndTransformation(input) {
  const profile=calculateProfile(input),natal=analyzeNatal(profile),context=analyzeContext(profile);
  const judgments=analyzeSourceJudgments(profile),command=calculateSeasonalCommand(input);
  const commandRelations=command.confirmedStem?natal.dayReference.alternatives.map(day=>({...classifyTenGod(day.stem,command.confirmedStem),
    certainty:natal.dayReference.alternatives.length===1?'all-candidates':'day-candidate-dependent'})):[];
  const factors=natal.tenGods.map(f=>({...f,
    role:['same-element','target-produces-day'].includes(f.direction)?'support-relation':'output-wealth-or-control-relation'}));
  const common=factors.filter(f=>f.certainty==='all-candidates');
  const reviewReasons=['SOURCE_DOES_NOT_DEFINE_TOTAL_STRENGTH_THRESHOLDS','ROOT_CONVENTION_ONLY_PARTIALLY_REVIEWED'];
  if(!command.confirmedStem) reviewReasons.push('SEASONAL_COMMAND_UNRESOLVED');
  if(!profile.timeKnown) reviewReasons.push('HOUR_UNOBSERVED');
  if(profile.boundaryReview) reviewReasons.push('CALENDAR_BOUNDARY_REVIEW');
  if(profile.clockReview) reviewReasons.push('HISTORICAL_CLOCK_REVIEW');
  if(factors.some(f=>f.certainty!=='all-candidates')) reviewReasons.push('CANDIDATE_DEPENDENT_FACTORS');
  if(common.some(f=>f.role==='support-relation') && common.some(f=>f.role!=='support-relation'))
    reviewReasons.push('SUPPORT_AND_OUTPUT_WEALTH_CONTROL_COEXIST');
  return {ruleVersion:reviewVersion,productionApproved:false,
    dependencies:{engineVersion:profile.policy.version,natalRuleVersion:natal.ruleVersion,
      contextRuleVersion:context.ruleVersion,judgmentRuleVersion:judgments.ruleVersion,commandRuleVersion:seasonalCatalog.version},
    coverage:natal.coverage,seasonalCommand:command,
    strength:{status:'not-adjudicated',classification:null,score:null,reviewReasons,
      commandRelations,monthExposures:context.monthExposures,hiddenStemRootObservations:context.rootObservations,
      sourceRootAssessments:judgments.rootAssessments,factors,
      aggregationPolicy:'No tally, majority vote, numeric weights or source-order rank. Day reference is not an extra peer.',
      sourcePolicy:'Keep static hidden stems, temporal command, and edition-specific roots distinct.'},
    transformation:analyzeTransformationConditions(profile)};
}

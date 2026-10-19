/** Selected source definitions plus editorial prompts; no compatibility inference. */
import {readFileSync} from 'node:fs';
import {compareProfiles} from './reading-analysis.mjs';
import {ruleCatalog} from './reading-rules.mjs';
const policy=JSON.parse(readFileSync(new URL('./selected-reading-policy.json', import.meta.url)));
const freeze=o=>{if(o&&typeof o==='object'){Object.values(o).forEach(freeze);Object.freeze(o);}return o;};
export const selectedReadingPolicy=freeze(policy);
if(policy.productionApproved!==false||policy.definitionVersion!==ruleCatalog.version||
  policy.engineVersion!=='research-civil-midnight-v5'||policy.status!=='selected-for-app-review'||
  JSON.stringify([...policy.includedRuleIds].sort())!==JSON.stringify(ruleCatalog.rules.map(r=>r.id).sort())||
  JSON.stringify(policy.comparisonPositions)!==JSON.stringify(['year','month','day'])||
  policy.maxDisplayedObservations!==6) throw new Error('INVALID_SELECTED_READING_POLICY');
const names={year:'연주',month:'월주',day:'일주'};
const ordered=xs=>[...new Set(xs)].sort();
export function buildSelectedReading(first,second,relationship) {
  if(!Object.hasOwn(policy.advice,relationship)) throw new Error('UNSUPPORTED_READING_RELATIONSHIP');
  const pair=compareProfiles(first,second); // strict profile validation before any projection
  if(pair.engineVersion!==policy.engineVersion) throw new Error('UNSUPPORTED_SELECTED_ENGINE');
  const eligible=pair.findings.filter(f=>policy.includedRuleIds.includes(f.ruleId)&&
    f.endpoints.every(e=>policy.comparisonPositions.includes(e.position)));
  const common=eligible.filter(f=>f.certainty==='all-candidates');
  // A consistent editorial order, never a significance/ranking or a good/bad selection.
  const sorted=[...common].sort((a,b)=>{
    const key=f=>f.ruleId+':'+f.endpoints.map(e=>e.position).join(':');
    return key(a)<key(b)?-1:key(a)>key(b)?1:0;
  });
  const observations=sorted.slice(0,policy.maxDisplayedObservations).map(f=>{
    const r=ruleCatalog.rules.find(r=>r.id===f.ruleId);
    return {id:`${r.id}:${f.endpoints.map(e=>e.position).join(':')}`,ruleId:r.id,family:r.family,
      positions:f.endpoints.map(e=>({side:e.side,position:e.position})),
      text:`내 ${names[f.endpoints[0].position]}와 상대 ${names[f.endpoints[1].position]}에서 ${r.symbols.join('·')}의 ${r.label} 짝이 확인돼요.`,
      source:{...r.source}};
  });
  const days=['a','b'].map(side=>pair.stemElements.find(e=>e.side===side&&e.position==='day'));
  const dayElements=days.map(d=>d.confirmedElement);
  const strength=dayElements.every(Boolean)?
    `내 일간의 오행은 ${dayElements[0]}, 상대 일간의 오행은 ${dayElements[1]}${['목','금'].includes(dayElements[1])?'으로':'로'} 분류돼요. 일간은 태어난 날의 천간 한 글자이며, 사주 전체의 오행 비율을 뜻하지 않아요.`:
    policy.copy.uncertainDay;
  // Use ALL common families for the summary, including ones outside the display cap.
  const families=ordered(common.map(f=>f.label));
  const difference=families.length?`두 사람의 기호 사이에서 ${families.join('·')}에 해당하는 짝이 확인돼요. ${policy.copy.pairMeaning}`:policy.copy.noMatch;
  const coverage=pair.coverage.map(c=>({side:c.side,hourKnown:c.omittedPositions.length===0,
    boundaryReviewRequired:c.boundaryReviewRequired,clockReviewRequired:c.clockReviewRequired}));
  const cautions=[];
  if(coverage.some(c=>!c.hourKnown)) cautions.push('출생 시간을 모르는 정보가 있어요. 시주는 보충하지 않았으며, 이번 비교는 연·월·일만 사용해요.');
  else cautions.push('출생 시각은 계산표에 보관했어요. 이번 기호 비교는 연·월·일만 사용해요.');
  if(coverage.some(c=>c.boundaryReviewRequired)) cautions.push('절기 경계의 후보 중 공통으로 확인되는 기호만 설명했어요.');
  if(coverage.some(c=>c.clockReviewRequired)) cautions.push('과거 표준시 변경 자료가 다른 날짜가 있어요. 계산의 확정과는 구분해 살펴봐 주세요.');
  const omittedCandidateDependentFacts=eligible.length-common.length;
  if(omittedCandidateDependentFacts) cautions.push('입력 후보에 따라 달라지는 합·충은 확정 문장에서 제외했어요.');
  return {label:policy.copy.label,title:policy.copy.title,strength,difference,
    advice:policy.advice[relationship],ruleVersion:policy.version,score:null,
    basis:{kind:'source-symbol-comparison',productionApproved:false,definitionVersion:ruleCatalog.version,
      notice:policy.copy.notice,adviceNotice:policy.copy.adviceNotice,comparisonPositions:[...policy.comparisonPositions],
      dayElements:dayElements.map((element,i)=>({side:i===0?'a':'b',element,source:{...days[i].source}})),
      observations,commonFamilies:families,totalCommonObservations:common.length,
      omittedDisplayObservations:common.length-observations.length,omittedCandidateDependentFacts,
      coverage,cautions,scoreStatus:'not-adopted',mapStatus:'collection-only-not-ranked',
      sharedCopy:{title:policy.copy.sharedTitle,strength:policy.copy.sharedStrength}}};
}

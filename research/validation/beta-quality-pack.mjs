import {readFileSync} from 'node:fs';
import {analyzeProfile,compareProfiles} from './reading-analysis.mjs';
import {calculateProfile} from './adapter.mjs';
import {strengthReferences} from './adjudication-review.mjs';
import {buildBetaReading,privateBetaScope} from './beta-reading.mjs';
const middle=JSON.parse(readFileSync(new URL('./fixtures/reading-sources/beta-moderation-cases.json',import.meta.url)));
const source=JSON.parse(readFileSync(new URL('./fixtures/reading-sources/beta-quality-sources.json',import.meta.url))).sources[0];
const positions=['year','month','day','hour'];
export const chart=pillars=>({policy:{version:'research-civil-midnight-v5',productionApproved:false},timeKnown:true,pillars});
export const referenceProfile=c=>chart(Object.fromEntries(positions.map((k,i)=>[k,c.pillars[i]])));
export function moderationReferenceCases(){return structuredClone(middle.cases);}
export function reviewModerationReference(profile) {
 const {coverage}=analyzeProfile(profile);
 const options=k=>profile.pillars[k]===null?profile.candidates?.[k]:[profile.pillars[k]];
 const fixed=profile.timeKnown&&positions.every(k=>options(k)?.length===1);
 const matches=middle.cases.filter(c=>positions.every((k,i)=>k==='hour'&&!profile.timeKnown||options(k).includes(c.pillars[i])));
 return {coverage,status:fixed&&matches.length?'exact-source-reference':matches.length?'partial-reference':'outside-reviewed-middle-cases',
  sourceClassification:fixed&&matches.length?matches[0].classification:null,
  matches:matches.map(c=>({id:c.id,sourceLabel:c.sourceLabel,pdfPage:c.pdfPage,sourceId:source.sourceId,pdfSha256:source.pdfSha256})),
  generalStrength:null,compatibilityScore:null,policy:'Source case attribution only; the contrast label is not a general weak-class threshold.'};
}
const a=()=>chart({year:'갑자',month:'갑자',day:'갑자',hour:'갑자'});
const b=()=>chart({year:'기축',month:'기축',day:'기축',hour:'기축'});
export function betaQualityFixtures() {
 const uncertain=a();uncertain.pillars.day=null;uncertain.candidates={day:['갑자','병자']};
 const both=b();both.pillars.day=null;both.candidates={day:['기축','신축']};
 const same=a();same.pillars.day=null;same.candidates={day:['갑자','을축']};
 const coexist=b();coexist.pillars.day='병오';
 const solar=calculateProfile({calendar:'solar',year:2024,month:2,day:10,leap:false,timeKnown:false});
 const lunar=calculateProfile({calendar:'lunar',year:2024,month:1,day:1,leap:false,timeKnown:false});
 const boundary=calculateProfile({calendar:'solar',year:1954,month:12,day:7,hour:23,minute:58,leap:false,timeKnown:true});
 const clock=calculateProfile({calendar:'solar',year:1954,month:3,day:21,leap:false,timeKnown:false});
 return [
  ['different-elements',a(),b(),'친구','두 기준 오행을 구분하고 전체 오행 비율로 쓰지 않음'],
  ['no-common-pair',a(),a(),'친구','짝 없음은 관계 불량·중화·100점이 아님'],
  ['coexisting-pairs',a(),coexist,'친구','합·충 종류 모두 보존, 서로 상쇄하거나 가감점하지 않음'],
  ['one-uncertain-day',uncertain,b(),'친구','한쪽 미확정이 다른 쪽의 확인된 토 오행을 지우지 않음'],
  ['both-uncertain-days',uncertain,both,'친구','둘 다 미확정이면 후보 중 임의 선택하지 않음'],
  ['same-element-candidates',same,b(),'친구','천간 후보가 달라도 전체 후보의 같은 오행 배속은 보존'],
  ['unknown-hour-calendar',solar,a(),'친구','시주 보충 없이 비교 범위 안내'],
  ['known-hours',a(),b(),'친구','시각을 알아도 베타 비교는 연·월·일'],
  ['solar-term-boundary',boundary,a(),'친구','절입 경계 후보의 공통 기호만 설명'],
  ['historical-clock-review',clock,a(),'친구','자료 차이의 검토 상태 전달'],
  ['solar-lunar-equivalent',lunar,a(),'친구','대응 양력과 같은 설명'],
  ['source-balanced-with-clash',referenceProfile(middle.cases[0]),a(),'친구','원문 중화 사례에 충이 있어도 불량 관계로 확대하지 않음'],
  ['seasonal-strength-counterexample',referenceProfile(middle.cases[1]),a(),'친구','월지·득령만으로 중화·신강을 출력하지 않음'],
  ...['친구','가족','연인','동료'].map(relation=>['relation-'+relation,a(),b(),relation,'관계 변경은 대화 주제만 바꾸며 기호 근거는 같음']),
 ].map(([id,first,second,relationship,expectation])=>({id,first,second,relationship,expectation}));
}
export function checkBetaEvidence(first,second,reading) {
 const raw=compareProfiles(first,second);
 const common=raw.findings.filter(f=>f.certainty==='all-candidates'&&f.endpoints.every(e=>e.position!=='hour'));
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const observationsSound=reading.basis.observations.every(o=>common.some(f=>f.ruleId===o.ruleId&&same(f.endpoints,o.positions)&&same(f.source,o.source)));
 const families=[...new Set(common.map(f=>f.label))].sort();
 return {observationsSound,allFamiliesPreserved:same(families,reading.basis.commonFamilies),
  countMatches:reading.basis.totalCommonObservations===common.length,
  noScore:reading.score===null&&reading.basis.scoreStatus==='not-adopted',
  sharedYearMonthDayOnly:reading.basis.observations.every(o=>o.positions.every(p=>p.position!=='hour')),
  copyWithinBounds:[reading.title,reading.strength,reading.difference,reading.advice].every(t=>t.length>0&&t.length<=180)};
}
export function buildBetaQualityPack() {
 const cases=betaQualityFixtures().map(f=>{
  const reading=buildBetaReading(f.first,f.second,f.relationship);
  return {id:f.id,expectation:f.expectation,relationship:f.relationship,reading,checks:checkBetaEvidence(f.first,f.second,reading)};
 });
 return {scope:privateBetaScope,reviewer:'Codex',reviewedOn:'2026-10-19',
  reviewScope:'Source definitions, source-reference contrast, editorial clarity and technical invariants; no expert or user-study signoff.',
  sourceReferenceBank:[...strengthReferences.map(c=>({id:c.id,sourceLabel:c.sourceLabel,category:c.classification,pdfPage:c.pdfPage})),
   ...middle.cases.map(c=>({id:c.id,sourceLabel:c.sourceLabel,category:c.classification,pdfPage:c.pdfPage}))],
  cases,checksPassed:cases.every(c=>Object.values(c.checks).every(Boolean)),
  reviewGates:[
   {id:'beta-scope',status:'fixed',evidence:'beta-scope.json'},
   {id:'source-and-editorial-review',status:'reviewed-by-Codex',evidence:'17 beta cases and 22 source references'},
   {id:'expert-interpretation-review',status:'not-completed',evidence:null},
   {id:'calendar-production-approval',status:'pending',evidence:null},
   {id:'user-comprehension-study',status:'not-started',evidence:null},
   {id:'external-private-pilot',status:'not-started',evidence:null},
  ],
  comprehensionQuestions:[
   {question:'기준 오행은 사주 전체의 오행 비율인가요?',expected:'아니요. 태어난 날의 글자 한 개의 분류예요.'},
   {question:'충이 있으면 관계가 나쁘다는 뜻인가요?',expected:'아니요. 기호의 짝 이름만 설명해요.'},
   {question:'대화 제안은 생일로 추론한 성격인가요?',expected:'아니요. 관계 유형에 맞춘 편집 제안이에요.'},
   {question:'공개 공유에서 생일·사주 기호를 볼 수 있나요?',expected:'아니요. 공개용 별명과 대화 주제만 공유해요.'},
   {question:'새 버전이 나오면 이미 저장한 결과도 바뀌나요?',expected:'아니요. 생성 당시 버전을 보관해요.'}
  ],humanParticipantsObserved:0,paidReleaseApproved:false};
}

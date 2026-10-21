import type {Reading} from './model';
import type {WholePerson,ReadingFacet} from './whole-chart-reading';
import {relationshipStoryVersion} from './relationship-story';
import type {RelationshipKind} from './easy-relationship-reading';
export const coherentReadingVersion='chunbae-coherent-whole-chart-v8';
export const roles=['비견','겁재','식신','상관','편재','정재','편관','정관','편인','정인'] as const;
export type Role=typeof roles[number];
type Voice={scene:string;habit:string;action:string;need:string;risk:string;say:string;reply:string};
// One editorial dictionary for personal descriptions AND relationship interactions.
// Situations distinguish apparently opposite habits; neither positions nor counts rank strength.
export const voices:Record<Role,Voice>={
 비견:{scene:'의견이 갈릴 때',habit:'자기 생각을 확인한 뒤 결정하려는 편이라네',action:'대신 결정하지 않고 고를 기회를 주는 것',need:'스스로 선택할 기회',risk:'마음을 정한 뒤에는 다른 의견을 듣기 어려울 수 있네',say:'네 생각은 알겠어. 내가 고를 수 있는 부분도 남겨 줄래?',reply:'좋아. 각자 원하는 것을 말하고 같이 고르자.'},
 겁재:{scene:'혼자 시작하기 막막할 때',habit:'누군가와 함께하면 용기를 내는 편이라네',action:'첫걸음을 함께하고 맡을 일을 나누는 것',need:'함께할 사람과 분명한 역할',risk:'도우려는 마음이 앞서 상대의 몫까지 대신 정할 수 있네',say:'같이 해 보고 싶어. 서로 무엇을 맡을지 먼저 정하자.',reply:'나는 여기까지 맡을 수 있어. 어려운 부분은 같이 해 보자.'},
 식신:{scene:'특별한 일 없는 평소에',habit:'작은 행동으로 꾸준히 마음을 챙기는 편이라네',action:'작은 약속과 일상의 관심을 꾸준히 이어 가는 것',need:'재촉하지 않는 관심과 작은 정성',risk:'갑자기 서두르라는 말을 들으면 부담을 느낄 수 있네',say:'크게 해 주기보다 평소처럼 조금씩 챙겨 주면 좋겠어.',reply:'알겠어. 무리한 약속보다 내가 꾸준히 할 수 있는 걸 해 볼게.'},
 상관:{scene:'불편한 점을 발견했을 때',habit:'생각을 솔직하게 말하고 다른 방법을 찾는 편이라네',action:'불편한 이유를 말로 정리하고 새 방법을 제안하는 것',need:'의견을 끝까지 들어 주는 반응',risk:'문제부터 짚으면 상대는 자신의 노력까지 부정당했다고 느낄 수 있네',say:'탓하려는 건 아니야. 불편했던 점을 끝까지 들어 줄래?',reply:'응. 어떤 점이 불편했는지 듣고 바꿀 방법을 같이 생각하자.'},
 편재:{scene:'새로 해 보고 싶은 일이 생기면',habit:'가능한 방법을 알아보고 먼저 움직이는 편이라네',action:'작게 시도할 기회를 만들고 실제 행동으로 옮기는 것',need:'작게라도 시도할 기회',risk:'하고 싶은 일이 늘어나면 지키기 어려운 약속까지 잡을 수 있네',say:'한번 해 보고 싶어. 부담 없는 크기로 시작하면 어떨까?',reply:'좋아. 쓸 시간과 비용부터 정하고 작은 것부터 해 보자.'},
 정재:{scene:'약속을 준비할 때',habit:'날짜와 필요한 것을 미리 챙기는 편이라네',action:'일정과 준비할 것을 챙기고 변경을 미리 알리는 것',need:'예측할 수 있는 일정과 사전 안내',risk:'계획이 바뀌면 사정을 듣기 전에 서운해질 수 있네',say:'바뀔 것 같으면 미리 알려 줘. 나도 준비를 바꿀 수 있게.',reply:'그럴게. 이번에는 가능한 날짜를 지금 같이 정하자.'},
 편관:{scene:'급한 문제가 생겼을 때',habit:'피하기보다 해결할 일을 먼저 찾는 편이라네',action:'당장 필요한 일부터 나누어 부담을 덜어 주는 것',need:'혼자 떠안지 않도록 돕는 행동',risk:'급한 마음에 상대도 같은 속도로 움직이길 요구할 수 있네',say:'혼자 해결하려니 급해졌어. 이 부분을 같이 맡아 줄래?',reply:'내가 할 수 있는 것부터 맡을게. 무엇이 가장 급한지 알려 줘.'},
 정관:{scene:'책임을 나눌 때',habit:'서로 정한 약속과 맡은 일을 지키려는 편이라네',action:'기대하는 일과 가능한 범위를 분명히 약속하는 것',need:'서로 납득한 약속과 책임 분담',risk:'내 기준을 상대도 당연히 지켜야 한다고 생각할 수 있네',say:'어디까지 할 수 있는지 서로 정하면 마음이 편할 것 같아.',reply:'좋아. 할 수 있는 일과 어려운 일을 같이 말해 보자.'},
 편인:{scene:'쉽게 판단하기 어려울 때',habit:'혼자 생각하며 놓친 점을 살피는 편이라네',action:'바로 결론을 재촉하지 않고 생각할 틈을 주는 것',need:'생각을 정리할 시간',risk:'생각이 길어져 말이 없으면 상대는 이유를 몰라 답답할 수 있네',say:'조금 생각할 시간이 필요해. 피하려는 건 아니야.',reply:'알겠어. 언제 다시 이야기하면 편할까? 그때 같이 보자.'},
 정인:{scene:'누군가 힘든 마음을 털어놓을 때',habit:'판단하기 전에 사정과 마음을 듣는 편이라네',action:'평가보다 이야기를 먼저 듣고 필요한 도움을 묻는 것',need:'내 마음도 물어봐 주는 배려',risk:'상대를 이해하려다 내 바람을 뒤로 미룰 수 있네',say:'네 마음도 이해해. 내 마음도 잠깐 이야기해도 될까?',reply:'물론이지. 네가 원하는 것도 듣고 싶어.'},
};
export type NarrativeTrait={role:Role;evidenceIds:string[]}&Voice;
export function buildNarrative(p:WholePerson):NarrativeTrait[]{return roles.filter(role=>p.evidence.some(e=>e.role===role)).map(role=>({role,...voices[role],evidenceIds:p.evidence.filter(e=>e.role===role).map(e=>e.id)}));}
type Topic='choice'|'care'|'plan'|'pressure'|'talk';
const topic:Record<Role,Topic>={비견:'choice',겁재:'choice',식신:'care',상관:'talk',편재:'plan',정재:'plan',편관:'pressure',정관:'pressure',편인:'talk',정인:'care'};
const scenes:Record<RelationshipKind,Record<Topic,string>>={
 연인:{choice:'주말 데이트에서 서로 하고 싶은 일이 다를 때',care:'바쁜 하루를 보내고 잠깐 안부를 나눌 때',plan:'여행이나 기념일 계획을 잡을 때',pressure:'한 사람만 연락과 약속을 챙긴다고 느낄 때',talk:'서운한 일을 꺼냈는데 바로 대답하기 어려울 때'},
 친구:{choice:'만나서 무엇을 할지 취향이 갈릴 때',care:'기운 없는 친구에게 연락했을 때',plan:'새 취미나 여행을 함께 시작하려 할 때',pressure:'모임 준비나 부탁이 한 사람에게 몰릴 때',talk:'고민을 털어놓았는데 조언이 부담스러울 때'},
 가족:{choice:'가족의 기대와 내가 원하는 선택이 다를 때',care:'가족이 지쳐 보여 무엇을 도울지 물을 때',plan:'방문이나 함께할 일정을 정할 때',pressure:'돌봄이나 필요한 일을 한 사람만 맡고 있을 때',talk:'걱정해서 한 말이 간섭처럼 들렸을 때'},
 동료:{choice:'같이 맡은 일의 방법을 정할 때',care:'동료가 지친 채 어려움을 이야기할 때',plan:'새 일을 시작하며 일정과 준비를 맞출 때',pressure:'급한 마감이나 추가 업무가 몰렸을 때',talk:'초안에 대한 의견을 주고받을 때'},
};
// Compatibility here means a concrete editorial aid-to-need example, never a score or verdict.
const helpers:Record<Role,Role[]>={비견:['비견','정인'],겁재:['정관','겁재'],식신:['식신','정재'],상관:['정인','상관'],편재:['겁재','편재'],정재:['정재','정관'],편관:['겁재','편관'],정관:['정관','정재'],편인:['편인','식신'],정인:['정인','편인']};
const bridges:Record<string,string>={
 '비견:비견':'가능한 선택지를 함께 보고 마지막 선택은 상대에게 맡겨 보게',
 '정인:비견':'상대가 왜 그 선택을 원하는지 먼저 듣고, 대신 결정하지는 말게',
 '정관:겁재':'함께 시작할 작은 일과 각자가 맡을 몫을 정해 보게',
 '겁재:겁재':'첫날은 같이 해 보고 다음부터 서로 도울 범위를 나눠 보게',
 '식신:식신':'큰 약속보다 짧은 안부나 작은 관심을 꾸준히 이어 가 보게',
 '정재:식신':'챙겨 주기로 한 작은 일을 잊지 않고 이어 가 보게',
 '정인:상관':'바로 반박하기 전에 불편했던 이유를 끝까지 듣고 이해한 내용을 되짚어 주게',
 '상관:상관':'새 방법을 제안하기 전에 상대 의견부터 한 문장으로 되짚어 주게',
 '겁재:편재':'시작이 막막한 부분을 함께하되, 쓸 시간과 비용은 먼저 정해 보게',
 '편재:편재':'새로운 제안을 한꺼번에 늘리기보다 이번에 해 볼 한 가지만 함께 골라 보게',
 '정재:정재':'바뀔 수 있는 일정과 미리 알려 줄 시간을 함께 적어 보게',
 '정관:정재':'언제까지 알려 주기로 했는지 약속하고, 어려워지면 먼저 이야기해 주게',
 '겁재:편관':'급한 일 중 자신이 맡을 수 있는 한 가지를 말하고 함께 처리해 보게',
 '편관:편관':'서로 급하게 움직이기 전에 무엇을 나눠 맡을지 먼저 정해 보게',
 '정관:정관':'지킬 수 있는 범위와 어려운 부탁을 서로 말한 뒤 약속해 보게',
 '정재:정관':'누가 무엇을 언제까지 준비할지 적어 책임이 한쪽에 몰리지 않게 해 보게',
 '편인:편인':'생각할 시간을 주되, 언제 다시 이야기할지도 함께 정해 보게',
 '식신:편인':'작은 안부는 이어 가면서도 바로 답하거나 결정하라고 재촉하지는 말게',
 '정인:정인':'상대 이야기를 듣다가 무엇을 원하는지도 직접 물어보게',
 '편인:정인':'상대가 한 말을 곰곰이 살핀 뒤, 참고 있는 바람은 없는지 물어보게',
};
const practices:Record<Role,string>={비견:'각자 원하는 선택지를 하나씩 말하고 번갈아 골라 보게',겁재:'함께할 작은 일 하나를 정하고 각자가 맡을 몫을 나눠 보게',식신:'무리 없이 꾸준히 해 줄 수 있는 작은 관심을 하나씩 정해 보게',상관:'상대 의견을 한 문장으로 되짚은 다음 자기 의견을 말해 보게',편재:'한번 해 볼 일에 쓸 시간과 비용의 한도를 먼저 정해 보게',정재:'일정이 바뀔 때 언제까지 알려 줄지 미리 약속해 보게',편관:'급할수록 당장 할 일 두 가지만 골라 하나씩 나눠 맡아 보게',정관:'할 수 있는 부탁과 어려운 부탁을 각각 하나씩 말해 보게',편인:'생각이 필요한 질문은 바로 답하지 않아도 될 시간을 정해 보게',정인:'상대를 챙기기 전에 오늘 자기 마음도 한 가지씩 이야기해 보게'};
const conditional=(s:string)=>`‘${s}’${(s.charCodeAt(s.length-1)-0xac00)%28===0?'라면':'이라면'}`;
const object=(s:string)=>`‘${s}’${(s.charCodeAt(s.length-1)-0xac00)%28===0?'를':'을'}`;
const unique=<T>(xs:T[])=>[...new Set(xs)];
const byRole=(p:WholePerson)=>p.narrative??buildNarrative(p);
const evidence=(p:WholePerson,rs:Role[],who:string)=>p.evidence.filter(e=>rs.includes(e.role as Role)).map(e=>`${who}: ${e.text}`);
function help(provider:WholePerson,receiver:WholePerson,kind:RelationshipKind,who:string,to:string){
 const a=byRole(provider),b=byRole(receiver);
 // Distinct needs first, then shared needs. Both are supported roles; absence is not a deficit.
 const ordered=[...b.filter(t=>!a.some(s=>s.role===t.role)),...b.filter(t=>a.some(s=>s.role===t.role))];
 const matches=ordered.flatMap(target=>{const support=helpers[target.role].map(role=>a.find(t=>t.role===role)).find(Boolean);return support?[{support,target}]:[];});
 const chosen=matches;
 if(!chosen.length)return {text:`${who}에게서 확인한 모습만으로 ${to}에게 딱 맞는 도움을 고르기는 어렵네. 어떤 상황에서 손을 보태면 좋은지 직접 물어보고 작은 부탁부터 맞춰 보게.`,evidence:[],chosen};
 const text=unique(chosen.map(m=>topic[m.target.role])).map(key=>`${scenes[kind][key]}를 생각해 보게. `+chosen.filter(m=>topic[m.target.role]===key).map(({support,target})=>`${to}가 바라는 것이 ${conditional(target.need)} ${bridges[support.role+':'+target.role].replaceAll('상대',to)}.`).join(' ')).join('\n')+`\n${who}도 무리해서 모두 해 줄 필요는 없네. 지금 할 수 있는 도움 하나를 고르고, ${to}도 그 도움을 원하는지 먼저 확인해 보게.`;
 return {text,evidence:[...evidence(provider,chosen.map(m=>m.support.role),who),...evidence(receiver,chosen.map(m=>m.target.role),to)],chosen};
}
function contextNotes(p:WholePerson){
 const months:Record<string,string>={인:'초봄',묘:'봄',진:'봄에서 여름으로 넘어가는 때',사:'초여름',오:'여름',미:'여름에서 가을로 넘어가는 때',신:'초가을',유:'가을',술:'가을에서 겨울로 넘어가는 때',해:'초겨울',자:'겨울',축:'겨울에서 봄으로 넘어가는 때'};
 return p.season.branches.length===1?months[p.season.branches[0]]:'계절이 바뀌는 경계';
}
export function addCoherentReading(previous:Reading,relation:string):Reading{
 if(previous.ruleVersion!==relationshipStoryVersion||!previous.wholeChart||!previous.interpretation||!Object.hasOwn(scenes,relation))throw new Error('INVALID_COHERENT_CONTEXT');
 const r=structuredClone(previous),w=r.wholeChart!,story=r.interpretation!,kind=relation as RelationshipKind;
 w.people.forEach(p=>{
  p.narrative=buildNarrative(p);const ts=p.narrative;
  p.facets=p.facets.map(f=>{
   if(f.id.startsWith('pillar:')){
    const found=ts.filter(t=>p.evidence.some(e=>e.position===f.id.slice(7)&&e.role===t.role));
    return {...f,text:`이 기둥에서는 ${found.map(t=>t.role).join('·')}이 확인되네. 위 장점과 주의점에서 같은 분류의 이야기를 함께 읽었지. 위치가 다르다는 이유만으로 별도의 성격을 덧붙이지는 않았네.`};
   }
   if(f.id==='roots')return {...f,title:'일간과 같은 오행이 있는 자리',text:'아래 자리에는 태어난 날의 첫 글자와 같은 오행이 확인되네. 이 기록만으로 자기주장이 강하다거나 사주가 강하다고 정하지는 않았네.'};
   if(f.id==='inner-relations')return {...f,title:'내 사주에서 확인한 합과 충',text:'아래는 알려진 글자 사이에서 확인한 합과 충이라네. 이 기호만으로 마음속 갈등이나 성격을 단정하지는 않았네.'};
   return f;
  });
  p.summary={title:'상황에 따라 드러나는 자네의 모습',text:ts.length?'한 가지 말로 성격을 정하기보다, 언제 어떤 모습이 나오는지 나누어 보겠네. 아래는 확인된 해·달·날'+(p.includedPositions.includes('hour')?'·시간':'')+'의 글자를 함께 풀어 본 이야기라네.':'확인된 글자가 부족해 성격을 서둘러 정하지 않겠네.',
   strength:ts.map(t=>`${t.scene}: ${t.habit}.`).join('\n'),
   watch:ts.map(t=>`${t.scene}: ${t.risk}.`).join('\n'),
   affection:ts.map(t=>`${t.scene}, 필요한 배려가 ‘${t.need}’인지 살펴보게.`).join('\n'),
   work:'위에서 마음에 와닿은 장점 하나를 골라 실제로 도움을 줬던 일을 떠올려 보게. 잘해 주고 싶어도 상대에게는 다른 도움이 필요할 수 있으니, 먼저 원하는 것을 물으면 좋겠네.'};
 });
 const [a,b]=w.people,at=byRole(a),bt=byRole(b),ag=help(a,b,kind,'자네','상대'),bg=help(b,a,kind,'상대','자네');
 const common=at.filter(t=>bt.some(s=>s.role===t.role)),onlyA=at.filter(t=>!bt.some(s=>s.role===t.role)),onlyB=bt.filter(t=>!at.some(s=>s.role===t.role));
 const diffText=[...onlyA.map(t=>`자네는 ${t.scene} ${t.habit}. 이때 상대에게 ${object(t.need)} 바라게 될 수 있지.`),...onlyB.map(t=>`상대는 ${t.scene} ${t.habit}. 이때 자네에게 ${object(t.need)} 바라게 될 수 있지.`)];
 // Conflict examples use distinct situational needs. No invented clash from missing classifications.
 const pairs=at.flatMap(left=>bt.filter(right=>topic[left.role]===topic[right.role]&&left.role!==right.role).map(right=>({left,right})));
 const focal=pairs.find(x=>onlyA.includes(x.left)||onlyB.includes(x.right))??pairs[0];
 const focalA=focal?.left??onlyA[0]??at[0],focalB=focal?.right??onlyB[0]??bt[0];
 const interactionTopics=unique([...at,...bt].map(t=>topic[t.role]));
 const comparisons=interactionTopics.flatMap(key=>{
  const left=at.filter(t=>topic[t.role]===key),right=bt.filter(t=>topic[t.role]===key);
  if(!left.length||!right.length||left.map(t=>t.role).join()===right.map(t=>t.role).join())return [];
  return [`${scenes[kind][key]}, 자네가 바라는 것은 ${left.map(t=>`‘${t.need}’`).join(' 또는 ')}, 상대가 바라는 것은 ${right.map(t=>`‘${t.need}’`).join(' 또는 ')}일 수 있네. 한쪽의 방식만 따르기보다 지금 각자 무엇이 필요한지 먼저 말해 보게.`];
 });
 const conflict=comparisons.length?comparisons.join('\n'):focalA&&focalB?`비슷한 배려를 기다려도 먼저 표현하지 않으면 서로 알기 어렵네. ${scenes[kind][topic[focalA.role]]}, 바라는 것을 한 가지씩 말해 보게.`:'지금 확인한 내용만으로 두 사람의 갈등 모습을 정하지 않겠네.';
 const conversation=focalA&&focalB?`자네: “${focalA.say}”\n상대: “${focalA.reply}”\n상대: “${focalB.say}”\n자네: “${focalB.reply}”`:'서로 원하는 것과 어려운 것을 하나씩 말해 보게.';
 const allEvidence=[...evidence(a,at.map(t=>t.role),'자네'),...evidence(b,bt.map(t=>t.role),'상대')];
 const sections:ReadingFacet[]=[
  {id:'gift-me',title:kind==='친구'?'내가 이 친구에게 힘이 되는 부분':'자네가 상대에게 줄 수 있는 도움',text:ag.text,evidence:ag.evidence},
  {id:'gift-other',title:kind==='친구'?'이 친구가 나에게 힘이 되는 부분':'상대가 자네에게 줄 수 있는 도움',text:bg.text,evidence:bg.evidence},
  {id:'shared',title:'서로 이해하기 편한 순간',text:common.length?common.map(t=>`${t.scene}, 두 사람 모두 ${t.habit}. ${object(t.need)} 서로 챙기면 편할 수 있지.`).join('\n'):'이번에 확인한 분류에서 같은 항목은 찾지 못했네. 이것을 공통점이 없는 사이라고 받아들이지는 말게. 함께 편했던 경험부터 이야기해 보게.',evidence:[...evidence(a,common.map(t=>t.role),'자네'),...evidence(b,common.map(t=>t.role),'상대')]},
  {id:'different',title:'다른 모습이 드러나는 상황',text:diffText.length?diffText.join('\n')+'\n여기서 따로 적은 모습이 다른 사람에게는 없다는 뜻은 아니네. 서로 실제로 어떤지 물어볼 주제로 삼아 보게.':'확인된 성향 항목은 서로 같네. 그래도 행동의 정도나 바라는 표현까지 같다고 정할 수는 없지. 같은 상황에서 각자가 편했던 방법을 이야기해 보게.',evidence:allEvidence},
  {id:'conversation',title:kind==='연인'?'서운할 때 이렇게 말해 보게':'마음이 엇갈릴 때 나눌 대화',text:conflict+'\n이 가운데 한 장면에서는 이렇게 말을 시작해 볼 수 있겠네.\n'+conversation,evidence:allEvidence},
  {id:'together',title:kind==='친구'?'둘이 함께하면 좋은 일':kind==='연인'?'사랑을 더 편하게 만드는 작은 습관':kind==='가족'?'가족끼리 함께 해 볼 일':'함께 일할 때 나누면 좋은 역할',text:unique([...(ag.chosen.map(m=>m.target.role)),...(bg.chosen.map(m=>m.target.role))]).map(role=>`${scenes[kind][topic[role]]}, ${practices[role]}.`).join('\n')||'이번에 함께 할 수 있는 작은 일 하나를 정해 보게.',evidence:[...ag.evidence,...bg.evidence]},
 ];
 // Whole-chart facts are retained as facts, not silently converted into empirical personality claims.
 w.pair.sections=sections;
 w.pair.summary=`${kind==='연인'?'두 사람의 사랑':kind==='친구'?'두 사람의 우정':kind==='가족'?'가족으로 지내는 두 사람':'함께 일하는 두 사람'}을 한 가지 유형으로 끝내지는 않겠네. ${common.length?'서로 비슷하게 이해할 모습도 있고, 상황에 따라 다르게 바라는 배려도 있지.':'확인한 성향은 서로 다르게 나타나네. 다름이 도움이 되는 순간과 부담이 되는 순간을 나누어 보겠네.'}\n${focalA?`자네는 ${focalA.scene} ${focalA.habit}.`:''} ${focalB?`상대는 ${focalB.scene} ${focalB.habit}.`:''}`;
 w.displayPolicy=`자네의 태어난 달은 ${contextNotes(a)}, 상대는 ${contextNotes(b)}의 배경으로 확인했네. 계절과 글자의 합·충은 기록으로 남기되, 그것만으로 성격이나 관계의 좋고 나쁨을 정하지 않았네. 같은 성향이 여러 곳에 나온다고 더 강하다고 세지도 않았지.`;
 story.relationship.scene='이번에는 아래 질문에 각자 한 가지씩 답해 보게. 서로의 답이 다르면 왜 그런지 들어 보게.';
 story.relationship.suggestion=focalA&&focalB?`자네는 ‘${focalA.need}’, 상대는 ${object(focalB.need)} 받았던 실제 경험을 하나씩 떠올려 보게. 다음에 비슷한 일이 생기면 서로 무엇을 해 줄 수 있을지 정하면 좋겠네.`:'최근 서로 고마웠던 일과 어려웠던 일을 하나씩 이야기해 보게.';
 story.relationship.question=kind==='연인'?'“내가 해 준 일 중 언제 사랑받는다고 느꼈어? 다음에는 무엇을 다르게 해 주면 좋을까?”':kind==='친구'?'“요즘 어떤 때 내 도움이 필요해? 내가 도우려다 부담을 준 적도 있었어?”':kind==='가족'?'“지금 내가 맡아 주면 좋은 일은 뭐야? 직접 결정하거나 쉬고 싶은 부분은 어디야?”':'“이번 일에서 어떤 도움이 필요해? 내가 대신 결정하지 않고 물어봐야 할 부분도 있을까?”';
 r.ruleVersion=coherentReadingVersion;w.version=coherentReadingVersion;r.strength=ag.text;r.difference=conflict;
 return r;
}

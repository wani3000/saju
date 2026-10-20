import type { Reading } from "./model";
import { reviewStoredChart } from "./chart-review";
import { sajuTypes, toHanja, type SajuType } from "./saju-types";

export const symbolicReadingVersion = "symbolic-personality-copy-v3";
export type ElementRelation = "same" | "me-supports-other" | "other-supports-me" | "me-checks-other" | "other-checks-me";
export type SymbolicPerson = {
  side: "me" | "other";
  pillars: {key:string; label:string; korean:string; hanja:string; fixed:boolean}[];
  type: SajuType | null;
  dayPillar: string | null;
  notes: string[];
};
export type SymbolicReading = {
  kind: "ten-stem-story";
  notice: string;
  people: SymbolicPerson[];
  pair: {kind: ElementRelation | "unresolved"; title:string; basis:string; summary:string; harmony:string; friction:string; practice:string; meeting?:string};
  relationship: {label:string; scene:string; suggestion:string; question:string};
  closing: string;
};
const cycle = ["목","화","토","금","수"];
const controls = ["목","토","수","화","금"];
const conversation:Record<string,{approach:string;request:string}>={
  갑:{approach:"목표와 다음 행동부터 정하는 쪽",request:"내가 선택한 방향을 존중해 줬으면 해"},
  을:{approach:"상대의 반응을 보며 방법을 조율하는 쪽",request:"내 작은 의견도 먼저 물어봐 줬으면 해"},
  병:{approach:"떠오른 생각과 반가운 마음을 바로 나누는 쪽",request:"내 이야기에 짧게라도 반응해 줬으면 해"},
  정:{approach:"가까운 사람의 마음을 세심히 살핀 뒤 말하는 쪽",request:"우리끼리 차분히 이야기할 시간이 있으면 해"},
  무:{approach:"서둘러 바꾸기보다 약속한 것을 지키는 쪽",request:"바꾸려는 이유를 미리 설명해 줬으면 해"},
  기:{approach:"지금 필요한 일을 먼저 챙기는 쪽",request:"내가 챙긴 일을 알아주고 함께 나눠 줬으면 해"},
  경:{approach:"문제와 해결책을 분명하게 말하는 쪽",request:"내가 도울 일을 구체적으로 알려 줬으면 해"},
  신:{approach:"말의 표현과 약속의 세부를 살피는 쪽",request:"말을 고를 때 내 마음도 한 번 생각해 줬으면 해"},
  임:{approach:"다른 가능성과 새로운 방법을 넓게 보는 쪽",request:"다른 방법을 찾아볼 여유도 남겨 줬으면 해"},
  계:{approach:"충분히 듣고 생각을 정리한 뒤 말하는 쪽",request:"답을 재촉하기보다 생각할 시간을 줬으면 해"},
};
export function elementRelation(a:string,b:string): ElementRelation {
  if (!cycle.includes(a)||!cycle.includes(b)) throw new Error("INVALID_STORY_ELEMENT");
  if(a===b) return "same";
  if(cycle[(cycle.indexOf(a)+1)%5]===b) return "me-supports-other";
  if(cycle[(cycle.indexOf(b)+1)%5]===a) return "other-supports-me";
  return controls[(controls.indexOf(a)+1)%5]===b ? "me-checks-other" : "other-checks-me";
}
const pairCopy: Record<ElementRelation, Omit<SymbolicReading["pair"],"kind"|"basis">> = {
  same: {
    title:"닮은 결로, 서로의 거울이 되는 사이",
    summary:"두 사람의 일간은 같은 오행에 속하네. 비슷한 관심에 함께 힘을 싣고, 나의 모습에서 상대를 이해하는 관계로 이야기를 풀어 볼 수 있지. 다만 같은 오행이어도 두 사람의 성격이 같다는 뜻은 아니네.",
    harmony:"좋아하는 일과 중요하게 여기는 기준을 찾아 함께 몰입해 보게. ‘나도 그런 적 있어’라는 공감이 생기는 순간에 두 사람의 닮은 결을 느껴 볼 만하네.",
    friction:"내게 당연한 것이 상대에게도 당연하리라 여기면 기대가 엇갈릴 수 있네. 둘 다 말하고 싶거나 둘 다 결정을 미룰 때에는 누가 먼저 할지 정해 두는 것이 도움이 되겠지.",
    practice:"함께 정할 일이 생기면 한 사람은 제안하고 다른 사람은 조건을 살피는 역할을 해 보게. 다음번에는 역할을 바꾸고, 닮은 점 하나와 다른 점 하나를 서로 말해 보게."},
  "me-supports-other": {
    title:"내가 건네고, 상대가 꽃피우는 사이",
    summary:"전통 오행 분류에서 내 일간의 오행이 상대의 오행을 생하는 짝이네. 내가 가진 관심과 아이디어를 건네고 상대가 자기 방식으로 펼치는 관계로 이야기를 풀어 보세. 실제로 늘 내가 돌보는 사이라는 판정은 아니네.",
    harmony:"나는 시작에 필요한 힘을 보태고 상대는 그 도움을 새로운 시도에 이어 볼 수 있겠네. 서로 어떤 도움에 힘이 나는지 말하면 응원이 막연한 말에서 구체적인 행동으로 바뀔 걸세.",
    friction:"내가 먼저 챙기는 일이 반복되면 나는 지치고 상대는 간섭처럼 느낄 수도 있네. 도움을 주는 것과 상대의 몫을 대신하는 것을 구분해 보게.",
    practice:"나는 ‘지금 어떤 도움이 필요해?’ 하고 먼저 묻고, 상대는 필요한 도움 한 가지와 혼자 해 보고 싶은 일 한 가지를 말해 보게. 받는 쪽도 고마움과 자기 몫을 분명히 나누면 좋겠네."},
  "other-supports-me": {
    title:"상대의 응원 위에, 내가 넓어지는 사이",
    summary:"전통 오행 분류에서 상대의 일간 오행이 내 오행을 생하는 짝이네. 상대가 마련한 여유와 응원을 내가 받아 펼치는 관계로 이야기를 풀어 보세. 실제로 누가 더 베푸는지는 두 사람이 확인할 일이네.",
    harmony:"상대의 말이나 준비 덕분에 내가 새 일을 해 볼 용기를 얻는 장면을 떠올려 보게. 도움을 받는 일이 약점이 되기보다 서로의 가능성을 넓히는 경험이 될 수 있지.",
    friction:"상대의 배려가 익숙해지면 당연하게 받거나 내 결정을 맡겨 버리기 쉽네. 상대 역시 도와주고 싶은 마음과 원하는 보답을 혼동하지 않도록 이야기해야겠지.",
    practice:"나는 ‘네가 해 줘서 도움이 된 일’을 구체적으로 말하고, 이번에는 내가 해 줄 일을 하나 정해 보게. 상대는 무리한 부탁 앞에서 어디까지 가능한지 먼저 알려 주면 좋겠네."},
  "me-checks-other": {
    title:"내 기준과 상대의 방식이, 균형을 배우는 사이",
    summary:"전통 오행 분류에서 내 일간 오행이 상대의 오행을 극하는 짝이네. 극은 여기서 서로의 속도와 기준을 점검하는 상징으로만 풀겠네. 나쁜 궁합이나 지배 관계를 뜻하는 판정은 아니네.",
    harmony:"나는 기준과 마무리 조건을 제안하고, 상대는 그 기준이 현실에서 어떤지 다른 시각을 보탤 수 있겠네. 서로 다른 의견을 이용하면 한쪽이 놓친 부분을 함께 살필 수 있지.",
    friction:"내 제안이 정답처럼 들리거나 상대의 방식을 너무 빨리 고치려 들면 대화가 답답해질 수 있네. 상대도 반대하는 이유를 숨기면 오해가 커질 수 있지.",
    practice:"나는 결론보다 이유를 먼저 설명하고, 상대는 받아들일 조건과 어려운 조건을 한 가지씩 말해 보게. 둘의 방법을 작게 시험한 뒤 경험을 보고 함께 고르는 것이 좋겠네."},
  "other-checks-me": {
    title:"서로 다른 기준으로, 시야를 넓히는 사이",
    summary:"전통 오행 분류에서 상대의 일간 오행이 내 오행을 극하는 짝이네. 상대의 기준을 통해 내 방식을 돌아보는 관계로 이야기를 풀어 보세. 내가 눌리거나 관계가 불리하다는 뜻은 아니네.",
    harmony:"상대가 내가 놓친 조건을 짚어 주고, 나는 다른 가능성을 보태는 장면을 떠올려 보게. 조언을 선택할 권한이 내게도 있을 때 서로의 시야를 넓힐 수 있겠네.",
    friction:"상대의 지적을 곧 거절로 받아들이거나, 반대로 내 판단을 모두 맡기면 마음이 불편해질 수 있네. 상대도 좋은 뜻만 믿고 말의 세기를 놓치지 않도록 해야겠지.",
    practice:"나는 ‘이 부분은 참고하되 결정은 이렇게 하고 싶어’라고 내 뜻을 말해 보게. 상대는 조언을 원하는지 먼저 묻고, 서로 다른 선택도 존중할 방법을 정하면 좋겠네."},
};
const relationshipCopy: Record<string,SymbolicReading["relationship"]> = {
  친구:{label:"친구로 지낼 때",scene:"약속 장소나 여행 일정을 정할 때, 한 사람은 바로 정하고 싶고 다른 사람은 선택지를 더 보고 싶을 수 있네.",suggestion:"결정할 시간과 각자 꼭 원하는 것 한 가지를 먼저 정해 보게. 연락이 뜸한 날에는 마음을 짐작하기보다 지금의 여유를 물어보면 좋겠네.",question:"“우리 둘이 편한 연락 빈도와 다음에 함께 해 보고 싶은 일은 뭐야?”"},
  연인:{label:"연인으로 지낼 때",scene:"바쁜 날 답장이 늦어지거나 서운한 일이 생겼을 때, 표현의 크기와 사랑의 크기를 같은 것으로 읽지 않는 연습이 필요하네.",suggestion:"연락이 어려운 날의 짧은 신호와 다툰 뒤 다시 대화할 시간을 함께 정해 보게. 공감부터 원하는지 해결책을 원하는지도 물어보면 좋겠네.",question:"“내가 어떻게 표현할 때 사랑받는다고 느껴? 서운할 때는 어떻게 말해 주면 좋을까?”"},
  가족:{label:"가족으로 지낼 때",scene:"가까운 사이일수록 집안일이나 돌봄을 말하지 않아도 알 것이라고 기대하기 쉽네. 익숙한 역할이 지금도 공평한지 살펴볼 만하지.",suggestion:"이번 주 각자가 맡을 일과 쉬는 시간을 적어 보게. 조언하기 전에는 필요한 도움을 묻고, 가족이어도 혼자 있을 시간과 선택을 존중해 주게.",question:"“요즘 내가 도와주면 좋은 일 한 가지와, 대신 결정하지 않았으면 하는 일은 뭐야?”"},
  동료:{label:"함께 일할 때",scene:"새 과제를 시작할 때에는 빠른 시도와 꼼꼼한 확인 사이에서 의견이 갈릴 수 있네. 성격 탓으로 돌리기 전에 업무 조건부터 맞춰 보세.",suggestion:"담당자·마감·완료 기준을 정하고 중간에 확인할 시점을 하나 두게. 피드백은 사람에 대한 평가보다 결과물에서 바꿀 행동으로 말해 보게.",question:"“이번 일에서 각자 맡고 싶은 역할과, 함께 확인해야 할 완료 기준은 뭐야?”"},
};

/** Called only after the strict v5 comparison validates both stored profiles. */
export function addSymbolicReading(base:Reading,charts:Record<string,unknown>,relation:string): Reading {
  const relationship=relationshipCopy[relation];
  if(!relationship || !base.basis) throw new Error("INVALID_STORY_CONTEXT");
  const people:SymbolicPerson[] = (["me","other"] as const).map(side=>{
    const review=reviewStoredChart(charts[side]);
    const day=review.pillars.find(p=>p.key==="day")!.value;
    const fixedDay=/^[갑을병정무기경신임계][자축인묘진사오미신유술해]$/.test(day);
    const type=fixedDay ? sajuTypes.find(t=>t.stem===day[0]) : null;
    return {side,pillars:review.pillars.map(p=>({key:p.key,label:p.label,korean:p.value,hanja:toHanja(p.value),
      fixed:/^[갑을병정무기경신임계][자축인묘진사오미신유술해]$/.test(p.value)})),
      type:type ? structuredClone(type) : null,dayPillar:fixedDay?day:null,
      notes:[...review.warnings,...(type?[]:["일간을 하나로 정할 수 없어 성향 유형과 두 사람의 궁합 이야기는 보류했어요."])]};
  });
  const [a,b]=people.map(p=>p.type);
  const kind=a&&b ? elementRelation(a.element,b.element) : "unresolved";
  const pair: SymbolicReading["pair"] = kind!=="unresolved"&&a&&b ? {kind,...pairCopy[kind],
    meeting:a.stem===b.stem ? `두 사람 모두 ‘${a.title}’로 읽히는 조합이네. 같은 유형이라도 표현의 크기와 생활 습관은 다를 수 있지. ‘${conversation[a.stem].request}’라는 바람에 각자 얼마나 공감하는지 이야기해 보게.`
      : `나는 ${conversation[a.stem].approach}, 상대는 ${conversation[b.stem].approach}으로 이야기를 풀어 볼 수 있네. 나는 ‘${conversation[a.stem].request}’, 상대는 ‘${conversation[b.stem].request}’라는 말이 자기 마음에 맞는지 확인해 보게. 서로의 속도를 알아가는 작은 출발점이 될 걸세.`,
    basis:`나의 ${a.hanja}(${a.stem})·${a.element}와 상대의 ${b.hanja}(${b.stem})·${b.element}를 기준으로 한 상징 풀이예요. 연·월·시 전체의 강약이나 합화 판정은 적용하지 않았어요.`}
    : {kind:"unresolved",title:"계산 후보를 먼저 확인해 주세요",basis:"일간이 미확정인 정보는 임의의 유형으로 채우지 않아요.",summary:"한 사람의 일간을 하나로 정하지 못해 두 사람의 성향 조합을 보류했어요.",harmony:"",friction:"",practice:"입력과 계산 후보를 확인한 뒤 다시 살펴보세요."};
  const interpretation:SymbolicReading={kind:"ten-stem-story",notice:"일간의 상징으로 읽는 성향·궁합 이야기예요. 성격 검사나 미래 예측은 아니에요.",
    people,pair,relationship:{...relationship},closing:"사람은 한 글자보다 훨씬 넓은 존재라네. 닮았다고 느낀 부분은 대화의 시작으로 삼고, 다른 부분은 서로의 말로 다시 써 보게."};
  return {...base,ruleVersion:symbolicReadingVersion,label:"김춘배 훈장의 사주 성향·궁합 이야기",title:pair.title,
    strength:pair.harmony || base.strength,difference:pair.friction || base.difference,
    basis:{...base.basis,notice:interpretation.notice},interpretation};
}

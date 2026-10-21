import type {Reading} from "./model";
import type {ChartEvidence,ReadingFacet,WholePerson} from "./whole-chart-reading";
import type {RoleFamily} from "./whole-chart-copy";
import type {RelationshipKind} from "./easy-relationship-reading";
import {everydayReadingVersion} from "./everyday-reading";

export const relationshipStoryVersion="chunbae-relationship-story-v7";
const personality:Record<string,string>={비견:"자기 생각을 지키고 스스로 결정하려는 편",겁재:"혼자보다 누군가와 함께할 때 힘을 얻는 편",식신:"작은 일을 꾸준히 챙기며 마음을 표현하는 편",상관:"생각을 솔직하게 말하고 새로운 방법을 찾는 편",편재:"새로운 일이 보이면 먼저 시도하는 편",정재:"미리 준비하고 작은 약속도 챙기는 편",편관:"문제가 생기면 먼저 해결하려는 편",정관:"맡은 일과 서로 정한 약속을 중요하게 여기는 편",편인:"혼자 충분히 생각한 뒤 판단하는 편",정인:"이유와 사정을 듣고 이해하려는 편"};
type Style={need:string;risk:string;say:string;answer:string};
const styles:Record<RoleFamily,Style>={
  peer:{need:"스스로 고를 수 있는 여유",risk:"내 뜻을 묻지 않고 대신 정해 주면 간섭으로 느낄 수 있네",say:"내가 원하는 것도 먼저 물어봐 줬으면 좋겠어.",answer:"좋아. 네 생각부터 듣고 같이 정하자."},
  output:{need:"내 이야기를 끝까지 들어 주는 반응",risk:"이야기하는 중에 답부터 정해 버리면 내 말을 듣지 않는다고 느낄 수 있네",say:"해결책보다 내 이야기를 먼저 끝까지 들어 줄래?",answer:"알겠어. 지금 어떤 마음인지부터 들을게."},
  practical:{need:"작은 약속을 실제로 지키는 행동",risk:"좋은 말만 하고 약속을 자꾸 미루면 나를 가볍게 여긴다고 느낄 수 있네",say:"바뀌는 일이 있으면 기다리기 전에 알려 줬으면 해.",answer:"미리 말할게. 이번에는 언제까지 할 수 있는지도 정하자."},
  structure:{need:"서로 기대하는 일을 분명히 정하는 대화",risk:"누가 무엇을 할지 모호하면 혼자 책임지고 있다는 생각이 들 수 있네",say:"누가 무엇을 할지 먼저 정하면 마음이 편할 것 같아.",answer:"좋아. 내가 맡을 수 있는 것부터 말해 볼게."},
  resource:{need:"재촉받지 않고 생각을 정리할 시간",risk:"바로 대답하라고 몰아붙이면 마음을 더 꺼내기 어려울 수 있네",say:"조금 생각하고 이야기해도 될까? 피하려는 건 아니야.",answer:"그럼 언제 다시 이야기하면 편할까? 그때까지 기다릴게."},
};
type Context={scene:string;overview:string;gifts:Record<RoleFamily,string>;activities:Record<RoleFamily,string>;sharedTitle:string;frictionTitle:string;futureTitle:string;future:string;closing:string};
const contexts:Record<RelationshipKind,Context>={
  연인:{scene:"데이트 약속을 정하다가 서로 원하는 것이 달라졌을 때",overview:"사랑을 표현하는 방식과 사랑받는다고 느끼는 순간을 함께 살펴보겠네.",gifts:{peer:"상대가 자기 취향과 생활을 지키면서 사랑할 수 있게 응원하는 일",output:"좋아하는 마음을 말로 꺼내고, 평범한 하루에도 즐거운 이야기를 더하는 일",practical:"바쁜 날 식사를 챙기거나 만나기로 한 약속을 지켜 사랑을 행동으로 보여 주는 일",structure:"연락과 만남의 약속을 함께 정하고, 어려운 일이 생겨도 함께 책임지는 일",resource:"힘들었던 하루의 이야기를 듣고, 마음이 정리될 때까지 곁에서 기다리는 일"},activities:{peer:"각자 해 보고 싶은 데이트를 번갈아 고르는 것",output:"하루 중 좋았던 일과 고마웠던 일을 서로 말하는 것",practical:"짧은 만남이라도 날짜와 장소를 정해 실제로 함께하는 것",structure:"바쁜 주에 언제 만날지 미리 정해 두는 것",resource:"조용히 산책하며 요즘 마음에 걸리는 일을 듣는 것"},sharedTitle:"사랑할 때 서로 닮은 부분",frictionTitle:"좋아하는데도 서운해지는 순간",futureTitle:"오래 만나고 함께 살아가려면",future:"오래 만나거나 함께 살 생각이라면 연락만큼 생활 이야기도 필요하네. 돈을 쓰는 방법, 집안일, 혼자 쉬는 시간, 가족과의 거리를 하나씩 이야기해 보게. 사주에서 편해 보이는 부분이 있어도 이런 약속은 두 사람이 직접 맞춰야 하지.",closing:"사랑은 똑같은 사람이 되어야 오래가는 것이 아니네. 상대가 주는 배려를 알아보고, 나에게 필요한 배려도 말해 주는 것이 중요하지. 서운함이 작을 때 꺼내고, 좋았던 일은 그날 알려 주게."},
  친구:{scene:"함께 여행을 가자고 했는데 가고 싶은 곳이나 쓸 수 있는 시간이 달랐을 때",overview:"성격이 어떻게 다르고, 서로 어떤 순간에 힘이 되어 줄 수 있는지 살펴보겠네.",gifts:{peer:"남의 눈치를 보느라 결정을 못 할 때 자기 생각을 믿고 선택하도록 응원하는 일",output:"혼자 고민하던 문제에 다른 생각을 보태고, 웃으며 이야기할 기회를 만드는 일",practical:"말로만 만나자고 하지 않고 날짜를 잡거나 필요한 준비를 도와주는 일",structure:"함께 정한 약속을 지키고, 시작한 공부나 운동을 꾸준히 이어가도록 돕는 일",resource:"실수하거나 지친 날에 먼저 평가하지 않고 이야기를 들어 주는 일"},activities:{peer:"각자 좋아하는 곳을 번갈아 소개하는 것",output:"새 취미를 해 보고 서로 느낀 점을 나누는 것",practical:"가고 싶던 여행이나 모임을 작은 계획부터 실행하는 것",structure:"공부나 운동처럼 꾸준히 하고 싶은 일을 함께 약속하는 것",resource:"부담 없는 산책이나 식사 자리에서 고민을 나누는 것"},sharedTitle:"친구로서 편하게 통하는 부분",frictionTitle:"도움이 오히려 부담이 되는 순간",futureTitle:"오래 편한 친구로 남으려면",future:"좋은 친구라고 늘 도움을 줄 수 있는 것은 아니네. 부탁을 거절할 수 있는지, 바쁜 시기를 이해해 주는지, 받은 도움에 고마움을 표현하는지도 살펴보게. 도움의 크기를 점수로 따지기보다 서로 부담 없이 주고받을 수 있는 사이인지가 중요하지.",closing:"이 친구가 나에게 무엇을 해 줄 수 있는지만큼, 내가 이 친구 앞에서 편하게 말할 수 있는지도 살펴보게. 힘들 때 기대고, 어려운 부탁에는 거절해도 우정이 흔들리지 않는 사이가 좋다네."},
  가족:{scene:"집안일이나 가족을 챙기는 일을 누가 맡을지 이야기할 때",overview:"서로에게 힘이 되는 돌봄과, 가까워서 놓치기 쉬운 각자의 마음을 살펴보겠네.",gifts:{peer:"가족의 기대와 다른 선택을 해도 자기 뜻을 말할 수 있게 응원하는 일",output:"고맙거나 서운한 일을 말로 꺼내 가족끼리 속마음을 나누게 하는 일",practical:"식사와 필요한 물건처럼 일상에서 손이 필요한 일을 직접 챙기는 일",structure:"돌봄과 집안일을 나누고, 한 사람에게 책임이 몰리지 않게 약속을 지키는 일",resource:"힘든 일을 털어놓을 때 충고부터 하지 않고 사정을 들어 주는 일"},activities:{peer:"각자 원하는 주말과 쉬는 시간을 이야기하는 것",output:"고마웠던 일을 식사 자리에서 한 가지씩 말하는 것",practical:"이번 주에 필요한 집안일을 작은 것부터 나누는 것",structure:"돌봄과 집안일에서 각자가 맡을 수 있는 일을 정하는 것",resource:"조용한 시간에 요즘 어떤 도움이 필요한지 묻는 것"},sharedTitle:"가족으로서 서로 힘이 되는 부분",frictionTitle:"가까운 사이라 더 서운한 순간",futureTitle:"돌봄과 각자의 생활을 함께 지키려면",future:"가족이라는 이유로 항상 참고 맡아야 하는 것은 아니네. 도울 수 있는 일과 어려운 일을 따로 말하고, 쉬고 싶다는 부탁도 존중해 주게. 서로 다른 집에서 지내거나 생활 형편이 달라도 두 사람에게 맞는 방식으로 나누면 되지.",closing:"가족이라서 알아줄 거라 기다리지 말고, 필요한 도움을 작은 말로 부탁해 보게. 고맙다는 말과 지금은 어렵다는 말을 모두 편하게 할 수 있으면 좋겠네."},
  동료:{scene:"같이 맡은 일의 방법이나 마감을 두고 의견이 달라졌을 때",overview:"각자 잘할 수 있는 일과 서로에게 보탤 도움, 협업에서 부딪힐 수 있는 순간을 살펴보겠네.",gifts:{peer:"자기 몫을 맡아 끝까지 해내고 상대가 맡은 일의 결정권도 존중하는 일",output:"막힌 문제에 새 방법을 제안하고 빠뜨린 질문을 꺼내는 일",practical:"아이디어를 일정과 준비할 것이 있는 실제 작업으로 옮기는 일",structure:"담당자와 완료 기준을 정해 일이 중간에 빠지지 않도록 챙기는 일",resource:"필요한 자료와 이유를 살피고, 모르는 것을 질문할 여유를 주는 일"},activities:{peer:"각자가 직접 판단할 수 있는 범위를 정하는 것",output:"초안을 놓고 개선할 방법을 편하게 제안하는 것",practical:"큰 일을 오늘 끝낼 수 있는 작은 작업으로 나누는 것",structure:"마감 전에 함께 확인할 항목을 정하는 것",resource:"착수 전에 목적과 필요한 자료를 함께 확인하는 것"},sharedTitle:"함께 일할 때 잘 맞는 부분",frictionTitle:"좋은 의도가 불편한 간섭이 될 때",futureTitle:"믿고 함께 일하려면",future:"서로의 장점은 역할이 분명할 때 도움이 되네. 누가 맡는지, 언제 끝내는지, 무엇을 완료로 볼지 적어 두게. 일이 늦어지면 성격을 탓하기보다 필요한 도움과 남은 시간을 먼저 확인해 보게.",closing:"일하는 방식이 다르다고 한쪽이 틀린 것은 아니네. 잘하는 일은 맡기고, 기대하는 것은 분명히 말해 주게. 사람을 평가하는 말보다 이번 일에서 바꿀 수 있는 행동을 이야기하면 좋겠네."},
};
const unique=(xs:string[])=>[...new Set(xs)];
const basis=(p:WholePerson)=>p.anchor?[p.anchor]:[];
const evidence=(rows:ChartEvidence[],side:string)=>rows.map(e=>`${side}: ${e.text}`);
function gift(provider:WholePerson,receiver:WholePerson,ctx:Context,who:string,to:string) {
  const main=provider.anchor,need=receiver.anchor;
  // Add a distinct confirmed family from known pillars. Counts never imply dominance.
  const extra=provider.evidence.find(e=>e.family!==main?.family);
  if(!main)return {text:`${who}의 성향은 아직 한 가지로 정하기 어렵네. ${to}에게 어떤 도움이 필요한지 직접 물어보는 것부터 시작해 보게.`,evidence:[]};
  return {text:`${who}의 장점을 살린 도움은 ${ctx.gifts[main.family]}이라네.${extra?` 여기에 ${ctx.gifts[extra.family]}도 함께 생각해 볼 수 있지.`:""}\n${need?`${to}가 바라는 것은 ‘${styles[need.family].need}’일 수 있네. 도움을 주기 전에 ‘지금은 어떻게 해 주면 좋을까?’ 하고 물으면, 좋은 뜻이 더 잘 전해지겠지.`:"다만 실제로 필요한 도움은 직접 물어보고 맞춰 주게."}`,evidence:[...evidence([main,...(extra?[extra]:[])],who),...evidence(basis(receiver),to)]};
}
export function addRelationshipStory(previous:Reading,relation:string):Reading {
  if(previous.ruleVersion!==everydayReadingVersion||!previous.wholeChart||!previous.interpretation||!Object.hasOwn(contexts,relation))throw new Error("INVALID_RELATIONSHIP_STORY");
  const r=structuredClone(previous),w=r.wholeChart!,story=r.interpretation!,ctx=contexts[relation as RelationshipKind];
  const [a,b]=w.people,af=a.anchor?.family,bf=b.anchor?.family;
  const pairEvidence=[...evidence(basis(a),"자네"),...evidence(basis(b),"상대")];
  const meGift=gift(a,b,ctx,"자네","상대"),otherGift=gift(b,a,ctx,"상대","자네");
  const common=w.pair.commonFamilies[0];
  const shared=common?`두 사람의 공통점을 살리려면 ${ctx.activities[common]}부터 해 보면 좋겠네. 비슷한 부분이 있으면 굳이 길게 설명하지 않아도 편한 순간이 생길 수 있지.\n다만 같은 바람이 있다고 늘 같은 선택을 하는 것은 아니네. ${styles[common].risk} 가까운 사이일수록 상대의 뜻을 한 번 더 물어보게.`:"서로 겹치는 분류가 적어도 잘 지낼 수 있네. 함께 편했던 순간과 어려웠던 순간을 하나씩 이야기해 보면, 실제로 잘 맞는 부분을 알아갈 수 있지.";
  const friction=`${af?`자네는 ${styles[af].need}가 중요할 수 있네. ${styles[af].risk}`:"자네가 어떤 상황에서 불편한지 먼저 말해 보게."}\n${bf?`상대는 ${styles[bf].need}가 중요할 수 있지. ${styles[bf].risk}`:"상대에게도 불편한 순간을 물어보게."}\n${af&&bf&&af===bf?"둘 다 같은 배려를 기다리면 먼저 말하는 사람이 없을 수 있네. 알아서 해 주길 기다리기보다 내 바람부터 꺼내 보게.":"한쪽의 도움 방식과 다른 쪽이 원하는 배려가 다르면, 좋은 뜻으로 한 행동도 서운하게 받아들일 수 있네."}`;
  const conversation=`${ctx.scene}, 이렇게 말을 시작해 보면 좋겠네.\n자네: “${af?styles[af].say:"나는 이 부분이 조금 어려웠어. 이야기해도 될까?"}”\n상대: “${af?styles[af].answer:"응, 어떤 점이 어려웠는지 말해 줘."}”\n상대: “${bf?styles[bf].say:"내가 원하는 것도 같이 이야기하고 싶어."}”\n자네: “${bf?styles[bf].answer:"좋아. 둘 다 편한 방법을 찾아보자."}”\n이 대사는 앞으로 반드시 나눌 말이 아니라, 서로 바라는 것을 차분히 말하는 예시라네.`;
  const activities=unique([...(af?[af]:[]),...(bf?[bf]:[])]).map(f=>ctx.activities[f as RoleFamily]);
  const together=activities.length?`${activities.map((x,i)=>`${i+1}. ${x}`).join("\n")}\n이번에는 한 가지만 해 보고, 끝나고 나서 무엇이 편했고 무엇이 부담이었는지 서로 물어보게.`:"함께 하고 싶은 작은 일부터 하나씩 말해 보게.";
  const sections:ReadingFacet[]=[
    {id:"gift-me",title:relation==="친구"?"내가 이 친구에게 힘이 되는 부분":"자네가 상대에게 줄 수 있는 도움",...meGift},
    {id:"gift-other",title:relation==="친구"?"이 친구가 나에게 힘이 되는 부분":"상대가 자네에게 줄 수 있는 도움",...otherGift},
    {id:"shared",title:ctx.sharedTitle,text:shared,evidence:common?[...evidence(a.evidence.filter(e=>e.family===common),"자네"),...evidence(b.evidence.filter(e=>e.family===common),"상대")]:[]},
    {id:"different",title:ctx.frictionTitle,text:friction,evidence:pairEvidence},
    {id:"conversation",title:relation==="연인"?"서운할 때 이렇게 말해 보게":"마음이 엇갈릴 때 나눌 대화",text:conversation,evidence:pairEvidence},
    {id:"together",title:relation==="친구"?"둘이 함께하면 좋은 일":relation==="연인"?"사랑을 더 편하게 만드는 작은 습관":relation==="가족"?"가족끼리 함께 해 볼 일":"함께 일할 때 나누면 좋은 역할",text:together,evidence:pairEvidence},
    {id:"future",title:ctx.futureTitle,text:ctx.future,evidence:[]},
  ];
  // Retain the complete historical observation record, without presenting it as a scored prediction.
  w.pair.sections=sections;
  w.pair.summary=`${ctx.overview}\n${a.anchor?`자네는 ${personality[a.anchor.role]}이라네.`:"자네의 성향은 생일을 더 확인해야겠네."} ${b.anchor?`상대는 ${personality[b.anchor.role]}이지.`:"상대의 성향도 아직 한 가지로 정하지 않았네."}\n${af&&bf&&af===bf?"비슷한 배려를 반가워할 수 있는 두 사람이네. 그만큼 같은 점에서 서운해질 수도 있으니, 서로 먼저 마음을 말해 주면 좋겠네.":"서로 잘하는 점을 보탤 여지가 있네. 다만 성격이 다르다는 이유만으로 저절로 부족한 부분이 채워지는 것은 아니지. 상대에게 필요한 도움을 물어보고 맞춰 갈 때 서로에게 힘이 될 수 있네."}`;
  w.people[0].summary.work=meGift.text;w.people[1].summary.work=otherGift.text;
  story.relationship.scene=ctx.scene+", 잠깐 멈추고 각자 바라는 것을 하나씩 말해 보게.";
  story.relationship.suggestion=together;story.closing=ctx.closing;
  w.version=relationshipStoryVersion;r.ruleVersion=relationshipStoryVersion;
  r.strength=meGift.text;r.difference=friction;
  // Public fields never contain private chart-derived dialogue or directions of help.
  return r;
}

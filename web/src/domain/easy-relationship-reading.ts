import type {Reading} from "./model";
import type {ChartEvidence,WholePerson} from "./whole-chart-reading";
import {wholeChartVersion} from "./whole-chart-reading";
import type {RoleFamily} from "./whole-chart-copy";

export const easyReadingVersion="chunbae-easy-relationship-copy-v5";
export type RelationshipKind="친구"|"연인"|"가족"|"동료";
export const easyFamilyNames:Record<RoleFamily,string>={peer:"내 생각을 지키는 힘",output:"마음을 표현하는 힘",practical:"행동으로 챙기는 힘",structure:"약속을 지키는 힘",resource:"차분히 이해하는 힘"};
const where={year:"태어난 해",month:"태어난 달",day:"태어난 날",hour:"태어난 시간"};
const plain:Record<string,{habit:string;strength:string;watch:string;request:string}>={
  비견:{habit:"자기 생각을 쉽게 바꾸지 않는 모습",strength:"내가 맡은 일을 꾸준히 해내는 힘",watch:"내 방식만 고집하면 상대가 끼어들 자리가 좁아질 수 있네",request:"내가 직접 선택할 기회를 줬으면 해"},
  겁재:{habit:"혼자보다 함께할 때 힘을 얻는 모습",strength:"망설이는 일도 함께 시작하게 하는 힘",watch:"가까운 사이라고 약속을 대충 넘기면 서운함이 남을 수 있네",request:"함께할 일과 각자 할 일을 미리 정했으면 해"},
  식신:{habit:"편한 속도로 차근차근 해내는 모습",strength:"작은 즐거움과 정성을 꾸준히 쌓는 힘",watch:"갑자기 재촉받으면 하고 싶던 마음도 줄어들 수 있네",request:"서두르지 않고 해 볼 시간을 줬으면 해"},
  상관:{habit:"자기 생각을 솔직하게 말하는 모습",strength:"답답한 순간에 새로운 방법을 꺼내는 힘",watch:"솔직한 말도 상대에게는 따지는 말로 들릴 수 있네",request:"의견이 달라도 우선 끝까지 들어 줬으면 해"},
  편재:{habit:"새로운 일이 보이면 먼저 해 보는 모습",strength:"생각을 실제 만남이나 행동으로 옮기는 힘",watch:"하고 싶은 일이 많으면 지키기 어려운 약속까지 잡을 수 있네",request:"작게라도 먼저 해 볼 기회가 있으면 해"},
  정재:{habit:"미리 준비하고 작은 약속도 챙기는 모습",strength:"사소한 일을 잊지 않고 챙기는 힘",watch:"계획이 바뀌었다고 상대의 정성까지 의심하지는 말게",request:"일정이 바뀌면 미리 말해 줬으면 해"},
  편관:{habit:"급한 일이 생기면 먼저 나서는 모습",strength:"어려운 일도 피하지 않고 해결하려는 힘",watch:"급한 마음이 상대를 재촉하는 말로 나갈 수 있네",request:"급하더라도 무엇부터 할지 같이 정했으면 해"},
  정관:{habit:"서로 정한 약속을 중요하게 여기는 모습",strength:"말과 행동을 맞추어 믿음을 쌓는 힘",watch:"약속을 따지기 전에 지키기 어려웠던 사정도 들어 보게",request:"지킬 약속과 어려운 사정을 함께 이야기했으면 해"},
  편인:{habit:"혼자 충분히 생각한 뒤 마음을 여는 모습",strength:"남들이 지나친 부분을 한 번 더 살피는 힘",watch:"오래 말이 없으면 상대는 마음이 멀어졌다고 느낄 수 있네",request:"조용히 생각할 시간이 필요하다는 것을 알아줬으면 해"},
  정인:{habit:"이유를 듣고 이해한 뒤 움직이는 모습",strength:"상대의 말을 차분히 듣고 살피는 힘",watch:"생각을 다 정리할 때까지 기다리다 내 뜻을 늦게 전할 수 있네",request:"결정하기 전에 이유를 차근차근 들려줬으면 해"},
};
// These are editorial conversation prompts, not source-derived predictions.
const contexts:Record<RelationshipKind,{title:string;intro:string;personal:string;scene:string;repair:string;question:string;closing:string;shared:Record<RoleFamily,string>}>={
  연인:{title:"두 사람이 사랑을 나누는 모습",intro:"좋아하는 마음을 어떻게 전하고, 어떤 배려에서 사랑받는다고 느낄지 살펴보세.",personal:"사랑하는 사람에게",scene:"데이트를 정하거나 바쁜 날 연락을 주고받을 때",repair:"서운한 날에는 ‘왜 늘 그래?’ 대신 ‘나는 그때 이 말이 듣고 싶었어’라고 말해 보게. 안아 주길 바라는지, 이야기를 들어 주길 바라는지도 직접 물어보게.",question:"“나는 어떤 순간에 사랑받는다고 느껴? 다음 데이트에서는 서로 무엇을 해 주면 좋을까?”",closing:"사랑은 마음을 알아맞히는 시험이 아니네. 좋아하는 마음을 자주 말하고, 서로 편안한 사랑의 방법을 함께 찾아가게.",shared:{peer:"데이트를 번갈아 정하고 각자 혼자 쉴 시간도 존중하는 일",output:"좋아한다는 말과 반가운 반응을 아끼지 않는 일",practical:"밥 한 끼나 작은 약속을 챙기며 사랑을 행동으로 보여 주는 일",structure:"연락과 만남의 약속을 함께 정해 불안을 줄이는 일",resource:"서운한 마음을 재촉하지 않고 충분히 들어 주는 일"}},
  친구:{title:"두 사람이 편한 친구가 되는 방법",intro:"함께 있으면 즐거운 일, 편한 연락 간격과 약속을 맞추는 방법을 살펴보세.",personal:"친구와 지낼 때",scene:"연락을 주고받거나 여행과 만날 장소를 정할 때",repair:"연락이 뜸하다고 우정이 식었다고 짐작하지는 말게. 바쁜 사정부터 묻고, 이번 만남에서 각자 하고 싶은 일 하나씩을 골라 보게.",question:"“우리는 얼마나 자주 연락하면 편해? 다음에 만날 때 꼭 함께 해 보고 싶은 일은 뭐야?”",closing:"좋은 친구는 늘 붙어 있어야 하는 사이가 아니네. 각자의 생활을 지키면서도 반갑게 다시 만날 수 있으면 좋겠네.",shared:{peer:"하고 싶은 일을 번갈아 고르고 서로의 취향을 존중하는 일",output:"재미있는 일을 나누고 친구의 이야기에 반응해 주는 일",practical:"만날 날짜와 장소를 실제 약속으로 정하는 일",structure:"늦거나 취소할 때 미리 알려 믿음을 지키는 일",resource:"고민을 털어놓을 때 서둘러 답하지 않고 들어 주는 일"}},
  가족:{title:"두 사람이 가족으로 편안해지는 방법",intro:"가까운 사이라 더 말하기 어려운 부탁과 돌봄, 각자의 쉬는 시간을 살펴보세.",personal:"가족과 지낼 때",scene:"집안일과 돌봄을 나누거나 각자의 휴식이 필요할 때",repair:"‘가족이면 당연히 알겠지’ 하고 기다리지 말게. 필요한 도움을 한 가지씩 부탁하고, 상대가 대신 결정해 주길 원하지 않는 일도 알려 주게.",question:"“요즘 내가 도와주면 좋은 일은 뭐야? 혼자 쉬거나 직접 결정하고 싶은 일도 말해 줄래?”",closing:"가족이라고 모든 마음이 같을 수는 없네. 고맙다는 말과 쉬고 싶다는 부탁을 편하게 나누는 집이 되면 좋겠네.",shared:{peer:"가족이어도 각자의 선택과 혼자 있을 시간을 존중하는 일",output:"고마운 일과 서운한 일을 쌓아 두지 않고 말하는 일",practical:"집안일과 돌봄을 한 사람에게 몰지 않고 나누는 일",structure:"함께 지킬 생활 약속을 무리하지 않게 정하는 일",resource:"충고하기 전에 지금 어떤 도움이 필요한지 듣는 일"}},
  동료:{title:"두 사람이 함께 일을 잘하는 방법",intro:"잘 맡을 수 있는 일과 일하는 속도, 의견이 다를 때 맞추는 방법을 살펴보세.",personal:"함께 일하는 사람에게",scene:"일을 나누거나 마감과 결과물을 함께 정할 때",repair:"의견이 다르면 사람의 성격보다 일에서 바꿀 점을 먼저 말해 보게. 누가 맡는지, 언제 끝내는지, 어디까지 하면 완료인지 한 문장씩 적어 보게.",question:"“이번 일에서 각자 어떤 역할을 맡으면 좋을까? 끝내기 전에 함께 확인할 것은 뭐야?”",closing:"좋은 동료는 모든 생각이 같은 사람이 아니네. 서로 잘하는 일을 알아보고, 모르는 것은 편하게 묻는 사이가 되어 보게.",shared:{peer:"각자 맡은 일의 결정권을 존중하는 일",output:"새 의견을 편하게 말하고 서로의 설명을 끝까지 듣는 일",practical:"생각을 담당자와 마감이 있는 행동으로 옮기는 일",structure:"완료 기준과 확인할 때를 함께 정하는 일",resource:"질문할 시간과 생각을 정리할 시간을 주는 일"}},
};
const unique=(xs:string[])=>[...new Set(xs)];
const habits=(rows:ChartEvidence[])=>unique(rows.map(e=>plain[e.role].habit)).join(", ");
const seasonNames:Record<string,string>={인:"봄이 시작될 무렵",묘:"봄기운이 한창일 무렵",진:"봄에서 여름으로 넘어갈 무렵",사:"여름이 시작될 무렵",오:"여름이 한창일 무렵",미:"여름에서 가을로 넘어갈 무렵",신:"가을이 시작될 무렵",유:"가을이 한창일 무렵",술:"가을에서 겨울로 넘어갈 무렵",해:"겨울이 시작될 무렵",자:"겨울이 한창일 무렵",축:"겨울에서 봄으로 넘어갈 무렵"};
const season=(p:WholePerson)=>p.season.branches.length===1?seasonNames[p.season.branches[0]]:"계절이 바뀌는 경계";
const wishes=(p:WholePerson)=>p.anchor?plain[p.anchor.role].request:null;
const voice=(s:string)=>s.replaceAll("있어요.","있네.").replaceAll("없어요.","없네.").replaceAll("않았어요.","않았네.").replaceAll("확인해 주세요.","확인해 보게.").replaceAll("아니에요.","아니네.").replaceAll("않아요.","않네.").replaceAll("했어요.","했네.").replaceAll("예요.","라네.").replaceAll("이에요.","이라네.");

/** New snapshots only: keep v4 source facts intact and write an independent, easy v5 story. */
export function addEasyRelationshipReading(previous:Reading,relation:string):Reading {
  if(previous.ruleVersion!==wholeChartVersion || !previous.wholeChart || !previous.interpretation || !Object.hasOwn(contexts,relation)) throw new Error("INVALID_EASY_READING_CONTEXT");
  const reading=structuredClone(previous),whole=reading.wholeChart!,story=reading.interpretation!,kind=relation as RelationshipKind,ctx=contexts[kind];
  whole.version=easyReadingVersion;
  whole.people=whole.people.map(p=>{
    const type=story.people.find(s=>s.side===p.side)!.type;
    const anchor=p.anchor?plain[p.anchor.role]:null;
    const secondary=p.evidence.find(e=>e.role!==p.anchor?.role);
    const rows=p.includedPositions.map(pos=>({pos,rows:p.evidence.filter(e=>e.position===pos)}));
    const summaryText=rows.filter(r=>r.rows.length).map(r=>{const example=r.rows.find(e=>e.layer==="visible")??r.rows[0];return `${where[r.pos]}의 글자에서는 ${plain[example.role].habit}을 떠올려 볼 수 있네.`;}).join(" ");
    p.summary={title:type?`${type.image}처럼, ${anchor?anchor.habit.replace(/ 모습$/,"")+" 사람":"마음을 살피는 사람"}`:"글자를 더 확인할 필요가 있네",
      text:type?`${type.image}에 빗대어 자네의 성격을 살펴보겠네. ${summaryText} 태어난 달은 ${season(p)}에 해당하네. 계절은 이야기를 이해하는 비유로만 참고해 보게.`:"태어난 날의 글자가 하나로 정해지지 않아 성격도 서둘러 붙이지 않겠네.",
      strength:anchor?`${anchor.strength}을 장점으로 떠올려 보게.${secondary?` 여기에 ${plain[secondary.role].strength}도 함께 살펴볼 만하지.`:""} 이런 모습이 실제 생활에서 언제 나타나는지 생각해 보게.`:"아직 장점을 한 가지로 정하기는 어렵네.",
      watch:anchor?`${anchor.watch}. ${secondary?plain[secondary.role].watch+".":"상대가 편한 방법도 함께 물어보게."}`:"아는 정보만으로 조심할 점을 정하지는 않겠네.",
      affection:anchor?`${ctx.personal} 마음을 전할 때, ‘${anchor.request}’라는 바람이 자기 마음에 맞는지 살펴보게. 바라는 것을 짐작하게 두기보다 구체적으로 말해 주면 좋겠네.`:"편안한 대화 방법부터 직접 물어보게.",
      work:p.families.length?`${p.families.map(f=>ctx.shared[f]).join(", ")}을 함께 해 보게. 한 번에 다 하려 하기보다 이번 주에 할 수 있는 일 하나만 골라도 좋겠네.`:"서로 편하게 해낼 수 있는 일부터 하나씩 물어보게."};
    p.facets=p.facets.map(f=>({...f,title:f.id==="season"?"태어난 달의 계절 이야기":f.id.startsWith("pillar:")?`${where[f.id.slice(7) as keyof typeof where]}의 글자를 풀어 보세`:f.id==="roots"?"내 생각을 다시 살피는 모습":"마음속에 다른 생각이 함께 들 때",
      text:f.id==="season"?`태어난 달은 ${season(p)}에 놓여 있네. 이것만으로 성격을 정할 수는 없으니, 다른 글자와 함께 참고해 보게.`
        :f.id.startsWith("pillar:")?`${habits(p.evidence.filter(e=>e.position===f.id.slice(7)))}을 떠올려 볼 수 있네. 실제로 자네에게 어울리는 모습인지 경험과 비교해 보게.`
        :f.id==="roots"?"다른 사람의 말도 듣되, 마지막에는 내 생각을 다시 확인하고 싶을 수 있겠네. 무엇을 지키고 무엇을 바꿀지 천천히 골라 보게."
        :"맞추고 싶은 마음과 내 방식대로 하고 싶은 마음이 함께 들 수 있네. 어느 쪽이 옳다고 서두르지 말고, 지금 필요한 것이 무엇인지 생각해 보게."}));
    p.notes=[...(p.omittedPositions.includes("hour")?["태어난 시간을 몰라 시간에 해당하는 글자는 풀이에 넣지 않았네."]:[]),...(p.omittedCandidateFacts?["생일이 계절의 경계에 걸려, 어느 쪽이든 같은 내용만 이야기했네."]:[]),"글자가 많다고 그 성격이 더 강하다는 뜻은 아니네."];
    return p;
  });
  const [a,b]=whole.people;
  const differing=(["month","hour","year","day"] as const).map(position=>({position,left:a.evidence.filter(e=>e.position===position),right:b.evidence.filter(e=>e.position===position)}))
    .find(s=>s.left.length&&s.right.length&&s.left.map(e=>e.layer+e.stem+e.role).sort().join()!==s.right.map(e=>e.layer+e.stem+e.role).sort().join());
  const wishA=wishes(a),wishB=wishes(b);
  const sharedOrder=unique([...(a.anchor?[a.anchor.family]:[]),...(b.anchor?[b.anchor.family]:[]),...whole.pair.commonFamilies]).filter(f=>whole.pair.commonFamilies.includes(f as RoleFamily)) as RoleFamily[];
  const shared=sharedOrder.map(f=>ctx.shared[f]);
  const scope=whole.people.map((p,i)=>`${i?"상대":"자네"}의 ${p.includedPositions.map(pos=>({year:"해",month:"달",day:"날",hour:"시간"})[pos]).join("·")}의 글자를 살폈네.`).join(" ")+(whole.people.some(p=>p.omittedPositions.includes("hour"))?" 태어난 시간을 모르는 쪽은 아는 글자만 사용했네.":" 두 사람 모두 태어난 시간까지 살폈네.");
  whole.pair.title=ctx.title;
  whole.pair.summary=`${ctx.intro} 태어난 날의 한 글자에만 기대지 않고, 두 사람의 알려진 글자를 함께 살폈네. 아래 내용이 두 사람의 실제 모습과 맞는지 편하게 이야기해 보게.`;
  whole.pair.scope=scope;
  const titles:Record<string,string>={shared:kind==="연인"?"사랑을 키울 수 있는 두 사람의 장점":"함께하면 좋은 두 사람의 장점",different:kind==="연인"?"사랑을 표현하는 방법이 다를 때":"서로 다른 방식도 알아 두게",conversation:kind==="연인"?"서운함을 쌓아 두지 않는 대화":"마음이 엇갈릴 때 나눌 말","close-context":kind==="연인"?"가까워질수록 알아 두면 좋은 마음":"가까이 지내며 살펴볼 모습",seasons:kind==="연인"?"데이트와 각자의 시간을 맞추는 방법":"함께할 시간과 쉴 시간을 맞추세"};
  whole.pair.sections=whole.pair.sections.map(f=>({...f,title:titles[f.id]??(f.id==="relation:branch-clash"?"의견이 달라도 마음을 다치지 않게":"잘 맞는 순간을 더 만들어 보세"),
    text:f.id==="shared"?(shared.length?`${shared[0]}을 함께 해 보게. ${shared[1]?`또 ${shared[1]}도 두 사람에게 어울리는 연습이 될 수 있지. `:""}서로 잘해 준 일을 하나씩 말해 주면 좋겠네.`:"겹치는 글자가 적다고 마음도 맞지 않는 것은 아니네. 함께 편했던 순간부터 하나씩 떠올려 보게.")
      :f.id==="different"?(differing?`${where[differing.position]}의 글자를 나란히 보면, 자네에게는 ${plain[(differing.left.find(e=>!differing.right.some(o=>o.role===e.role))??differing.left[0]).role].habit}, 상대에게는 ${plain[(differing.right.find(e=>!differing.left.some(o=>o.role===e.role))??differing.right[0]).role].habit}을 떠올릴 수 있네. ${ctx.scene} 누가 먼저 정하고 누가 생각할 시간을 바라는지 물어보게.`:"비슷한 글자라도 실제 마음을 표현하는 방법은 다를 수 있네. "+ctx.repair)
      :f.id==="conversation"?(wishA&&wishB?`자네는 ‘${wishA}’, 상대는 ‘${wishB}’라는 말에 공감하는지 살펴보게. ${ctx.scene} 먼저 자기 마음을 말한 뒤 상대의 이야기도 끝까지 들어 보게. 듣고 싶은 말과 해 줬으면 하는 행동을 하나씩 알려 주면 좋겠네.`:"지금 아는 정보만으로 대화 방식을 정하지는 않겠네. "+ctx.repair)
      :f.id==="close-context"?[a,b].map((p,i)=>{const day=p.evidence.filter(e=>e.position==="day"),hour=p.evidence.filter(e=>e.position==="hour");return `${i?"상대":"자네"}의 태어난 날을 보면 ${day.length?habits(day):"아직 더 확인할 모습"}을 떠올릴 수 있네.${hour.length?` 태어난 시간에서는 ${habits(hour)}도 함께 보게.`:p.includedPositions.includes("hour")?" 시간에 따른 모습이 하나로 정해지지 않아 그 부분은 더 확인해야겠네.":" 태어난 시간을 몰라 그 부분은 덧붙이지 않았네."}`;}).join(" ")+` ${ctx.scene} 이런 모습이 있는지 서로의 경험을 들어 보게.`
      :f.id==="seasons"?`자네는 ${season(a)}, 상대는 ${season(b)}의 글자를 참고했네. 계절만 보고 두 사람의 성격을 정하는 것은 아니네. ${kind==="연인"?"데이트를 오래 하고 싶은 날과 혼자 쉬고 싶은 날을 미리 말해 보게. 자주 만나고 싶은 마음과 쉬고 싶은 마음을 사랑의 크기로 비교하지는 말게.":kind==="친구"?"만날 수 있는 때와 연락이 어려운 때를 편하게 알려 주게. 매번 같은 속도로 연락해야 좋은 친구인 것은 아니네.":kind==="가족"?"함께할 집안일과 각자 쉴 시간을 따로 정해 보게. 쉬고 싶다는 말을 무관심으로 듣지는 말게.":"바로 답할 수 있는 일과 생각할 시간이 필요한 일을 나눠 보게. 답이 늦다고 의욕이 없는 것으로 정하지는 말게."}`
      :f.id==="relation:branch-clash"?`생일의 글자 가운데 서로 마주 보는 짝이 있네. 이것을 다툼이나 이별이 생긴다는 뜻으로 읽지는 말게. ${ctx.scene} 의견이 갈리면 각자 무엇을 원하는지 한 가지씩 말해 보게. 서로 원하는 것을 알아야 함께 고를 방법도 보인다네.`
      :`생일의 글자 가운데 서로 이어지는 짝이 있네. 이것만으로 좋은 관계가 보장되는 것은 아니네. ${shared[0]??ctx.repair}${shared.length?"부터 함께 해 보게.":""}`}));
  // Full fact/provenance lists remain available under the explanation, unchanged.
  whole.notice="두 사람의 사주를 쉬운 말로 풀어 본 이야기라네. 사람의 마음과 앞날을 단정하는 답은 아니니, 서로를 알아가는 데 참고해 보게.";
  whole.displayPolicy="아래 글자 기록은 풀이를 확인하고 싶은 이를 위해 남겼네. 항목이 많다고 성격이 더 강하다는 뜻은 아니네.";
  for(const p of story.people) p.notes=p.notes.map(voice);
  story.relationship={label:kind==="연인"?"두 사람의 사랑을 위해 해 볼 일":kind==="친구"?"오래 편한 친구로 지내려면":kind==="가족"?"서로 편안한 가족이 되려면":"믿고 일하는 동료가 되려면",
    scene:wishA&&wishB?`${ctx.scene}, 자네는 ‘${wishA}’, 상대는 ‘${wishB}’라는 바람을 먼저 나눠 보게.`:"서로에게 바라는 작은 배려부터 한 가지씩 말해 보게.",
    suggestion:`${shared.length?`${shared[0]}부터 이번 주에 해 보게. `:""}${ctx.repair}`,question:ctx.question};
  story.closing=ctx.closing;story.notice=whole.notice;
  reading.ruleVersion=easyReadingVersion;reading.title=ctx.title;reading.label="김춘배 훈장이 들려주는 두 사람의 이야기";
  reading.strength=whole.pair.sections[0].text;reading.difference=whole.pair.sections.find(s=>s.id==="conversation")!.text;
  // Keep public advice independent of private chart-derived wishes.
  reading.advice=ctx.repair;
  reading.basis={...reading.basis!,notice:whole.notice,cautions:[scope,...reading.basis!.cautions.slice(1).map(voice)]};
  return reading;
}

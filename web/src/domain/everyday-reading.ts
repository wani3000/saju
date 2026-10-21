import type {Reading} from "./model";
import type {WholePerson} from "./whole-chart-reading";
import {easyReadingVersion,type RelationshipKind} from "./easy-relationship-reading";

export const everydayReadingVersion="chunbae-everyday-copy-v6";
// Independent editorial prose. The source classifications and their uncertainty remain unchanged.
type Trait={title:string;good:string;weakTitle:string;weak:string;balance:string;wish:string};
const traits:Record<string,Trait>={
  비견:{title:"자기 주관이 뚜렷함",good:"남의 말에 쉽게 흔들리지 않고, 스스로 정한 일은 끝까지 해내려는 편이라네.",weakTitle:"자기 방식을 고집하기 쉬움",weak:"이미 마음을 정한 뒤에는 다른 의견이 잘 들어오지 않을 수 있네. 상대는 자기 말이 무시당한다고 느낄 수 있지.",balance:"자기 생각이 분명해서 든든하지만, 의견이 다를 때는 먼저 양보하기 어려울 수 있네.",wish:"내 의견도 물어봐 줬으면 좋겠어"},
  겁재:{title:"사람들과 함께하는 힘",good:"혼자 망설이던 일도 누군가와 함께하면 용기를 내는 편이라네. 가까운 사람의 일에 발 벗고 나서기도 하지.",weakTitle:"가까운 사이에서 앞서가기 쉬움",weak:"도와주고 싶은 마음에 상대의 뜻을 묻기 전에 나설 수 있네. 함께하는 일에서도 내 의견을 먼저 밀어붙이지 않는지 살펴보게.",balance:"가까운 사람을 적극적으로 돕지만, 상대가 원하지 않는 도움까지 줄 수 있네.",wish:"함께 정하기 전에 내가 원하는 것도 물어봐 줘"},
  식신:{title:"꾸준히 챙기는 다정함",good:"큰 말 한마디보다 작은 행동을 꾸준히 보여 주는 편이라네. 밥을 챙기거나 필요한 것을 기억해 두는 식이지.",weakTitle:"갑작스러운 변화에 부담을 느낌",weak:"익숙한 순서대로 하고 싶은데 일정이 자꾸 바뀌면 지칠 수 있네. 급하게 재촉받을 때는 오히려 말이나 행동이 느려질 수도 있지.",balance:"꾸준히 챙겨 주는 것이 장점이지만, 갑자기 속도를 맞춰야 할 때는 부담을 느낄 수 있네.",wish:"재촉하기보다 조금 기다려 줬으면 좋겠어"},
  상관:{title:"솔직하고 생각이 빠름",good:"문제가 보이면 그냥 넘기지 않고 더 나은 방법을 찾는 편이라네. 남들이 말하기 어려워하는 의견도 꺼낼 수 있지.",weakTitle:"말이 날카롭게 들릴 수 있음",weak:"틀린 점을 바로 짚다 보면 상대의 기분을 놓칠 수 있네. 맞는 말이라도 듣는 사람은 비난받는다고 느낄 수 있지.",balance:"솔직해서 답답한 일을 풀어 주지만, 마음이 급할 때는 말이 세게 나갈 수 있네.",wish:"의견이 달라도 내 말을 끝까지 들어 줘"},
  편재:{title:"먼저 움직이는 적극성",good:"해 보고 싶은 일이 생기면 기회를 찾고 직접 움직이는 편이라네. 만날 곳을 알아보거나 새로운 일을 시작하는 데 힘을 보태지.",weakTitle:"너무 많은 일을 벌이기 쉬움",weak:"의욕이 앞서면 시간이나 체력을 생각하지 않고 약속할 수 있네. 시작한 일을 마무리하기 전에 다른 일로 관심이 옮겨갈 수도 있지.",balance:"함께할 일을 먼저 만들어 주지만, 약속이 많아지면 하나하나 챙기기 어려울 수 있네.",wish:"새로 해 보고 싶은 일도 함께 이야기해 줘"},
  정재:{title:"작은 약속도 잘 챙김",good:"날짜와 준비할 것을 미리 확인하고, 맡은 일을 차근차근 끝내는 편이라네. 말로만 약속하기보다 실제 행동으로 믿음을 주지.",weakTitle:"계획이 바뀌면 예민해질 수 있음",weak:"미리 준비한 만큼 갑작스러운 취소나 변경이 더 서운할 수 있네. 사정이 생긴 것인데도 나를 가볍게 여긴다고 받아들이기 쉽지.",balance:"작은 약속까지 챙겨서 믿음직하지만, 상대가 같은 만큼 챙기지 않으면 서운할 수 있네.",wish:"약속이 바뀌면 미리 알려 줬으면 좋겠어"},
  편관:{title:"어려운 일에도 나서는 책임감",good:"문제가 생겼을 때 피하기보다 해결할 방법을 찾는 편이라네. 급한 상황에서 먼저 맡아 주는 든든함이 있지.",weakTitle:"마음이 급하면 상대를 재촉함",weak:"빨리 해결하려는 마음에 상대도 나처럼 움직이길 바랄 수 있네. 도움을 주려던 말이 지시처럼 들리지 않는지 살펴보게.",balance:"급할 때는 든든한 사람이지만, 평소에도 서두르면 상대는 쉬기 어려울 수 있네.",wish:"급한 일이라도 무엇부터 할지 같이 정해 줘"},
  정관:{title:"책임감과 약속을 지키는 태도",good:"한번 맡은 일이나 서로 정한 약속을 쉽게 놓지 않는 편이라네. 내 기분보다 해야 할 일을 먼저 챙기기도 하지.",weakTitle:"기준이 엄격해질 수 있음",weak:"나는 당연히 지키는 일인데 상대가 그렇지 않으면 이해하기 어려울 수 있네. 사정을 듣기 전에 옳고 그름부터 따질 수도 있지.",balance:"약속을 잘 지켜서 믿음을 주지만, 상대에게도 같은 기준을 요구하면 부담이 될 수 있네.",wish:"어려운 사정이 있으면 숨기지 말고 이야기해 줘"},
  편인:{title:"신중하게 살피는 눈",good:"남들이 지나치는 작은 차이도 알아보고, 혼자 충분히 생각한 뒤 판단하는 편이라네. 쉽게 결론을 내리지 않는 신중함이 있지.",weakTitle:"생각을 혼자 오래 붙잡음",weak:"아직 정리가 안 됐다는 이유로 말을 아끼다 보면 오해를 풀 기회를 놓칠 수 있네. 상대는 무엇이 불편한지 몰라 답답할 수 있지.",balance:"신중해서 놓치는 일이 적지만, 생각이 길어지면 마음을 전하는 때가 늦어질 수 있네.",wish:"생각할 시간을 주되 나중에 다시 물어봐 줘"},
  정인:{title:"이야기를 듣고 이해하는 배려",good:"바로 판단하기보다 왜 그런지부터 들어 보는 편이라네. 가까운 사람이 힘들어하면 이야기를 듣고 마음을 챙겨 주지.",weakTitle:"내 뜻을 늦게 말하기 쉬움",weak:"상대를 이해하려다 정작 내가 원하는 것을 뒤로 미룰 수 있네. 괜찮다고 해 놓고 나중에 혼자 서운해질 수도 있지.",balance:"상대의 사정을 잘 이해하지만, 내 마음까지 참아 버리면 서운함이 쌓일 수 있네.",wish:"내가 괜찮다고 해도 원하는 게 없는지 물어봐 줘"},
};
function selected(p:WholePerson) {
  // Round-robin examples cover each known pillar before remaining facts; no strength ranking.
  const groups=p.includedPositions.map(pos=>p.evidence.filter(e=>e.position===pos));
  const roles:string[]=[];
  for(let i=0;i<Math.max(0,...groups.map(g=>g.length));i++) for(const group of groups) {
    const role=group[i]?.role;if(role&&!roles.includes(role))roles.push(role);
  }
  return roles.slice(0,4).map(role=>traits[role]);
}
const lead=(p:WholePerson)=>p.anchor?traits[p.anchor.role]:null;
const settings:Record<RelationshipKind,{scene:string;good:string;hard:string;tip:string}>={
  연인:{scene:"연애할 때",good:"사랑이 편안해지는 부분",hard:"서운해지기 쉬운 부분",tip:"데이트나 연락에서 바라는 것을 말할 때"},
  친구:{scene:"친구로 지낼 때",good:"친구로서 잘 맞을 부분",hard:"친구 사이에 서운해질 때",tip:"만날 약속이나 연락 간격을 정할 때"},
  가족:{scene:"가족과 지낼 때",good:"서로에게 힘이 되는 부분",hard:"가까워서 더 부딪히는 부분",tip:"집안일이나 필요한 도움을 이야기할 때"},
  동료:{scene:"함께 일할 때",good:"함께 일할 때 잘 맞을 부분",hard:"일하면서 부딪히기 쉬운 부분",tip:"역할과 마감을 정할 때"},
};
export function addEverydayReading(previous:Reading,relation:string):Reading {
  if(previous.ruleVersion!==easyReadingVersion||!previous.wholeChart||!previous.interpretation||!Object.hasOwn(settings,relation))throw new Error("INVALID_EVERYDAY_CONTEXT");
  const r=structuredClone(previous),w=r.wholeChart!,story=r.interpretation!,ctx=settings[relation as RelationshipKind];
  w.version=everydayReadingVersion;r.ruleVersion=everydayReadingVersion;
  w.people.forEach(p=>{
    const chosen=selected(p),main=lead(p),person=story.people.find(s=>s.side===p.side)!;
    const day=person.pillars.find(c=>c.key==="day");
    p.summary={
      title:main?main.title:"생일을 조금 더 확인해야겠네",
      text:main?`${day?.fixed?`${day.korean}일주를 중심으로, `:""}태어난 해와 달${p.includedPositions.includes("hour")?", 시간":""}의 글자도 함께 살폈네. 한마디로 말하면 ${main.balance}`:"태어난 날의 글자가 하나로 정해지지 않아 성격을 한쪽으로 정하지 않았네.",
      strength:chosen.map(t=>`${t.title}: ${t.good}`).join("\n"),
      watch:chosen.map(t=>`${t.weakTitle}: ${t.weak}`).join("\n"),
      affection:main?`${ctx.scene}, ${main.balance} ‘${main.wish}’라고 말해 두면 서로 오해를 줄이는 데 도움이 되겠네.`:"서로 어떤 배려를 바라는지 직접 물어보면 좋겠네.",
      work:previous.interpretation!.relationship.suggestion,
    };
  });
  const [a,b]=w.people.map(lead);
  const describe=(t:Trait|null)=>t?t.good:"아직 성격을 한 가지로 말하기는 어렵네.";
  w.pair.summary=`${ctx.scene} 두 사람이 어떤 점에서 편하고, 어떤 순간에 서운할 수 있는지 살펴보겠네. 장점과 단점은 같은 성향에서 나오는 경우가 많다네.`;
  w.pair.sections=w.pair.sections.map(s=>{
    if(s.id==="shared")return {...s,title:ctx.good,text:`자네는 ${describe(a)}\n상대는 ${describe(b)}\n${a&&b&&a===b?"이런 점이 비슷해서 서로의 행동을 이해하기 편할 수 있네. 다만 원하는 것이 겹칠 때는 번갈아 양보하는 것도 필요하지.":"서로 잘하는 방식이 다를 수 있으니, 내가 편한 방법을 상대도 좋아할 거라고 생각하지는 말게."}`};
    if(s.id==="different")return {...s,title:ctx.hard,text:`${a?`자네 쪽에서는 ${a.weak}`:"자네의 성향은 아직 더 확인해야겠네."}\n${b?`상대 쪽에서는 ${b.weak}`:"상대의 성향은 아직 더 확인해야겠네."}\n${ctx.tip}, 상대가 일부러 그러는 것인지 짐작하기보다 먼저 이유를 물어보게.`};
    if(s.id==="conversation")return {...s,text:`${a?`자네가 바라는 말은 ‘${a.wish}’에 가까울 수 있네.`:"자네가 바라는 배려부터 하나씩 말해 보게."}\n${b?`상대는 ‘${b.wish}’라는 배려를 더 반가워할 수 있지.`:"상대에게도 어떤 배려가 편한지 물어보게."}\n${previous.advice}`};
    if(s.id==="close-context")return {...s,text:`${a?`자네는 ${a.balance}`:"자네의 마음은 직접 나누는 말로 알아가면 좋겠네."}\n${b?`상대는 ${b.balance}`:"상대의 마음도 직접 물어보게."}\n${relation==="연인"?"좋아하는 마음이 있어도 표현하는 방법은 다를 수 있네. 연락, 만남, 혼자 쉬는 시간 중 무엇이 필요한지 말로 알려 주게.":relation==="친구"?"친해도 매번 취향이 같지는 않네. 만나서 하고 싶은 일을 번갈아 고르면 한쪽만 맞추는 일을 줄일 수 있지.":relation==="가족"?"가족이라고 말하지 않은 마음까지 알 수는 없네. 도움이 필요한 일과 직접 하고 싶은 일을 구분해서 알려 주게.":"좋은 뜻으로 도와줘도 상대의 일을 대신 결정하면 불편할 수 있네. 어디까지 맡아 주면 좋을지 먼저 확인해 보게."}`};
    if(s.id==="seasons")return {...s,text:relation==="연인"?"자주 만나야 사랑받는다고 느끼는 사람도 있고, 혼자 쉬어야 다시 다정해지는 사람도 있네. 연락이 늦거나 혼자 있고 싶다는 말을 곧바로 마음이 식었다는 뜻으로 받아들이지는 말게. 바쁜 날에는 언제 다시 연락할 수 있는지 알려 주면 좋겠네.":relation==="친구"?"매일 연락해야 편한 친구도 있고, 오랜만에 만나도 반가운 친구도 있네. 서로 편한 연락 간격을 물어보고, 답이 늦을 때는 바쁜 일이 있는지 먼저 살펴보게.":relation==="가족"?"함께 보내는 시간만큼 혼자 쉬는 시간도 필요하네. 누가 언제 쉴지, 그동안 필요한 일은 누가 맡을지 미리 나누면 부탁할 때 눈치를 덜 보게 되지.":"바로 답할 수 있는 질문과 생각할 시간이 필요한 일을 나눠 보게. 답이 늦을 때는 의욕부터 의심하기보다, 언제까지 답을 주면 되는지 알려 주면 좋겠네."};
    return {...s,text:s.id==="relation:branch-clash"?`의견이 다를 때는 ‘누가 맞느냐’보다 ‘각자 무엇이 필요하냐’를 먼저 이야기해 보게. ${ctx.tip} 원하는 것을 하나씩 말하면 함께 고르기 쉬워지네.`:`편했던 순간을 당연하게 넘기지 말고, 무엇이 좋았는지 말해 주게. ‘그때 내 이야기를 끝까지 들어 줘서 좋았어’처럼 구체적으로 말하면 상대도 어떤 행동을 이어 가면 좋을지 알 수 있지.`};
  });
  story.relationship.scene=`${ctx.scene} 기억할 것은 두 가지라네.\n${a?`자네에게는 ‘${a.wish}’.`:"자네가 바라는 배려 하나."}\n${b?`상대에게는 ‘${b.wish}’.`:"상대가 바라는 배려 하나."}`;
  w.notice="전통 사주의 뜻을 일상에 빗대어 풀었네. 실제 성격과 다른 부분도 있으니, 두 사람이 서로를 알아가는 데 참고하면 좋겠네.";
  story.notice=w.notice;r.basis!.notice=w.notice;
  r.strength=w.pair.sections[0].text;r.difference=w.pair.sections.find(s=>s.id==="conversation")!.text;
  return r;
}

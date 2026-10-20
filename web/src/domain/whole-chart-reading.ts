import {analyzeNatal,compareProfiles} from "../generated/selected-reading.mjs";
import type {Reading,ReadingSource} from "./model";
import type {NatalAnalysis,Position,TenGodFact,SymbolFinding} from "./natal-facts";
import {addSymbolicReading} from "./symbolic-reading";
import {sajuTypes,toHanja} from "./saju-types";
import {familyNames,familyPractice,roleCopy,seasons,type RoleFamily} from "./whole-chart-copy";

export const wholeChartVersion="whole-chart-personality-copy-v4";
const positions:Position[]=["year","month","day","hour"];
const positionNames:Record<Position,string>={year:"연주",month:"월주",day:"일주",hour:"시주"};
const familyOrder:RoleFamily[]=["peer","output","practical","structure","resource"];
const unique=(xs:string[])=>[...new Set(xs)];
export type ChartEvidence={id:string;position:Position;layer:"visible"|"hidden";stem:string;role:string;family:RoleFamily;text:string;sources:ReadingSource[]};
export type ReadingFacet={id:string;title:string;text:string;evidence:string[]};
export type WholePerson={side:"me"|"other";includedPositions:Position[];omittedPositions:Position[];
  season:{branches:string[];label:string;commonGroup:string|null;text:string};
  families:RoleFamily[];evidence:ChartEvidence[];facets:ReadingFacet[];
  summary:{title:string;text:string;strength:string;watch:string;affection:string;work:string};
  anchor:ChartEvidence|null;roots:{position:Position;stems:string[]}[];
  innerRelations:{text:string;family:string}[];omittedCandidateFacts:number;notes:string[]};
export type WholePair={title:string;summary:string;sections:ReadingFacet[];commonFamilies:RoleFamily[];
  observations:{id:string;ruleId:string;text:string;family:string;positions:{side:string;position:string}[];source:ReadingSource}[];
  omittedCandidateFacts:number;scope:string};
export type WholeChartReading={kind:"whole-chart-story";version:string;people:WholePerson[];pair:WholePair;
  displayPolicy:string;notice:string};

function evidenceFor(f:TenGodFact,n:NatalAnalysis):ChartEvidence {
  const c=roleCopy[f.label];if(!c)throw new Error("UNSUPPORTED_TEN_GOD_COPY");
  const options=n.hiddenStems.find(p=>p.position===f.position)!.alternatives.map(a=>a.pillar);
  const where=`${positionNames[f.position]} ${options.map(toHanja).join(" / ")}${options.length>1?" 후보":""}`;
  const stem=sajuTypes.find(t=>t.stem===f.targetStem)!.hanja;
  return {id:f.id,position:f.position,layer:f.layer,stem:f.targetStem,role:f.label,family:c.family,
    text:`${where}의 ${f.layer==="visible"?"천간":"지장간"} ${stem}(${f.targetStem}) → ${f.label}`,
    sources:f.sources.map(s=>({...s}))};
}
function relationText(f:SymbolFinding,self=false) {
  const [a,b]=f.endpoints;
  const pair=f.witnesses[0];
  const left=self?"":a.side==="a"?"내 ":"상대 ",right=self?"":b.side==="a"?"내 ":"상대 ";
  const glyphs=f.family==="stem-combination"?pair.map(s=>sajuTypes.find(t=>t.stem===s)!.hanja):pair.map(s=>toHanja(`갑${s}`).slice(1));
  return `${left}${positionNames[a.position]} · ${right}${positionNames[b.position]}의 ${glyphs.join("·")}(${pair.join("·")}) ${f.label}`;
}
function seasonFor(n:NatalAnalysis):WholePerson["season"] {
  const branches=[...n.monthContext.branches],variants=branches.map(b=>seasons[b]);
  if(variants.some(v=>!v))throw new Error("UNSUPPORTED_MONTH_BRANCH");
  const groups=unique(variants.map(v=>v.group));
  const label=branches.length===1?variants[0].label:`${variants.map(v=>v.label).join(" / ")} 후보`;
  return {branches,label,commonGroup:groups.length===1?groups[0]:null,
    text:branches.length===1 ? `월지 ${toHanja(`갑${branches[0]}`).slice(1)}(${branches[0]})는 ${label}의 맥락이네. ${variants[0].text}에 빗대어 전체 이야기의 배경으로 읽겠네. ${variants[0].practice}.`
      : `월지 후보가 ${branches.join("·")}여서 ${label}를 함께 남겼네. 한 계절의 성향을 골라 확정하지 않겠네. 월령으로 일간의 강약을 정한 것은 아니네.`};
}
function summarizeFamilies(families:RoleFamily[]) {
  return families.length?families.map(f=>familyNames[f]).join(" · "):"확정할 수 있는 십성 해설이 아직 없는 구성";
}
const combinations:Record<string,string>={
  "peer:output":"내 생각을 지키는 힘과 그것을 표현하는 힘을 함께 써 볼 수 있네. 다만 말의 크기보다 상대가 이해했는지도 살펴보게",
  "peer:practical":"내 몫을 정하는 힘과 실제로 움직이는 힘을 함께 써 볼 수 있네. 혼자 끝내려 하기보다 도움받을 자리도 남겨 보게",
  "peer:structure":"자기 방식과 함께 지킬 기준을 동시에 살피는 모습으로 읽을 수 있네. 독립적으로 할 부분과 함께 합의할 부분을 나누어 보게",
  "peer:resource":"자기 판단을 지키면서도 충분히 이해하려는 모습으로 읽을 수 있네. 혼자 생각한 결론이 상대에게도 전달되도록 이유를 들려주게",
  "output:practical":"아이디어를 말로 꺼내고 실제 경험으로 옮기는 두 결을 함께 써 볼 수 있네. 시작의 즐거움 곁에 마무리할 범위도 정해 두게",
  "output:structure":"새로운 말을 꺼내는 결과 약속을 지키려는 결이 함께 보이네. 더 나은 방법을 제안하되 사람에 대한 평가와는 구분해 말해 보게",
  "output:resource":"생각을 안으로 정리하는 일과 밖으로 표현하는 일을 번갈아 써 볼 수 있네. 준비가 끝날 때까지 숨기기보다 중간 생각도 나누어 보게",
  "practical:structure":"실행할 일과 지킬 약속을 함께 챙기는 모습으로 읽을 수 있네. 성과를 내는 일과 서로 무리하지 않는 일을 함께 기준에 놓게",
  "practical:resource":"충분히 이해한 뒤 현실에 옮기는 두 결을 함께 써 볼 수 있네. 조사하고 준비한 다음에는 작게 해 볼 행동도 하나 붙여 보게",
  "structure:resource":"이유를 이해하고 납득할 약속을 세우는 모습으로 읽을 수 있네. 기준이 달라졌을 때 누구의 탓보다 바뀐 상황을 먼저 확인해 보게",
};
function buildPerson(side:"me"|"other",n:NatalAnalysis):WholePerson {
  const coverage=n.coverage[0];
  const facts=n.tenGods.filter(f=>f.certainty==="all-candidates");
  const evidence=facts.map(f=>evidenceFor(f,n));
  const families=familyOrder.filter(f=>evidence.some(e=>e.family===f));
  // An editorial example from the month stem, then hour/year; never a strength ranking.
  const anchor=["month","hour","year"].map(p=>evidence.find(e=>e.position===p&&e.layer==="visible")).find(Boolean)
    ?? evidence.find(e=>e.position==="day") ?? null;
  const secondary=evidence.find(e=>e.family!==anchor?.family) ?? null;
  const season=seasonFor(n),day=sajuTypes.find(t=>t.stem===n.dayReference.confirmedStem);
  const facets:ReadingFacet[]=[{id:"season",title:"월주가 더하는 계절의 배경",text:season.text,
    evidence:n.hiddenStems.find(h=>h.position==="month")!.alternatives.map(a=>`${toHanja(a.pillar)}(${a.pillar})`)}];
  for(const position of positions.filter(p=>coverage.includedPositions.includes(p))) {
    const visible=evidence.filter(e=>e.position===position&&e.layer==="visible");
    const hidden=evidence.filter(e=>e.position===position&&e.layer==="hidden");
    if(visible.length||hidden.length) facets.push({id:`pillar:${position}`,title:`${positionNames[position]}에서 읽는 겉과 속의 결`,
      text:[...visible.map(e=>`${e.role}는 ${roleCopy[e.role].habit}으로 풀어 보겠네.`),
        ...(hidden.length?[`같은 기둥의 지지 안에서는 ${unique(hidden.map(e=>e.role)).join("·")}이 확인되네. ${unique(hidden.map(e=>roleCopy[e.role].habit)).join("과 ")}도 함께 살펴볼 만하지.`]:[])].join(" "),
      evidence:[...visible,...hidden].map(e=>e.text)});
  }
  // Same-element connections inside source-listed hidden stems, without root grades/weights.
  const roots=positions.flatMap(position=>{
    const matches=unique(evidence.filter(e=>e.position===position&&e.layer==="hidden"&&e.family==="peer").map(e=>e.stem));
    return matches.length?[{position,stems:matches}]:[];
  });
  const innerRelations=n.relations.findings.filter(f=>f.certainty==="all-candidates").map(f=>({text:relationText(f,true),family:f.family}));
  if(roots.length) facets.push({id:"roots",title:"속에 이어지는 자기 기준",text:`${roots.map(r=>positionNames[r.position]).join("·")}의 지장간에 일간과 같은 오행이 연결되어 있네. 자기 방식으로 되돌아가 생각할 자리를 찾는 상징으로 읽어 보세. 이것만으로 신강이나 통근의 등급을 정한 것은 아니네.`,evidence:roots.map(r=>`${positionNames[r.position]} 지장간 ${r.stems.join("·")}`)});
  if(innerRelations.length) facets.push({id:"inner-relations",title:"내 사주 안에서 함께 움직이는 기호",text:`알려진 기둥 사이에 ${unique(innerRelations.map(f=>f.family==="branch-clash"?"육충":f.family==="branch-combination"?"육합":"천간 합")).join("·")}이 함께 보이네. 맞추고 싶은 마음과 다른 방식을 시험하는 마음을 따로 돌아보는 질문으로 삼아 보세. 합과 충을 서로 지우거나 곧바로 성격으로 단정하지는 않겠네.`,evidence:innerRelations.map(f=>f.text)});
  const c=anchor?roleCopy[anchor.role]:null;
  const pillarSummary=coverage.includedPositions.map(position=>{
    const roles=unique(evidence.filter(e=>e.position===position).map(e=>e.role));
    const pillar=n.hiddenStems.find(h=>h.position===position)!.alternatives.map(a=>toHanja(a.pillar)).join("/");
    return `${positionNames[position]} ${pillar}의 ${roles.length?roles.join("·"):"공통 분류 보류"}`;
  }).join(", ");
  const key=familyOrder.filter(f=>f===anchor?.family||f===secondary?.family).join(":");
  const blend=combinations[key] ?? (c?`${c.strength}을 생활에서 써 볼 수 있겠네` : "계산 후보를 확인한 뒤 해설을 이어가겠네");
  const summary=day ? {
    title:anchor?`${day.title} · ${c!.title}`:day.title,
    text:`일간 ${day.hanja}(${day.stem})의 ${day.image} 같은 기본 결 위에, ${season.label}이라는 배경이 놓여 있네. ${pillarSummary} 같은 분류를 확인했네. ${summarizeFamilies(families)}의 여러 면을 함께 읽을 수 있지. 한 가지 유형만으로 끝내지 않고, 아래의 서로 다른 결을 겹쳐 살펴보세.`,
    strength:`${anchor?`${positionNames[anchor.position]}의 ${anchor.role}에서는 ${c!.strength}을, `:""}${secondary?`${positionNames[secondary.position]}의 ${secondary.role}에서는 ${roleCopy[secondary.role].strength}을 함께 떠올릴 수 있네. `:"확인한 기둥의 결을 함께 떠올려 보게. "}${blend}.`,
    watch:anchor?`${positionNames[anchor.position]}의 ${anchor.role} 해설을 예로 들면, ${c!.watch}. ${secondary?`${positionNames[secondary.position]}의 ${secondary.role}도 함께 있으니, ${roleCopy[secondary.role].watch}. `:""}이 두 모습을 실제로 언제 경험하는지 돌아보게.`:"일간과 다른 기둥의 관계가 후보마다 달라 주의점을 하나로 정하지 않았어요.",
    affection:anchor?`가까운 사람에게 ‘${c!.request}’라는 말이 내 바람에 맞는지 물어보게. ${season.branches.length===1?seasons[season.branches[0]].practice+". ":"계절 후보를 하나로 고르지는 않았네. "}배려를 원하는 순간과 혼자 해 보고 싶은 순간을 따로 말하면 좋겠네.`:day.affection,
    work:`${families.map(f=>familyPractice[f].strength).join(", ")}를 서로 다른 역할로 써 보게. ${coverage.includedPositions.includes("hour")?"시주의 해설도 함께 참고하되, 특정 나이의 직업이나 성과를 예언하는 뜻은 아니네.":"출생 시간을 모르니 시주에 관한 업무 방식은 보충하지 않았네."}`,
  } : {title:"일간 후보를 먼저 확인해 주세요",text:"일간을 하나로 정할 수 없어 종합 성향 문장을 보류했어요.",strength:"",watch:"",affection:"",work:""};
  const omittedCandidateFacts=n.tenGods.filter(f=>f.certainty!=="all-candidates").length+n.relations.findings.filter(f=>f.certainty!=="all-candidates").length;
  return {side,includedPositions:[...coverage.includedPositions],omittedPositions:[...coverage.omittedPositions],season,families,evidence,facets,summary,anchor,roots,innerRelations,omittedCandidateFacts,
    notes:[...(coverage.omittedPositions.includes("hour")?["시간을 몰라 시주의 천간·지장간·합충은 반영하지 않았어요."]:[]),
      ...(omittedCandidateFacts?["후보에 따라 달라지는 십성과 합충은 확정 해설에서 제외했어요."]:[]),
      "오행·십성 항목 수는 강약이나 중요도의 비율이 아니에요. 지장간에 임의의 가중치를 주지 않았어요."]};
}

function buildPair(a:WholePerson,b:WholePerson,comparison:ReturnType<typeof compareProfiles>):WholePair {
  const commonFamilies=familyOrder.filter(f=>a.families.includes(f)&&b.families.includes(f));
  const aOnly=a.families.filter(f=>!b.families.includes(f)),bOnly=b.families.filter(f=>!a.families.includes(f));
  // Broad five-family sets often coincide. Compare actual roles at the same known
  // pillar as well, so two distinct charts do not receive an empty "no difference" paragraph.
  const differingSlots=(["month","hour","year","day"] as Position[]).flatMap(position=>{
    const left=a.evidence.filter(e=>e.position===position),right=b.evidence.filter(e=>e.position===position);
    if(!left.length||!right.length)return [];
    const key=(items:ChartEvidence[])=>items.map(e=>`${e.layer}:${e.stem}:${e.role}`).sort().join("|");
    if(key(left)===key(right))return [];
    return [{position,left,right}];
  });
  const findings=comparison.findings.filter(f=>f.certainty==="all-candidates");
  const observations=findings.map(f=>({id:`${f.ruleId}:${f.endpoints.map(e=>e.position).join(":")}`,ruleId:f.ruleId,text:relationText(f),family:f.family,positions:f.endpoints.map(e=>({...e})),source:{...f.source}}));
  const hasClash=findings.some(f=>f.family==="branch-clash"),hasCombination=findings.some(f=>f.family!=="branch-clash");
  const title=hasClash&&hasCombination?"이어지는 결도, 다른 속도도 함께 있는 사이":commonFamilies.length?"닮은 바탕에 서로의 방식을 더하는 사이":"다른 강점을 번갈아 꺼내 보는 사이";
  const sections:ReadingFacet[]=[];
  sections.push({id:"shared",title:"두 사주에서 함께 보이는 강점",text:commonFamilies.length?
    `두 사람의 알려진 기둥에 ${summarizeFamilies(commonFamilies)}의 분류가 함께 보이네. ${commonFamilies.map(f=>familyPractice[f].strength).join(", ")}를 같이 해 볼 일로 삼아 보게. 같은 분류가 있다고 표현 방식까지 같다는 뜻은 아니네.`
    :"알려진 기둥에서 공통으로 확정한 십성 묶음은 없네. 실제 공통점이 없다는 뜻은 아니니, 서로 편하게 해내는 일을 직접 물어보게.",
    evidence:commonFamilies.flatMap(f=>[`나: ${a.evidence.filter(e=>e.family===f).map(e=>e.text).join(" / ")}`,`상대: ${b.evidence.filter(e=>e.family===f).map(e=>e.text).join(" / ")}`])});
  const slot=differingSlots[0];
  const positionalText=slot?`같은 ${positionNames[slot.position]} 자리를 비교해도 나는 ${unique(slot.left.map(e=>e.role)).join("·")}, 상대는 ${unique(slot.right.map(e=>e.role)).join("·")}의 조합이네. 내 ${slot.left[0].role}은 ${roleCopy[slot.left[0].role].habit}, 상대의 ${slot.right[0].role}은 ${roleCopy[slot.right[0].role].habit}으로 풀어 보세. 같은 묶음을 공유해도 그 결을 꺼내는 방식은 서로 물어볼 만하지.`
    :"확인한 같은 위치의 십성 구성이 비슷하네. 그렇다고 실제 성격과 표현도 같다고 정하지는 않겠네. 같은 상황에서 누가 먼저 말하고 누가 생각할 시간을 원하는지 경험으로 비교해 보게.";
  sections.push({id:"different",title:"서로 다르게 꺼내 쓰는 결",text:[
    ...(aOnly.length?[`내 알려진 기둥에서 별도로 확인한 ${summarizeFamilies(aOnly)}은 ${aOnly.map(f=>familyPractice[f].strength).join(", ")}의 역할로 써 볼 만하네.`]:[]),
    ...(bOnly.length?[`상대 쪽의 ${summarizeFamilies(bOnly)}은 ${bOnly.map(f=>familyPractice[f].strength).join(", ")}의 역할로 읽어 보세.`]:[]),positionalText].join(" "),
    evidence:[...a.evidence.filter(e=>aOnly.includes(e.family)).map(e=>`나: ${e.text}`),...b.evidence.filter(e=>bOnly.includes(e.family)).map(e=>`상대: ${e.text}`),
      ...differingSlots.flatMap(s=>[...s.left.map(e=>`나: ${e.text}`),...s.right.map(e=>`상대: ${e.text}`)])]});
  const ac=a.anchor?roleCopy[a.anchor.role]:null,bc=b.anchor?roleCopy[b.anchor.role]:null;
  sections.push({id:"conversation",title:"두 사람의 대화가 엇갈릴 때",text:ac&&bc?
    `내 ${a.anchor!.role}의 결은 ${ac.habit}, 상대의 ${b.anchor!.role}은 ${bc.habit}으로 읽어 보세. ${a.anchor!.role===b.anchor!.role?`둘 다 ‘${ac.request}’라는 바람이 있는지 확인하고, 서로 먼저 배려받기만 기다리지는 않는지 살펴보게.`:`나는 ‘${ac.request}’, 상대는 ‘${bc.request}’라는 바람이 있는지 확인해 보게.`} ${commonFamilies.length?familyPractice[commonFamilies[0]].practice:"한 사람의 기준을 정답으로 삼기보다 번갈아 제안하고 확인해 보게"}.`
    :"대화 방식을 읽을 공통 근거가 부족해 특정한 충돌 장면을 붙이지 않았어요. 편한 대화 방식부터 서로 물어보세요.",evidence:[...(a.anchor?[`나의 예: ${a.anchor.text}`]:[]),...(b.anchor?[`상대의 예: ${b.anchor.text}`]:[])]});
  const closeRows=[a,b].map((p,i)=>{
    const who=i===0?"내":"상대의",day=p.evidence.filter(e=>e.position==="day"&&e.layer==="hidden");
    const hour=p.evidence.find(e=>e.position==="hour"&&e.layer==="visible");
    return `${who} 일지의 지장간에서는 ${day.length?unique(day.map(e=>e.role)).join("·")+"의 결을 확인했네":"후보 전체에 공통인 분류를 정하지 않았네"}. ${hour?`${who} 시주 천간의 ${hour.role}도 반영하면, ${roleCopy[hour.role].habit}을 함께 살펴볼 수 있지.`:p.includedPositions.includes("hour")?`${who} 시주는 후보 전체에 공통인 천간 십성 해설을 고르지 않았네.`:`${who} 시주는 시간을 몰라 보충하지 않았네.`}`;
  });
  sections.push({id:"close-context",title:"일지와 시주로 더 살펴보는 관계의 결",text:closeRows.join(" ")+" 이런 결이 가까운 사이에서 실제로 어떻게 나타나는지 서로의 경험을 한 가지씩 들어 보게. 기둥의 위치만으로 가족이나 배우자의 성격을 대신 정하지는 않겠네.",evidence:[...a.evidence.filter(e=>e.position==="day"||e.position==="hour").map(e=>`나: ${e.text}`),...b.evidence.filter(e=>e.position==="day"||e.position==="hour").map(e=>`상대: ${e.text}`)]});
  sections.push({id:"seasons",title:"월주로 살펴보는 생활 리듬",text:`나의 월주는 ${a.season.label}, 상대는 ${b.season.label}의 배경이네. ${a.season.commonGroup&&b.season.commonGroup?(a.season.commonGroup===b.season.commonGroup?"비슷한 계절 배경을 공유하지만 시작하고 쉬는 실제 속도는 서로 물어보게.":"서로 다른 계절 비유처럼, 움직일 때와 생각을 정리할 때의 선호가 다를 수 있다는 질문으로 읽어 보세."):"월지 후보가 있어 하나의 계절 조합으로 단정하지 않겠네."} 함께할 일정 하나와 각자 쉴 시간 하나를 정해 보는 것이 좋겠네.`,evidence:[`나의 월지: ${a.season.branches.join(" / ")}`,`상대의 월지: ${b.season.branches.join(" / ")}`]});
  for(const family of ["stem-combination","branch-combination","branch-clash"]) {
    const rows=observations.filter(f=>f.family===family);if(!rows.length)continue;
    const clash=family==="branch-clash";
    sections.push({id:`relation:${family}`,title:clash?"육충에서 꺼내 보는 다른 방식의 질문":family==="branch-combination"?"육합에서 꺼내 보는 맞춤의 질문":"천간 합에서 꺼내 보는 연결의 질문",
      text:clash?"서로 마주 보는 지지의 짝이 확인되네. 계획을 바꾸거나 의견이 갈릴 때 무엇을 지키고 싶은지 한 가지씩 말해 보게. 이 짝만으로 다툼이나 이별을 예측하는 것은 아니네."
        :"이어지는 이름을 가진 기호의 짝이 확인되네. 함께할 일을 정할 때 서로 어떤 도움과 양보를 편안하게 느끼는지 물어보게. 합이 곧 좋은 관계나 합화의 성립을 보장하는 것은 아니네.",
      evidence:rows.map(r=>r.text)});
  }
  const hourScope=a.includedPositions.includes("hour")&&b.includedPositions.includes("hour")?"·시":a.includedPositions.includes("hour")||b.includedPositions.includes("hour")?"과 확인된 쪽의 시주":"";
  return {title,summary:`두 사람의 연·월·일${hourScope}에서 십성의 여러 결과 월지의 배경, 기둥 사이의 합충을 함께 살펴봤네. ${hasClash&&hasCombination?"합과 충이 모두 보여 한쪽을 지우지 않고 각각의 질문을 남겼네.":"일간끼리의 오행 관계만으로 궁합을 끝내지 않았네."}`,
    sections,commonFamilies,observations,omittedCandidateFacts:comparison.findings.length-findings.length,
    scope:`나 ${a.includedPositions.map(p=>positionNames[p]).join("·")} / 상대 ${b.includedPositions.map(p=>positionNames[p]).join("·")}. ${a.omittedPositions.length||b.omittedPositions.length?"시간을 모르는 쪽의 시주는 비교에 넣지 않았어요.":"두 사람의 시주까지 비교했어요."}`};
}

export function buildWholeChartReading(base:Reading,charts:Record<string,unknown>,relation:string):Reading {
  // Strict validation of all positions precedes any prose. The raw research modules stay immutable.
  const comparison=compareProfiles(charts.me,charts.other);
  const natalA=analyzeNatal(charts.me),natalB=analyzeNatal(charts.other);
  const seed=addSymbolicReading(base,charts,relation);
  const people=[buildPerson("me",natalA),buildPerson("other",natalB)],pair=buildPair(people[0],people[1],comparison);
  const notice="확인한 사주 전체를 바탕으로 읽는 성격·궁합 이야기예요. 전통 상징의 해설이며 성격 검사나 미래 예측은 아니에요.";
  const wholeChart:WholeChartReading={kind:"whole-chart-story",version:wholeChartVersion,people,pair,notice,
    displayPolicy:"월간·시간·연간, 이어 일지의 순서로 대화의 예를 고릅니다. 중요도·강약·확률 순서가 아니며, 모든 확정 십성은 세부 근거에 남깁니다."};
  const cautions=[pair.scope,"합·충은 함께 보존했어요. 강약·용신·합화의 최종 판정과 궁합 점수는 제공하지 않아요.",
    ...(pair.omittedCandidateFacts?["후보에 따라 달라지는 두 사람의 합충은 확정 해설에서 제외했어요."]:[]),
    ...base.basis!.cautions.filter(c=>!c.includes("이번 비교")&&!c.includes("이번 기호 비교"))];
  return {...seed,ruleVersion:wholeChartVersion,label:"김춘배 훈장의 전체 사주 성격·궁합 풀이",title:pair.title,
    strength:pair.sections[0].text,difference:pair.sections[2].text,wholeChart,
    basis:{...base.basis!,notice,comparisonPositions:positions.filter(p=>comparison.coverage.some(c=>c.includedPositions.includes(p))),
      coverage:comparison.coverage.map(c=>({side:c.side,hourKnown:c.includedPositions.includes("hour"),boundaryReviewRequired:c.boundaryReviewRequired,clockReviewRequired:c.clockReviewRequired})),
      observations:pair.observations.map(o=>({...o})),
      commonFamilies:unique(comparison.findings.filter(f=>f.certainty==="all-candidates").map(f=>f.label)),totalCommonObservations:pair.observations.length,
      omittedDisplayObservations:0,omittedCandidateDependentFacts:pair.omittedCandidateFacts,cautions}};
}

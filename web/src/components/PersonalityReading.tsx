import type { SavedResult } from "../domain/model";
import type { WholeChartReading,WholePerson } from "../domain/whole-chart-reading";
import {familyNames} from "../domain/whole-chart-copy";
const easyFamilyNames:Record<string,string>={peer:"내 생각을 지키는 힘",output:"마음을 표현하는 힘",practical:"행동으로 챙기는 힘",structure:"약속을 지키는 힘",resource:"차분히 이해하는 힘"};
const elementMeanings:Record<string,string>={목:"나무",화:"불",토:"흙",금:"쇠",수:"물"};

function ReadingText({text,list=false}:{text:string;list?:boolean}) {
  const lines=text.split("\n");
  return list?<ul className="story-traits">{lines.filter(Boolean).map(line=>{const colon=line.indexOf(": ");return <li key={line}>{colon>=0?<><strong>{line.slice(0,colon)}</strong><p>{line.slice(colon+2)}</p></>:line}</li>;})}</ul>:<>{lines.map((line,i)=><p key={i}>{line}</p>)}</>;
}

function FullProfileDetails({person}:{person:WholePerson}) {
  return <details className="story-more whole-evidence"><summary>연·월·일·시 풀이와 근거 펼치기</summary>
    <p className="hint">반영한 기둥: {person.includedPositions.map(p=>({year:"연주",month:"월주",day:"일주",hour:"시주"})[p]).join(" · ")}</p>
    {person.facets.map(f=><section key={f.id}><h4>{f.title}</h4><p>{f.text}</p>
      <ul className="story-evidence-list" aria-label={`${f.title}의 근거`}>{f.evidence.map((text,i)=><li key={`${i}:${text}`}>{text}</li>)}</ul></section>)}
    <h4>확인한 십성 전체</h4>
    <ul className="story-evidence-list">{person.evidence.map(e=><li key={e.id}>{e.text}</li>)}</ul>
    {person.notes.map(note=><p className="hint" key={note}>{note}</p>)}
    <p className="hint">글자의 이름과 옛 분류를 아래에 남겨 두었네. 성격은 그 뜻을 쉬운 말로 풀어 본 것이니, 실제 모습과 비교해 보게. 이 기록으로 사람의 앞날을 단정하지는 않겠네.</p>
  </details>;
}
function WholePairReading({whole}:{whole:WholeChartReading}) {
  return <section className="reading-entry" aria-labelledby="story-pair-title">
    <p className="reading-kicker">三 · 두 사람의 마음을 살피다</p>
    <h2 id="story-pair-title">{whole.pair.title}</h2><ReadingText text={whole.pair.summary}/>
    <details className="story-more"><summary>풀이에 사용한 기록</summary><p className="hint">{whole.pair.scope}</p>{whole.pair.observations.map(o=><p key={o.id} className="hint">{o.text}</p>)}</details>
    {whole.pair.sections.map(f=><section className="whole-pair-section" key={f.id}>
      <h3>{f.title}</h3><ReadingText text={f.text}/>
      {f.evidence.length>0&&<details className="story-more"><summary>{f.title}의 근거 보기</summary>
        <ul className="story-evidence-list">{f.evidence.map((text,i)=><li key={`${i}:${text}`}>{text}</li>)}</ul></details>}
    </section>)}
    <details className="story-more"><summary>풀이를 읽는 방법</summary><p className="hint">{whole.displayPolicy}</p></details>
  </section>;
}

/** Render the saved interpretation, never derive a new personality for an old purchase. */
export default function PersonalityReading({result}:{result:SavedResult}) {
  const story=result.reading.interpretation;
  if(!story) return null;
  const whole=result.reading.wholeChart;
  const everyday=["chunbae-everyday-copy-v6","chunbae-relationship-story-v7"].includes(whole?.version??"");
  const easy=everyday||whole?.version==="chunbae-easy-relationship-copy-v5";
  const name=(side:string)=>side==="me"?result.me.name:result.other.name;
  return <div className="saju-story">
    <section className="reading-entry" aria-labelledby="story-chart-title">
      <p className="reading-kicker">一 · 사주를 펼치다</p>
      <h2 id="story-chart-title">두 사람의 여덟 글자</h2>
      <p>사주는 태어난 해와 달, 날과 시간을 글자로 적어 놓은 것이라네. {whole?"한 글자만 보고 성격을 정하지 않고, 아는 글자를 함께 살펴보겠네. 두 사람이 평소 어떤 모습인지 쉽게 이야기해 주겠네.":"태어난 날의 첫 글자부터 두 사람의 이야기를 시작해 보겠네."}</p>
      {story.people.map(p=><div className="story-chart" key={p.side}>
        <h3>{name(p.side)}의 사주</h3>
        <dl className="story-pillars">{p.pillars.map(c=><div key={c.key} className={c.key==="day"?"day-pillar":""}>
          <dt>{({year:"태어난 해",month:"태어난 달",day:"태어난 날",hour:"태어난 시간"} as Record<string,string>)[c.key] ?? c.label}{c.key==="day"&&<span className="sr-only"> · 성향 기준</span>}</dt>
          <dd><strong className={c.fixed?"pillar-hanja":"pillar-unresolved"} lang={c.fixed?"zh":undefined}>{c.fixed?c.hanja:c.korean}</strong>
            {c.fixed&&<span>{c.korean}</span>}</dd>
        </div>)}</dl>
        {p.type&&<p className="story-day-key"><strong>{p.type.hanja}({p.type.stem})</strong>{["무","기","계"].includes(p.type.stem)?"는":"은"} {elementMeanings[p.type.element]}을 뜻하는 글자라네. 여기서는 <strong>{p.type.image}</strong>에 빗대어 자네의 모습을 풀어 보겠네.</p>}
        {p.notes.map(n=><p className="hint" key={n}>{n}</p>)}
      </div>)}
      <p className="hint">위 표를 왼쪽부터 보면 해·달·날·시간의 순서라네. 달은 옛 달력의 계절이 바뀌는 때를 기준으로 나누었지. 태어난 시간을 모르면 빈자리로 두고, 글자가 하나로 정해지지 않을 때도 억지로 고르지는 않겠네.</p>
    </section>
    <section className="reading-entry" aria-labelledby="story-types-title">
      <p className="reading-kicker">二 · 각자의 성향</p>
      <h2 id="story-types-title">자네는 어떤 사람인가?</h2>
      <p className="hint">{whole?"태어난 날의 글자가 같아도 다른 글자가 다르면 이야기는 달라지네. 각자 어떤 장점이 있고, 무엇을 배려받으면 편한지 쉽게 풀어 보겠네.":"열 가지 글자의 뜻에 빗대어 성격을 살펴보겠네. 사람을 딱 한 가지 성격으로 정하는 답은 아니라네."}</p>
      {story.people.map(p=>{const profile=whole?.people.find(person=>person.side===p.side);return <section className="story-profile" key={p.side} aria-label={`${name(p.side)}의 성향 유형`}>
        <p className="reading-kicker">{name(p.side)}의 성향</p>
        <h3>{profile?.summary.title ?? p.type?.title ?? "성격을 서둘러 정하지 않겠네"}</h3>
        {p.type ? <>
          {!everyday&&<p className="story-type-symbol"><span lang="zh">{p.type.hanja}</span> {p.type.stem}{p.type.element} · {p.type.image}형</p>}
          {!everyday&&<ul className="story-keywords" aria-label="성향 키워드">{(profile?profile.families.map(f=>easy?easyFamilyNames[f]:familyNames[f]):p.type.keywords).map(k=><li key={k}>{k}</li>)}</ul>}
          <p>{profile?.summary.text ?? p.type.summary}</p>
          <h4>장점</h4><ReadingText list={everyday} text={profile?.summary.strength ?? p.type.strength}/>
          <h4>단점 · 조심하면 좋은 점</h4><ReadingText list={everyday} text={profile?.summary.watch ?? p.type.watch}/>
          {profile&&<FullProfileDetails person={profile} />}
          <details className="story-more"><summary>{easy?"이 관계에서 편안해지는 방법":"가까운 사이와 일할 때의 모습"}</summary>
            <h4>{easy&&result.other.relation==="연인"?"사랑하는 사람에게 바라는 배려":"서로에게 바라는 배려"}</h4><p>{profile?.summary.affection ?? p.type.affection}</p>
            <h4>{easy?"상대에게 보탤 수 있는 도움":"함께 일을 할 때"}</h4><ReadingText text={profile?.summary.work ?? p.type.work}/>
          </details>
        </> : <p>태어난 날의 글자가 하나로 정해지지 않아 성격을 서둘러 붙이지 않았네. 아래 기록에서 생일과 시간을 먼저 살펴보게.</p>}
      </section>;})}
    </section>
    {whole?<WholePairReading whole={whole} />:<section className="reading-entry" aria-labelledby="story-pair-title">
      <p className="reading-kicker">三 · 두 사람의 궁합</p>
      <h2 id="story-pair-title">{story.pair.title}</h2>
      <p className="story-pair-symbols">{story.people.map(p=>`${name(p.side)} · ${p.type?.image ?? "미확정"}`).join(" × ")}</p>
      <p>{story.pair.summary}</p>
      {story.pair.meeting&&<><h3>두 유형이 만나는 대화</h3><p>{story.pair.meeting}</p></>}
      {story.pair.kind!=="unresolved"&&<>
        <h3>잘 맞춰 갈 수 있는 점</h3><p>{story.pair.harmony}</p>
        <h3>엇갈리기 쉬운 순간</h3><p>{story.pair.friction}</p>
      </>}
      <h3>두 사람에게 권하는 연습</h3><p>{story.pair.practice}</p>
      <p className="hint">{story.pair.basis}</p>
    </section>}
    <section className="reading-entry" aria-labelledby="story-relation-title">
      <p className="reading-kicker">四 · 일상으로 가져가기</p>
      <h2 id="story-relation-title">{story.relationship.label}</h2>
      <ReadingText text={story.relationship.scene}/><ReadingText text={story.relationship.suggestion}/>
      <blockquote className="story-question">{story.relationship.question}</blockquote>
      <p className="hint">훈장의 말 가운데 두 사람에게 맞는 것을 골라 써 보게. 서로의 마음은 직접 나누는 말에서 가장 잘 알 수 있다네.</p>
    </section>
    <section className="story-closing"><h2>훈장이 건네는 한마디</h2><p>{story.closing}</p></section>
  </div>;
}

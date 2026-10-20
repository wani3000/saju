import type { SavedResult } from "../domain/model";
const elementMeanings:Record<string,string>={목:"나무",화:"불",토:"흙",금:"쇠",수:"물"};

/** Render the saved interpretation, never derive a new personality for an old purchase. */
export default function PersonalityReading({result}:{result:SavedResult}) {
  const story=result.reading.interpretation;
  if(!story) return null;
  const name=(side:string)=>side==="me"?result.me.name:result.other.name;
  return <div className="saju-story">
    <section className="reading-entry" aria-labelledby="story-chart-title">
      <p className="reading-kicker">一 · 사주를 펼치다</p>
      <h2 id="story-chart-title">두 사람의 여덟 글자</h2>
      <p>태어난 해·달·날·시각을 두 글자씩 적은 것이 사주예요. 아래 표에서 <strong>일주의 첫 글자, 일간</strong>을 두 사람의 성향 이야기의 출발점으로 삼았어요.</p>
      {story.people.map(p=><div className="story-chart" key={p.side}>
        <h3>{name(p.side)}의 사주</h3>
        <dl className="story-pillars">{p.pillars.map(c=><div key={c.key} className={c.key==="day"?"day-pillar":""}>
          <dt>{c.label}{c.key==="day"&&<span className="sr-only"> · 성향 기준</span>}</dt>
          <dd><strong className={c.fixed?"pillar-hanja":"pillar-unresolved"} lang={c.fixed?"zh":undefined}>{c.fixed?c.hanja:c.korean}</strong>
            {c.fixed&&<span>{c.korean}</span>}</dd>
        </div>)}</dl>
        {p.type&&<p className="story-day-key"><strong>{p.type.hanja}({p.type.stem})</strong>은 {p.type.polarity}의 {p.type.element}({elementMeanings[p.type.element]})에 속해요. 이 글자를 <strong>{p.type.image}</strong>에 빗대어 성향을 풀어 볼게요.</p>}
        {p.notes.map(n=><p className="hint" key={n}>{n}</p>)}
      </div>)}
      <p className="hint">연주는 태어난 해, 월주는 절기로 나눈 달, 일주는 태어난 날, 시주는 태어난 시각의 기둥이에요. 시간을 모르면 시주는 비워 두고, 후보가 있으면 하나를 골라 채우지 않아요.</p>
    </section>
    <section className="reading-entry" aria-labelledby="story-types-title">
      <p className="reading-kicker">二 · 각자의 성향</p>
      <h2 id="story-types-title">나는 어떤 결의 사람일까?</h2>
      <p className="hint">열 가지 일간 상징으로 만든 성향 유형이에요. MBTI와는 다른 창작 해설이며, 사주 전체의 강약을 판정한 결과는 아니에요.</p>
      {story.people.map(p=><section className="story-profile" key={p.side} aria-label={`${name(p.side)}의 성향 유형`}>
        <p className="reading-kicker">{name(p.side)}의 성향</p>
        <h3>{p.type?.title ?? "성향 유형을 정하지 않았어요"}</h3>
        {p.type ? <>
          <p className="story-type-symbol"><span lang="zh">{p.type.hanja}</span> {p.type.stem}{p.type.element} · {p.type.image}형</p>
          <ul className="story-keywords" aria-label="성향 키워드">{p.type.keywords.map(k=><li key={k}>{k}</li>)}</ul>
          <p>{p.type.summary}</p>
          <h4>이 유형이 빛나는 순간</h4><p>{p.type.strength}</p>
          <h4>마음에 두면 좋은 점</h4><p>{p.type.watch}</p>
          <details className="story-more"><summary>가까운 사이와 일할 때의 모습</summary>
            <h4>마음을 나누는 방식</h4><p>{p.type.affection}</p>
            <h4>함께 일을 할 때</h4><p>{p.type.work}</p>
          </details>
        </> : <p>일간 후보가 달라 하나의 유형을 붙이지 않았어요. 아래 계산 확인에서 후보와 출생 기록을 먼저 살펴봐 주세요.</p>}
      </section>)}
    </section>
    <section className="reading-entry" aria-labelledby="story-pair-title">
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
    </section>
    <section className="reading-entry" aria-labelledby="story-relation-title">
      <p className="reading-kicker">四 · 일상으로 가져가기</p>
      <h2 id="story-relation-title">{story.relationship.label}</h2>
      <p>{story.relationship.scene}</p><p>{story.relationship.suggestion}</p>
      <blockquote className="story-question">{story.relationship.question}</blockquote>
      <p className="hint">관계에 맞춘 일반적인 대화 제안이에요. 두 사람의 실제 경험에 맞춰 골라 써 주세요.</p>
    </section>
    <section className="story-closing"><h2>훈장이 건네는 한마디</h2><p>{story.closing}</p></section>
  </div>;
}

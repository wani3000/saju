import {useState,type Ref} from 'react';
import IconArrowDownLine from '@karrotmarket/react-monochrome-icon/IconArrowDownLine';
import {character} from '@/domain/presentation';
import sample from '../../content/landing-sample.json';

const relationships=[
  {name:'연인',title:'좋아하는 마음도, 전하는 방법은 다르니',description:'사랑을 표현하는 방식부터 서운해지는 순간, 다시 가까워지는 대화까지 살펴보겠네.',topics:['사랑의 표현','서운함과 화해','함께하는 일상']},
  {name:'친구',title:'이 친구와 나는 어떻게 힘이 될까?',description:'각자의 성격과 서로에게 도움이 되는 순간, 편하게 오래 지내는 방법을 풀어 보겠네.',topics:['성격의 차이','서로 주는 도움','편안한 거리']},
  {name:'가족',title:'가까운 사이라도 마음은 물어야 알지',description:'서로를 챙기는 방식과 자주 엇갈리는 마음, 각자 존중받고 싶은 부분을 살펴보겠네.',topics:['마음을 전하는 법','반복되는 오해','서로의 자리']},
  {name:'동료',title:'다르게 일해도, 함께 잘할 수 있도록',description:'일하는 속도와 잘 맡는 역할, 의견이 다를 때 맞춰 가는 방법을 이야기하겠네.',topics:['일하는 방식','역할 나누기','의견 맞추기']},
];
const questions=[
  ['태어난 시간을 몰라도 볼 수 있나요?','그럼, 괜찮네. 생일을 적고 ‘시간을 몰라요’를 고르면 되네. 아는 글자만 살피고, 모르는 시간은 짐작해서 채우지 않겠네.'],
  ['음력 생일도 적을 수 있나요?','생일 입력칸에서 음력을 고르면 되네. 윤달에 태어났다면 윤달도 함께 표시해 주게.'],
  ['전에 본 이야기는 어디에서 다시 보나요?','같은 카카오 계정으로 들어와 오른쪽 위 프로필을 누르면 되네. 사주 조회 내역과 결제 내역을 따로 살펴볼 수 있지. ‘나의 관계 지도 보기’에서도 남긴 이야기를 다시 읽을 수 있네.'],
  ['이 풀이를 어떻게 읽으면 좋을까요?','옛 사주 글자의 뜻을 빌려 서로를 돌아보는 이야기라네. 사람의 성격이나 앞날을 정답처럼 정하는 것은 아니니, 두 사람이 실제로 나눈 경험과 함께 읽어 보게.'],
];
const sampleNames=(text:string)=>text.replaceAll('자네','보라').replaceAll('상대','도하');

/** A read-only public example. Changing its relationship never edits the saved draft. */
export default function Landing({heading}:{heading:Ref<HTMLHeadingElement>}) {
  const [relation,setRelation]=useState('연인');
  const active=relationships.find(item=>item.name===relation)!;
  const excerpt=sample.readings.find(item=>item.relation===relation)!;
  return <div className="landing-content">
    <section className="landing-hero" aria-labelledby="landing-title">
      <img className="home-photo" src={character.photo} alt={character.photoAlt} width={1495} height={1052} fetchPriority="high" />
      <div className="landing-hero-copy">
        <p className="landing-eyebrow">괴산의 작은 서당에서 보내는 초대</p>
        <h1 id="landing-title" className="home-title" ref={heading} tabIndex={-1}>{character.homeTitle}</h1>
        <p className="home-invitation">{character.invitation}</p>
        <a className="landing-preview-link" href="#reading-example">어떤 이야기를 들려주시나요? <IconArrowDownLine size={18} aria-hidden="true"/></a>
      </div>
    </section>

    <section className="home-information" aria-label="김춘배 훈장 소개">
      <span className="seal-window" aria-hidden="true"><img src={character.seal} alt="" width={120} height={120}/></span>
      <p className="landing-eyebrow">김춘배 훈장의 인사</p>
      <h2>충청북도 괴산의 서당,<br/>김춘배 훈장이네.</h2>
      <p>자네는 어떤 사람인지, 소중한 이와는 어떻게 지내면 좋을지.<br className="landing-desktop-break"/> 이곳에서 알아듣기 쉽게 들려주겠네.</p>
    </section>

    <section id="reading-example" className="landing-section" aria-labelledby="landing-example-title">
      <div className="landing-section-heading">
        <p className="landing-eyebrow">一 · 먼저, 나를 알아가는 이야기</p>
        <h2 id="landing-example-title">좋은 점도, 서툰 점도<br/>함께 살펴보세.</h2>
        <p>장점만 늘어놓기보다, 어떤 순간에 어떤 모습이 나오는지 풀어 보겠네.</p>
      </div>
      <div className="landing-sample-note"><span>풀이 예시</span><p>아래는 가상의 두 사람, 보라와 도하의 풀이 중 일부라네.</p></div>
      <div className="landing-people">
        {excerpt.people.map(person=><article className="landing-person" key={person.name}>
          <p className="landing-person-name">{person.name}의 성격</p>
          <h3>{person.scene}</h3>
          <p>{person.habit}.</p>
          <div className="landing-watch"><span>조심하면 좋은 점</span><p>{person.risk}.</p></div>
        </article>)}
      </div>
      <p className="landing-footnote">태어난 날의 한 글자만 보지 않고, 해·달·날과 아는 시간을 함께 살펴보네.</p>
    </section>

    <section className="landing-section landing-relationship" aria-labelledby="landing-relationship-title">
      <div className="landing-section-heading">
        <p className="landing-eyebrow">二 · 두 사람이 함께하는 이야기</p>
        <h2 id="landing-relationship-title">어떤 사이인지에 따라<br/>궁금한 것도 다르겠지.</h2>
        <p>아래에서 관계를 골라, 이야기의 한 대목을 읽어 보게.</p>
      </div>
      <div className="landing-relation-picker" role="group" aria-label="관계별 풀이 예시">
        {relationships.map(item=><button key={item.name} type="button" aria-pressed={relation===item.name} aria-controls="landing-relation-example" onClick={()=>setRelation(item.name)}>{item.name}</button>)}
      </div>
      <div id="landing-relation-example" className="landing-relation-example">
        <p className="landing-eyebrow">{active.name}의 이야기 · 풀이 예시</p>
        <h3>{active.title}</h3>
        <p>{active.description}</p>
        <ul className="landing-topics" aria-label={`${active.name} 풀이에서 살펴볼 내용`}>{active.topics.map(topic=><li key={topic}>{topic}</li>)}</ul>
        <div className="landing-gifts">
          <article><h4>보라가 도하에게 줄 수 있는 도움</h4><p>{sampleNames(excerpt.giftMe)}</p></article>
          <article><h4>도하가 보라에게 줄 수 있는 도움</h4><p>{sampleNames(excerpt.giftOther)}</p></article>
        </div>
        <details className="landing-conversation">
          <summary>{relation==='연인'?'서운할 때 나눌 대화도 읽어 보게':'마음이 엇갈릴 때 나눌 대화도 읽어 보게'}</summary>
          <div className="landing-dialogue">{excerpt.conversation.map((line,i)=><p key={i}>{line.replace(/^자네:/,'보라:').replace(/^상대:/,'도하:')}</p>)}</div>
        </details>
        <div className="landing-practice"><span>함께 해 볼 일</span><p>{excerpt.together}</p></div>
      </div>
    </section>

    <section className="landing-section" aria-labelledby="landing-how-title">
      <div className="landing-section-heading"><p className="landing-eyebrow">三 · 서당에 이야기를 맡기는 법</p><h2 id="landing-how-title">생일을 적으면,<br/>이야기가 시작된다네.</h2></div>
      <ol className="landing-how">
        <li><span aria-hidden="true">01</span><h3>나의 생일</h3><p>부를 이름과 생일,<br/>아는 만큼의 시간을 적어 주게.</p></li>
        <li><span aria-hidden="true">02</span><h3>함께 볼 이의 생일</h3><p>상대의 생일을 적고,<br/>두 사람이 어떤 사이인지 알려 주게.</p></li>
        <li><span aria-hidden="true">03</span><h3>두 사람의 이야기</h3><p>각자의 성격과 서로 주는 도움,<br/>함께 지내는 방법을 읽어 보게.</p></li>
      </ol>
      <p className="landing-keep">한번 나눈 이야기는 프로필과 관계 지도에 남겨 두겠네.<br className="landing-desktop-break"/> 다시 읽고 싶은 날, 같은 계정으로 찾아오게.</p>
    </section>

    <section className="landing-section landing-faq" aria-labelledby="landing-faq-title">
      <div className="landing-section-heading"><p className="landing-eyebrow">서당 문 앞에서 궁금한 것들</p><h2 id="landing-faq-title">훈장에게 물어보게.</h2></div>
      {questions.map(([question,answer])=><details key={question}><summary>{question}</summary><p>{answer}</p></details>)}
    </section>
    <footer className="landing-footer"><p>자네와 소중한 이의 마음을,<br/>조금 더 다정하게 알아가는 시간이기를.</p><span>충청북도 괴산의 서당 · 김춘배 훈장</span></footer>
  </div>;
}

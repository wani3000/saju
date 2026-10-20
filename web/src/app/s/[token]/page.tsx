import Link from "next/link";
import { database } from "@/server/db";
import { publicShare } from "@/server/service";
import type { ShareCard } from "@/domain/model";
import { character, shareArtwork } from "@/domain/presentation";
export const dynamic = "force-dynamic";
export default async function Shared({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const card = (await publicShare(await database(), token)) as ShareCard | null;
  const art = card ? shareArtwork(card) : null;
  return (
    <main className="shell shared">
      <Link href="/" className="brand">
        <img className="guide-avatar" src={character.avatar} width={44} height={44} alt="" />
        <span><strong>{character.displayName}</strong><small>{character.setting}</small></span>
      </Link>
      {card ? (
        <>
          <p className="badge">{card.kind === "conversation-only" ? "함께 나누는 대화" : "공유된 예시 카드"}</p>
          {art && <img
            className="hero"
            src={art.src}
            alt={art.alt}
          />}
          <h1>
            {card.aliases[0]} · {card.aliases[1]}<br />
            함께 나누는 이야기
          </h1>
          <h2>{card.reading.title}</h2>
          <section className="card">
            <p>{card.reading.strength}</p>
            <p>{card.reading.advice}</p>
          </section>
          <p className="notice">
            {card.kind === "conversation-only" ? "이 카드는 관계에 맞춘 대화 주제예요. 생년월일·사주 기호·비교 근거와 다른 사람의 정보는 공개하지 않아요." : "이 카드는 고정 예시 문구이며 실제 궁합 분석 결과가 아니에요. 생년월일과 다른 사람의 정보는 공개하지 않아요."}
          </p>
        </>
      ) : (
        <>
          <h1>
            지금은 볼 수 없는
            <br />
            이야기예요
          </h1>
          <p>공유가 철회되었거나, 링크가 만료되었어요.</p>
        </>
      )}
      <p className="hint">{character.displayName} · 조선풍 가상 인물</p>
      <Link className="button" href="/">
        나도 시작하기
      </Link>
    </main>
  );
}

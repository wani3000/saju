import Link from "next/link";
import { database } from "@/server/db";
import { publicShare } from "@/server/service";
import type { ShareCard } from "@/domain/model";
export const dynamic = "force-dynamic";
export default async function Shared({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const card = (await publicShare(await database(), token)) as ShareCard | null;
  return (
    <main className="shell shared">
      <Link href="/" className="brand">
        가까운 사이
      </Link>
      {card ? (
        <>
          <p className="badge">공유된 예시 카드</p>
          <img
            className="hero"
            src="/assets/tigers/pair-v1.png"
            alt="다정하게 기대고 있는 두 아기 호랑이"
          />
          <h1>
            {card.aliases[0]}와<br />
            {card.aliases[1]}의 이야기
          </h1>
          <h2>{card.reading.title}</h2>
          <section className="card">
            <p>{card.reading.strength}</p>
            <p>{card.reading.advice}</p>
          </section>
          <p className="notice">
            이 카드는 고정 예시 문구이며 실제 궁합 분석 결과가 아닙니다.
            생년월일과 다른 사람의 정보는 공개하지 않습니다.
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
      <Link className="button" href="/">
        나도 시작하기
      </Link>
    </main>
  );
}

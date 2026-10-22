"use client";
import { useEffect, useRef, useState } from "react";
import {
  selfGroup,
  publicCard,
  blankPerson,
  type Pair,
  type SavedResult,
} from "@/domain/model";
import PersonForm from "./PersonForm";
import ProfileHistory, {ProfileAvatar,type HistoryOrder} from "./ProfileHistory";
import type {ProfileSummary,ReadingHistoryItem} from "@/domain/profile";
import FixedActions from "./FixedActions";
import IconChevronLeftLine from "@karrotmarket/react-monochrome-icon/IconChevronLeftLine";
import GuideNote from "./GuideNote";
import PersonalityReading from "./PersonalityReading";
import { character, journeyCopy, shareArtwork } from "@/domain/presentation";
import { reviewStoredChart } from "@/domain/chart-review";
import { checkpoint, navigationKey, restoreNavigation } from "@/domain/navigation";
function clearNavigation() {
  try { sessionStorage.removeItem(navigationKey); } catch { /* Storage can be unavailable. */ }
}
type Order = HistoryOrder;
export type State = {
  kind: string;
  authEnabled: boolean;
  authLinked: boolean;
  authRequired?: boolean;
  authenticated?: boolean;
  profile?: ProfileSummary|null;
  readingHistory?: ReadingHistoryItem[];
  draft: Pair | null;
  revision: number;
  free: string;
  results: SavedResult[];
  pending: {
    id: string;
    state: string;
    order_id: string;
    order_state: string;
    amount: number;
    provider: string;
  }[];
  shares: {
    id: string;
    comparison_id: string;
    revoked_at: string | null;
    expires_at: string;
  }[];
  orders: Order[];
  provider: string;
  tossClientKey: string | null;
};
async function serverApi(
  path: string,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
) {
  const res = await fetch(`/api/${path}`, {
    method,
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "요청을 처리하지 못했어요.");
  return data;
}
let boot: Promise<unknown> | undefined;
export default function App({ request: api = serverApi, preview = false, onResetPreview }: {
  request?: typeof serverApi;
  preview?: boolean;
  onResetPreview?: () => void;
} = {}) {
  const [data, setData] = useState<State | null>(null),
    [pair, setPair] = useState<Pair | null>(null);
  const [view, setView] = useState("home"),
    [selected, setSelected] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [saved, setSaved] = useState(""),
    [code, setCode] = useState(""),
    [restore, setRestore] = useState(""),
    [aliases, setAliases] = useState<[string, string]>(["나", "상대방"]),
    [shareLink, setShareLink] = useState(""),
    [mapPage, setMapPage] = useState(0);
  const [authReview, setAuthReview] = useState(false);
  const [editing, setEditing] = useState(false);
  const [navigationReady, setNavigationReady] = useState(false);
  const [eraseConfirmed, setEraseConfirmed] = useState(false);
  const [mapGroup, setMapGroup] = useState("");
  const ownerGeneration = useRef(0);
  const revision = useRef(0),
    saveChain = useRef<Promise<void>>(Promise.resolve()),
    lastSaved = useRef(""),
    requestKey = useRef(""),
    heading = useRef<HTMLHeadingElement>(null);
  const current = data?.results.find((r) => r.id === selected);
  const sharePreview = current ? publicCard(aliases, current.reading) : null;
  const previewArtwork = sharePreview ? shareArtwork(sharePreview) : null;
  const groups = [...new Set((data?.results ?? []).map(selfGroup))];
  const activeGroup = groups.includes(mapGroup) ? mapGroup : groups.at(-1);
  const mapResults = (data?.results ?? []).filter(
    (r) => selfGroup(r) === activeGroup,
  );
  const pageIndex = Math.min(
    mapPage,
    Math.max(0, Math.ceil(mapResults.length / 4) - 1),
  );
  async function refresh(initial = false) {
    const next = (await api("state")) as State;
    setData(next);
    if (initial) {
      const value = next.draft ?? { me: blankPerson(), other: blankPerson() };
      setPair(value);
      revision.current = next.revision;
      lastSaved.current = JSON.stringify(value);
    }
    return next;
  }
  function navigate(next: string, edit = false) {
    if (data?.authRequired && !data.authenticated && !["home","account"].includes(next)) next="account";
    setEditing(edit);
    setError("");
    setNotice("");
    setView(next);
    setTimeout(() => {
      window.scrollTo(0, 0);
      heading.current?.focus();
    }, 0);
  }
  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    let alive = true;
    boot ??= api("session", {});
    boot
      .then(async () => {
        if (!alive) return;
        const initial = await refresh(true);
        const params = new URLSearchParams(window.location.search);
        // The checkpoint is a hint; only the current server-owned state may restore it.
        if (!["auth", "orderId", "paymentReturn", "code"].some(k => params.has(k))) {
          let raw = null;
          try { raw = sessionStorage.getItem(navigationKey); } catch { /* Optional storage. */ }
          const resume = initial.authRequired&&!initial.authenticated ? {view:"home",selected:null,editing:false} : restoreNavigation(raw, initial);
          setSelected(resume.selected);
          navigate(resume.view, resume.editing);
        }
        setNavigationReady(true);
        if (params.has("auth")) {
          const outcome = params.get("auth");
          window.history.replaceState({}, "", window.location.pathname);
          setView(outcome==="complete"&&initial.authenticated?"me":"account");
          setAuthReview(outcome === "review");
          setNotice(
            outcome === "failed"
              ? "로그인을 마치지 못했어요. 다시 시도해 주세요."
              : outcome === "review"
                ? "이미 보관함이 있어요. 아래에서 어떻게 열지 선택해 주세요."
                : outcome==="complete"&&initial.authenticated ? "로그인했네. 이제 두 사람의 생일을 적어 보게." : "로그인 상태를 확인하지 못했네. 다시 시도해 주게.",
          );
        }
        const order = params.get("orderId"),
          key = params.get("paymentKey"),
          amount = params.get("amount");
        if (order && key && amount) {
          window.history.replaceState({}, "", window.location.pathname);
          await act(async () => {
            await api(`orders/${order}/confirm`, {
              paymentKey: key,
              amount: Number(amount),
            });
            await api("process", {});
            await refresh();
            navigate("map");
          });
        } else if (params.has("paymentReturn")) {
          window.history.replaceState({}, "", window.location.pathname);
          await api("process", {});
          await refresh();
          setView("account");
          setNotice(
            "이용 내역에서 결제 상태를 확인해 주세요. 확인 중이면 다시 결제하지 말고 상태 확인을 눌러 주세요.",
          );
        } else if (params.has("code")) {
          window.history.replaceState({}, "", window.location.pathname);
          setError("결제가 완료되지 않았어요. 입력과 주문은 보관했어요.");
          setView("account");
        }
      })
      .catch((e) => {
        boot = undefined;
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (!navigationReady || !data) return;
    try { sessionStorage.setItem(navigationKey, JSON.stringify(checkpoint(view, selected, data, editing))); }
    catch { /* Server storage and the main flow still work without tab storage. */ }
  }, [navigationReady, view, selected, data, editing]);
  async function persist(value: Pair, generation = ownerGeneration.current) {
    if (generation !== ownerGeneration.current || data?.authRequired && !data.authenticated) return;
    const json = JSON.stringify(value);
    if (json === lastSaved.current) return;
    setSaved("저장 중…");
    const task = saveChain.current
      .catch(() => {})
      .then(async () => {
        if (
          generation !== ownerGeneration.current ||
          json === lastSaved.current
        )
          return;
        const res = await api("draft", {
          pair: value,
          revision: revision.current,
        });
        revision.current = res.revision;
        lastSaved.current = json;
        if (generation === ownerGeneration.current)
          setData(current => current ? { ...current, draft: value, revision: res.revision } : current);
        setSaved("입력을 저장했어요");
      });
    saveChain.current = task;
    await task;
  }
  useEffect(() => {
    if (!pair || !data) return;
    setSaved(
      JSON.stringify(pair) === lastSaved.current
        ? "입력을 저장했어요"
        : "입력 중…",
    );
    const generation = ownerGeneration.current;
    const timer = setTimeout(() => {
      persist(pair, generation).catch((e) => {
        setSaved("저장하지 못했어요");
        setError(e.message);
      });
    }, 700);
    return () => clearTimeout(timer);
  }, [pair]);
  useEffect(() => {
    if (!data?.pending.some((p) => ["queued", "processing"].includes(p.state)))
      return;
    const timer = setTimeout(() => {
      act(async () => {
        await api("process", {});
        await refresh();
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, [data]);
  async function start() {
    if (!pair) return;
    await persist(pair);
    requestKey.current ||= crypto.randomUUID();
    const res = await api("comparisons", {
      pair,
      key: requestKey.current,
      intent: "request-reading",
    });
    await api("process", {});
    await refresh();
    setSelected(res.id);
    navigate("result");
  }
  function addPerson() {
    if (!pair) return;
    setPair({ ...pair, other: blankPerson() });
    requestKey.current = "";
    navigate("other");
  }
  async function pay(order: Order) {
    if (order.provider === "mock") {
      await api(`orders/${order.id}/confirm`, {
        paymentKey: `mock_${order.id}`,
        amount: order.amount,
      });
      await api("process", {});
      await refresh();
      setSelected(order.comparison_id);
      navigate("result");
      return;
    }
    if (order.provider === "nicepay-test") {
      const checkout = await api(`orders/${order.id}/prepare`, {});
      const { openNicepay } = await import("./nicepay-client");
      await openNicepay(checkout);
      return;
    }
    if (!data?.tossClientKey)
      throw new Error("Toss 테스트 키가 아직 연결되지 않았어요.");
    const { loadTossPayments } = await import("@tosspayments/tosspayments-sdk");
    const toss = await loadTossPayments(data.tossClientKey);
    await toss.payment({ customerKey: pair!.me.id }).requestPayment({
      method: "CARD",
      amount: { currency: "KRW", value: order.amount },
      orderId: order.id,
      orderName: `${character.displayName} 연구용 테스트`,
      successUrl: window.location.origin + "/",
      failUrl: window.location.origin + "/",
    });
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("복사했어요.");
    } catch {
      setNotice("자동 복사가 어려워요. 아래 내용을 길게 눌러 복사해 주세요.");
    }
  }
  const pending = data?.pending.find((p) => p.id === selected);
  const pendingOrder = data?.orders.find((o) => o.comparison_id === selected);
  const header =
    view === "home"
      ? character.homeTitle
      : (
          {
            me: journeyCopy.me.title,
            other: journeyCopy.other.title,
            review: journeyCopy.review.title,
            result: current
              ? `${current.me.name} · ${current.other.name}`
              : "이야기 준비 상태",
            map: journeyCopy.map.title,
            share: journeyCopy.share.title,
            account: journeyCopy.account.title,
          } as Record<string, string>
        )[view];
  const guide = view === "result" ? (current ? journeyCopy.result.guide : journeyCopy.pending.guide)
    : view === "map" ? (data?.results.length ? journeyCopy.map.guide : journeyCopy.map.empty)
    : ({ me: journeyCopy.me.guide, other: journeyCopy.other.guide, review: journeyCopy.review.guide,
        share: journeyCopy.share.guide, account: journeyCopy.account.guide } as Record<string, string>)[view];
  return (
    <main className={`shell${view === "home" ? " home-shell" : " journey-shell"}${view === "result" ? " result-shell" : ""}`}>
      <header className={`app-header${view === "home" ? " landing-header" : ""}`}>
        {view !== "home" && <button className="icon-button" aria-label="뒤로가기" onClick={() => navigate(editing ? "review" : ({ other: "me", review: "other", share: "result" } as Record<string, string>)[view] ?? "home")}><IconChevronLeftLine size={28} aria-hidden="true" /></button>}
        <button className={`brand${view !== "home" ? " compact-brand" : ""}`} onClick={() => navigate("home")} aria-label={`${character.displayName} 시작 화면`}>
          <img className="guide-avatar" src={character.avatar} width={44} height={44} alt="" />
          <span><strong>{character.displayName}</strong><small>{character.setting}</small></span>
        </button>
        <button className="icon-button profile-button" aria-label="내 프로필" onClick={() => navigate("account")}><ProfileAvatar profile={data?.profile}/></button>
      </header>
      {view !== "home" && <h1 ref={heading} tabIndex={-1}>
        {header}
      </h1>}
      {data && pair && guide && <GuideNote>{guide}</GuideNote>}
      {error && (
        <div className="error" role="alert">
          {error}
          <button
            className="text-button"
            onClick={() => window.location.reload()}
          >
            새로고침
          </button>
        </div>
      )}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      {!data || !pair ? (
        <p role="status">저장된 이야기를 불러오고 있어요…</p>
      ) : (
        <>
          {view === "home" && (
            <>
              <img
                className="home-photo"
                src={character.photo}
                alt={character.photoAlt}
                width={1495}
                height={1052}
                fetchPriority="high"
              />
              <h1 className="home-title" ref={heading} tabIndex={-1}>{character.homeTitle}</h1>
              <p className="home-invitation">{character.invitation}</p>
              <p className="home-step">내 정보부터 차례로 입력해요.</p>
              <span className="seal-window" aria-hidden="true"><img src={character.seal} alt="" /></span>
              <section className="home-information" aria-label="김춘배 훈장 소개">
                <h2>충청북도 괴산의 서당,<br />김춘배 훈장이네.</h2>
                <p>이 작은 서당에서 글을 가르치고,<br />찾아온 이들의 이야기를 듣고 있지.</p>
                <p>자네와 소중한 사람의 생일을 적어 주게.<br />타고난 성정과 함께하는 모습을<br />차근차근 풀어 보겠네.</p>
              </section>
              <FixedActions>
                <button className="primary" disabled={busy} onClick={() => navigate("me")}>
                  {data.authRequired&&!data.authenticated ? "카카오로 시작하기" : data.draft ? "저장한 입력 이어가기" : "두 사람의 생일 적기"}
                </button>
                <button className="secondary" onClick={() => navigate("map")}>나의 관계 지도 보기</button>
              </FixedActions>
            </>
          )}
          {(view === "me" || view === "other") && (
            <>
              <PersonForm
                key={view}
                person={view === "me" ? pair.me : pair.other}
                other={view === "other"}
                busy={busy}
                saved={saved}
                onContinue={() =>
                  act(async () => {
                    await persist(pair);
                    navigate(editing ? "review" : view === "me" ? "other" : "review");
                  })
                }
                onChange={(p) => {
                  setPair({ ...pair, [view === "me" ? "me" : "other"]: p });
                  requestKey.current = "";
                }}
              />
            </>
          )}
          {view === "review" && (
            <>
              <div className="pair-review">
                {[pair.me, pair.other].map((p, i) => (
                  <section className="card" key={p.id}>
                    <p className="person-label">{i ? "상대방" : "나"}</p>
                    <h2>{p.name || "이름을 입력해 주세요"}</h2>
                    <p>
                      {p.calendar === "solar" ? "양력" : "음력"}{" "}
                      {p.leap ? "윤달" : ""}
                      <br />
                      {p.year}.{p.month}.{p.day}
                      <br />
                      {p.timeKnown ? `${p.hour}시 ${p.minute}분` : "시간 모름"}
                    </p>
                    <button
                      className="text-button"
                      onClick={() => navigate(i ? "other" : "me", true)}
                    >
                      수정
                    </button>
                  </section>
                ))}
              </div>
              {data.free !== "available" && data.kind !== "member" && !preview && (
                <button
                  className="secondary"
                  onClick={() => navigate("account")}
                >
                  먼저 복구 코드 만들기
                </button>
              )}
              <FixedActions>
              <button
                className="primary"
                disabled={busy}
                onClick={() => act(start)}
              >
                {busy
                  ? "확인 중…"
                  : data.free === "available"
                    ? "무료 사주 이야기 보기"
                    : "추가 이용 확인하기"}
              </button>
              </FixedActions>
            </>
          )}
          {view === "result" && (
            <>
              {current ? (
                <>
                  <article className="reading-paper" aria-label={current.reading.interpretation ? "두 사람의 사주 성향과 궁합 기록" : "두 사람의 기호 설명 기록"}>
                    <div className="reading-cover">
                      <img src={character.photo} alt={character.photoAlt} width={1495} height={1052} />
                      <div><p className="reading-kicker">서당에서 건네는 기록</p>
                        <h2 className="result-title">{current.reading.interpretation ? "두 사람의 사주 이야기" : current.reading.title}</h2>
                      </div>
                    </div>
                    <p className="badge">{current.reading.label}</p>
                    <p className="notice">
                      {current.reading.basis?.notice ?? "생일로 판단한 궁합 풀이가 아닌 고정 예시예요. 실제 규칙 감수 후 제공할 예정이에요."}
                    </p>
                    {current.reading.interpretation ? <PersonalityReading result={current} /> : [
                      [current.reading.basis ? "두 사람의 기준 오행" : "잘 맞춰 가는 점", current.reading.strength],
                      [current.reading.basis ? "함께 살펴볼 기호" : "서로 알아갈 점", current.reading.difference],
                      ["오늘의 작은 제안", current.reading.advice],
                    ].map(([title, text], index) => (
                      <section className="reading-entry" key={title}>
                        <p className="reading-kicker">{["첫째", "둘째", "셋째"][index]}</p>
                        <h2>{title}</h2>
                        <p>{text}</p>
                        {title === "오늘의 작은 제안" && current.reading.basis && (
                          <p className="hint">{current.reading.basis.adviceNotice}</p>
                        )}
                      </section>
                    ))}
                    <div className="reading-signature">
                      <span className="seal-window" aria-hidden="true"><img src={character.seal} alt="" /></span>
                      <p>{character.displayName}의 서당에서</p>
                      <p className="hint">{current.reading.interpretation ? "사주 상징으로 나누는 성향 이야기" : "점수 없는 기호 설명"}</p>
                    </div>
                  </article>
                  {current.reading.basis && (
                    <details className="card evidence-record">
                      <summary>비교 근거와 확인 범위</summary>
                      {current.reading.basis.cautions.map(text => <p className="hint" key={text}>{text}</p>)}
                      {current.reading.basis.observations.map(f => (
                        <section key={f.id}>
                          <p>{f.text}</p>
                          <p className="hint">기호 정의: 『연해자평』 1926년 판본 PDF {f.source.pdfPage}쪽</p>
                        </section>
                      ))}
                      {current.reading.basis.observations.length === 0 && <p>이번 범위에서 공통으로 확인한 합·충 짝이 없어요. 관계의 좋고 나쁨을 뜻하지 않아요.</p>}
                      {current.reading.basis.omittedDisplayObservations > 0 && <p className="hint">확인된 항목 {current.reading.basis.totalCommonObservations}개 중 {current.reading.basis.observations.length}개를 기호 이름 순으로 표시했어요. 중요도나 점수 순서가 아니에요.</p>}
                    </details>
                  )}
                  <details className="card evidence-record">
                    <summary>생년월일 연구 계산 확인</summary>
                    <p className="hint">
                      운영 검증 전 연구 계산이에요. 절입·과거 표준시 정책은 추가 검토
                      중이며, 시간을 모르면 후보를 함께 남겨요.
                    </p>
                    {Object.entries(current.charts).map(([key, value]) => {
                      const review = reviewStoredChart(value);
                      return (
                        <div key={key}>
                          <h3>{key === "me" ? current.me.name : current.other.name}</h3>
                          {review.solarLabel && <p className="hint">양력 환산: {review.solarLabel}</p>}
                          {review.conventions.map(text => <p className="hint" key={text}>{text}</p>)}
                          {review.warnings.map(text => <p className="notice" key={text}>{text}</p>)}
                          <dl className="pillars review-pillars">
                            {review.pillars.map(p => (
                              <div key={p.key}>
                                <dt>{p.label}</dt>
                                <dd>{p.value}</dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                      );
                    })}
                  </details>
                  <button
                    className="primary"
                    onClick={() => {
                      setAliases(["나", "상대방"]);
                      setShareLink("");
                      navigate("share");
                    }}
                  >
                    {preview ? "공유할 내용 미리보기" : "생일 없이 이야기 공유"}
                  </button>
                  <button className="secondary" onClick={() => navigate("map")}>
                    관계 지도 보기
                  </button>
                  <button className="text-button full" onClick={addPerson}>
                    한 명 더 추가하기
                  </button>
                </>
              ) : pendingOrder && pendingOrder.state === "created" ? (
                <section className="card">
                  <h2>추가 이용 안내</h2>
                  <p className="price">2,900원</p>
                  <p>
                    {pendingOrder.provider === "mock"
                      ? "모의 결제로 흐름을 확인해요."
                      : pendingOrder.provider === "nicepay-test"
                        ? "NICEPAY 테스트 결제창을 열어요."
                        : "Toss 테스트 결제창을 열어요."}
                    <br />
                    실제 청구는 없어요.
                  </p>
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => act(() => pay(pendingOrder))}
                  >
                    {pendingOrder.provider === "mock"
                      ? "모의 결제하고 결과 보기"
                      : pendingOrder.provider === "nicepay-test"
                        ? "NICEPAY 테스트 결제하기"
                        : "Toss 테스트 결제하기"}
                  </button>
                  <button
                    className="text-button full"
                    disabled={busy}
                    onClick={() =>
                      act(async () => {
                        await api(`orders/${pendingOrder.id}/cancel`, {});
                        await refresh();
                        requestKey.current = "";
                        navigate("review");
                      })
                    }
                  >
                    주문 취소하고 돌아가기
                  </button>
                </section>
              ) : (
                <section className="card pending-record">
                  <h2>{pending?.state === "failed" ? "다시 준비할 수 있어요" : "현재 준비 상태"}</h2>
                  <p role="status">
                    {pending?.state === "failed"
                      ? "결과 준비에 실패했어요. 같은 이용권으로 다시 시도할 수 있어요."
                      : pending?.state === "queued" || pending?.state === "processing"
                        ? "사주 이야기를 준비하고 있어요. 잠시 후 상태를 확인해 주세요."
                        : "진행 중인 요청을 확인해 주세요."}
                  </p>
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() =>
                      act(async () => {
                        if (pending?.state === "failed")
                          await api(`comparisons/${pending.id}/retry`, {});
                        if (
                          pendingOrder &&
                          ["confirming", "confirmation_unknown"].includes(
                            pendingOrder.state,
                          )
                        )
                          await api(`orders/${pendingOrder.id}/reconcile`, {});
                        await api("process", {});
                        await refresh();
                      })
                    }
                  >
                    상태 확인하고 이어가기
                  </button>
                </section>
              )}
            </>
          )}
          {view === "map" && (
            <>
              <p>
                이야기를 나눈 사람들을 모았어요.
                <br />
                위치는 보관함의 배치이며 궁합이나 친밀도 순서가 아니에요.
              </p>
              {data.results.length ? (
                <>
                  {groups.length > 1 && (
                    <label>
                      내 정보 기준별 지도
                      <select
                        value={activeGroup}
                        onChange={(e) => {
                          setMapGroup(e.target.value);
                          setMapPage(0);
                        }}
                      >
                        {groups.map((g, i) => {
                          const r = data.results.find(
                            (r) => selfGroup(r) === g,
                          )!;
                          return (
                            <option key={g} value={g}>
                              {i + 1}. {r.me.year}.{r.me.month}.{r.me.day}{" "}
                              {r.me.calendar === "solar" ? "양력" : "음력"}
                              {r.me.leap ? " 윤달" : ""} ·{" "}
                              {r.me.timeKnown
                                ? `${r.me.hour}:${r.me.minute}`
                                : "시간 모름"}
                            </option>
                          );
                        })}
                      </select>
                      <p className="hint">
                        내 출생 정보가 바뀐 전후의 결과는 별도 지도로 보관해요.
                      </p>
                    </label>
                  )}
                  <div className="relationship-map">
                    <div className="map-self">
                      <span>나</span>
                    </div>
                    <div className="map-people">
                      {mapResults
                        .slice(pageIndex * 4, pageIndex * 4 + 4)
                        .map((r) => (
                          <button
                            key={r.id}
                            className="map-person"
                            onClick={() => {
                              setSelected(r.id);
                              navigate("result");
                            }}
                          >
                            <span>{r.other.name}</span>
                          </button>
                        ))}
                    </div>
                  </div>
                  {mapResults.length > 4 && (
                    <div className="row between">
                      <button
                        className="secondary"
                        disabled={pageIndex === 0}
                        onClick={() => setMapPage(pageIndex - 1)}
                      >
                        이전
                      </button>
                      <span>
                        {pageIndex + 1} / {Math.ceil(mapResults.length / 4)}
                      </span>
                      <button
                        className="secondary"
                        disabled={(pageIndex + 1) * 4 >= mapResults.length}
                        onClick={() => setMapPage(pageIndex + 1)}
                      >
                        다음
                      </button>
                    </div>
                  )}
                  <h2>저장된 이야기</h2>
                  {mapResults.map((r) => (
                    <button
                      key={r.id}
                      className="result-row"
                      onClick={() => {
                        setSelected(r.id);
                        navigate("result");
                      }}
                    >
                      <span>
                        <strong>{r.other.name}</strong>
                        <small>
                          {r.other.relation} · {r.me.name}의 당시 정보 기준
                        </small>
                      </span>
                      <span aria-hidden>↗</span>
                    </button>
                  ))}
                </>
              ) : (
                <section className="card">
                  <img
                    className="result-hero"
                    src={character.photo}
                    alt={character.photoAlt}
                  />
                  <p>아직 저장된 이야기가 없어요.</p>
                </section>
              )}
              {data.pending.length > 0 && (
                <>
                  <h2>진행 중인 이야기</h2>
                  {data.pending.map((p) => (
                    <button
                      className="result-row"
                      key={p.id}
                      onClick={() => {
                        setSelected(p.id);
                        navigate("result");
                      }}
                    >
                      <span>
                        {p.order_id ? "추가 이용" : "무료 결과"} 이어가기
                      </span>
                      <span>→</span>
                    </button>
                  ))}
                </>
              )}
              <button
                className="primary"
                onClick={() =>
                  data.results.length ? addPerson() : navigate("me")
                }
              >
                {data.results.length
                  ? "한 명 더 추가하기"
                  : "첫 이야기 시작하기"}
              </button>
            </>
          )}
          {view === "share" && current && (
            <>
              <p>
                {preview ? "임시 체험판은 공유할 내용만 미리 볼 수 있어요. 공개 링크는 만들지 않아요." : "링크를 아는 사람은 누구나 볼 수 있어요."}
                <br />
                생일과 다른 사람의 목록은 공개하지 않아요.
              </p>
              <section className="card share-preview">
                <span className="badge">공개 미리보기 · {sharePreview?.kind === "conversation-only" ? "대화 주제" : "예시"}</span>
                {previewArtwork && <img
                  className="result-hero"
                  src={previewArtwork.src}
                  alt={previewArtwork.alt}
                />}
                {aliases.map((name, i) => (
                  <label key={i}>
                    공개용 {i ? "상대" : "내"} 별명
                    <input
                      maxLength={10}
                      value={name}
                      onChange={(e) => {
                        const next: [string, string] = [...aliases];
                        next[i] = e.target.value;
                        setAliases(next);
                        setShareLink("");
                      }}
                    />
                  </label>
                ))}
                <h2>{sharePreview?.reading.title}</h2>
                <p>{sharePreview?.reading.strength}</p>
                <p>{sharePreview?.reading.advice}</p>
                <p className="hint">
                  {sharePreview?.kind === "conversation-only" ? "대화 주제만 나누는 카드예요. 생년월일·사주 기호·비교 근거는 공개하지 않아요." : "실제 궁합 분석이 아닌 고정 예시 카드예요."}
                </p>
              </section>
              <button
                className="primary"
                disabled={preview || busy || aliases.some((x) => !x.trim())}
                onClick={() =>
                  act(async () => {
                    const out = await api(`results/${current.id}/shares`, {
                      aliases,
                    });
                    setShareLink(window.location.origin + out.path);
                    await refresh();
                  })
                }
              >
                {preview ? "공개 공유는 정식 연결 후 제공해요" : "이 내용으로 30일 공유 링크 만들기"}
              </button>
              {shareLink && (
                <section className="card">
                  <p>
                    현재 링크는 이 개발 서버에 접속할 수 있는 환경에서만 열려요.
                  </p>
                  <label>
                    공유 링크
                    <input readOnly value={shareLink} />
                  </label>
                  <button
                    className="secondary"
                    onClick={() => act(() => copy(shareLink))}
                  >
                    링크 복사
                  </button>
                  <a
                    className="button secondary"
                    href={shareLink}
                    target="_blank"
                    rel="noreferrer"
                  >
                    공유 화면 열기
                  </a>
                </section>
              )}
              <h2>발급한 링크</h2>
              {data.shares
                .filter((s) => s.comparison_id === current.id)
                .map((s) => (
                  <section className="card" key={s.id}>
                    <p>
                      {s.revoked_at
                        ? "공유 철회됨"
                        : `${new Date(s.expires_at).toLocaleDateString("ko-KR")}까지`}
                    </p>
                    {!s.revoked_at && (
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() =>
                          act(async () => {
                            await api(`shares/${s.id}`, undefined, "DELETE");
                            setShareLink("");
                            await refresh();
                            setNotice(
                              "링크를 철회했어요. 이미 복사한 내용까지 지워지지는 않아요.",
                            );
                          })
                        }
                      >
                        이 링크 철회하기
                      </button>
                    )}
                  </section>
                ))}
            </>
          )}
          {view === "account" && (preview || !data.authRequired || data.authenticated) && <ProfileHistory
            profile={data.profile} preview={preview} readings={data.readingHistory??[]} orders={data.orders} busy={busy}
            onOpen={id=>{setSelected(id);navigate("result");}}
            onOrder={(order,action)=>{if(action==="open"){setSelected(order.comparison_id);navigate("result");return;}void act(async()=>{
              await api(`orders/${order.id}/${action}`,{});if(action==="reconcile")await api("process",{});await refresh();
              if(action==="refund")setNotice("테스트 취소를 확인했네. 해당 이야기의 열람을 중단했네.");
            });}}
          />}
          {view === "account" && preview && (
            <section className="card">
              <h2>나의 체험 기록</h2>
              <p>이곳에서 만든 이야기를 다시 볼 수 있어요. 기록을 지우면 처음부터 둘러볼 수 있어요.</p>
              <p>카카오 로그인과 실제 결제는 준비 중일세.</p>
              <button className="kakao-login" aria-label="카카오 로그인" disabled><img src="/assets/kakao/login-complete-ko.svg" alt="" width={224} height={46}/></button>
              <button className="primary" onClick={()=>navigate("me")}>로그인 없이 체험하기</button>
              <button className="secondary" onClick={onResetPreview}>체험 기록 초기화</button>
            </section>
          )}
          {view === "account" && !preview && (
            <>
              <section className="card">
                <h2>{data.authenticated?"카카오로 연결된 계정":"카카오로 시작하기"}</h2>
                {!data.authenticated && (
                  <button
                    className="kakao-login"
                    aria-label="카카오 로그인"
                    disabled={busy || !data.authEnabled}
                    onClick={() =>
                      act(async () => {
                        if (pair && !data.authRequired) await persist(pair);
                        const r = await api("auth/start", {});
                        window.location.assign(r.url);
                      })
                    }
                  >
                    <img src="/assets/kakao/login-complete-ko.svg" alt="" width={224} height={46}/>
                  </button>
                )}
                {data.authenticated && <p>카카오로 로그인했네. 다른 기기에서도 같은 계정으로 기록을 열 수 있네.</p>}
                {!data.authEnabled && (
                  <p className="hint">카카오 로그인 연결을 준비하고 있어요.</p>
                )}
                {authReview && (
                  <section className="card">
                    <h3>기존 보관함을 찾았어요</h3>
                    <p>
                      합치기는 내 생일이 같은 경우에만 가능해요. 기존 보관함만
                      열면 현재 내용은 여기에 남아요.
                    </p>
                    {(["merge", "switch"] as const).map((choice) => (
                      <button
                        key={choice}
                        className="secondary"
                        disabled={busy}
                        onClick={() =>
                          act(async () => {
                            ownerGeneration.current++;
                            await saveChain.current.catch(() => {});
                            await api("auth/finish", { choice });
                            clearNavigation();
                            window.location.assign("/");
                          })
                        }
                      >
                        {choice === "merge"
                          ? "내용을 합쳐서 열기"
                          : "기존 보관함만 열기"}
                      </button>
                    ))}
                  </section>
                )}
              </section>
              {!data.authRequired && <>
              <section className="card">
                <p>
                  현재 브라우저에서 30일 동안 다시 볼 수 있어요. 복구 코드를
                  보관하면 다른 브라우저에서도 이 보관함을 열 수 있어요.
                </p>
                <p className="hint">
                  개발용 복구 방식이에요. 코드를 아는 사람은 보관함 전체에
                  접근할 수 있으니 다른 사람에게 보내지 마세요.
                </p>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() =>
                    act(async () => {
                      const r = await api("recovery-code", {});
                      setCode(r.code);
                      await refresh();
                    })
                  }
                >
                  {data.kind === "member"
                    ? "복구 코드 다시 발급 (이전 코드 만료)"
                    : "복구 코드 만들기"}
                </button>
                {code && (
                  <>
                    <label htmlFor="recovery-code">지금 한 번만 표시되는 복구 코드</label>
                    <textarea id="recovery-code" readOnly value={code} />
                    <button
                      className="text-button"
                      onClick={() => act(() => copy(code))}
                    >
                      코드 복사
                    </button>
                    <button
                      className="primary"
                      onClick={() => {
                        setCode("");
                        navigate("review");
                      }}
                    >
                      보관했어요 · 입력으로 돌아가기
                    </button>
                  </>
                )}
              </section>
              <section className="card">
                <h2>다른 보관함 불러오기</h2>
                <p>
                  현재 보관함과 합치지 않고 전환해요. 현재 이야기를 다시 열려면
                  먼저 위에서 복구 코드를 보관해 주세요.
                </p>
                <label>
                  복구 코드
                  <input
                    type="password"
                    autoComplete="off"
                    value={restore}
                    onChange={(e) => setRestore(e.target.value)}
                  />
                </label>
                <button
                  className="secondary"
                  disabled={busy || !restore}
                  onClick={() =>
                    act(async () => {
                      ownerGeneration.current++;
                      await saveChain.current.catch(() => {});
                      await api("recover", { code: restore });
                      clearNavigation();
                      setSelected(null);
                      setShareLink("");
                      setAliases(["나", "상대방"]);
                      setRestore("");
                      setCode("");
                      requestKey.current = "";
                      await refresh(true);
                      navigate("map");
                    })
                  }
                >
                  코드로 보관함 전환
                </button>
              </section>
              </>}
              {(!data.authRequired || data.authenticated) && <>
              <section className="card">
                <h2>이 브라우저에서 나가기</h2>
                <p>{data.authRequired?"다시 들어올 때는 카카오로 로그인해 주게.":"다시 들어오려면 로그인 연결이나 복구 코드가 필요해요."}</p>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() =>
                    act(async () => {
                      ownerGeneration.current++;
                      await saveChain.current.catch(() => {});
                      await api("logout", {});
                      clearNavigation();
                      window.location.assign("/");
                    })
                  }
                >
                  보관함에서 나가기
                </button>
              </section>
              <section className="card">
                <h2>내 정보 지우기</h2>
                <p>
                  입력한 생일, 결과와 공유 링크를 지워요. 복구 코드로도 되돌릴
                  수 없어요. 주문·동의·무료 이용 기록은 남으며 삭제가 환불을
                  뜻하지는 않아요. 카카오와 Supabase 계정의 연결 해제는 별도로 준비 중이에요.
                </p>
                <label>
                  <input
                    type="checkbox"
                    checked={eraseConfirmed}
                    onChange={(e) => setEraseConfirmed(e.target.checked)}
                  />{" "}
                  내용을 확인했고 내 정보를 지울게요
                </label>
                <button
                  className="secondary"
                  disabled={busy || !eraseConfirmed}
                  onClick={() =>
                    act(async () => {
                      ownerGeneration.current++;
                      await saveChain.current.catch(() => {});
                      await api("account", undefined, "DELETE");
                      clearNavigation();
                      window.location.assign("/");
                    })
                  }
                >
                  내 정보 삭제
                </button>
              </section>
              </> }
              <section className="card">
                <h2>이 연구 체험에 대해</h2>
                <p>
                  이곳은 연구용 체험이에요. 궁합 규칙 감수와 실결제는 아직 준비 중이에요.
                  중요한 판단에는 이 연구 결과를 사용하지 않도록 해 주세요.
                </p>
              </section>
            </>
          )}
        </>
      )}
      {view !== "home" && <footer>{character.displayName}의 서당에서</footer>}
    </main>
  );
}

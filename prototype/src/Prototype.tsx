import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { MotionConfig } from "motion/react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CaretRightIcon,
  CheckIcon,
  CopyIcon,
  HeartIcon,
  HouseIcon,
  InfoIcon,
  ListBulletsIcon,
  MapTrifoldIcon,
  PencilSimpleIcon,
  PlantIcon,
  PlusIcon,
  ShareNetworkIcon,
} from "@phosphor-icons/react";
import {
  BottomSheet,
  FlowStack,
  KeyboardInput,
  MobileScroll,
  useFlow,
  useKeyboard,
  useScreenPortal,
  type FlowScreen,
} from "./mobile";
import {
  birthLabel,
  blankPerson,
  samplePerson,
  shareText,
  snapshotPerson,
  validatePerson,
  type PersonDraft,
  type PreviewResult,
} from "./model";
import "@fontsource/jua";
import "@fontsource/noto-sans-kr/400.css";
import "@fontsource/noto-sans-kr/500.css";
import "@fontsource/noto-sans-kr/700.css";
import "./prototype.css";

type Store = {
  me: PersonDraft;
  setMe: (p: PersonDraft) => void;
  other: PersonDraft;
  setOther: (p: PersonDraft) => void;
  results: PreviewResult[];
  setResults: React.Dispatch<React.SetStateAction<PreviewResult[]>>;
  selected: string | null;
  setSelected: (id: string) => void;
  editReturn: boolean;
  setEditReturn: (v: boolean) => void;
};
const StoreContext = createContext<Store | null>(null);
function useStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error("Missing store");
  return value;
}
const asset = (name: string) => `/assets/tigers/${name}-v1.png`;
function SajuInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const keyboard = useKeyboard();
  return (
    <KeyboardInput
      {...props}
      onBlur={(event) => {
        props.onBlur?.(event);
        const next = event.relatedTarget;
        if (!(
          next instanceof HTMLInputElement ||
          next instanceof HTMLTextAreaElement
        ))
          keyboard.hide();
      }}
    />
  );
}
function Avatar({
  cream = false,
  className = "",
}: {
  cream?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <HeartIcon
      aria-hidden
      weight="fill"
      className={`avatar fallback ${className}`}
    />
  ) : (
    <img
      className={`avatar ${className}`}
      src={asset(cream ? "cream" : "orange")}
      alt=""
      onError={() => setFailed(true)}
    />
  );
}
function Pair({ className = "" }: { className?: string }) {
  return (
    <img
      className={`tiger-pair ${className}`}
      src={asset("pair")}
      alt="볼을 맞대고 웃는 아기 호랑이 두 마리"
    />
  );
}
function Brand() {
  return (
    <span className="brand">
      <PlantIcon weight="fill" aria-hidden />
      <span>가까운 사이</span>
    </span>
  );
}
function Primary({
  children,
  onClick,
  type = "button",
  disabled = false,
  buttonRef,
}: {
  buttonRef?: React.Ref<HTMLButtonElement>;
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      ref={buttonRef}
      className="primary"
      type={type}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
function Note({ children }: { children: ReactNode }) {
  return (
    <div className="notice">
      <InfoIcon aria-hidden weight="fill" />
      <span>{children}</span>
    </div>
  );
}
function Page({
  id,
  children,
  className = "",
}: {
  id: string;
  children: ReactNode;
  className?: string;
}) {
  const flow = useFlow();
  const [active, setActive] = useState(false);
  const guard = useRef<HTMLDivElement>(null);
  const main = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    setActive(
      guard.current
        ?.closest("[data-flow-current]")
        ?.getAttribute("data-flow-current") === "true",
    );
  }, [flow.current.key]);
  useEffect(() => {
    if (active && id !== "home") main.current?.focus({ preventScroll: true });
  }, [active, id]);
  return (
    <div
      ref={guard}
      className="page-guard"
      inert={!active}
      aria-hidden={!active || undefined}
    >
      <MobileScroll className="saju-scroll">
        <main ref={main} tabIndex={-1} className={`page-content ${className}`}>
          {children}
        </main>
      </MobileScroll>
    </div>
  );
}
function Header({ title }: { title: string }) {
  const flow = useFlow();
  const keyboard = useKeyboard();
  return (
    <div className="toolbar">
      <button className="icon-button" aria-label="뒤로 가기" onClick={flow.pop}>
        <ArrowLeftIcon size={23} />
      </button>
      <span>{title}</span>
      {keyboard.visible ? (
        <button
          key="keyboard-done"
          className="text-button"
          onPointerDown={(event) => event.preventDefault()}
          onClick={keyboard.hide}
        >
          입력 완료
        </button>
      ) : (
        <button
          key="home"
          className="icon-button"
          aria-label="처음으로"
          onClick={() => flow.push(screens.home)}
        >
          <HouseIcon size={23} />
        </button>
      )}
    </div>
  );
}
const screen = (
  id: string,
  title: string,
  component: ReactNode,
): FlowScreen => ({
  id,
  title,
  headerHeight: 54,
  header: () => <Header title={title} />,
  render: () => component,
});
const screens = {
  home: { id: "home", render: () => <Home /> } satisfies FlowScreen,
  me: screen("me", "내 정보", <PersonForm who="me" />),
  other: screen("other", "상대 정보", <PersonForm who="other" />),
  review: screen("review", "입력 확인", <Review />),
  result: screen("result", "우리 궁합", <Result />),
  map: screen("map", "내 지도", <MapPage />),
  share: screen("share", "공유 미리보기", <SharePage />),
};
function Steps({ current }: { current?: number }) {
  return (
    <ol className="steps" aria-label="궁합 확인 순서">
      {["내 정보", "상대 정보", "우리 궁합"].map((label, i) => (
        <li key={label} aria-current={current === i + 1 ? "step" : undefined}>
          <span>{i + 1}</span>
          <b>{label}</b>
        </li>
      ))}
    </ol>
  );
}
function Home() {
  const flow = useFlow();
  const store = useStore();
  const start = () => {
    store.setEditReturn(false);
    if (store.results.length) store.setOther(blankPerson());
    flow.push(store.results.length ? screens.other : screens.me);
  };
  return (
    <Page id="home" className="home">
      <header className="home-header">
        <Brand />
        <button className="map-link" onClick={() => flow.push(screens.map)}>
          내 지도 <CaretRightIcon aria-hidden />
        </button>
      </header>
      <Pair className="home-hero" />
      <h1>
        나와 이 사람,
        <br />
        어떤 사이일까요?
      </h1>
      <p className="home-subtitle">
        생년월일로 알아보는
        <br />
        우리 사이의 좋은 점
      </p>
      <Steps />
      <Primary onClick={start}>
        {store.results.length ? "한 명 더 알아보기" : "첫 상대 무료로 보기"}{" "}
        <CaretRightIcon weight="bold" aria-hidden />
      </Primary>
      <p className="price-note">다음 상대부터 1명당 2,900원</p>
    </Page>
  );
}
function PersonForm({ who }: { who: "me" | "other" }) {
  const store = useStore();
  const flow = useFlow();
  const keyboard = useKeyboard();
  const other = who === "other";
  const formId = useId();
  const person = store[who];
  const setPerson = other ? store.setOther : store.setMe;
  const [errors, setErrors] = useState<Record<string, string>>({});
  const errorRef = useRef<HTMLDivElement>(null);
  const update = (key: keyof PersonDraft, value: string | boolean) => {
    setPerson({
      ...person,
      [key]: value,
      ...(key === "calendar" && value === "solar" ? { leap: false } : {}),
    });
    setErrors({});
  };
  useEffect(() => {
    if (Object.keys(errors).length) {
      keyboard.hide();
      errorRef.current?.focus({ preventScroll: true });
      const scroll = errorRef.current?.closest(".mobile-scroll");
      if (scroll instanceof HTMLElement && errorRef.current)
        scroll.scrollTop +=
          errorRef.current.getBoundingClientRect().top -
          scroll.getBoundingClientRect().top -
          12;
    }
  }, [errors]);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = validatePerson(person);
    setErrors(next);
    if (Object.keys(next).length) return;
    setPerson(snapshotPerson(person));
    if (store.editReturn) {
      store.setEditReturn(false);
      flow.pop();
    } else flow.push(other ? screens.review : screens.other);
  };
  const num = (
    key: "year" | "month" | "day" | "hour" | "minute",
    label: string,
    placeholder: string,
    group: string,
  ) => (
    <label className="number-field">
      <span>{label}</span>
      <SajuInput
        id={`${formId}-${key}`}
        aria-invalid={Boolean(errors[group])}
        aria-describedby={
          errors[group] ? `${formId}-${group}-error` : undefined
        }
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        maxLength={key === "year" ? 4 : 2}
        value={person[key]}
        onChange={(e) => update(key, e.target.value.replace(/[^0-9]/g, ""))}
      />
    </label>
  );
  return (
    <Page id={who} className="form-page">
      <div className="form-heading">
        <div>
          <span className="eyebrow">{other ? "2" : "1"} / 3</span>
          <h1>
            {other
              ? "알아보고 싶은\n사람이 있나요?"
              : "먼저, 나를\n알려 주세요."}
          </h1>
        </div>
        <Avatar cream={other} />
      </div>
      <p className="muted">
        {other
          ? "상대가 동의한 정보와 별명을 사용해 주세요."
          : "내 정보는 한 번만 입력하면 돼요."}
      </p>
      <Note>
        미리보기에서는 가상 정보를 사용해 주세요. 새로고침하면 입력이 사라져요.
      </Note>
      <button
        className="text-button sample-fill"
        onClick={() => {
          setPerson(samplePerson(other));
          setErrors({});
        }}
      >
        가상 정보로 채우기 <ArrowRightIcon aria-hidden />
      </button>
      <form onSubmit={submit} noValidate>
        <div
          ref={errorRef}
          tabIndex={-1}
          role={Object.keys(errors).length ? "alert" : undefined}
        >
          {Object.keys(errors).length ? (
            <p className="error-summary">입력한 내용을 확인해 주세요.</p>
          ) : null}
        </div>
        <label className="field-label" htmlFor={`${formId}-name`}>
          별명
        </label>
        <SajuInput
          id={`${formId}-name`}
          className="text-input"
          autoComplete="off"
          value={person.name}
          maxLength={10}
          placeholder={other ? "예: 하루" : "예: 나래"}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? `${formId}-name-error` : undefined}
          onChange={(e) => update("name", e.target.value)}
        />
        {errors.name ? (
          <p id={`${formId}-name-error`} className="field-error">
            {errors.name}
          </p>
        ) : null}
        <fieldset>
          <legend>생년월일</legend>
          <div className="segments" aria-label="달력 구분">
            {(["solar", "lunar"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={person.calendar === v}
                onClick={() => update("calendar", v)}
              >
                {person.calendar === v ? <CheckIcon aria-hidden /> : null}
                {v === "solar" ? "양력" : "음력"}
              </button>
            ))}
          </div>
          {person.calendar === "lunar" ? (
            <>
              <button
                type="button"
                className="check-control"
                role="checkbox"
                aria-checked={person.leap}
                onClick={() => update("leap", !person.leap)}
              >
                <span>{person.leap ? <CheckIcon aria-hidden /> : null}</span>
                윤달에 태어났어요
              </button>
              <p className="helper">
                음력·윤달의 실제 날짜 확인은 정식 계산에서 제공해요. 지금은 입력
                흐름만 체험해요.
              </p>
            </>
          ) : null}
          <div className="date-fields">
            {num("year", "연도", "1990", "date")}
            {num("month", "월", "3", "date")}
            {num("day", "일", "12", "date")}
          </div>
          <p className="helper">1908년부터 · 국내 출생 기준</p>
          {errors.date ? (
            <p id={`${formId}-date-error`} className="field-error">
              {errors.date}
            </p>
          ) : null}
        </fieldset>
        <fieldset>
          <legend>태어난 시간</legend>
          <div className="segments">
            {[false, true].map((v) => (
              <button
                type="button"
                key={String(v)}
                aria-pressed={person.timeKnown === v}
                onClick={() => update("timeKnown", v)}
              >
                {person.timeKnown === v ? <CheckIcon aria-hidden /> : null}
                {v ? "알아요" : "몰라요"}
              </button>
            ))}
          </div>
          {person.timeKnown ? (
            <>
              <div className="time-fields">
                {num("hour", "시 (24시간)", "14", "time")}
                {num("minute", "분", "30", "time")}
              </div>
              {errors.time ? (
                <p id={`${formId}-time-error`} className="field-error">
                  {errors.time}
                </p>
              ) : null}
            </>
          ) : (
            <p className="helper">
              괜찮아요. 시간은 모르는 상태로 남겨 둘게요.
            </p>
          )}
        </fieldset>
        {other ? (
          <fieldset>
            <legend>어떤 사이인가요?</legend>
            <div className="relation-options">
              {["친구", "연인", "가족", "동료", "그 외"].map((v) => (
                <button
                  type="button"
                  key={v}
                  aria-pressed={person.relation === v}
                  onClick={() => update("relation", v)}
                >
                  {v}
                </button>
              ))}
            </div>
          </fieldset>
        ) : null}
        <Primary type="submit">
          {store.editReturn
            ? "수정 완료"
            : other
              ? "입력 내용 확인하기"
              : "상대 정보 입력하기"}{" "}
          <CaretRightIcon aria-hidden />
        </Primary>
      </form>
    </Page>
  );
}
function PersonSummary({
  person,
  label,
  cream,
  edit,
}: {
  person: PersonDraft;
  label: string;
  cream?: boolean;
  edit?: () => void;
}) {
  return (
    <div className="person-summary">
      <Avatar cream={cream} />
      <div>
        <span className="helper">{label}</span>
        <h3>{person.name}</h3>
        <p>{birthLabel(person)}</p>
        <p>
          {person.timeKnown
            ? `${person.hour.padStart(2, "0")}:${person.minute.padStart(2, "0")} 출생`
            : "태어난 시간 모름"}
        </p>
      </div>
      {edit ? (
        <button
          className="icon-button"
          onClick={edit}
          aria-label={`${label} 수정`}
        >
          <PencilSimpleIcon />
        </button>
      ) : null}
    </div>
  );
}
function Review() {
  const store = useStore();
  const flow = useFlow();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const submitting = useRef(false);
  const actionRef = useRef<HTMLButtonElement>(null);
  const sheetWasOpened = useRef(false);
  const { screenRef } = useScreenPortal();
  useEffect(() => {
    if (paymentOpen) {
      sheetWasOpened.current = true;
      return;
    }
    const frame = screenRef.current;
    if (!sheetWasOpened.current || !frame) return;
    const observer = new MutationObserver(() => {
      if (!frame.querySelector('[data-testid="bottom-sheet"]')) {
        actionRef.current?.focus({ preventScroll: true });
        observer.disconnect();
      }
    });
    observer.observe(frame, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [paymentOpen, screenRef]);
  const already = store.results.find((r) => r.other.id === store.other.id);
  const paid = store.results.length > 0 && !already;
  const create = () => {
    if (submitting.current) return;
    submitting.current = true;
    const id = already?.id ?? crypto.randomUUID();
    if (!already)
      store.setResults((prev) => [
        ...prev,
        {
          id,
          me: snapshotPerson(store.me),
          other: snapshotPerson(store.other),
        },
      ]);
    store.setSelected(id);
    setPaymentOpen(false);
    flow.replace(screens.result);
  };
  const edit = (who: "me" | "other") => {
    store.setEditReturn(true);
    flow.push(screens[who]);
  };
  return (
    <Page id="review">
      <span className="eyebrow">마지막으로 확인해요</span>
      <h1>
        두 사람의 정보가
        <br />
        맞나요?
      </h1>
      <p className="muted">생일과 태어난 시간을 한 번 더 확인해 주세요.</p>
      <PersonSummary
        person={store.me}
        label="내 정보"
        edit={() => edit("me")}
      />
      <PersonSummary
        person={store.other}
        label="상대 정보"
        cream
        edit={() => edit("other")}
      />
      <div className="price-row">
        <span>{paid ? "추가 상대 1명" : "첫 상대 1명"}</span>
        <strong>{paid ? "2,900원" : "무료"}</strong>
      </div>
      <Note>
        지금은 화면 미리보기예요. 입력한 생일로 사주를 계산하지 않으며, 모든
        결과는 동일한 예시예요.
      </Note>
      <Primary
        buttonRef={actionRef}
        onClick={paid ? () => setPaymentOpen(true) : create}
      >
        {paid ? "추가 이용 안내 보기" : "무료 예시 결과 보기"}{" "}
        <CaretRightIcon aria-hidden />
      </Primary>
      <BottomSheet
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        title="한 명 더 알아보기"
        description="정식 서비스에서는 상대 한 명당 2,900원이에요."
        snap={0.64}
      >
        <div className="saju-sheet">
          <Avatar cream />
          <h2>지금은 무료로 체험해요</h2>
          <p>결제는 진행되지 않아요. 예시 결과를 지도에 추가해 볼 수 있어요.</p>
          <Primary onClick={create}>결제 없이 예시 추가</Primary>
          <button className="secondary" onClick={() => setPaymentOpen(false)}>
            돌아가기
          </button>
        </div>
      </BottomSheet>
    </Page>
  );
}
function useSelected() {
  const store = useStore();
  return (
    store.results.find((r) => r.id === store.selected) ?? store.results.at(-1)
  );
}
function Result() {
  const result = useSelected();
  const flow = useFlow();
  if (!result)
    return (
      <Page id="result">
        <h1>아직 결과가 없어요</h1>
        <Primary onClick={() => flow.push(screens.me)}>처음 궁합 보기</Primary>
      </Page>
    );
  return (
    <Page id="result" className="result-page">
      <span className="sample-label">예시 결과</span>
      <p className="result-names">
        {result.me.name} 님과 {result.other.name} 님
      </p>
      <h1>
        함께라서 더 포근한
        <br />
        우리 사이
      </h1>
      <Pair className="result-hero" />
      <Note>
        입력한 생일을 분석한 결과가 아니에요. 화면을 살펴보기 위한 예시
        문구예요.
      </Note>
      <section className="reading">
        <div className="reading-title">
          <HeartIcon weight="fill" />
          <h2>우리 사이의 좋은 점</h2>
        </div>
        <p>
          작은 일도 함께 나누면 즐거움이 커져요. 서로의 이야기에 귀 기울이는
          시간이 좋은 기억이 될 수 있어요.
        </p>
        <div className="reading-title">
          <PlantIcon weight="fill" />
          <h2>조금 다를 수 있는 점</h2>
        </div>
        <p>
          마음을 표현하는 속도는 다를 수 있어요. 바로 답이 없더라도 조금 기다려
          주세요.
        </p>
        <div className="reading-title">
          <HeartIcon />
          <h2>더 가까워지는 작은 방법</h2>
        </div>
        <p>
          오늘 좋았던 일 하나를 나눠 보세요. 해결책보다 “그랬구나” 한마디가 더
          따뜻할 때도 있어요.
        </p>
      </section>
      <button className="secondary" onClick={() => flow.push(screens.share)}>
        <ShareNetworkIcon /> 이 궁합 공유하기
      </button>
      <RelationshipMap compact />
      <AddPerson />
      <p className="helper center">
        기존 예시 결과는 무료로 다시 볼 수 있어요.
      </p>
    </Page>
  );
}
function AddPerson() {
  const store = useStore();
  const flow = useFlow();
  return (
    <Primary
      onClick={() => {
        store.setOther(blankPerson());
        store.setEditReturn(false);
        flow.push(store.results.length ? screens.other : screens.me);
      }}
    >
      <PlusIcon aria-hidden />
      {store.results.length ? "한 명 더 추가하기" : "첫 상대 무료로 보기"}
    </Primary>
  );
}
function RelationshipMap({ compact = false }: { compact?: boolean }) {
  const store = useStore();
  const flow = useFlow();
  const [mode, setMode] = useState<"map" | "list">("map");
  const [page, setPage] = useState(0);
  const perPage = 4;
  const pageCount = Math.ceil(store.results.length / perPage);
  const visible = store.results.slice(page * perPage, (page + 1) * perPage);
  const open = (id: string) => {
    store.setSelected(id);
    if (flow.current.id === "result") flow.replace(screens.result);
    else flow.push(screens.result);
  };
  return (
    <section className={`relationship-section ${compact ? "compact-map" : ""}`}>
      <div className="section-heading">
        <h2>가까운 사람 지도</h2>
        <span>{store.results.length}명</span>
      </div>
      <p className="helper">
        예시 배치예요. 실제 궁합 거리나 친밀도를 나타내지 않아요.
      </p>
      {!store.results.length ? (
        <div className="empty-map">
          <Avatar />
          <h2>나의 첫 인연을 담아 볼까요?</h2>
          <p>
            궁합을 살펴본 사람들이
            <br />
            이곳에 하나씩 모여요.
          </p>
        </div>
      ) : (
        <>
          <div className="segments map-toggle">
            <button
              aria-pressed={mode === "map"}
              onClick={() => setMode("map")}
            >
              <MapTrifoldIcon />
              지도
            </button>
            <button
              aria-pressed={mode === "list"}
              onClick={() => setMode("list")}
            >
              <ListBulletsIcon />
              목록
            </button>
          </div>
          {mode === "map" ? (
            <>
              <div className="relationship-map">
                <div className="map-self">
                  <Avatar />
                  <strong>
                    {store.me.name || "나"}
                    <small>나</small>
                  </strong>
                </div>
                <div className="map-people">
                  {visible.map((r) => (
                    <button
                      className="map-person"
                      key={r.id}
                      onClick={() => open(r.id)}
                      aria-label={`${r.other.name} ${r.other.relation} 예시 결과 보기`}
                    >
                      <Avatar cream />
                      <strong>{r.other.name}</strong>
                      <span>{r.other.relation}</span>
                    </button>
                  ))}
                </div>
              </div>
              {pageCount > 1 ? (
                <div className="pagination">
                  <button
                    className="text-button"
                    disabled={page === 0}
                    onClick={() => setPage((v) => v - 1)}
                  >
                    이전
                  </button>
                  <span>
                    {page + 1} / {pageCount}
                  </span>
                  <button
                    className="text-button"
                    disabled={page === pageCount - 1}
                    onClick={() => setPage((v) => v + 1)}
                  >
                    다음
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <ul className="people-list">
              {store.results.map((r) => (
                <li key={r.id}>
                  <button onClick={() => open(r.id)}>
                    <Avatar cream />
                    <span>
                      <strong>{r.other.name}</strong>
                      <small>{r.other.relation} · 예시 결과</small>
                    </span>
                    <CaretRightIcon aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
function MapPage() {
  return (
    <Page id="map">
      <RelationshipMap />
      <AddPerson />
      <p className="helper center">
        화면을 새로고침하면 예시 지도가 초기화돼요.
      </p>
    </Page>
  );
}
function SharePage() {
  const result = useSelected();
  const [myAlias, setMyAlias] = useState(result?.me.name ?? "나");
  const [otherAlias, setOtherAlias] = useState(result?.other.name ?? "상대");
  const [status, setStatus] = useState("");
  const valid = myAlias.trim().length > 0 && otherAlias.trim().length > 0;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareText(myAlias, otherAlias));
      setStatus("예시 문구를 복사했어요. 원하는 곳에 직접 붙여 넣어 주세요.");
    } catch {
      setStatus("복사하지 못했어요. 아래 문구를 길게 눌러 복사해 주세요.");
    }
  };
  return (
    <Page id="share">
      <h1>
        따뜻한 한마디를
        <br />
        나눠 보세요.
      </h1>
      <p className="muted">
        공유할 별명만 확인해 주세요.
        <br />
        생일과 태어난 시간은 포함하지 않아요.
      </p>
      <div className="share-fields">
        <label>
          내 공개 별명
          <SajuInput
            value={myAlias}
            maxLength={10}
            onChange={(e) => {
              setMyAlias(e.target.value);
              setStatus("");
            }}
          />
        </label>
        <label>
          상대 공개 별명
          <SajuInput
            value={otherAlias}
            maxLength={10}
            onChange={(e) => {
              setOtherAlias(e.target.value);
              setStatus("");
            }}
          />
        </label>
      </div>
      <div className="share-card">
        <Brand />
        <Pair />
        <span className="sample-label">예시 카드</span>
        <h2>
          {myAlias || "나"} &amp; {otherAlias || "상대"}
        </h2>
        <p>
          서로의 하루에
          <br />
          작은 다정함을 더하는 사이
        </p>
        <small>실제 사주 분석 결과가 아닙니다.</small>
      </div>
      <Primary onClick={copy} disabled={!valid}>
        <CopyIcon aria-hidden />
        공유 문구 복사
      </Primary>
      <p className="copy-status" role="status">
        {status}
      </p>
      <details className="share-text">
        <summary>공유 문구 전체 보기</summary>
        <p>{shareText(myAlias, otherAlias)}</p>
      </details>
      <p className="helper">
        미리보기에서는 문구 복사를 제공해요. 공개 링크는 만들어지지 않아요.
      </p>
    </Page>
  );
}
export default function Prototype() {
  const { screenRef } = useScreenPortal();
  useEffect(() => {
    // Native focus can scroll an overflow-hidden ancestor. Only MobileScroll
    // should move when our long forms and result buttons receive focus.
    const frame = screenRef.current;
    if (!frame) return;
    const keepFrameOrigin = () => {
      if (frame.scrollTop || frame.scrollLeft) frame.scrollTo(0, 0);
    };
    frame.addEventListener("scroll", keepFrameOrigin, { passive: true });
    keepFrameOrigin();
    return () => frame.removeEventListener("scroll", keepFrameOrigin);
  }, [screenRef]);
  const [me, setMe] = useState(blankPerson);
  const [other, setOther] = useState(blankPerson);
  const [results, setResults] = useState<PreviewResult[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [editReturn, setEditReturn] = useState(false);
  return (
    <StoreContext.Provider
      value={{
        me,
        setMe,
        other,
        setOther,
        results,
        setResults,
        selected,
        setSelected,
        editReturn,
        setEditReturn,
      }}
    >
      <MotionConfig reducedMotion="user">
        <div className="saju-app">
          <FlowStack initial={screens.home} />
        </div>
      </MotionConfig>
    </StoreContext.Provider>
  );
}

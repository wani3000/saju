import policy from "../../content/research-policy.json";

/** Current input guidance only. Saved results keep their own policy and copy. */
export default function ResearchNotice() {
  return (
    <aside className="input-policy" aria-label="입력 전 확인">
      <p>{policy.display.storage}</p>
      <details>
        <summary>계산·저장·공유 기준 보기</summary>
        <h3>계산 범위와 기준</h3>
        <p>{policy.display.range}</p>
        <p>{policy.display.clock}</p>
        <p>{policy.display.uncertainty}</p>
        <p>{policy.display.history}</p>
        <p>{policy.display.meaning}</p>
        <h3>저장한 정보 관리</h3>
        <p>{policy.display.sharing}</p>
        <p>{policy.display.erasure}</p>
      </details>
    </aside>
  );
}

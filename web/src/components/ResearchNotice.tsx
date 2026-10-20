import policy from "../../content/research-policy.json";

/** Current input guidance only. Saved results keep their own policy and copy. */
export default function ResearchNotice({ localOnly = false }: { localOnly?: boolean }) {
  return (
    <aside className="input-policy" aria-label="입력 전 확인">
      <p>{localOnly ? "입력하는 동안 별명·생년월일·출생 시간·관계는 이 브라우저 탭에만 임시 보관돼요. 서버로 보내지 않으며 가상 정보로 체험해 주세요." : policy.display.storage}</p>
      <details>
        <summary>계산·저장·공유 기준 보기</summary>
        <h3>계산 범위와 기준</h3>
        <p>{policy.display.range}</p>
        <p>{policy.display.clock}</p>
        <p>{policy.display.uncertainty}</p>
        <p>{policy.display.history}</p>
        <p>{policy.display.meaning}</p>
        <h3>저장한 정보 관리</h3>
        <p>{localOnly ? "공유 미리보기에는 공개 별명과 대화 주제만 담겨요. 임시 체험판은 공개 공유 링크를 만들지 않아요." : policy.display.sharing}</p>
        <p>{localOnly ? "보관함의 체험 기록 초기화로 이 탭의 입력과 결과를 지울 수 있어요. 체험을 마치면 초기화해 주세요." : policy.display.erasure}</p>
      </details>
    </aside>
  );
}

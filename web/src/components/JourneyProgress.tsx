const stages = [
  ["me", "내 생일"],
  ["other", "상대 생일"],
  ["review", "내용 확인"],
  ["result", "이야기"],
] as const;

export default function JourneyProgress({ stage }: { stage: string }) {
  const current = stages.findIndex(([key]) => key === stage);
  if (current === -1) return null;
  return (
    <ol className="journey-progress" aria-label="생일 입력과 결과 순서">
      {stages.map(([key, label], index) => (
        <li key={key} aria-current={index === current ? "step" : undefined}
          className={index < current ? "completed" : undefined}>
          <span className="journey-order" aria-hidden="true">{index + 1}</span>
          <span>{label}</span>
        </li>
      ))}
    </ol>
  );
}

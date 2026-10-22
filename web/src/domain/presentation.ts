import type { WholePerson } from "./whole-chart-reading";
import character from "../../content/character.json";
import journeyCopy from "../../content/journey-copy.json";
export { character, journeyCopy };

/** Resolve only pinned catalog assets. Never reinterpret an old share as the latest character. */
export function shareArtwork(card: { catalogVersion?: unknown; guide?: unknown }) {
  if (card.catalogVersion === "tigers-v1")
    return { src: "/assets/tigers/pair-v1.png", alt: "다정하게 기대고 있는 두 아기 호랑이" };
  if (card.catalogVersion === character.catalogVersion && card.guide === character.version)
    return { src: character.photo, alt: character.photoAlt };
  return null;
}

// Short labels for the same situational traits already stored in a v8 snapshot.
// Include every stored trait once: order/count does not rank a dominant personality.
const traitLabels: Record<string, string> = {
  비견: "자기 주관", 겁재: "협동심", 식신: "꾸준한 관심", 상관: "솔직함",
  편재: "실행력", 정재: "준비성", 편관: "문제 해결력", 정관: "책임감",
  편인: "신중함", 정인: "공감",
};
export function personalityOverview(profile?: WholePerson, savedFallback = "") {
  const labels = [...new Set(profile?.narrative?.map(t => traitLabels[t.role]).filter(Boolean) ?? [])];
  if (labels.length) return `${labels.join("·")}이 함께 보이는 사람으로 읽어 볼 수 있겠네.`;
  // Older snapshots stay on their saved wording; do not run today's interpretation engine.
  return (profile?.summary.text || savedFallback).split(/(?<=[.!?])\s|\n/)[0];
}

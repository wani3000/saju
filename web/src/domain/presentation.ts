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

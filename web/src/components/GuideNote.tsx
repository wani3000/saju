import { character } from "@/domain/presentation";

/** Character speech is current UI guidance, never part of a stored reading. */
export default function GuideNote({ children }: { children: React.ReactNode }) {
  return (
    <aside className="guide-note" aria-label="훈장의 안내">
      <p className="guide-byline">{character.displayName}의 한마디</p>
      <p className="guide-quote">{children}</p>
    </aside>
  );
}

// Tab-scoped UI checkpoint only. Birth data, aliases, tokens and consent never go here.
export const navigationKey = "saju-navigation-v1";
type Screen = "home" | "me" | "other" | "review" | "result" | "map" | "share" | "account";
type Checkpoint = { version: 1; view: Screen; selected: string | null; draftPeople: string[] | null; editing: boolean };
type Available = { draft: { me: { id: string }; other: { id: string } } | null; results: { id: string }[]; pending: { id: string }[] };
const screens: string[] = ["home", "me", "other", "review", "result", "map", "share", "account"];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const home = (): Checkpoint => ({ version: 1, view: "home", selected: null, draftPeople: null, editing: false });
export function checkpoint(view: string, selected: string | null, state: Available, editing = false): Checkpoint {
  const safe = home();
  if (!screens.includes(view)) return safe;
  safe.view = view as Screen;
  if ((view === "result" || view === "share") && selected && uuid.test(selected) &&
    [...state.results, ...state.pending].some(r => r.id === selected)) safe.selected = selected;
  if (["me", "other", "review"].includes(view) && state.draft)
    safe.draftPeople = [state.draft.me.id, state.draft.other.id];
  safe.editing = editing && (view === "me" || view === "other");
  return safe;
}
export function restoreNavigation(raw: string | null, state: Available): Checkpoint {
  try {
    const c = JSON.parse(raw ?? "null") as Checkpoint;
    if (!c || c.version !== 1 || !screens.includes(c.view) || typeof c.editing !== "boolean" ||
      Object.keys(c).some(k => !["version", "view", "selected", "draftPeople", "editing"].includes(k))) return home();
    if (c.view === "result" || c.view === "share") {
      if (typeof c.selected !== "string" || !uuid.test(c.selected)) return home();
      const completed = state.results.some(r => r.id === c.selected);
      if (!completed && !state.pending.some(r => r.id === c.selected)) return home();
      return checkpoint(c.view === "share" && !completed ? "result" : c.view, c.selected, state);
    }
    if (["me", "other", "review"].includes(c.view)) {
      if (!state.draft || !Array.isArray(c.draftPeople) || c.draftPeople.length !== 2 ||
        c.draftPeople[0] !== state.draft.me.id || c.draftPeople[1] !== state.draft.other.id) return home();
    }
    return checkpoint(c.view, null, state, c.editing);
  } catch { return home(); }
}

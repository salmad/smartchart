/* Decks kept in this browser (localStorage). A deck holds its slides, style and palette, the agent's
   conversation and the chat thread, so a reload continues where it stopped. Nothing leaves the browser. */
const KEY = "smartchart.journey.decks.v1";

/** { active, decks: { [id]: deck } }; an empty store when storage is missing, blocked or corrupt. */
export function loadStore() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && typeof s.decks === "object") return s;
  } catch { /* private mode or bad JSON: start empty */ }
  return { active: null, decks: {} };
}

/** False when the browser refuses the write (storage full or blocked). */
export function saveStore(store) {
  try { localStorage.setItem(KEY, JSON.stringify(store)); return true; } catch { return false; }
}

export const newDeckId = () => `d_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Newest first. */
export const deckList = (store) => Object.values(store.decks).sort((a, b) => (b.updated || 0) - (a.updated || 0));

/** Named after the cover, else the first slide's title. */
export function deckName(d) {
  const slides = (d.items || []).map((it) => it.slide);
  const t = (slides.find((s) => s.template === "cover") || slides[0])?.title;
  return t ? t.replace(/\[\[|\]\]|\[[-+]|[-+]\]|\*\*/g, "").trim() : "Untitled deck";
}

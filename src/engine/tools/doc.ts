/* The public deck (DeckDoc) and the app's saved data (SavedDeck without the chat). Tools read and write DeckDoc;
   the service turns it back into the app's shape, keeping fields tools don't own (current, updated). */
import { plain, upgrade } from "../slides/schema.js";
import type { Slide, Style, Theme } from "../types.js";
import type { Check } from "../agent/checks.js";
import { ToolError, type DeckDoc, type DocSlide } from "./types.js";

interface SavedItem { id: string; slide: Slide; status?: string; errors?: string[]; warnings?: string[]; checks?: Check[] }
interface SavedData { style?: Style; theme?: Theme; accent?: string | null; items?: SavedItem[] }

export function docFromData(id: string, name: string, data: unknown): DeckDoc {
  const d = (data && typeof data === "object" ? data : {}) as SavedData;
  return { id, name, style: d.style === "pitch" ? "pitch" : "consulting", theme: d.theme === "paper" ? "paper" : "ink", accent: d.accent ?? null,
    slides: (d.items ?? []).map((it) => ({ id: it.id, slide: upgrade(it.slide), issues: it.errors ?? [], warnings: it.warnings ?? [], checks: it.checks ?? [] })) };
}

export function dataFromDoc(doc: DeckDoc, previous: unknown): Record<string, unknown> {
  const prev = (previous && typeof previous === "object" ? previous : {}) as Record<string, unknown>;
  return { ...prev, style: doc.style, theme: doc.theme, accent: doc.accent, updated: Date.now(),
    items: doc.slides.map((s) => ({ id: s.id, slide: s.slide, status: "ok", errors: s.issues, warnings: s.warnings, checks: s.checks })) };
}

export const storylineRows = (doc: DeckDoc) =>
  doc.slides.map((s, i) => ({ slideId: s.id, n: i + 1, template: s.slide.template, title: plain(s.slide.title ?? ""), issues: s.issues.length }));

export function slideAt(doc: DeckDoc, slideId: string): { item: DocSlide; index: number } {
  const index = doc.slides.findIndex((s) => s.id === slideId);
  if (index < 0) throw new ToolError("not_found", `No slide ${slideId} in this deck (valid ids: ${doc.slides.map((s) => s.id).join(", ") || "none yet"}).`, "get_deck lists the slides.");
  return { item: doc.slides[index], index };
}

/** Where a slide goes: "start", "end" (or nothing), or after a slide id. */
export function insertIndex(doc: DeckDoc, after: string | undefined): number {
  if (after === "start") return 0;
  if (!after || after === "end") return doc.slides.length;
  return slideAt(doc, after).index + 1;
}

export function newSlideId(doc: DeckDoc): string {
  const taken = new Set(doc.slides.map((s) => s.id));
  let id: string;
  do id = `s_${Math.random().toString(36).slice(2, 6)}`; while (taken.has(id));
  return id;
}

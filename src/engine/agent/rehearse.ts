/* Rehearse: the room reads the deck and asks what it would really ask in the meeting, slide by slide, with the answer the
   maker should give from what the deck holds; a question the deck cannot answer is a gap (a backup slide, a figure to
   find). One model call; the maker keeps what helps in their speaker notes. */
import { headline } from "../slides/schema.js";
import { pictureAsWords } from "../slides/images.js";
import type { Slide, Style } from "../types.js";
import { complete, type ChatMessage } from "./llm.js";

export interface RoomQuestion { q: string; answer: string; gap: boolean }
export interface SlideQuestions { id: string; page: number; title: string; questions: RoomQuestion[] }

const ROOM: Record<Style, string> = {
  consulting: "the board or the client's executive committee: senior, short of time, sceptical of numbers they cannot trace",
  pitch: "a partner at a venture fund and an associate: they have seen a hundred decks this month and look for the reason to say no",
};

/** The deck as the room reads it: each content slide's words and figures, pictures as words, and the maker's notes. */
function deckText(slides: { id: string; slide: Slide }[]): string {
  return slides.map(({ slide }, i) => {
    const { talk, ...shown } = slide;
    return `Slide ${i + 1} (${slide.template}): ${JSON.stringify(shown, pictureAsWords)}${talk ? `\nThe maker's notes for it: ${talk}` : ""}`;
  }).join("\n\n");
}

export function rehearseMessages(slides: { id: string; slide: Slide }[], style: Style): ChatMessage[] {
  return [
    { role: "system", content: `You are the room this deck will be presented to: ${ROOM[style]}. You have read the whole deck. For each content slide (not the cover, chapter dividers or agenda), ask the one or two hardest questions you would really ask in the meeting: the ones that decide whether you agree, fund or approve. Ask in your own words, as you would say them across the table: at most 25 words each; no softballs, no questions the slide already answers on its face.
For each question give the answer the maker should give: at most two sentences and 45 words, using only facts in the deck or in the maker's notes, never invented ones. If the deck does not hold the answer, set "gap": true and say in the answer what evidence or figure would answer it.
Reply with JSON only: {"slides":[{"n":<slide number>,"questions":[{"q":"…","answer":"…","gap":false}]}]}` },
    { role: "user", content: deckText(slides) },
  ];
}

/** The model's answer, kept to slides that exist and questions that are whole: at most 2 per slide. */
export function parseRehearsal(text: string, slides: { id: string; slide: Slide }[]): SlideQuestions[] {
  let o: { slides?: unknown } | null = null;
  try { o = JSON.parse(String(text).match(/\{[\s\S]*\}/)?.[0] ?? "null"); } catch { return []; }
  const list = Array.isArray(o?.slides) ? o.slides : [];
  const out: SlideQuestions[] = [];
  for (const s of list as { n?: unknown; questions?: unknown }[]) {
    const n = Number(s?.n), at = slides[n - 1];
    if (!at || ["cover", "section", "agenda"].includes(at.slide.template)) continue;
    const qs = (Array.isArray(s.questions) ? s.questions : []) as { q?: unknown; answer?: unknown; gap?: unknown }[];
    const questions = qs.filter((x) => typeof x?.q === "string" && x.q.trim() && typeof x.answer === "string" && x.answer.trim())
      .slice(0, 2).map((x) => ({ q: String(x.q).trim(), answer: String(x.answer).trim(), gap: x.gap === true }));
    if (questions.length && !out.some((x) => x.id === at.id)) out.push({ id: at.id, page: n, title: headline(at.slide), questions });
  }
  return out.sort((a, b) => a.page - b.page);
}

export async function rehearse(slides: { id: string; slide: Slide }[], style: Style, signal?: AbortSignal): Promise<SlideQuestions[]> {
  return parseRehearsal(await complete({ messages: rehearseMessages(slides, style), max_tokens: 4000, temperature: 0.5, signal }), slides);
}

/** A question and its answer as a line of speaker notes. */
export const asTalk = (x: RoomQuestion) => `If asked "${x.q}": ${x.answer}`;

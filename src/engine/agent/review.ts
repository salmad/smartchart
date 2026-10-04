/* A red-pen review of a deck made anywhere (read from a PDF or PPTX): the storyline checks on its titles, and per
   slide the notes a partner would scribble. One Jev call (the deck questions and a finding-or-topic question per
   content slide); the other notes are code. Advice only. */
import type { Style } from "../types.js";
import { jev as jevCall, type JevFn } from "./llm.js";
import { numbersIn } from "./checks.js";
import { lineChecks, type StoryCheck, type StoryLine } from "./story.js";

/** A slide as read from a file: its title and the rest of its text. */
export interface Page { title: string; body: string }
export interface PageReview { page: number; title: string; notes: string[] }
export interface Review { pages: PageReview[]; deck: StoryCheck[]; verdict: string; ms: number }

const P_FAIL = 0.7, LONG_TITLE = 15, WALL = 120, MAX_JUDGED = 40;
const words = (t: string) => t.match(/\S+/g)?.length ?? 0;
const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Which pages are a cover or a section divider: the first page with little text, and short-titled pages with no body. */
export function kindOf(p: Page, i: number): StoryLine["kind"] {
  if (i === 0 && words(p.body) < 25) return "cover";
  return words(p.title) <= 4 && words(p.body) < 8 && !numbersIn(p.body).length ? "section" : "content";
}

/** The notes code can make on its own. */
export function codeNotes(pages: Page[], style: Style): string[][] {
  const seen = new Map<string, number>();
  return pages.map((p, i) => {
    if (kindOf(p, i) !== "content") return [];
    const notes: string[] = [];
    if (!p.title.trim()) notes.push("No title: the room can’t tell what this slide says");
    if (words(p.title) > LONG_TITLE) notes.push(`The title runs to ${words(p.title)} words; a title the room reads at a glance is 15 or fewer`);
    if (style === "consulting" && p.title && numbersIn(p.body).length && !numbersIn(p.title).length) notes.push("The slide has figures but the title quantifies nothing: put the so-what figure in it");
    if (words(p.body) > WALL) notes.push(`${words(p.body)} words of body text: too much to read while someone talks`);
    const key = norm(p.title), first = seen.get(key);
    if (key && first !== undefined) notes.push(`Same title as slide ${first + 1}`);
    else if (key) seen.set(key, i);
    return notes;
  });
}

export async function reviewDeck(pages: Page[], style: Style, jev: JevFn = jevCall): Promise<Review> {
  const lines: StoryLine[] = pages.map((p, i) => ({ id: `p${i + 1}`, page: i + 1, kind: kindOf(p, i), title: p.title.trim() || "(no title)" }));
  const content = lines.filter((l) => l.kind === "content");
  // Pitch titles name the topic by design; a consulting title should state the finding.
  // At most MAX_JUDGED titles ride in the one call; past that the code notes still apply.
  const titles = style === "consulting" ? Object.fromEntries(content.slice(0, MAX_JUDGED).map((l) => [`T${l.page}`, {
    instructions: `Slide ${l.page}'s title is "${l.title}". Does it state a conclusion or so-what, or only name a topic?`,
    options: { action: "States a conclusion or so-what.", topic: "Names a topic without a claim." } }])) : {};
  const r = content.length >= 2
    ? await lineChecks(lines, style, jev, () => "slide", titles)
    : { checks: [], ms: 0, answers: Object.keys(titles).length ? await jev(`Deck style: ${style}.`, titles) : {} };
  const notes = codeNotes(pages, style);
  const topics: number[] = [];
  for (const l of content) {
    const a = r.answers[`T${l.page}`];
    if (a && (a.probabilities.topic ?? 0) >= P_FAIL) { notes[l.page - 1].unshift("The title names a topic, not a finding: say what the slide proves"); topics.push(l.page); }
  }
  // A deck check that points at a slide also goes on that slide.
  for (const c of r.checks) if (!c.ok && c.slideId) notes[Number(c.slideId.slice(1)) - 1]?.push(c.msg);
  const total = notes.flat().length + r.checks.filter((c) => !c.ok && !c.slideId).length;
  const verdict = !total ? `No red pen: ${pages.length} slide${pages.length === 1 ? "" : "s"}, every check passes.`
    : `${total} note${total === 1 ? "" : "s"} on ${pages.length} slide${pages.length === 1 ? "" : "s"}${topics.length > content.length / 2 ? "; most titles name topics instead of findings" : ""}.`;
  return { pages: pages.map((p, i) => ({ page: i + 1, title: p.title, notes: notes[i] })), deck: r.checks, verdict, ms: r.ms };
}

/** What Rebuild in Occam asks, as the chat shows it; the deck and the review go along as the attached file. */
export const rebuildAsk = (style: Style) => `Rebuild this deck in Occam as a ${style} deck: the same story, every figure exactly as given, and every note in its review fixed.`;

/** The deck's text as the agent reads it, one block per slide, then the review's notes. */
export function deckText(pages: Page[], review?: Review): string {
  const slides = pages.map((p, i) => `Slide ${i + 1}: ${p.title}\n${p.body}`.trim()).join("\n\n");
  if (!review) return slides;
  const flaws = [...review.deck.filter((c) => !c.ok).map((c) => c.msg), ...review.pages.flatMap((p) => p.notes.map((n) => `Slide ${p.page}: ${n}`))];
  return `${slides}\n\nReview (${review.verdict})\n${flaws.length ? flaws.map((f) => `- ${f}`).join("\n") : "- Nothing to fix."}`;
}

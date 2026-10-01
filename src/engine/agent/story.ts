/* Deck checks D1–D5: the storyline as the room skims it (the titles alone, in order), judged the way a partner reads a
   deck. One Jev call; a check fails only when a failing value has p ≥ 0.7, as for the slide checks. */
import { plain } from "../slides/schema.js";
import type { Slide, Style } from "../types.js";
import { jev as jevCall, type JevFn } from "./llm.js";

/** One line of the storyline: a content slide's headline, or a cover or section as a heading. */
export interface StoryLine { id: string; page: number; kind: "cover" | "section" | "content"; title: string; claim?: string }
/** How a failed check is fixed: code moves a slide, or the agent gets a prompt. */
export type StoryFix = { kind: "move"; id: string; to: number; label: string } | { kind: "ask"; prompt: string; label: string }
export interface StoryCheck { id: string; ok: boolean; msg: string; p: number; slideId?: string; fix?: StoryFix }

const P_FAIL = 0.7;

export function storyline(slides: { id: string; slide: Slide }[], style: Style): StoryLine[] {
  return slides.map(({ id, slide }, i) => {
    const kind = slide.template === "cover" ? "cover" : slide.template === "section" ? "section" : "content";
    // Pitch titles name the topic; the subtitle carries the claim.
    return { id, page: i + 1, kind, title: plain(slide.title), ...(style === "pitch" && slide.subtitle ? { claim: plain(slide.subtitle) } : {}) };
  });
}

interface Q { instructions: string; options: Record<string, string>; pass: string | ((choice: string) => boolean) }

export async function storyChecks(slides: { id: string; slide: Slide }[], style: Style, jev: JevFn = jevCall): Promise<{ checks: StoryCheck[]; ms: number }> {
  const lines = storyline(slides, style), content = lines.filter((l) => l.kind === "content");
  if (content.length < 2) return { checks: [], ms: 0 };
  const n = (id: string) => lines.find((l) => l.id === id)?.page ?? 0;
  const perSlide = (what: string) => Object.fromEntries(content.map((l) => [l.id, `Slide ${l.page} ${what}`]));
  const first = content[0];

  const qs: Record<string, Q> = {};
  if (style === "consulting") qs.D1 = { instructions: "Which content slide states the deck's main answer: the recommendation or conclusion the room should take away?", options: { ...perSlide("states the main answer."), none: "No slide states one main answer." }, pass: (c) => c === first.id };
  qs.D2 = { instructions: style === "pitch" ? "Read in order, do the claims make one case an investor can follow?" : "Read in order, do the titles alone make one argument the room can follow?",
    options: { argument: "Each builds on the one before; together they make one case.", jumps: "A step is missing or out of order, so the case jumps.", topics: "They name topics; they do not make a case." }, pass: "argument" };
  qs.D3 = { instructions: "Does any slide make the same point as an earlier slide?", options: { none: "Every slide makes its own point.", ...perSlide("repeats the point of an earlier slide.") }, pass: "none" };
  qs.D4 = { instructions: "Does any slide not help make the deck's case?", options: { none: "Every slide helps make the case.", ...perSlide("does not help make the case.") }, pass: "none" };
  qs.D5 = style === "pitch"
    ? { instructions: "Does the deck end on the ask: what the founders want from the room (the raise and what it buys)?", options: { ask: "It ends on the ask.", open: "It ends without an ask." }, pass: "ask" }
    : { instructions: "Does the deck end on what to do: a recommendation, a decision to take or next steps?", options: { ends: "It ends on what to do.", open: "It ends on evidence; the room is not told what to do." }, pass: "ends" };

  const state = [`Deck style: ${style}.`, `The deck as the room skims it (page, id, kind, ${style === "pitch" ? "topic — claim" : "title"}):`,
    ...lines.map((l) => `${l.page}. ${l.id} [${l.kind === "content" ? slides[l.page - 1].slide.template : l.kind}] ${l.title}${l.claim ? ` — ${l.claim}` : ""}`)].join("\n");
  const r = await jev(state, Object.fromEntries(Object.entries(qs).map(([id, q]) => [id, { instructions: q.instructions, options: q.options }])));

  const checks = Object.entries(qs).map(([id, q]): StoryCheck | null => {
    const a = r[id]; if (!a) return null;
    const passes = (v: string) => (typeof q.pass === "function" ? q.pass(v) : v === q.pass);
    const [fail, p] = Object.entries(a.probabilities).filter(([v]) => !passes(v)).sort((x, y) => y[1] - x[1])[0] ?? ["", 0];
    const ok = p < P_FAIL;
    if (ok) return { id, ok, msg: id === "D5" && style === "pitch" ? "The deck ends on the ask" : PASS[id], p: 1 - p };
    const slideId = content.some((l) => l.id === fail) ? fail : undefined, page = slideId ? n(slideId) : 0;
    return { id, ok, p, ...(slideId ? { slideId } : {}), ...failed(id, fail, page, slideId, style, lines) };
  }).filter((c): c is StoryCheck => c !== null);
  return { checks, ms: r._ms };
}

const PASS: Record<string, string> = {
  D1: "The answer comes first", D2: "The titles make one argument", D3: "Every slide makes its own point", D4: "Every slide helps make the case", D5: "The deck ends on what to do",
};

function failed(id: string, choice: string, page: number, slideId: string | undefined, style: Style, lines: StoryLine[]): { msg: string; fix?: StoryFix } {
  const heads = style === "pitch" ? "claims" : "titles";
  if (id === "D1") {
    if (!slideId) return { msg: "No slide states the main answer", fix: { kind: "ask", label: "Ask Occam", prompt: "No slide states the deck's main answer. Rewrite the first content slide's title so it states the recommendation the rest of the deck supports. Change only that title." } };
    // First content position: after a cover, never before it.
    const to = lines.findIndex((l) => l.kind === "content");
    return { msg: `The answer is on slide ${page}, not first`, fix: { kind: "move", id: slideId, to, label: `Move slide ${page} first` } };
  }
  if (id === "D2") return choice === "topics"
    ? { msg: `The ${heads} name topics; they don't make a case`, fix: { kind: "ask", label: "Ask Occam", prompt: `Rewrite each slide's ${style === "pitch" ? "subtitle" : "title"} as the point it makes, so read in order they tell the deck's argument. Change only ${style === "pitch" ? "subtitles" : "titles"}.` } }
    : { msg: `The ${heads} jump: a step is missing or out of order`, fix: { kind: "ask", label: "Ask Occam", prompt: `Read in order, the slide ${heads} jump. Rewrite them so each builds on the one before and together they make one argument. Change only ${style === "pitch" ? "subtitles" : "titles"}; tell me if a slide is missing.` } };
  if (id === "D3") return { msg: `Slide ${page} repeats an earlier point`, fix: { kind: "ask", label: "Ask Occam", prompt: `Slide ${page} makes the same point as an earlier slide. Make it say something the earlier slide does not, or tell me which one to drop.` } };
  if (id === "D4") return { msg: `Slide ${page} doesn't help make the case`, fix: { kind: "ask", label: "Ask Occam", prompt: `Slide ${page} doesn't help make the deck's case. Rewrite its title so it says how it supports the argument, or tell me to drop it.` } };
  return style === "pitch"
    ? { msg: "The deck ends without the ask", fix: { kind: "ask", label: "Ask Occam", prompt: "Add a last slide with the ask: what we are raising and what it buys." } }
    : { msg: "The deck ends without saying what to do", fix: { kind: "ask", label: "Ask Occam", prompt: "Add a last slide that says what the room should do: the recommendation and the next steps." } };
}

/** The storyline's identity: checks are kept while it is unchanged. */
export const storyKey = (slides: { id: string; slide: Slide }[], style: Style) =>
  JSON.stringify([style, slides.map(({ id, slide }) => [id, slide.template, slide.title, slide.subtitle ?? ""])]);


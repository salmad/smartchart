/* One write for every tool that changes a slide: checkWrite with the server estimate, archived templates refused,
   rule checks split out of the warnings, and the result in the shape every write tool returns. */
import { checkWrite } from "../agent/write.js";
import { isTemplate, OFFERED } from "../slides/schema.js";
import type { Slide } from "../types.js";
import { estimate } from "./estimate.js";
import { storyline } from "../agent/story.js";
import { openComments } from "../comments.js";
import { ToolError, type DeckDoc, type ToolContext } from "./types.js";

const asValue = (v: unknown): unknown => { if (typeof v === "string" && /^\s*[[{]/.test(v)) { try { return JSON.parse(v); } catch { /* keep */ } } return v; };
const RULE = /^R\d+:/;

export async function writeSlide(ctx: ToolContext, input: unknown, request: string) {
  const deck = ctx.deck;
  if (!deck) throw new ToolError("bad_input", "No deck.", "Pass deckId.");
  const slide = asValue(input);
  if (!slide || typeof slide !== "object" || Array.isArray(slide)) throw new ToolError("bad_input", "slide: must be a JSON object { template, ...fields }.");
  const template = (slide as { template?: unknown }).template;
  if (!isTemplate(template)) throw new ToolError("bad_input", `slide.template: must be one of ${OFFERED.join(", ")}.`, "get_template shows each template's fields.");
  if (!OFFERED.includes(template)) throw new ToolError("refused", `slide.template: "${template}" is not available.`, `Use one of: ${OFFERED.join(", ")}.`);
  const w = await checkWrite(slide, { style: deck.style, jev: ctx.jev, brief: request, strict: true, measure: estimate(deck.style) });
  if (!w.applied) throw new ToolError("bad_input", `The slide was not written: ${w.issues.join(" | ")}`, "Fix each path named and write again.");
  return { slide: w.slide, issues: w.issues, warnings: w.warnings.filter((x) => !RULE.test(x)), checks: w.warnings.filter((x) => RULE.test(x)),
    autofixes: w.autofixes, resolved: Object.fromEntries(Object.entries(w.resolved).map(([k, v]) => [k, v.value])) };
}

/** What to do after a write, so checks reach the agent without it asking: what to fix, when to judge the slide, when
    the storyline is worth a look, and open comments. Advice only; the agent decides. */
export function nextStep(doc: DeckDoc, slideId: string, w: Pick<Written, "issues" | "warnings" | "checks">, created: boolean): string {
  const out: string[] = [];
  if (w.issues.length) out.push("Fix each issue with the smallest edit (update_slide at its path), never by deleting content.");
  else if (w.warnings.length || w.checks.length) out.push("Weigh the warnings and failed checks: fix the ones a small edit fixes, and tell the user about any you leave. Never invent a source or a figure to clear one.");
  if (!w.issues.length) out.push("When the slide says what the user asked, check_slide judges it (one model call).");
  const content = storyline(doc.slides.map((s) => ({ id: s.id, slide: s.slide })), doc.style).filter((l) => l.kind === "content").length;
  if (created && content >= 2) out.push(`The deck has ${content} content slides: check_storyline reads them in order once the set is done.`);
  const notes = openComments(doc.comments, slideId).length;
  if (notes) out.push(`This slide has ${notes} open comment${notes === 1 ? "" : "s"} (read_slide): address ${notes === 1 ? "it" : "them"} only if the user asked.`);
  return out.join(" ");
}

/** The write result: empty lists left out; a notice when the user is editing this slide by hand; the next step. */
export function writeResult(ctx: ToolContext, doc: DeckDoc, slideId: string, w: Awaited<ReturnType<typeof writeSlide>>, extra: Record<string, unknown> = {}, created = false): Record<string, unknown> {
  const n = doc.slides.findIndex((s) => s.id === slideId) + 1, editing = ctx.presence.editing;
  const notice = editing && editing.until > ctx.now() && editing.slideId === slideId ? `The user is editing ${slideId} by hand right now; your change is applied and they will see it.` : undefined;
  const out: Record<string, unknown> = { applied: true, slideId, n, slide: w.slide, ...extra, rev: ctx.rev, fit: "estimated" };
  for (const [k, v] of Object.entries({ issues: w.issues, warnings: w.warnings, checks: w.checks, autofixes: w.autofixes })) if (v.length) out[k] = v;
  if (Object.keys(w.resolved).length) out.resolved = w.resolved;
  if (notice) out.notice = notice;
  out.next = nextStep(doc, slideId, w, created);
  return out;
}

export type Written = Awaited<ReturnType<typeof writeSlide>>;
export type { Slide };

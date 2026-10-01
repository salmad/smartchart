/* One write for every tool that changes a slide: checkWrite with the server estimate, archived templates refused,
   rule checks split out of the warnings, and the result in the shape every write tool returns. */
import { checkWrite } from "../agent/write";
import { isTemplate, OFFERED } from "../slides/schema";
import type { Slide } from "../types";
import { estimate } from "./estimate";
import { ToolError, type DeckDoc, type ToolContext } from "./types";

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

/** The write result: empty lists left out; a notice when the user is editing this slide by hand. */
export function writeResult(ctx: ToolContext, doc: DeckDoc, slideId: string, w: Awaited<ReturnType<typeof writeSlide>>, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const n = doc.slides.findIndex((s) => s.id === slideId) + 1, editing = ctx.presence.editing;
  const notice = editing && editing.until > ctx.now() && editing.slideId === slideId ? `The user is editing ${slideId} by hand right now; your change is applied and they will see it.` : undefined;
  const out: Record<string, unknown> = { applied: true, slideId, n, slide: w.slide, ...extra, fit: "estimated" };
  for (const [k, v] of Object.entries({ issues: w.issues, warnings: w.warnings, checks: w.checks, autofixes: w.autofixes })) if (v.length) out[k] = v;
  if (Object.keys(w.resolved).length) out.resolved = w.resolved;
  if (notice) out.notice = notice;
  return out;
}

export type Written = Awaited<ReturnType<typeof writeSlide>>;
export type { Slide };

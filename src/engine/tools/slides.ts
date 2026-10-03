import { applyPatch } from "../agent/patch.js";
import { NAMED_MARK, matchNewSeries, prefixed, touches } from "../agent/agent.js";
import { CAPABILITIES } from "../slides/capabilities.js";
import { getAt, listOps } from "../slides/edit.js";
import type { Slide } from "../types.js";
import { insertIndex, newSlideId, slideAt, storylineRows } from "./doc.js";
import { writeResult, writeSlide } from "./write.js";
import { DESTRUCTIVE, IDEMPOTENT, READ, ToolError, WRITE, tool, type DeckDoc, type ToolContext } from "./types.js";

const DECK = { type: "string", description: "The deck id." } as const;
const SLIDE_ID = { type: "string", description: "A slide id from get_deck, e.g. s_a1b2." } as const;
const AFTER = { type: "string", description: "A slide id, \"start\" or \"end\"." } as const;
const REQUEST = { type: "string", description: "The user's own words for this change. Code uses them for \"auto\" choices; always pass them." } as const;
const SLIDE = { description: "The whole slide JSON for its template ({ template, ...fields }), per get_template's card." } as const;

/** The in-app guards: chart marks and stacking stay "auto" unless the user named them. */
function choicesToCode(input: unknown, request: string): unknown {
  const s = input as { chart?: { series?: { mark?: string }[]; stacking?: string } } | null;
  const chart = s && typeof s === "object" ? s.chart : undefined;
  if (chart && Array.isArray(chart.series) && !NAMED_MARK.test(request)) chart.series.forEach((x) => { if (x && typeof x === "object") x.mark = "auto"; });
  if (chart && chart.stacking !== undefined && !/stack|percent|share/i.test(request)) chart.stacking = "auto";
  return input;
}
const parsed = (v: unknown) => { if (typeof v === "string" && /^\s*[[{]/.test(v)) { try { return JSON.parse(v) as unknown; } catch { /* keep */ } } return v; };
const docOf = (ctx: ToolContext) => structuredClone(ctx.deck as DeckDoc);

export const slideTools = [
  tool<{ deckId: string; slide: unknown; after?: string; request?: string; slideId?: string }>({ name: "create_slide", title: "Create a slide", group: "slides", scope: "deck", annotations: WRITE,
    description: "Add a slide: the whole slide JSON for its template (get_template first). Code autofixes, validates, resolves \"auto\" choices and checks fit, then returns the stored slide, its position, issues to fix, warnings and failed rule checks. slideId only to restore a slide you deleted.",
    input: { type: "object", additionalProperties: false, required: ["deckId", "slide"], properties: { deckId: DECK, slide: SLIDE, after: AFTER, request: REQUEST, slideId: SLIDE_ID } },
    run: async (ctx, { slide, after, request = "", slideId }) => {
      const doc = docOf(ctx), input = choicesToCode(parsed(slide), request);
      if (slideId && (!/^s_[\w-]{1,32}$/.test(slideId) || doc.slides.some((s) => s.id === slideId)))
        throw new ToolError("bad_input", `slideId: ${slideId} is taken or malformed.`, "Leave slideId out; it is only for restoring a deleted slide.");
      const at = insertIndex(doc, after), w = await writeSlide(ctx, input, request), id = slideId ?? newSlideId(doc);
      doc.slides.splice(at, 0, { id, slide: w.slide, issues: w.issues, warnings: w.warnings, checks: [] });
      return { result: writeResult(ctx, doc, id, w), deck: doc, events: [{ slideId: id, what: "created", paths: [] }] };
    } }),

  tool<{ deckId: string; slideId: string; path?: string }>({ name: "read_slide", title: "Read a slide", group: "slides", scope: "deck", annotations: READ,
    description: "A slide's current JSON (or the value at one path, e.g. cards[2] or chart.series[0]), its template, which lists can grow or shrink (min, max, length) and the template's capabilities by name (get_template says when to use each). Content only; checks come back with writes and check_slide.",
    input: { type: "object", additionalProperties: false, required: ["deckId", "slideId"], properties: { deckId: DECK, slideId: SLIDE_ID, path: { type: "string" } } },
    run: async (ctx, { slideId, path }) => {
      const doc = ctx.deck as DeckDoc, { item } = slideAt(doc, slideId);
      const lists = listOps(item.slide, doc.style).map((o) => ({ path: o.path, min: o.min, max: o.max, length: o.length }));
      const capabilities = (CAPABILITIES[item.slide.template] ?? []).filter((c) => !c.styles || c.styles.includes(doc.style)).map((c) => c.name);
      if (!path) return { result: { slideId, template: item.slide.template, slide: item.slide, lists, ...(capabilities.length ? { capabilities } : {}) } };
      const value = getAt(item.slide, path);
      if (value === undefined) throw new ToolError("bad_input", `path: nothing at ${path}.`, `Top-level fields: ${Object.keys(item.slide).join(", ")}.`);
      return { result: { slideId, template: item.slide.template, path, value, lists: lists.filter((l) => l.path.startsWith(path.split("[")[0])) } };
    } }),

  tool<{ deckId: string; slideId: string; set: Record<string, unknown>; request?: string }>({ name: "update_slide", title: "Edit a slide", group: "slides", scope: "deck", annotations: DESTRUCTIVE,
    description: "Change parts of a slide at exact paths; everything else stays. { \"title\": \"…\", \"chart.series[1].values[3]\": 42, \"cards[2]\": null } — a value replaces, null removes an item, the next index appends, setting a whole list reorders it. All or nothing. Returns what changed, issues on the changed parts and elsewhere (problems your change caused on other parts).",
    input: { type: "object", additionalProperties: false, required: ["deckId", "slideId", "set"], properties: { deckId: DECK, slideId: SLIDE_ID, set: { type: "object", additionalProperties: true, description: "{ path: value }" }, request: REQUEST } },
    run: async (ctx, { slideId, set, request = "" }) => {
      const doc = docOf(ctx), { item, index } = slideAt(doc, slideId), current = item.slide;
      const patch = Object.fromEntries(Object.entries(parsed(set) as Record<string, unknown>).map(([k, v]) => [prefixed(current, k), parsed(v)]));
      const p = applyPatch(current, patch);
      if (p.errors) throw new ToolError("bad_input", p.errors.join(" | "), "read_slide shows the slide's paths.");
      if (!NAMED_MARK.test(request)) matchNewSeries(current, p.slide);
      const w = await writeSlide(ctx, p.slide, request);
      doc.slides[index] = { ...item, slide: w.slide, issues: w.issues, warnings: w.warnings };
      const mine = w.issues.filter((i) => touches(i, p.changed)), elsewhere = w.issues.filter((i) => !touches(i, p.changed));
      return { result: writeResult(ctx, doc, slideId, { ...w, issues: mine }, { changed: p.changed, ...(elsewhere.length ? { elsewhere } : {}) }),
        deck: doc, events: [{ slideId, what: "updated", paths: p.changed }] };
    } }),

  tool<{ deckId: string; slideId: string; slide: unknown; request?: string }>({ name: "change_template", title: "Change a slide's template", group: "slides", scope: "deck", annotations: DESTRUCTIVE,
    description: "Rewrite a slide in another template, keeping its id and position (\"show this as a table\"). Write the whole slide JSON for the new template, keeping the message and every figure. Only when the user asked for another kind of slide.",
    input: { type: "object", additionalProperties: false, required: ["deckId", "slideId", "slide"], properties: { deckId: DECK, slideId: SLIDE_ID, slide: SLIDE, request: REQUEST } },
    run: async (ctx, { slideId, slide, request = "" }) => {
      const doc = docOf(ctx), { item, index } = slideAt(doc, slideId), input = choicesToCode(parsed(slide), request);
      const w = await writeSlide(ctx, input, request);
      doc.slides[index] = { ...item, slide: w.slide, issues: w.issues, warnings: w.warnings, checks: [] };
      return { result: writeResult(ctx, doc, slideId, w), deck: doc, events: [{ slideId, what: "template", paths: [] }] };
    } }),

  tool<{ deckId: string; slideId: string; after: string }>({ name: "move_slide", title: "Move a slide", group: "slides", scope: "deck", annotations: IDEMPOTENT,
    description: "Move a slide to just after another slide, or to the start or end. Returns the new storyline.",
    input: { type: "object", additionalProperties: false, required: ["deckId", "slideId", "after"], properties: { deckId: DECK, slideId: SLIDE_ID, after: AFTER } },
    run: async (ctx, { slideId, after }) => {
      const doc = docOf(ctx), { index } = slideAt(doc, slideId);
      if (after === slideId) throw new ToolError("bad_input", "after: a slide cannot go after itself.");
      const [item] = doc.slides.splice(index, 1);
      doc.slides.splice(insertIndex(doc, after), 0, item);
      return { result: { slides: storylineRows(doc) }, deck: doc, events: [{ slideId, what: "moved", paths: [] }] };
    } }),

  tool<{ deckId: string; slideId: string }>({ name: "delete_slide", title: "Delete a slide", group: "slides", scope: "deck", annotations: DESTRUCTIVE,
    description: "Remove a slide. Returns it, so create_slide with the same slide and slideId puts it back. Only when the user asked to remove it.",
    input: { type: "object", additionalProperties: false, required: ["deckId", "slideId"], properties: { deckId: DECK, slideId: SLIDE_ID } },
    run: async (ctx, { slideId }) => {
      const doc = docOf(ctx), { index } = slideAt(doc, slideId), [gone] = doc.slides.splice(index, 1);
      return { result: { deleted: { slideId, slide: gone.slide as Slide } }, deck: doc, events: [{ slideId, what: "deleted", paths: [] }] };
    } }),
];

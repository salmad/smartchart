/* MVP agent (spec 9.0–9.5): one GLM 5.3 Flash loop with three tools.
   create_slide classifies (Jev) and hands over a template card; edit_slide writes a whole slide
   through the write path (autofix → validate → measure → apply unless a shape error);
   read_slide reloads a slide and its card. The caller owns the deck and the history. */
import { MENU, describe, validate } from "../v5/schema.js";
import { agentStep, jev } from "./llm.js";
import { GUIDE, MENU_OPTIONS, STYLE_STATE, exampleFor } from "./prompts.js";
import { autofix } from "./pipeline.js";
import { ruleChecks } from "./checks.js";
import { TOOLS, agentSystem, stateBlock } from "./agent-prompt.js";

const MAX_TOOL_CALLS = 10;
const plainTitle = (s) => String(s || "").replace(/\[\[|\]\]|\*\*|\[-|-\]|\[\+|\+\]/g, "");
const newId = (taken) => { let id; do id = `s_${Math.random().toString(36).slice(2, 6)}`; while (taken.has(id)); return id; };
// Models sometimes send objects as JSON strings; accept both.
const asValue = (v) => { if (typeof v === "string" && /^\s*[[{]/.test(v)) { try { return JSON.parse(v); } catch { /* keep the string */ } } return v; };

/* validate() reports limits (length, item counts, budgets) with the same list as shape errors.
   Limits are fit issues: the slide still renders, so the write is applied and they are returned (spec 9.4). */
const LIMIT = /characters|at most|budget|too many|Cut or merge|Shorten|with notes|with a takeaway/i;

/** Top-level fields whose JSON differs between two versions of a slide. */
function changedFields(before, after) {
  if (!before) return Object.keys(after);
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
}

/**
 * Run one user turn.
 * deck: { style, theme, slides: [{ id, slide, pending?, issues, warnings }] }, mutated in place.
 * history: the conversation messages (no system), mutated in place.
 * measure(slide, index) → layout issues and `.lines` for the title, at 1920×1080.
 * onChange(deck, slideId) is called after every applied write, so the canvas updates live.
 */
export async function runTurn({ text, deck, history, selection, measure, log, onChange }) {
  const style = deck.style, cards = new Map(); // slideId → template whose card this turn handed over
  const find = (id) => deck.slides.find((s) => s.id === id);
  const unknown = (id) => ({ error: `unknown slideId ${id}; valid ids: ${deck.slides.map((s) => s.id).join(", ") || "none yet"}` });
  const visible = () => deck.slides.filter((s) => !s.pending);

  const tools = {
    async create_slide({ about = "", after = "end", template, replace }) {
      if (replace && !find(replace)) return unknown(replace);
      let probabilities = null;
      if (!MENU[template]) {
        const titles = visible().map((s, i) => `${i + 1}. [${s.slide.template}] ${plainTitle(s.slide.title)}`).join("\n");
        const r = await jev(`Deck style: ${STYLE_STATE[style]}.\n${titles ? `Slides already in the deck:\n${titles}` : "The deck is empty."}\nContent for the slide: ${about}`,
          { template: { instructions: `Which slide template best fits this content?\n${GUIDE}`, options: MENU_OPTIONS } });
        template = r.template.choice; probabilities = r.template.probabilities;
        log({ step: "Classify", model: "Jev", ms: r._ms, detail: `${template} · p ${r.template.p.toFixed(2)}` });
      }
      let slideId = replace;
      if (!slideId) {
        slideId = newId(new Set(deck.slides.map((s) => s.id)));
        const at = after === "end" || !find(after) ? deck.slides.length : deck.slides.findIndex((s) => s.id === after) + 1;
        deck.slides.splice(at, 0, { id: slideId, slide: null, pending: true, issues: [], warnings: [] });
      }
      cards.set(slideId, template);
      return { slideId, template, probabilities, card: describe(template, style), example: JSON.parse(exampleFor(template, style)) };
    },

    async edit_slide({ slideId, slide }) {
      const item = find(slideId);
      if (!item) return unknown(slideId);
      slide = asValue(slide);
      if (!slide || typeof slide !== "object" || Array.isArray(slide)) return { applied: false, issues: ["slide: must be a JSON object { template, ...fields }."] };
      const allowed = cards.get(slideId) || item.slide?.template;
      slide = { template: slide.template || allowed, ...slide };
      if (slide.template !== allowed) return { applied: false, issues: [`template: this slide is a ${allowed} slide. To change its template, call create_slide with replace: "${slideId}" first.`] };
      const { slide: fixed, fixes } = autofix(slide, style);
      const v = validate(fixed, style);
      const shape = v.errors.filter((e) => !LIMIT.test(e)), limits = v.errors.filter((e) => LIMIT.test(e));
      if (shape.length) return { applied: false, issues: shape, autofixes: fixes };
      const index = deck.slides.indexOf(item);
      let measured;
      try { measured = measure(fixed, index); } catch (e) { return { applied: false, issues: [`slide could not be rendered: ${e.message}`, ...limits], autofixes: fixes }; }
      const issues = [...limits, ...measured];
      const rules = ruleChecks(fixed, style, measure.lines).filter((c) => !c.ok).map((c) => `${c.id}: ${c.msg}`);
      const changed = changedFields(item.slide, fixed);
      Object.assign(item, { slide: fixed, pending: false, issues, warnings: [...v.warnings, ...rules] });
      onChange?.(deck, slideId);
      return { applied: true, changed, slide: fixed, issues, warnings: item.warnings, autofixes: fixes };
    },

    async read_slide({ slideId }) {
      const item = find(slideId);
      if (!item || item.pending) return unknown(slideId);
      return { slide: item.slide, template: item.slide.template, card: describe(item.slide.template, style), issues: item.issues, warnings: item.warnings };
    },
  };

  const trail = { modelCalls: 0, toolCalls: 0, modelMs: 0 };
  history.push({ role: "user", content: `${stateBlock({ style, theme: deck.theme, slides: visible(), selection })}\n\n${text}` });
  for (;;) {
    const capped = trail.toolCalls >= MAX_TOOL_CALLS;
    const { message, ms } = await agentStep({ messages: [{ role: "system", content: agentSystem(style) }, ...history], tools: TOOLS, toolChoice: capped ? "none" : "auto" });
    trail.modelCalls++; trail.modelMs += ms;
    history.push(message);
    const calls = message.tool_calls || [];
    log({ step: calls.length ? "Agent" : "Reply", model: "GLM Flash", ms, detail: calls.length ? calls.map((c) => c.function.name).join(", ") : `after ${trail.toolCalls} tool call${trail.toolCalls === 1 ? "" : "s"}` });
    if (!calls.length) break;
    for (const call of message.tool_calls) {
      trail.toolCalls++;
      const t0 = performance.now();
      let args, out;
      try { args = JSON.parse(call.function.arguments || "{}"); } catch { args = null; }
      if (!args) out = { error: "arguments were not valid JSON" };
      else if (!tools[call.function.name]) out = { error: `unknown tool ${call.function.name}; tools: ${Object.keys(tools).join(", ")}` };
      else out = await tools[call.function.name](args);
      history.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(out) });
      log({ step: call.function.name, model: "tool", ms: Math.round(performance.now() - t0), detail: summary(call.function.name, out) });
    }
  }
  // Slides reserved but never written this turn are dropped.
  deck.slides = deck.slides.filter((s) => !s.pending);
  const reply = history.at(-1).content || "";
  return { reply, ...trail };
}

function summary(name, out) {
  if (out.error) return out.error;
  if (name === "create_slide") return `${out.slideId} · ${out.template}`;
  if (name === "read_slide") return `${out.template} · ${out.issues.length} issue${out.issues.length === 1 ? "" : "s"}`;
  if (!out.applied) return `not applied · ${out.issues.length} shape error${out.issues.length === 1 ? "" : "s"}: ${out.issues.join(" | ")}`;
  return `applied · changed ${out.changed.join(", ") || "nothing"} · ${out.issues.length ? `${out.issues.length} fit issue${out.issues.length === 1 ? "" : "s"}: ${out.issues.join(" | ")}` : "fits"}`;
}


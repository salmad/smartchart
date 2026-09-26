/* Hybrid agent (spec 9.0–9.5). PRE: one Jev call; when the intent is sure, code makes the first tool call.
   Then GLM 5.3 Flash in a tool loop. New slides are written whole right after create_slide; existing slides
   change only through path patches. Every write: autofix → validate → resolve auto (Jev) → autofix →
   measure → rule checks. The working-slides block goes last before every model step, never into history. */
import { MENU, describe, validate } from "../v5/schema.js";
import { agentStep as glmStep, jev as jevCall } from "./llm.js";
import { GUIDE, MENU_OPTIONS, STYLE_STATE, exampleFor } from "./prompts.js";
import { autofix } from "./autofix.js";
import { applyPatch } from "./patch.js";
import { resolveAuto } from "./resolve.js";
import { ruleChecks } from "./checks.js";
import { LEADS, LEAD_Q, P_ACT, P_LEAD, firstCall, preStep } from "./pre.js";
import { TOOLS, agentSystem, stateBlock, workingBlock } from "./agent-prompt.js";

const MAX_TOOL_CALLS = 10;
const plainTitle = (s) => String(s || "").replace(/\[\[|\]\]|\*\*|\[-|-\]|\[\+|\+\]/g, "");
const newId = (taken) => { let id; do id = `s_${Math.random().toString(36).slice(2, 6)}`; while (taken.has(id)); return id; };
// Models sometimes send objects as JSON strings; accept both.
const asValue = (v) => { if (typeof v === "string" && /^\s*[[{]/.test(v)) { try { return JSON.parse(v); } catch { /* keep the string */ } } return v; };
/* validate() lists limits with shape errors. Limits are fit issues: applied and returned (spec 9.4). */
const LIMIT = /characters|at most|budget|too many|Cut or merge|Shorten|with notes|with a takeaway/i;
/** An issue belongs to a patch when its leading path and a patched path share a prefix. */
const touches = (issue, paths) => { const r = String(issue).split(/[:\s]/)[0]; return paths.some((p) => r.startsWith(p) || p.startsWith(r)); };

/**
 * One user turn. deck = { style, theme, slides: [{ id, slide, pending?, issues, warnings, checks? }] } and
 * history are mutated in place; `working` (a Set of slide ids) is owned by the caller and kept across turns.
 * measure(slide, index) → layout issues, with `.lines` (title lines) and `.warnings` (L5) set on it.
 */
export async function runTurn({ text, deck, history, working, selection, measure, log, onChange, models = {} }) {
  const agentStep = models.agentStep || glmStep, jev = models.jev || jevCall;
  const style = deck.style, reserved = new Map(), written = new Set();
  const trail = { modelCalls: 0, toolCalls: 0, modelMs: 0 };
  const find = (id) => deck.slides.find((s) => s.id === id);
  const unknown = (id) => ({ error: `unknown slideId ${id}; valid ids: ${deck.slides.filter((s) => !s.pending).map((s) => s.id).join(", ") || "none yet"}` });
  const visible = () => deck.slides.filter((s) => !s.pending);

  async function classify(about) {
    const titles = visible().map((s, i) => `${i + 1}. [${s.slide.template}] ${plainTitle(s.slide.title)}`).join("\n");
    const r = await jev(`Deck style: ${STYLE_STATE[style]}.\n${titles ? `Slides already in the deck:\n${titles}` : "The deck is empty."}\nContent for the slide: ${about}`,
      { template: { instructions: `Which slide template best fits this content?\n${GUIDE}`, options: MENU_OPTIONS }, lead: { instructions: LEAD_Q, options: LEADS } });
    log({ step: "Classify", model: "Jev", ms: r._ms, detail: `${r.template.choice} · p ${r.template.p.toFixed(2)}` });
    return { template: r.template.choice, probabilities: r.template.probabilities, lead: r.lead.p >= P_LEAD ? r.lead.choice : null };
  }

  async function write(item, input) {
    const first = autofix(input, style), v = validate(first.slide, style);
    const shape = v.errors.filter((e) => !LIMIT.test(e)), limits = v.errors.filter((e) => LIMIT.test(e));
    if (shape.length) return { applied: false, issues: shape, autofixes: first.fixes };
    const r = await resolveAuto(first.slide, style, jev);
    if (Object.keys(r.resolved).length) log({ step: "Resolve", model: "Jev", ms: r.ms, detail: Object.entries(r.resolved).map(([k, x]) => `${k} = ${x.value}`).join(" · ") });
    const done = autofix(r.slide, style), slide = done.slide;
    let measured;
    try { measured = measure(slide, deck.slides.indexOf(item)); } catch (e) { return { applied: false, issues: [`slide could not be rendered: ${e.message}`, ...limits], autofixes: first.fixes }; }
    const issues = [...limits, ...measured];
    const rules = ruleChecks(slide, style, measure.lines).filter((c) => !c.ok).map((c) => `${c.id}: ${c.msg}`);
    Object.assign(item, { slide, pending: false, issues, warnings: [...v.warnings, ...(measure.warnings || []), ...rules], checks: [] });
    working.add(item.id); written.add(item.id);
    onChange?.(deck, item.id);
    return { applied: true, issues, warnings: item.warnings, autofixes: [...first.fixes, ...done.fixes], resolved: r.resolved };
  }

  const tools = {
    async create_slide({ about = "", after = "end", template, replace }, pre) {
      if (replace && !find(replace)) return unknown(replace);
      let probabilities = pre?.probabilities || null, lead = pre?.lead || null;
      if (!MENU[template]) ({ template, probabilities, lead } = await classify(about));
      let slideId = replace;
      if (!slideId) {
        slideId = newId(new Set(deck.slides.map((s) => s.id)));
        const at = after === "end" || !find(after) ? deck.slides.length : deck.slides.findIndex((s) => s.id === after) + 1;
        deck.slides.splice(at, 0, { id: slideId, slide: null, pending: true, issues: [], warnings: [] });
      }
      reserved.set(slideId, template);
      const decided = template === "cards" && lead ? { "cards.lead": lead } : {};
      const example = exampleFor(template, style, lead);
      return { slideId, template, probabilities, decided, card: describe(template, style), example: example === "(none)" ? null : JSON.parse(example) };
    },

    async edit_slide({ slideId, slide }) {
      const item = find(slideId);
      if (!item) return unknown(slideId);
      if (!reserved.has(slideId)) return { applied: false, error: `${slideId} already exists: change it with patch_slide, setting only the paths that change. edit_slide writes a whole slide only right after create_slide.` };
      slide = asValue(slide);
      if (!slide || typeof slide !== "object" || Array.isArray(slide)) return { applied: false, issues: ["slide: must be a JSON object { template, ...fields }."] };
      const allowed = reserved.get(slideId);
      slide = { template: slide.template || allowed, ...slide };
      if (slide.template !== allowed) return { applied: false, issues: [`template: this is a ${allowed} slide. To change the template, call create_slide with replace: "${slideId}" first.`] };
      return write(item, slide);
    },

    async patch_slide({ slideId, set }) {
      const item = find(slideId);
      if (!item) return unknown(slideId);
      if (item.pending) return { applied: false, error: `${slideId} has no content yet: write it whole with edit_slide first.` };
      set = asValue(set);
      if (set && typeof set === "object") set = Object.fromEntries(Object.entries(set).map(([k, v]) => [k, asValue(v)]));
      const p = applyPatch(item.slide, set);
      if (p.errors) return { applied: false, issues: p.errors };
      const res = await write(item, p.slide);
      if (!res.applied) return res;
      return { ...res, changed: p.changed, issues: res.issues.filter((i) => touches(i, p.changed)), elsewhere: res.issues.filter((i) => !touches(i, p.changed)) };
    },

    async read_slide({ slideId }) {
      const item = find(slideId);
      if (!item || item.pending) return unknown(slideId);
      working.add(slideId);
      return { slideId, template: item.slide.template, card: describe(item.slide.template, style), note: "The slide's current JSON is in the Working slides message." };
    },
  };

  /** Run one tool call and record it. Returns whether it was clean and the reply it carried. */
  async function callTool({ id, name, args, raw }, pre, byCode = false) {
    trail.toolCalls++;
    if (byCode) history.push({ role: "assistant", content: "", tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }] });
    if (raw !== undefined) { try { args = JSON.parse(raw || "{}"); } catch { args = null; } }
    const t0 = performance.now();
    let out;
    if (!args) out = { error: "arguments were not valid JSON" };
    else if (!tools[name]) out = { error: `unknown tool ${name}; tools: ${Object.keys(tools).join(", ")}` };
    else out = await tools[name](args, pre);
    history.push({ role: "tool", tool_call_id: id, content: JSON.stringify(out) });
    log({ step: name, model: byCode ? "code" : "tool", ms: Math.round(performance.now() - t0), detail: summary(name, out) });
    const wrote = name === "edit_slide" || name === "patch_slide";
    const clean = !out.error && (!wrote || (out.applied && !out.issues.length && !out.elsewhere?.length));
    return { clean, reply: wrote && out.applied && typeof args.reply === "string" && args.reply.trim() ? args.reply.trim() : null };
  }

  history.push({ role: "user", content: `${stateBlock({ style, theme: deck.theme, slides: visible(), selection })}\n\n${text}` });
  const pre = await preStep({ text, deck, selection, jev });
  log({ step: "Pre", model: "Jev", ms: pre.ms, detail: `${pre.intent} · p ${pre.p.toFixed(2)}${pre.p >= P_ACT ? "" : " · agent decides"}` });
  const first = firstCall(pre, selection, text, deck);
  if (first) await callTool({ id: "pre_1", name: first.name, args: first.args }, pre, true);

  let reply = null;
  while (reply === null) {
    const capped = trail.toolCalls >= MAX_TOOL_CALLS;
    const messages = [{ role: "system", content: agentSystem(style) }, ...history, { role: "user", content: workingBlock(deck.slides.filter((s) => working.has(s.id) && s.slide)) }];
    const { message, ms } = await agentStep({ messages, tools: TOOLS, toolChoice: capped ? "none" : "auto" });
    trail.modelCalls++; trail.modelMs += ms;
    history.push(message);
    const calls = message.tool_calls || [];
    log({ step: calls.length ? "Agent" : "Reply", model: "GLM Flash", ms, detail: calls.length ? calls.map((c) => c.function.name).join(", ") : `after ${trail.toolCalls} tool call${trail.toolCalls === 1 ? "" : "s"}` });
    if (!calls.length) { reply = message.content || ""; break; }
    let clean = true, carried = null;
    for (const c of calls) {
      const r = await callTool({ id: c.id, name: c.function.name, raw: c.function.arguments });
      clean &&= r.clean; carried = r.reply || carried;
    }
    if (clean && carried) { reply = carried; history.push({ role: "assistant", content: reply }); }
  }
  deck.slides = deck.slides.filter((s) => !s.pending);
  return { reply, pre, written: [...written], ...trail };
}

function summary(name, out) {
  if (out.error) return out.error;
  if (name === "create_slide") return `${out.slideId} · ${out.template}`;
  if (name === "read_slide") return `${out.slideId} · ${out.template}`;
  if (!out.applied) return `not applied · ${out.issues.length} shape error${out.issues.length === 1 ? "" : "s"}: ${out.issues.join(" | ")}`;
  const left = [...out.issues, ...(out.elsewhere || [])];
  return `applied${out.changed ? ` · ${out.changed.join(", ")}` : ""} · ${left.length ? `${left.length} issue${left.length === 1 ? "" : "s"}: ${left.join(" | ")}` : "fits"}`;
}

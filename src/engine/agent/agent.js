/* Hybrid agent (spec 9.0–9.5). PRE: one Jev call; when the intent is sure, code makes the first tool call.
   Then GLM 5.3 Flash in a tool loop. New slides are written whole right after create_slide; existing slides
   change only through path patches. Every write: autofix → validate → resolve auto (Jev) → autofix →
   measure → rule checks. The working-slides block goes last before every model step, never into history. */
import { MENU, describe, validate } from "../slides/schema";
import { agentStep as glmStep, jev as jevCall } from "./llm";
import { GUIDE, MENU_OPTIONS, STYLE_STATE, exampleFor } from "./prompts";
import { autofix } from "./autofix";
import { applyPatch } from "./patch";
import { resolveAuto } from "./resolve";
import { ruleChecks } from "./checks";
import { LEADS, LEAD_Q, P_LEAD, firstCall, isSure, preStep } from "./pre";
import { TOOLS, agentSystem, stateBlock, workingBlock } from "./agent-prompt";
import { shorten, targets } from "./shorten";

const MAX_TOOL_CALLS = 10, SHORTEN_ROUNDS = 2;
const NAMED_MARK = /\b(bars?|columns?|lines?|line chart|area|histogram)\b/i;
// Intents where a clean write finishes the request, so code ends the turn without a reply call.
const DONE_BY = { new_slide: true, change_template: true, edit_selected: true };
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
  const style = deck.style, reserved = new Map(), written = new Set(), read = new Set();
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

  async function write(item, input, round = 0) {
    const first = autofix(input, style), v = validate(first.slide, style);
    const shape = v.errors.filter((e) => !LIMIT.test(e)), limits = v.errors.filter((e) => LIMIT.test(e));
    if (shape.length) return { applied: false, issues: shape, autofixes: first.fixes };
    const r = await resolveAuto(first.slide, style, jev, text);
    if (Object.keys(r.resolved).length) log({ step: "Resolve", model: "Jev", ms: r.ms, detail: Object.entries(r.resolved).map(([k, x]) => `${k} = ${x.value}`).join(" · ") });
    const done = autofix(r.slide, style), slide = done.slide;
    let measured;
    try { measured = measure(slide, deck.slides.indexOf(item)); } catch (e) { return { applied: false, issues: [`slide could not be rendered: ${e.message}`, ...limits], autofixes: first.fixes }; }
    const issues = [...limits, ...measured];
    const rules = ruleChecks(slide, style, measure.lines).filter((c) => !c.ok).map((c) => `${c.id}: ${c.msg}`);
    Object.assign(item, { slide, pending: false, issues, warnings: [...v.warnings, ...(measure.warnings || []), ...rules], checks: [] });
    working.add(item.id); written.add(item.id);
    onChange?.(deck, item.id);
    const result = { applied: true, issues, warnings: item.warnings, autofixes: [...first.fixes, ...done.fixes], resolved: r.resolved };
    // Over-long text: one small call per field instead of another agent step.
    const long = round < SHORTEN_ROUNDS ? targets(issues, slide) : [];
    if (!long.length) return result;
    const cut = await shorten(long, style, agentStep, slide);
    trail.modelCalls += long.length;
    log({ step: "Shorten", model: "GLM Flash", ms: cut.ms, detail: long.map((t) => `${t.path} ≤ ${t.max}${cut.set[t.path] ? "" : " (kept)"}`).join(" · ") });
    if (!Object.keys(cut.set).length) return result;
    const next = await write(item, applyPatch(slide, cut.set).slide, round + 1);
    return { ...next, shortened: [...Object.keys(cut.set), ...(next.shortened || [])] };
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
      // Building a new slide: other slides stay out of view unless read or written this turn, so their
      // content and open checks do not leak into the new one.
      [...working].forEach((id) => { if (!read.has(id) && !written.has(id)) working.delete(id); });
      const decided = template === "cards" && lead ? { "cards.lead": lead } : {};
      const example = exampleFor(template, style, lead);
      return { slideId, template, probabilities, decided, card: describe(template, style), example: example === "(none)" ? null : JSON.parse(example) };
    },

    async edit_slide({ slideId, slide }) {
      // Models sometimes drop the id right after create_slide; with one slide reserved it is unambiguous.
      if (!slideId && reserved.size === 1) slideId = [...reserved.keys()][0];
      const item = find(slideId);
      if (!item) return unknown(slideId);
      if (!reserved.has(slideId)) return { applied: false, error: `${slideId} already exists: change it with patch_slide, setting only the paths that change. edit_slide writes a whole slide only right after create_slide.` };
      slide = asValue(slide);
      if (!slide || typeof slide !== "object" || Array.isArray(slide)) return { applied: false, issues: ["slide: must be a JSON object { template, ...fields }."] };
      const allowed = reserved.get(slideId);
      slide = { template: slide.template || allowed, ...slide };
      if (slide.template !== allowed) return { applied: false, issues: [`template: this is a ${allowed} slide. To change the template, call create_slide with replace: "${slideId}" first.`] };
      // Chart choices go to code unless the user named them (spec 9.1): marks and stacking become "auto".
      if (Array.isArray(slide.chart?.series)) {
        if (!NAMED_MARK.test(text)) slide.chart.series.forEach((x) => { if (x && typeof x === "object" && x.mark !== "auto") x.mark = "auto"; });
        if (!/stack/i.test(text) && slide.chart.stacked !== undefined) slide.chart.stacked = "auto";
      }
      return write(item, slide);
    },

    async patch_slide({ slideId, set }) {
      // A dropped id is unambiguous when one slide is being worked on.
      if (!slideId && working.size === 1) slideId = [...working][0];
      const item = find(slideId);
      if (!item) return unknown(slideId);
      if (item.pending) return { applied: false, error: `${slideId} has no content yet: write it whole with edit_slide first.` };
      set = asValue(set);
      if (set && typeof set === "object") set = Object.fromEntries(Object.entries(set).map(([k, v]) => [prefixed(item.slide, k), asValue(v)]));
      const p = applyPatch(item.slide, set);
      if (!p.errors && !NAMED_MARK.test(text)) matchNewSeries(item.slide, p.slide);
      if (p.errors) return { applied: false, issues: p.errors };
      const res = await write(item, p.slide);
      if (!res.applied) return res;
      return { ...res, changed: p.changed, issues: res.issues.filter((i) => touches(i, p.changed)), elsewhere: res.issues.filter((i) => !touches(i, p.changed)) };
    },

    async read_slide({ slideId }) {
      const item = find(slideId);
      if (!item || item.pending) return unknown(slideId);
      working.add(slideId); read.add(slideId);
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
    return { clean, name, out, args, reply: wrote && out.applied && typeof args.reply === "string" && args.reply.trim() ? args.reply.trim() : null };
  }

  // The working set starts with the selected slide only; the agent reads others when it needs them.
  working.clear();
  if (selection?.slideId && find(selection.slideId)?.slide) working.add(selection.slideId);
  history.push({ role: "user", content: `${stateBlock({ style, theme: deck.theme, slides: visible(), selection })}\n\n${text}` });
  const pre = await preStep({ text, deck, selection, jev });
  const sure = isSure(pre, deck), first = firstCall(pre, selection, text, deck);
  log({ step: "Pre", model: "Jev", ms: pre.ms, detail: `${pre.intent} · p ${pre.p.toFixed(2)}${sure ? "" : " · agent decides"}` });
  if (first) await callTool({ id: "pre_1", name: first.name, args: first.args }, pre, true);

  let reply = null;
  while (reply === null) {
    const capped = trail.toolCalls >= MAX_TOOL_CALLS;
    const messages = [{ role: "system", content: agentSystem(style) }, ...history, { role: "user", content: workingBlock(deck.slides.filter((s) => working.has(s.id) && s.slide)) }];
    const { message, ms, tokensIn = 0, tokensOut = 0 } = await agentStep({ messages, tools: TOOLS, toolChoice: capped ? "none" : "auto" });
    trail.modelCalls++; trail.modelMs += ms;
    history.push(message);
    const calls = message.tool_calls || [];
    log({ step: calls.length ? "Agent" : "Reply", model: "GLM Flash", ms, tokensIn, tokensOut,
      detail: `${calls.length ? calls.map((c) => c.function.name).join(", ") : `after ${trail.toolCalls} tool call${trail.toolCalls === 1 ? "" : "s"}`}${tokensIn ? ` · ${(tokensIn / 1000).toFixed(1)}k in, ${tokensOut} out` : ""}` });
    if (!calls.length) { reply = message.content || ""; break; }
    let clean = true, carried = null;
    const done = [];
    for (const c of calls) {
      const r = await callTool({ id: c.id, name: c.function.name, raw: c.function.arguments });
      clean &&= r.clean; carried = r.reply || carried; done.push(r);
    }
    // A sure single-slide request that ends on a clean write needs no reply call: code writes the reply.
    const finishing = sure && DONE_BY[pre.intent] && done.every((r) => r.name === "edit_slide" || r.name === "patch_slide");
    if (clean && !carried && finishing) carried = message.content?.trim() || codeReply(pre.intent, done.at(-1), find(done.at(-1).args?.slideId)?.slide || deck.slides.find((x) => written.has(x.id))?.slide);
    if (clean && carried) { reply = carried; history.push({ role: "assistant", content: reply }); }
  }
  deck.slides = deck.slides.filter((s) => !s.pending);
  compact(history);
  return { reply, pre, written: [...written], ...trail };
}

/* After a turn, the history keeps what was done, not the reference material: template cards and examples
   leave create_slide results, and whole-slide JSON leaves edit_slide calls (the Working slides block has
   the current JSON). Keeps long sessions small and stops old content from leaking into new slides. */
function compact(history) {
  const creates = new Set();
  for (const m of history) {
    for (const c of m.tool_calls || []) {
      if (c.function.name === "create_slide") creates.add(c.id);
      if (c.function.name === "edit_slide" && !c.function.arguments.includes("(written)")) {
        let a = {}; try { a = JSON.parse(c.function.arguments); } catch { /* keep the id only */ }
        c.function.arguments = JSON.stringify({ slideId: a.slideId, slide: "(written)" });
      }
    }
    if (m.role === "tool" && creates.has(m.tool_call_id) && m.content.includes('"card"')) {
      let o = {}; try { o = JSON.parse(m.content); } catch { /* leave as is */ }
      m.content = JSON.stringify({ slideId: o.slideId, template: o.template });
    }
  }
}

/* The reply code writes when it ends the turn: what changed, and anything the user should know. */
const FIELD = { title: "title", subtitle: "subtitle", takeaway: "takeaway", kicker: "kicker", footnote: "footnote", source: "source", notes: "notes", chart: "chart", table: "table", cards: "cards", steps: "steps", number: "number", body: "text", focus: "highlight" };
const NEXT = "What would you like to change next?";
function codeReply(intent, r, slide) {
  const extra = [];
  if (/illustrative/i.test(slide?.footnote || "")) extra.push("The figures are illustrative and marked in the footnote.");
  // Marks code picked, named by series: "Revenue as bars, Margin as a line".
  const marks = Object.entries(r.out.resolved || {}).map(([k, x]) => [k.match(/series\[(\d+)\]\.mark$/)?.[1], x.value]).filter(([i]) => i !== undefined)
    .map(([i, v]) => `${slide?.chart?.series?.[i]?.name || `series ${Number(i) + 1}`} as ${v === "line" ? "a line" : "bars"}`);
  if (marks.length) extra.push(`Showing ${marks.join(", ")}; ask if you want it the other way.`);
  if (intent === "edit_selected") {
    const parts = [...new Set((r.out.changed || []).map((p) => { const [head, i] = [p.split(/[.[]/)[0], p.match(/^\w+\[(\d+)\]/)?.[1]];
      return i !== undefined && ["cards", "steps", "notes"].includes(head) ? `${head.replace(/s$/, "")} ${Number(i) + 1}` : FIELD[head] || head; }))];
    return [`Updated the ${parts.join(", ")}.`, ...extra, NEXT].join(" ");
  }
  const kind = slide?.template === "number" ? "big-number" : slide?.template || "new";
  return [intent === "change_template" ? `Switched it to a ${kind} slide.` : `Added a ${kind} slide.`, ...extra, NEXT].join(" ");
}

/** "rows[0]" → "table.rows[0]" when the head is not a slide field but belongs to exactly one of its objects. */
function prefixed(slide, path) {
  const head = String(path).split(/[.[]/)[0];
  if (head in slide) return path;
  const owners = Object.entries(slide).filter(([, v]) => v && typeof v === "object" && !Array.isArray(v) && head in v).map(([k]) => k);
  return owners.length === 1 ? `${owners[0]}.${path}` : path;
}

/* Chart guide: comparable series share a mark. A series a patch adds takes the mark of an existing series
   in the same unit (unless the user named one); with none, code picks ("auto"). */
function matchNewSeries(before, after) {
  const old = before.chart?.series || [], all = after.chart?.series;
  if (!Array.isArray(all) || all.length <= old.length) return;
  const unit = (x) => x?.format || after.chart.format || "{v}";
  all.slice(old.length).forEach((x) => {
    if (!x || typeof x !== "object") return;
    const twin = old.find((o) => unit(o) === unit(x));
    x.mark = twin ? twin.mark : "auto";
  });
}

function summary(name, out) {
  if (out.error) return out.error;
  if (name === "create_slide") return `${out.slideId} · ${out.template}`;
  if (name === "read_slide") return `${out.slideId} · ${out.template}`;
  if (!out.applied) return `not applied · ${out.issues.length} shape error${out.issues.length === 1 ? "" : "s"}: ${out.issues.join(" | ")}`;
  const left = [...out.issues, ...(out.elsewhere || [])];
  return `applied${out.changed ? ` · ${out.changed.join(", ")}` : ""} · ${left.length ? `${left.length} issue${left.length === 1 ? "" : "s"}: ${left.join(" | ")}` : "fits"}`;
}

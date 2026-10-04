/* Hybrid agent (spec 9.0–9.5). PRE: one Jev call; when the intent is sure, code makes the first tool call.
   Then GLM 5.3 Flash in a tool loop. New slides are written whole right after create_slide; existing slides
   change only through path patches. Every write: autofix → validate → resolve auto (Jev) → autofix →
   measure → rule checks. The working-slides block goes last before every model step, never into history. */
import { OFFERED, describe, headline, isTemplate } from "../slides/schema.js";
import { agentStep as glmStep, jev as jevCall, type AgentStepFn, type ChatMessage, type JevFn } from "./llm.js";
import { GUIDE, MENU_OPTIONS, STYLE_STATE, exampleFor } from "./prompts.js";
import { checkWrite } from "./write.js";
import { applyPatch } from "./patch.js";
import type { Resolved } from "./resolve.js";
import type { Check } from "./checks.js";
import { LEADS, LEAD_Q, P_LEAD, firstCall, isSure, preStep, type Pre, type Selection } from "./pre.js";
import { TOOLS, agentSystem, stateBlock, workingBlock } from "./agent-prompt.js";
import { shorten, targets } from "./shorten.js";
import type { Series, Slide, Style, TemplateId, Theme } from "../types.js";

export interface AgentSlide { id: string; slide: Slide | null; pending?: boolean; issues: string[]; warnings: string[]; checks?: Check[] }
export interface AgentDeck { style: Style; theme: Theme; slides: AgentSlide[] }
/** Renders and measures a slide: layout issues, with the title's line count and the L5 warnings set on it. */
export type MeasureFn = ((slide: Slide, index: number) => string[]) & { lines: number; warnings?: string[] };
export interface TraceStep { step: string; detail: string; model: string; ms?: number; tokensIn?: number; tokensOut?: number }
export interface TurnResult { reply: string; pre: Pre; written: string[]; modelCalls: number; toolCalls: number; modelMs: number }
export interface TurnArgs {
  text: string; deck: AgentDeck; history: ChatMessage[]; working: Set<string>; selection: Selection
  measure: MeasureFn; log: (s: TraceStep) => void; onChange?: (d: AgentDeck, focusId?: string) => void
  models?: { agentStep?: AgentStepFn; jev?: JevFn }
  /** With attached files, `text` carries them in full for the writer. `ask` is the user's own words (what they asked
      for: a cover, a stacked chart); `brief` is the ask with the start of each file (what Jev routes on). Both
      default to `text`. */
  ask?: string; brief?: string
  /** Slides the user saved by hand since the last turn; the deck state names them. */
  edited?: string[]
}

/* Tool arguments come from the model's JSON; each tool reads the fields it needs. */
interface ToolArgs { about?: string; after?: string; template?: string; replace?: string; slideId?: string; slide?: unknown; set?: unknown; reply?: unknown }
/** Every tool result shape in one: an error, a write result, or a create/read result. */
interface ToolOut {
  error?: string; applied?: boolean; issues?: string[]; warnings?: string[]; elsewhere?: string[]; changed?: string[]
  autofixes?: string[]; resolved?: Resolved; shortened?: string[]
  slideId?: string; template?: TemplateId; probabilities?: Record<string, number> | null; decided?: Record<string, string>
  /** A refused template change: the agent must ask the user first (see create_slide). */
  confirm?: "template";
  card?: ReturnType<typeof describe>; example?: unknown; note?: string
  /** Reserved slides still to write this turn. */
  todo?: string
}
interface WriteResult extends ToolOut { applied: boolean; issues: string[] }
interface CallResult { clean: boolean; name: string; out: ToolOut; args: ToolArgs | null; reply: string | null }
type Draft = Slide & Record<string, unknown>;

const MAX_TOOL_CALLS = 10, SHORTEN_ROUNDS = 2;
export const NAMED_MARK = /\b(bars?|columns?|lines?|line chart|area|histogram)\b/i;
// Intents where a clean write finishes the request, so code ends the turn without a reply call.
const DONE_BY: Record<string, boolean> = { new_slide: true, change_template: true, edit_selected: true };
const newId = (taken: Set<string>) => { let id: string; do id = `s_${Math.random().toString(36).slice(2, 6)}`; while (taken.has(id)); return id; };
// Models sometimes send objects as JSON strings; accept both.
const asValue = (v: unknown): unknown => { if (typeof v === "string" && /^\s*[[{]/.test(v)) { try { return JSON.parse(v); } catch { /* keep the string */ } } return v; };
/* validate() lists limits with shape errors. Limits are fit issues: applied and returned (spec 9.4). */
/** An issue belongs to a patch when its leading path and a patched path share a prefix. */
export const touches = (issue: string, paths: string[]) => { const r = String(issue).split(/[:\s]/)[0]; return paths.some((p) => r.startsWith(p) || p.startsWith(r)); };

/**
 * One user turn. deck = { style, theme, slides: [{ id, slide, pending?, issues, warnings, checks? }] } and
 * history are mutated in place; `working` (a Set of slide ids) is owned by the caller and kept across turns.
 * measure(slide, index) → layout issues, with `.lines` (title lines) and `.warnings` (L5) set on it.
 */
export async function runTurn({ text, deck, history, working, selection, edited = [], measure, log, onChange, models = {}, ask = text, brief = text }: TurnArgs): Promise<TurnResult> {
  const agentStep = models.agentStep || glmStep, jev = models.jev || jevCall;
  const style = deck.style, reserved = new Map<string, TemplateId>(), written = new Set<string>(), read = new Set<string>();
  const trail = { modelCalls: 0, toolCalls: 0, modelMs: 0 };
  const find = (id: string | undefined) => deck.slides.find((s) => s.id === id);
  const unknown = (id: string | undefined): ToolOut => ({ error: `unknown slideId ${id}; valid ids: ${deck.slides.filter((s) => !s.pending).map((s) => s.id).join(", ") || "none yet"}` });
  const unwritten = () => deck.slides.filter((s) => s.pending).map((s) => s.id);
  const visible = () => deck.slides.filter((s): s is AgentSlide & { slide: Slide } => !s.pending && !!s.slide);
  // Template changes need the user: allowed when this turn's message asks for one (PRE, sure), or when the last
  // turn asked about this slide and the user answered. Otherwise create_slide refuses and the agent asks.
  let turnPre: Pre | null = null;
  const confirmable = askedLastTurn(history);

  async function classify(about: string): Promise<{ template: TemplateId; probabilities: Record<string, number>; lead: string | null }> {
    const titles = visible().map((s, i) => `${i + 1}. [${s.slide.template}] ${headline(s.slide)}`).join("\n");
    const r = await jev(`Deck style: ${STYLE_STATE[style]}.\n${titles ? `Slides already in the deck:\n${titles}` : "The deck is empty."}\nContent for the slide: ${about}`,
      { template: { instructions: `Which slide template best fits this content?\n${GUIDE}`, options: MENU_OPTIONS }, lead: { instructions: LEAD_Q, options: LEADS } });
    log({ step: "Classify", model: "Jev", ms: r._ms, detail: `${r.template.choice} · p ${r.template.p.toFixed(2)}` });
    // Jev answers with one of the options, which are the template ids.
    return { template: r.template.choice as TemplateId, probabilities: r.template.probabilities, lead: r.lead.p >= P_LEAD ? r.lead.choice : null };
  }

  async function write(item: AgentSlide, input: unknown, round = 0): Promise<WriteResult> {
    const w = await checkWrite(input, { style, jev, brief, strict: true,
      measure: (s) => { const issues = measure(s, deck.slides.indexOf(item)); return { issues, lines: measure.lines, warnings: measure.warnings || [] }; } });
    if (!w.applied) return { applied: false, issues: w.issues, autofixes: w.autofixes };
    if (Object.keys(w.resolved).length) log({ step: "Resolve", model: "Jev", ms: w.resolveMs, detail: Object.entries(w.resolved).map(([k, x]) => `${k} = ${x.value}`).join(" · ") });
    const { slide, issues } = w;
    Object.assign(item, { slide, pending: false, issues, warnings: w.warnings, checks: [] });
    working.add(item.id); written.add(item.id);
    onChange?.(deck, item.id);
    const result: WriteResult = { applied: true, issues, warnings: item.warnings, autofixes: w.autofixes, resolved: w.resolved };
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

  const tools: Record<string, (args: ToolArgs, pre?: Pre) => Promise<ToolOut>> = {
    async create_slide({ about = "", after = "end", template: asked, replace }, pre) {
      if (replace && !find(replace)) return unknown(replace);
      let template: TemplateId, probabilities = pre?.probabilities || null, lead = pre?.lead || null;
      // An archived template cannot be named (it is not in the tool's enum); a model that writes it anyway is refused.
      if (isTemplate(asked) && !OFFERED.includes(asked)) return { error: `template: "${asked}" is not available. Use one of: ${OFFERED.join(", ")}, or leave template out.` };
      if (isTemplate(asked)) template = asked; else ({ template, probabilities, lead } = await classify(about));
      const current = replace ? find(replace)?.slide?.template : undefined;
      const requested = !!turnPre && turnPre.intent === "change_template" && isSure(turnPre, deck);
      if (replace && current && current !== template && !requested && !confirmable.has(replace)) {
        return { confirm: "template", slideId: replace, template, error: `Changing ${replace} from a ${current} slide to a ${template} slide needs the user's go-ahead. Write nothing more this turn. Reply with one sentence on why, then numbered options, e.g. "1. Switch it to a ${template} slide" and "2. Keep it as a ${current} slide" with how you would do the request that way. If they pick the switch, call create_slide with replace again.` };
      }
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
      const decided: Record<string, string> = template === "cards" && lead ? { "cards.lead": lead } : {};
      const example = exampleFor(template, style, lead);
      return { slideId, template, probabilities, decided, card: describe(template, style), example: example === "(none)" ? null : JSON.parse(example) };
    },

    async edit_slide({ slideId, slide }) {
      // Models sometimes drop the id right after create_slide; with one slide reserved it is unambiguous.
      if (!slideId && reserved.size === 1) slideId = [...reserved.keys()][0];
      const item = find(slideId);
      if (!item) return unknown(slideId);
      const allowed = reserved.get(item.id);
      if (!allowed) return { applied: false, error: `${slideId} already exists: change it with patch_slide, setting only the paths that change. edit_slide writes a whole slide only right after create_slide.` };
      const input = asValue(slide);
      if (!input || typeof input !== "object" || Array.isArray(input)) return { applied: false, issues: ["slide: must be a JSON object { template, ...fields }."] };
      // Model JSON, shaped like a slide; write() validates it. A template the model left out is the reserved one.
      const draft = { template: allowed, ...input } as Draft;
      if (draft.template !== allowed) return { applied: false, issues: [`template: this is a ${allowed} slide. To change the template, call create_slide with replace: "${slideId}" first.`] };
      // Chart choices go to code unless the user named them (spec 9.1): marks and stacking become "auto".
      const chart = draft.chart;
      if (chart && Array.isArray(chart.series)) {
        if (!NAMED_MARK.test(ask)) chart.series.forEach((x) => { if (x && typeof x === "object" && x.mark !== "auto") x.mark = "auto"; });
        if (!/stack/i.test(ask) && chart.stacking !== undefined) chart.stacking = "auto";
      }
      const res = await write(item, draft), left = unwritten();
      // Several slides reserved in one go: a reply on the first write must not end the turn early.
      return res.applied && left.length ? { ...res, todo: `Still to write with edit_slide: ${left.join(", ")}. Reply only after the last one.` } : res;
    },

    async patch_slide({ slideId, set }) {
      // A dropped id is unambiguous when one slide is being worked on.
      if (!slideId && working.size === 1) slideId = [...working][0];
      const item = find(slideId), current = item?.slide;
      if (!item) return unknown(slideId);
      if (item.pending || !current) return { applied: false, error: `${slideId} has no content yet: write it whole with edit_slide first.` };
      let patch = asValue(set);
      if (patch && typeof patch === "object") patch = Object.fromEntries(Object.entries(patch).map(([k, v]) => [prefixed(current, k), asValue(v)]));
      const p = applyPatch(current, patch);
      if (p.errors) return { applied: false, issues: p.errors };
      if (!NAMED_MARK.test(ask)) matchNewSeries(current, p.slide);
      const res = await write(item, p.slide);
      if (!res.applied) return res;
      return { ...res, changed: p.changed, issues: res.issues.filter((i) => touches(i, p.changed)), elsewhere: res.issues.filter((i) => !touches(i, p.changed)) };
    },

    async read_slide({ slideId }) {
      const item = find(slideId);
      if (!item || item.pending || !item.slide) return unknown(slideId);
      working.add(item.id); read.add(item.id);
      return { slideId, template: item.slide.template, card: describe(item.slide.template, style), note: "The slide's current JSON is in the Working slides message." };
    },
  };

  /** Run one tool call and record it. Returns whether it was clean and the reply it carried. */
  async function callTool({ id, name, args, raw }: { id: string; name: string; args?: ToolArgs | null; raw?: string }, pre?: Pre, byCode = false): Promise<CallResult> {
    trail.toolCalls++;
    if (byCode) history.push({ role: "assistant", content: "", tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }] });
    if (raw !== undefined) { try { args = JSON.parse(raw || "{}"); } catch { args = null; } }
    const t0 = performance.now();
    let out: ToolOut;
    if (!args) out = { error: "arguments were not valid JSON" };
    else if (!Object.hasOwn(tools, name)) out = { error: `unknown tool ${name}; tools: ${Object.keys(tools).join(", ")}` };
    else out = await tools[name](args, pre);
    history.push({ role: "tool", tool_call_id: id, content: JSON.stringify(out) });
    log({ step: name, model: byCode ? "code" : "tool", ms: Math.round(performance.now() - t0), detail: summary(name, out) });
    const wrote = name === "edit_slide" || name === "patch_slide";
    // A write that applied always carries its issues list.
    const clean = !out.error && (!wrote || (!!out.applied && !out.issues?.length && !out.elsewhere?.length));
    return { clean, name, out, args: args ?? null, reply: wrote && out.applied && typeof args?.reply === "string" && args.reply.trim() ? args.reply.trim() : null };
  }

  // The working set starts with the selected slide only; the agent reads others when it needs them.
  working.clear();
  if (selection?.slideId && find(selection.slideId)?.slide) working.add(selection.slideId);
  history.push({ role: "user", content: `${stateBlock({ style, theme: deck.theme, slides: visible(), selection, edited })}\n\n${text}` });
  const pre = await preStep({ text: brief, deck, selection, jev });
  turnPre = pre;
  const sure = isSure(pre, deck), first = firstCall(pre, selection, brief, deck);
  log({ step: "Pre", model: "Jev", ms: pre.ms, detail: `${pre.intent} · p ${pre.p.toFixed(2)}${sure ? "" : " · agent decides"}` });
  if (first) await callTool({ id: "pre_1", name: first.name, args: first.args }, pre, true);

  let reply: string | null = null;
  while (reply === null) {
    const capped = trail.toolCalls >= MAX_TOOL_CALLS;
    const messages: ChatMessage[] = [{ role: "system", content: agentSystem(style) }, ...history, { role: "user", content: workingBlock(deck.slides.filter((s): s is AgentSlide & { slide: Slide } => working.has(s.id) && !!s.slide)) }];
    const { message, ms, tokensIn = 0, tokensOut = 0 } = await agentStep({ messages, tools: TOOLS, toolChoice: capped ? "none" : "auto" });
    trail.modelCalls++; trail.modelMs += ms;
    history.push(message);
    const calls = message.tool_calls || [];
    log({ step: calls.length ? "Agent" : "Reply", model: "GLM Flash", ms, tokensIn, tokensOut,
      detail: `${calls.length ? calls.map((c) => c.function.name).join(", ") : `after ${trail.toolCalls} tool call${trail.toolCalls === 1 ? "" : "s"}`}${tokensIn ? ` · ${(tokensIn / 1000).toFixed(1)}k in, ${tokensOut} out` : ""}` });
    if (!calls.length) { reply = message.content || ""; break; }
    let clean = true, carried: string | null = null;
    const done: CallResult[] = [];
    for (const c of calls) {
      const r = await callTool({ id: c.id, name: c.function.name, raw: c.function.arguments });
      clean &&= r.clean; carried = r.reply || carried; done.push(r);
    }
    // A sure single-slide request that ends on a clean write needs no reply call: code writes the reply.
    const finishing = sure && DONE_BY[pre.intent] && done.every((r) => r.name === "edit_slide" || r.name === "patch_slide");
    const last = done[done.length - 1];
    if (clean && !carried && finishing) carried = message.content?.trim() || codeReply(pre.intent, last, find(last.args?.slideId)?.slide || deck.slides.find((x) => written.has(x.id))?.slide);
    // Reserved slides still unwritten keep the turn going (the tool result lists them).
    if (clean && carried && !unwritten().length) { reply = carried; history.push({ role: "assistant", content: reply }); }
  }
  deck.slides = deck.slides.filter((s) => !s.pending);
  compact(history);
  return { reply, pre, written: [...written], ...trail };
}

/** Slides whose template change the last turn refused and asked the user about: this turn may make it. */
function askedLastTurn(history: ChatMessage[]): Set<string> {
  const ids = new Set<string>();
  for (let i = history.length - 1; i >= 0 && history[i].role !== "user"; i--) {
    const m = history[i];
    if (m.role !== "tool" || !m.content?.includes('"confirm":"template"')) continue;
    try { const o = JSON.parse(m.content) as { slideId?: unknown }; if (typeof o.slideId === "string") ids.add(o.slideId); } catch { /* not a tool result */ }
  }
  return ids;
}

/* After a turn, the history keeps what was done, not the reference material: template cards and examples
   leave create_slide results, and whole-slide JSON leaves edit_slide calls (the Working slides block has
   the current JSON). Keeps long sessions small and stops old content from leaking into new slides. */
function compact(history: ChatMessage[]) {
  const creates = new Set<string>();
  for (const m of history) {
    for (const c of m.tool_calls || []) {
      if (c.function.name === "create_slide") creates.add(c.id);
      if (c.function.name === "edit_slide" && !c.function.arguments.includes("(written)")) {
        let a: { slideId?: unknown } = {}; try { a = JSON.parse(c.function.arguments); } catch { /* keep the id only */ }
        c.function.arguments = JSON.stringify({ slideId: a.slideId, slide: "(written)" });
      }
    }
    if (m.role === "tool" && creates.has(m.tool_call_id ?? "") && m.content?.includes('"card"')) {
      let o: { slideId?: unknown; template?: unknown } = {}; try { o = JSON.parse(m.content); } catch { /* leave as is */ }
      m.content = JSON.stringify({ slideId: o.slideId, template: o.template });
    }
  }
}

/* The reply code writes when it ends the turn: what changed, and anything the user should know. */
const FIELD: Record<string, string> = { title: "title", subtitle: "subtitle", takeaway: "takeaway", kicker: "kicker", footnote: "footnote", source: "source", notes: "notes", notesTitle: "notes heading", caption: "caption", chart: "chart", table: "table", cards: "cards", steps: "steps", number: "number", body: "text", focus: "highlight" };
const NEXT = "What would you like to change next?";
function codeReply(intent: string, r: CallResult, slide: Slide | null | undefined): string {
  const extra: string[] = [];
  // Marks code picked, named by series: "Revenue as bars, Margin as a line".
  const marks = Object.entries(r.out.resolved || {}).map(([k, x]) => [k.match(/series\[(\d+)\]\.mark$/)?.[1], x.value]).filter(([i]) => i !== undefined)
    .map(([i, v]) => `${slide?.chart?.series?.[Number(i)]?.name || `series ${Number(i) + 1}`} as ${v === "line" ? "a line" : "bars"}`);
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
export function prefixed(slide: Slide, path: string): string {
  const head = String(path).split(/[.[]/)[0];
  if (head in slide) return path;
  const owners = Object.entries(slide as Draft).filter(([, v]) => v && typeof v === "object" && !Array.isArray(v) && head in v).map(([k]) => k);
  return owners.length === 1 ? `${owners[0]}.${path}` : path;
}

/* Chart guide: comparable series share a mark. A series a patch adds takes the mark of an existing series
   in the same unit (unless the user named one); with none, code picks ("auto"). */
export function matchNewSeries(before: Slide, after: Slide) {
  const old = before.chart?.series || [], all = after.chart?.series;
  if (!Array.isArray(all) || all.length <= old.length) return;
  const unit = (x: Series | undefined) => x?.format || after.chart?.format || "{v}";
  all.slice(old.length).forEach((x) => {
    if (!x || typeof x !== "object") return;
    const twin = old.find((o) => unit(o) === unit(x));
    x.mark = twin ? twin.mark : "auto";
  });
}

function summary(name: string, out: ToolOut): string {
  if (out.error) return out.error;
  if (name === "create_slide") return `${out.slideId} · ${out.template}`;
  if (name === "read_slide") return `${out.slideId} · ${out.template}`;
  // A write without an error always carries its issues list.
  const issues = out.issues ?? [];
  if (!out.applied) return `not applied · ${issues.length} shape error${issues.length === 1 ? "" : "s"}: ${issues.join(" | ")}`;
  const left = [...issues, ...(out.elsewhere || [])];
  return `applied${out.changed ? ` · ${out.changed.join(", ")}` : ""} · ${left.length ? `${left.length} issue${left.length === 1 ? "" : "s"}: ${left.join(" | ")}` : "fits"}`;
}

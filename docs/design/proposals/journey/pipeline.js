/* Agent pipeline for one slide (spec 9.0): ROUTE → DECIDE → FILL → DECIDE → GATE → REPAIR.
   Every model call is short and fresh; code sits between them. `measure(slide)` renders the
   slide at 1920×1080 and returns layout issues; `log(step)` reports progress to the UI. */
import { ICONS, MENU, fieldsFor, validate } from "../v5/schema.js";
import { BIG, FLASH, glm, jev } from "./llm.js";
import { GUIDE, MENU_OPTIONS, STYLE_STATE, deckState, editPrompt, fillPrompt, pickPrompt, repairPrompt } from "./prompts.js";

const ROUTE_THRESHOLD = 0.7;
const plainTitle = (s) => String(s || "").replace(/\[\[|\]\]|\*\*|\[-|-\]|\[\+|\+\]/g, "");

/* 1. ROUTE: Jev picks the menu entry; below the threshold GLM (thinking) picks from Jev's top two. */
async function route({ request, style, deck, index }, log) {
  const state = `Deck style: ${STYLE_STATE[style]}.\n${deckState(deck, index)}\nUser request: ${request}`;
  const r = await jev(state, { template: { instructions: `Which slide template best fits this request?\n${GUIDE}`, options: MENU_OPTIONS } });
  const t = r.template, top = Object.entries(t.probabilities).sort((a, b) => b[1] - a[1]);
  if (t.p >= ROUTE_THRESHOLD) {
    log({ step: "Route", model: "Jev", ms: r._ms, detail: `${t.choice} · p ${t.p.toFixed(2)}` });
    return t.choice;
  }
  const candidates = top.slice(0, 2).map(([id]) => id);
  const g = await glm({ ...pickPrompt({ request, style, candidates }), thinking: true });
  const id = MENU[g.value.template] ? g.value.template : candidates[0];
  log({ step: "Route", model: "Jev → GLM", ms: r._ms + g.ms, detail: `Jev unsure (${top.slice(0, 2).map(([k, p]) => `${k} ${p.toFixed(2)}`).join(", ")}); GLM picked ${id}` });
  return id;
}

/* 3. DECIDE (before fill): closed-set choices that depend on the request, not on the copy. */
async function decideBefore(id, { request, style }, log) {
  const qs = {};
  if (id === "chart") qs.type = { instructions: "Which chart type fits this request?", options: { bars: "Grouped bars comparing categories or periods, optionally with one line series such as a margin %.", lines: "Lines showing trends over many periods, scenarios or forecasts." } };
  if (id === "cards") qs.lead = { instructions: "How should the cards lead? Value when every card has a number worth showing; framed for a two-way contrast (them vs us, before vs after); otherwise icon.", options: { icon: "Each card leads with an icon.", value: "Each card leads with a big number.", framed: "Two framed cards contrasting a losing case and a winning case." } };
  if (!Object.keys(qs).length) return {};
  const r = await jev(`Deck style: ${STYLE_STATE[style]}.\nUser request: ${request}`, qs), fixed = {};
  if (r.type?.p >= 0.6) fixed["chart.type"] = r.type.choice;
  if (r.lead?.p >= 0.6) fixed["cards.lead"] = r.lead.choice;
  log({ step: "Decide", model: "Jev", ms: r._ms, detail: Object.entries(qs).map(([k]) => `${k}: ${r[k]?.choice} (${r[k]?.p.toFixed(2)})${r[k]?.p >= 0.6 ? "" : " → left to GLM"}`).join(" · ") });
  return fixed;
}

function applyFixed(slide, fixed) {
  if (fixed["chart.type"] && slide.chart) slide.chart.type = fixed["chart.type"];
  if (fixed["cards.lead"] === "framed") slide.framed = true;
  return slide;
}

/* 5. DECIDE (after fill): the icon of each card depends on the card's written title. */
async function decideAfter(slide, style, log) {
  if (slide.template !== "cards" || slide.framed || !slide.cards?.every((c) => c.icon)) return slide;
  const options = Object.fromEntries(ICONS.map((i) => [i, i.replace(/-/g, " ")]));
  const qs = Object.fromEntries(slide.cards.map((c, i) => [`icon${i}`, { instructions: `Which icon best represents this card? Title: "${plainTitle(c.title)}". Text: "${plainTitle(c.text || (c.bullets || []).join("; "))}"`, options }]));
  const r = await jev(`Slide title: ${plainTitle(slide.title)}`, qs);
  const picks = slide.cards.map((c, i) => { const a = r[`icon${i}`]; if (a && a.p >= 0.35) c.icon = a.choice; return c.icon; });
  log({ step: "Decide", model: "Jev", ms: r._ms, detail: `icons: ${picks.join(", ")}` });
  return slide;
}

/* Code fixes trivia and reports it; it never shortens text (spec 9.4). */
export function autofix(slide, style) {
  const fixes = [];
  const walk = (v) => {
    if (typeof v === "string") return v.trim().replace(/\s+/g, " ").replace(/(\d)\s?percent\b/gi, "$1%").replace(/(^|[\s(])"(\S)/g, "$1“$2").replace(/(\S)"/g, "$1”").replace(/(\w)'(\w)/g, "$1’$2");
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== null && x !== undefined && x !== "").map(([k, x]) => [k, walk(x)]));
    return v;
  };
  const out = walk(slide);
  if (typeof out.source === "string" && /^source:\s*/i.test(out.source)) { out.source = out.source.replace(/^source:\s*/i, ""); fixes.push("removed 'Source:' prefix"); }
  if (style === "consulting" && MENU[out.template]?.frame !== false && /[^.]\.$/.test(out.title || "")) { out.title = out.title.slice(0, -1); fixes.push("removed title full stop"); }
  if (style === "pitch") { delete out.kicker; }
  return { slide: out, fixes };
}

/* 6. GATE: validation errors plus measured layout issues. */
function gate(slide, style, measure) {
  const v = validate(slide, style);
  const layout = v.errors.length ? [] : measure(slide).map((m) => `layout: ${m}`);
  return { errors: [...v.errors, ...layout], warnings: v.warnings };
}

const topField = (err, slide) => {
  const k = err.replace(/^layout:\s*/, "").split(/[.[:\s]/)[0];
  return k in fieldsFor(slide.template, "consulting") || k in fieldsFor(slide.template, "pitch") ? k : null;
};

function applyPatch(slide, patch, allowed) {
  const set = patch?.set && typeof patch.set === "object" ? patch.set : patch || {};
  const out = structuredClone(slide), changed = [];
  for (const [k, v] of Object.entries(set)) {
    if (k === "template" || (allowed && !allowed.has(k))) continue;
    if (v === null) delete out[k]; else out[k] = v;
    changed.push(k);
  }
  return { slide: out, changed };
}

/* 7. REPAIR: fresh context with only the failing fields; 2 rounds, then the larger model once, then a draft. */
async function gateAndRepair(slide, style, measure, log) {
  let fixed = autofix(slide, style), cur = fixed.slide, g = gate(cur, style, measure);
  log({ step: "Gate", model: "code", ms: 0, detail: g.errors.length ? `${g.errors.length} issue${g.errors.length > 1 ? "s" : ""}${fixed.fixes.length ? ` · auto-fixed: ${fixed.fixes.join(", ")}` : ""}` : `valid and fits${fixed.fixes.length ? ` · auto-fixed: ${fixed.fixes.join(", ")}` : ""}`, errors: g.errors });
  const ladder = [[FLASH, 1], [FLASH, 2], [BIG, 2]];
  for (const [model, round] of ladder) {
    if (!g.errors.length) break;
    const fields = g.errors.map((e) => topField(e, cur));
    const allowed = fields.includes(null) ? null : new Set(fields);
    const r = await glm({ ...repairPrompt({ slide: cur, style, errors: g.errors, round }), model, temperature: 0.2 });
    const p = applyPatch(cur, r.value, allowed);
    fixed = autofix(p.slide, style); cur = fixed.slide; g = gate(cur, style, measure);
    log({ step: "Repair", model: model === BIG ? "GLM 5.3" : "GLM Flash", ms: r.ms, detail: `changed ${p.changed.join(", ") || "nothing"} → ${g.errors.length ? `${g.errors.length} left` : "valid and fits"}`, errors: g.errors });
  }
  return { slide: cur, status: g.errors.length ? "draft" : "ok", errors: g.errors, warnings: g.warnings };
}

/** New slide from a request. */
export async function createSlide({ request, style, deck, index, measure, log, previous }) {
  const id = await route({ request, style, deck, index }, log);
  const fixed = await decideBefore(id, { request, style }, log);
  const f = await glm(fillPrompt({ id, style, request, deck, index, fixed, previous }));
  let slide = applyFixed({ ...f.value, template: id }, fixed);
  log({ step: "Fill", model: "GLM Flash", ms: f.ms, detail: `${f.tokens} tokens · “${plainTitle(slide.title).slice(0, 60)}”` });
  slide = await decideAfter(slide, style, log);
  return gateAndRepair(slide, style, measure, log);
}

const INTENTS = {
  text: "Change wording: titles, notes, captions, takeaway, tone of the copy.",
  data: "Change numbers, series, categories, rows or columns.",
  template: "Show the same content in a different kind of slide (e.g. as a chart, a table, cards).",
  new_slide: "Add another slide to the deck.",
};

/** Edit the slide at `index`, or add a new one when the request asks for it. */
export async function editSlide({ request, style, deck, index, measure, log }) {
  const slide = deck.slides[index];
  const r = await jev(`Deck style: ${STYLE_STATE[style]}.\n${deckState(deck)}\nCurrent slide: ${index + 1} (${slide.template}): ${plainTitle(slide.title)}\nUser request: ${request}`,
    { intent: { instructions: "What kind of change does the user want?", options: INTENTS } });
  const intent = r.intent.choice;
  log({ step: "Intent", model: "Jev", ms: r._ms, detail: `${intent.replace("_", " ")} · p ${r.intent.p.toFixed(2)}` });
  if (intent === "new_slide") return { ...(await createSlide({ request, style, deck, index: index + 1, measure, log })), added: true };
  if (intent === "template") {
    const others = { ...deck, slides: deck.slides.filter((_, i) => i !== index) };
    return createSlide({ request: `${request} (content: ${plainTitle(slide.title)})`, style, deck: others, index, measure, log, previous: slide });
  }
  const e = await glm({ ...editPrompt({ slide, style, request, deck, index }), temperature: 0.2 });
  const p = applyPatch(slide, e.value, null);
  log({ step: "Edit", model: "GLM Flash", ms: e.ms, detail: `changed ${p.changed.join(", ") || "nothing"}` });
  return gateAndRepair(p.slide, style, measure, log);
}

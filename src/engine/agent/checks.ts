/* Design checks (spec 6): rule checks in code, judgment checks as one Jev call.
   They are advisory: shown on the slide, never blocking. */
import { MENU, plain } from "../slides/schema.js";
import { derivedFigures } from "../slides/charts/chart-math.js";
import { jev as jevCall, type JevFn } from "./llm.js";
import type { Slide, Style } from "../types.js";

export interface Check { id: string; ok: boolean; msg: string; p?: number }

const words = (s: string | undefined): string[] => plain(s || "").toLowerCase().match(/[a-z0-9£$€%]+/g) || [];
const hasFocusSpan = (s: string | undefined) => /\[\[.+?\]\]/.test(s || "");
const UNIT = /[%£$€×]|\dx\b|\d\s?(k|m|bn|mn|pp|h|hrs?|min|s)\b|\b(bps|hours?|days?|weeks?|months?|years?|mins?)\b/i;

function focusCount(s: Slide): number | null {
  switch (s.template) {
    case "chart": {
      const kind = s.chart?.kind || "bars";
      if (kind === "waterfall") return (s.chart?.items || []).filter((x) => x?.focus).length;
      if (kind === "timeline") return (s.chart?.rows || []).filter((x) => x?.focus).length;
      if (kind === "ranked") return (s.chart?.ranking || []).filter((x) => x?.focus).length;
      if (kind === "matrix") return (s.chart?.points || []).filter((x) => x?.focus).length;
      return (s.chart?.series || []).filter((x) => x.color === "focus").length;
    }
    case "pair": return (s.halves || []).reduce((sum, h) => sum + (h?.chart ? focusCount({ template: "chart", title: "", chart: h.chart }) ?? 0 : 0)
      + (h?.table ? focusCount({ template: "table", title: "", table: h.table }) ?? 0 : 0), 0);
    case "table": return (s.table?.columns || []).filter((c) => c.focus).length + (s.table?.rows || []).filter((r) => r.focus).length;
    case "steps": return (s.steps || []).filter((x) => x.focus).length;
    case "cards": return s.framed ? 1 : (s.cards || []).filter((c) => c.tone === "focus").length;
    default: return null;
  }
}

function parallelTexts(s: Slide): string[] {
  if (s.template === "cards") return (s.cards || []).map((c) => plain(c.text || (c.bullets || []).join(" ") || c.title));
  if (s.template === "steps") return (s.steps || []).map((x) => plain(x.text));
  return (s.notes || []).map((n) => plain(n.title + " " + (n.text || "")));
}

// A timeline is a plan and a matrix a judgement, not figures: no unit, source or quantified-title rules.
const isTimeline = (s: Slide) => s.template === "chart" && (s.chart?.kind === "timeline" || s.chart?.kind === "matrix");
const hasFigures = (s: Slide) => (["chart", "pair", "table", "number"].includes(s.template) && !isTimeline(s)) || (s.template === "cards" && (s.cards || []).some((c) => c.value));
/** The words a slide claims with: its headline and body text (not chart positions, step times or page furniture). */
const claimText = (s: Slide) => [s.title, s.subtitle, s.takeaway, s.number?.caption, ...(s.points || []).flatMap((p) => [p.title, p.text]),
  ...(s.cards || []).flatMap((c) => [c.title, c.text, ...(c.bullets || [])]), ...(s.notes || []).flatMap((n) => [n.title, n.text]),
  ...(s.steps || []).map((x) => x.text), ...(s.halves || []).flatMap((h) => [...(h.bullets || []), ...(h.points || []), h.number?.caption])].filter(Boolean).map((t) => plain(t)).join(" ");
/** R8: in consulting, a slide that claims figures says where they come from, in its source or a footnote. A quote names its speaker. */
function sourceCheck(s: Slide): Check | null {
  if (s.template === "quote" || s.template === "cover" || s.template === "section") return null;
  if (!hasFigures(s) && !numbersIn(claimText(s)).length) return null;
  const ok = !!(s.source || s.footnote);
  return { id: "R8", ok, msg: ok ? "Figures say where they come from" : "Figures with no source or footnote: say where they come from" };
}

// "2019–20" and "2019–2020" name a period: only the year counts, not the shorthand end.
const YEAR_RANGE = /\b((?:19|20)\d{2})\s*[–-]\s*(?:\d{2}|\d{4})\b/g;
const YEAR = (n: number, raw: string) => Number.isInteger(n) && n >= 1900 && n <= 2100 && !/[,.]/.test(raw);
/** Figures in a text: "£9,400k" → 9400, "4.5×" → 4.5; four-digit years are left out. */
// Thousands separators only between digit groups: "2030," at the end of a clause is the year 2030.
export const numbersIn = (text: unknown): number[] => [...String(text).replace(YEAR_RANGE, "$1").matchAll(/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g)].map((m): [number, string] => [parseFloat(m[0].replace(/,/g, "")), m[0]]).filter(([n, raw]) => !YEAR(n, raw)).map(([n]) => n);
const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(0.051, Math.abs(b) * 0.02);

function bodyText(s: Slide): string {
  const { title, subtitle, takeaway, kicker, footnote, source, ...body } = s;
  // Indented: compact JSON would read [1,4,10] as one number.
  return JSON.stringify(body, (_k, v) => (typeof v === "string" ? plain(v) : v), 1);
}
/** A headline figure is on the slide, or is a difference, ratio or % change of two body figures. */
function derivable(h: number, nums: number[]): boolean {
  if (nums.some((b) => close(b, h))) return true;
  for (const a of nums) for (const b of nums) {
    if (a === b || !b) continue;
    if (close(a - b, h) || close(a / b, h) || close((a / b - 1) * 100, h)) return true;
  }
  return false;
}
/** The unit of a value: currency before, %/k/m/bn after; "/yr" qualifiers and ranges ignored. */
const unitOf = (v: string) => String(v).replace(/\/\w+$/, "").replace(/[\d,.\s()+−–~-]/g, "").toLowerCase();
const decimals = (v: string) => (String(v).match(/\.(\d+)/) || ["", ""])[1].length;
const tooPrecise = (v: string) => numbersIn(v).some((n) => Math.abs(n) >= 10000 && String(Math.round(Math.abs(n))).replace(/0+$/, "").length > 3);
function timeKey(label: string): number | null {
  const t = String(label).trim(), m = t.match(/^(?:FY\s?)?((?:19|20)\d{2})$/) || t.match(/^(?:Year|Y)\s?(\d+)$/i);
  if (m) return Number(m[1]);
  const mo = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(t.slice(0, 3).toLowerCase());
  return mo >= 0 && t.length <= 9 ? mo : null;
}

/** Rule checks R1–R14. `lines` is the measured title line count. */
export function ruleChecks(s: Slide, style: Style, lines: number): Check[] {
  // A slide without a title (the big number) still owes its figures a source.
  if (MENU[s.template].frame === false) { const r8 = style === "consulting" ? sourceCheck(s) : null; return r8 ? [r8] : []; }
  const out: Check[] = [], add = (id: string, ok: boolean, msg: string) => out.push({ id, ok, msg });
  const maxLines = style === "pitch" ? 1 : 2;
  add("R1", lines <= maxLines, lines <= maxLines ? `Title fits on ${lines} line${lines > 1 ? "s" : ""}` : `Title runs to ${lines} lines (max ${maxLines})`);
  const n = words(s.title).length;
  if (style === "consulting") add("R2", n >= 5, n >= 5 ? "Title is a full sentence" : `Title has ${n} words; action titles state a so-what`);
  if (style === "pitch") add("R3", n <= 3 && !!s.subtitle, n > 3 ? `Title has ${n} words; keep the topic to 1–3` : s.subtitle ? "Topic title with the claim in the subtitle" : "No subtitle: the claim is missing");
  const fc = focusCount(s);
  if (fc !== null) {
    const head = style === "pitch" ? `${s.title} ${s.subtitle || ""}` : s.title;
    // A framed contrast can carry its point in the negative or positive colour instead.
    const titled = hasFocusSpan(head) || (!!s.framed && /\[-.+?-\]|\[\+.+?\+\]/.test(head));
    add("R4", fc === 1 && titled, fc !== 1 ? `${fc} focus elements; exactly one should stand out` : titled ? "One focus element, highlighted in the title" : "Focus element is not highlighted in the title with [[…]]");
  }
  if (s.template === "chart" && !isTimeline(s)) add("R5", UNIT.test(s.chart?.format || "") || (s.chart?.series || []).some((x) => UNIT.test(x.format || "")), "Chart values carry a unit");
  if (s.template === "number") add("R5", UNIT.test(s.number?.value || "") || /\d/.test(s.number?.value || "") === false, UNIT.test(s.number?.value || "") ? "The big number carries a unit" : "The big number has no unit");
  if (s.takeaway) {
    const t = new Set(words(s.title)), k = words(s.takeaway), overlap = k.filter((w) => t.has(w)).length / Math.max(1, k.length);
    add("R6", overlap < 0.6, overlap < 0.6 ? "Takeaway adds to the title" : "Takeaway repeats the title");
  }
  const lens = parallelTexts(s).map((x) => x.length).filter(Boolean);
  if (lens.length >= 2) { const r = Math.max(...lens) / Math.min(...lens); add("R7", r <= 2.5, r <= 2.5 ? "Parallel items are balanced" : `Parallel items are unbalanced (${r.toFixed(1)}× longest vs shortest)`); }
  const r8 = style === "consulting" ? sourceCheck(s) : null;
  if (r8) out.push(r8);
  if (s.template === "chart" && s.chart && Array.isArray(s.chart.series)) {
    const c = s.chart, series = s.chart.series, fmt = (x: { format?: string }) => x.format || c.format || "{v}", byFmt: Record<string, Set<string>> = {};
    series.forEach((x) => { if (!x.dashed) (byFmt[fmt(x)] ||= new Set()).add(x.mark); });
    const mixed = Object.entries(byFmt).find(([, marks]) => marks.size > 1), units = new Set(series.map(fmt)).size;
    const bars = series.filter((x) => x.mark === "bar"), badStack = c.stacking === "stacked" && (bars.length < 2 || new Set(bars.map(fmt)).size > 1);
    // Bars share one scale, so bars in a second unit would be drawn against the first unit's values.
    const barUnits = new Set(bars.map(fmt)).size;
    add("R9", !mixed && units <= 2 && !badStack && barUnits <= 1, mixed ? `Series in ${mixed[0]} mix bars and lines; comparable series share one mark` : units > 2 ? `${units} units on one chart; at most 2` : badStack ? "Stacked bars need 2 or more bar series in one unit" : barUnits > 1 ? "Bars in 2 units share one scale; draw the second unit as a line" : "Chart follows the chart guide");
  }
  // Notes are 3 or none, in both styles: two notes only restate what the title and takeaway already say.
  const nn = (s.notes || []).length;
  if (nn) add("R10", nn === 3, nn === 3 ? "3 notes" : nn < 3 ? `${nn} notes; the title and takeaway already carry the point: delete the notes, or add a third` : `${nn} notes; 3 reads best: merge or cut to 3`);
  else if (style === "consulting" && s.template === "cards" && !s.framed) {
    const n = (s.cards || []).length;
    if (n) add("R10", n <= 3, n <= 3 ? `${n} parallel items` : `${n} parallel items; 3 reads best: merge or cut to 3`);
  }
  const heads = numbersIn([s.title, s.subtitle, s.takeaway].filter(Boolean).map(plain).join(" "));
  if (heads.length) {
    // Figures code computed (a CAGR, a difference, a waterfall total, a 100% share) count as on the slide.
    const nums = [...numbersIn(bodyText(s)), ...derivedFigures(s.template === "chart" ? s.chart : null)], missing = heads.filter((h) => !derivable(h, nums));
    add("R11", !missing.length, missing.length ? `Headline figure ${missing.join(", ")} is not on the slide` : "Headline figures are on the slide");
  }
  if (style === "consulting" && hasFigures(s)) add("R12", numbersIn(plain(s.title)).length > 0, numbersIn(plain(s.title)).length ? "The title quantifies the so-what" : "The title has no figure; quantify the so-what");
  // Tables: one unit and precision per column, or per row when rows are the metrics (columns are periods).
  const body = s.template === "table" ? (s.table?.rows || []).filter((r) => !r.style).map((r) => (r.cells || []).slice(1).map((c) => String(c && typeof c === "object" ? c.value : c ?? ""))) : [];
  const figs = (g: string[]) => g.filter((v) => /\d/.test(v)), mixedGroup = (g: string[]) => g.length > 1 && (new Set(g.map(unitOf)).size > 1 || new Set(g.map(decimals)).size > 1);
  const cols = body.length ? body[0].map((_, j) => figs(body.map((r) => r[j] ?? ""))) : [];
  // Value cards are independent numbers: only false precision applies to them.
  const values = s.template === "cards" ? (s.cards || []).map((c) => c.value).filter((v): v is string => !!v) : [];
  if (body.length || values.length) {
    const rows = body.map(figs), byRow = rows.some((g) => g.length > 1) && !rows.some(mixedGroup);
    const bad = byRow ? null : cols.find(mixedGroup);
    const precise = [...body.flat(), ...values].find(tooPrecise);
    add("R13", !bad && !precise, bad ? `Mixed units or decimals: ${bad.join(", ")}` : precise ? `False precision: ${precise}; round to 3 significant digits` : "Consistent units and precision");
  }
  if (s.template === "chart" && s.chart?.categories) {
    const keys = s.chart.categories.map(timeKey), series = s.chart.series || [];
    if (keys.every((k) => k !== null)) add("R14", keys.every((k, i) => !i || k > keys[i - 1]), keys.every((k, i) => !i || k > keys[i - 1]) ? "Time runs oldest to newest" : "Time must run oldest to newest, left to right");
    else if (series.length === 1 && series[0].mark === "bar") { const v = series[0].values; const sorted = v.every((x, i) => !i || x <= v[i - 1]);
      add("R14", sorted, sorted ? "Bars sorted largest first" : "Bars are not sorted by value; largest first unless the order means something"); }
  }
  // Fix the R5 message when it fails.
  out.forEach((c) => { if (c.id === "R5" && !c.ok && c.msg.startsWith("Chart")) c.msg = "Chart values have no unit in `format`"; });
  return out;
}

const slideText = (s: Slide) => JSON.stringify(s, (_k, v) => (typeof v === "string" ? plain(v) : v));

/** Judgment checks J1–J10: one Jev call; a check fails only when a failing value has p ≥ 0.7. */
interface Judgment { instructions: string; options: Record<string, string>; pass: string; label: Record<string, string> }

export async function judgmentChecks(s: Slide, style: Style, jev: JevFn = jevCall): Promise<{ checks: Check[]; ms: number }> {
  if (MENU[s.template].frame === false) return { checks: [], ms: 0 };
  const qs: Record<string, Judgment> = {}, add = (id: string, styles: Style[], instructions: string, options: Record<string, string>, pass: string, label: Record<string, string>) => { if (styles.includes(style)) qs[id] = { instructions, options, pass, label }; };
  add("J1", ["consulting"], "Is the title an action title that states a so-what, or a topic label?", { action: "States a conclusion or so-what.", topic: "Names a topic without a claim." }, "action", { action: "Title states a so-what", topic: "Title reads like a topic label" });
  add("J2", ["consulting", "pitch"], "Does the body (data, cards, notes, steps) support the claim in the title and subtitle?", { supported: "The body proves the claim.", partly: "The body supports part of the claim.", unsupported: "The body does not support the claim." }, "supported", { supported: "Body supports the claim", partly: "Body supports the claim only partly", unsupported: "Body does not support the claim" });
  const parallel = ["cards", "steps"].includes(s.template) || s.notes?.length;
  if (parallel) add("J3", ["consulting"], "Are the parallel items (cards, notes or steps) mutually exclusive and collectively exhaustive with respect to the title?", { mece: "Distinct and together complete.", overlap: "Some items overlap.", gap: "Something important is missing." }, "mece", { mece: "Parallel items are MECE", overlap: "Parallel items overlap", gap: "Parallel items leave a gap" });
  if (focusCount(s) === 1) add("J4", ["consulting", "pitch"], "Does the highlighted focus element (focus series, card, step or column) match what the title claims?", { matches: "The highlighted element is what the title is about.", mismatch: "The highlight points at something else." }, "matches", { matches: "Highlight matches the claim", mismatch: "Highlight does not match the claim" });
  if (s.takeaway) add("J5", ["consulting", "pitch"], "Does the takeaway add an implication, or restate the slide?", { adds: "Adds an implication.", restates: "Repeats what the slide already says." }, "adds", { adds: "Takeaway adds an implication", restates: "Takeaway restates the slide" });
  add("J6", ["pitch"], "Does the slide carry one idea, or several?", { one: "One idea.", several: "Several ideas competing." }, "one", { one: "One idea per slide", several: "Several ideas on one slide" });
  add("J7", ["consulting", "pitch"], `The slide uses the "${s.template}" template. Is that the right kind of slide for this content?`, { right: "The template suits the content.", ...Object.fromEntries(Object.keys(MENU).filter((k) => k !== s.template && !["cover", "section"].includes(k)).map((k) => [`better_${k}`, `A ${k} slide would show this better.`])) }, "right", {});
  if (parallel) add("J8", ["consulting"], "Are the parallel items (card titles, step names or note titles) written in the same grammatical form?", { parallel: "All in one form: all noun phrases, all verbs, or all outcomes.", mixed: "The forms are mixed." }, "parallel", { parallel: "Parallel items share one form", mixed: "Parallel items mix forms" });
  // J9: judgements written as words in a table's cells read faster as marks. A narrow question on purpose: one asking
  // which of the template's capabilities fits suggested ones the slide already used and missed this case.
  if (s.template === "table") add("J9", ["consulting", "pitch"], "Look at the table's body cells (not the first column). Are they has/lacks or degree judgements written as words (Yes, No, Partly, Often, None) that would read faster as marks (✓ ✗ or Harvey balls ○ ◔ ◑ ◕ ●), with any detail as a short note under the mark? Cells that are figures, or already marks, are not.",
    { keep: "The cells are figures, phrases that need words, or already marks.", marks: "Most cells in at least one column are has/lacks or degree judgements in words." }, "keep",
    { keep: "Cells suit words and figures", marks: "Judgements in words may read faster as marks (✓ ✗ or Harvey balls)" });
  // J10: header icons help when the columns are categories scanned across (mainly columns of marks); over the things
  // compared (a bank, a product) or over columns of words and figures they are decoration.
  if (s.template === "table" && s.table?.columns?.some((c) => c?.icon)) add("J10", ["consulting", "pitch"], "The table's columns carry header icons. Do they help the reader scan columns that are categories or criteria (mainly columns of marks), or are they decoration over the things being compared (a bank, a product) or over columns of words and figures?",
    { help: "The columns are categories scanned across; the icons help.", decorative: "The icons decorate entities or columns of words and figures." }, "help",
    { help: "Header icons help the scan", decorative: "Header icons look decorative; consider removing them" });
  const r = await jev(`Deck style: ${style}.\nSlide JSON: ${slideText(s)}`, Object.fromEntries(Object.entries(qs).map(([id, q]) => [id, { instructions: q.instructions, options: q.options }])));
  const checks = Object.entries(qs).map(([id, q]): Check | null => {
    const a = r[id]; if (!a) return null;
    const failP = Object.entries(a.probabilities).filter(([v]) => v !== q.pass).sort((x, y) => y[1] - x[1])[0] || ["", 0];
    const ok = failP[1] < 0.7;
    const msg = id === "J7" ? (ok ? "Template suits the content" : `A ${failP[0].replace("better_", "")} slide may show this better`) : q.label[ok ? q.pass : failP[0]];
    return { id, ok, msg, p: ok ? a.probabilities[q.pass] ?? 0 : failP[1] };
  }).filter((c): c is Check => c !== null);
  return { checks, ms: r._ms };
}

// A rule check that says the same as a failed judgment check is left out of the nudge.
const SAME_AS: Record<string, string> = { R2: "J1", R6: "J5" };
const NUDGE_MAX = 2;

/** One sentence pointing the user at the failed checks worth fixing (judgment first, at most 2), or "". */
export function nudge(checks: Check[]): string {
  const failed = checks.filter((c) => !c.ok && /^[JR]\d/.test(c.id));
  const ids = new Set(failed.map((c) => c.id));
  const picked = [...failed.filter((c) => c.id.startsWith("J")), ...failed.filter((c) => c.id.startsWith("R") && !ids.has(SAME_AS[c.id]))].slice(0, NUDGE_MAX);
  if (!picked.length) return "";
  const lower = (m: string) => m.charAt(0).toLowerCase() + m.slice(1);
  return `Worth a look: ${picked.map((c) => lower(c.msg)).join(", and ")}.`;
}

/** The reply with the nudge before its closing question, or at the end when it has none. */
export function withNudge(reply: string, line: string): string {
  if (!line) return reply;
  const q = reply.match(/[^.!?]*\?\s*$/);
  return q ? `${reply.slice(0, q.index).trimEnd()} ${line} ${q[0].trim()}`.trim() : `${reply.trimEnd()} ${line}`.trim();
}

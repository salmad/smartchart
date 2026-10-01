/* Every "auto" choice on a slide, resolved with ONE Jev call (spec 9.1). A concrete value is never
   touched. Below P_AUTO the default stands; icons always take Jev's top pick. */
import { CHART_GUIDE, ICONS, plain } from "../slides/schema.js";
import type { JevFn } from "./llm.js";
import type { Chart, Series, Slide, Style } from "../types.js";

export type Resolved = Record<string, { value: string; p: number }>;
interface Question { id: string; path: string; instructions: string; options: Record<string, string>; min: number; fallback: string; apply: (choice: string) => void }
interface FocusItems { names: (string | undefined)[]; apply: (i: number) => void }

export const P_AUTO = 0.6;
const GUIDE = CHART_GUIDE.join("\n");
const fmtOf = (c: Chart, s: Series) => s.format || c.format || "{v}";
const slideText = (s: Slide) => JSON.stringify(s, (_k, v) => (typeof v === "string" ? plain(v) : v));

/** The items a focus can land on, with a function that sets it. */
// Runs on validated slides; the `?? []` guards only keep invalid input from throwing.
function focusItems(s: Slide): FocusItems | null {
  const one = <T>(list: T[], set: (x: T, on: boolean) => void) => (i: number) => list.forEach((x, j) => set(x, i === j));
  const flag = (x: { focus?: boolean }, on: boolean) => { if (on) x.focus = true; else delete x.focus; };
  switch (s.template) {
    case "chart": {
      const c = s.chart ?? {};
      if (c.kind === "waterfall") { const items = c.items ?? []; return { names: items.map((x) => x.label), apply: one(items, flag) }; }
      if (c.kind === "timeline") { const rows = c.rows ?? []; return { names: rows.map((x) => x.label), apply: one(rows, flag) }; }
      const series = c.series ?? [];
      return { names: series.map((x) => x.name), apply: one(series, (x, on) => { x.color = on ? "focus" : x.color === "contrast" ? "contrast" : "neutral"; }) };
    }
    case "table": { const cols = (s.table?.columns ?? []).slice(1); return { names: cols.map((c) => c.label), apply: one(cols, flag) }; }
    case "steps": { const steps = s.steps ?? []; return { names: steps.map((x) => x.title), apply: one(steps, flag) }; }
    case "cards": { const cards = s.cards ?? []; return s.framed ? null : { names: cards.map((c) => plain(c.title)), apply: one(cards, (c, on) => { c.tone = on ? "focus" : c.tone === "neg" ? "neg" : "neutral"; }) }; }
    default: return null;
  }
}

/** Questions for every auto on the slide: { id, path, instructions, options, min, fallback, apply(choice) }. */
function collect(s: Slide): Question[] {
  const qs: Question[] = [];
  if (s.template === "chart" && s.chart?.series) {
    const c = s.chart, series = s.chart.series, categories = c.categories ?? [], others = (i: number) => series.filter((_, j) => j !== i).map((x) => `"${x.name}" (${fmtOf(c, x)}, ${x.mark})`).join(", ") || "none";
    series.forEach((x, i) => {
      if (x.mark !== "auto") return;
      qs.push({ id: `mark${i}`, path: `chart.series[${i}].mark`, min: P_AUTO, fallback: categories.length >= 7 ? "line" : "bar",
        instructions: `Should the series "${x.name}" (format ${fmtOf(c, x)}) be drawn as bars or as a line? The chart has ${categories.length} categories (${categories.join(", ")}). Other series: ${others(i)}.\nChart guide:\n${GUIDE}`,
        options: { bar: "Bars: sizes compared across categories or a few periods.", line: "A line: a trend over many periods, a forecast or scenario, a rate in another unit over bars, or a reference such as a target." },
        apply: (v) => { x.mark = v as Series["mark"]; } });
    });
    if (c.stacking === "auto") qs.push({ id: "stacking", path: "chart.stacking", min: P_AUTO, fallback: "side_by_side",
      instructions: `Should the bar series be stacked or side by side?\nChart guide:\n${GUIDE}`,
      options: { stacked: "Stacked: the series are parts of one whole whose total matters (revenue by segment).", side_by_side: "Side by side: the point is comparing the series with each other (us vs them), or they do not add up." },
      apply: (v) => { c.stacking = v === "stacked" ? "stacked" : "none"; } });
  }
  if (s.focus === "auto") {
    const f = focusItems(s);
    if (f?.names.length) {
      const hl = (String(s.title || "").match(/\[\[(.+?)\]\]/) || [])[1]?.toLowerCase();
      const guess = Math.max(0, f.names.findIndex((n) => hl && String(n).toLowerCase().includes(hl)));
      qs.push({ id: "focus", path: "focus", min: P_AUTO, fallback: `item${guess}`,
        instructions: "Which one item is the slide's title (and subtitle) about? That item is highlighted.",
        options: Object.fromEntries(f.names.map((n, i) => [`item${i}`, String(n)])), apply: (v) => f.apply(Number(v.slice(4))) });
    }
  }
  if (s.template === "cards" && Array.isArray(s.cards)) s.cards.forEach((card, i) => {
    if (card.icon !== "auto") return;
    qs.push({ id: `icon${i}`, path: `cards[${i}].icon`, min: 0, fallback: "circle-check",
      instructions: `Which icon best represents this card? Title: "${plain(card.title)}". Text: "${plain(card.text || (card.bullets || []).join("; "))}"`,
      options: Object.fromEntries(ICONS.map((ic) => [ic, ic.replace(/-/g, " ")])), apply: (v) => { card.icon = v; } });
  });
  return qs;
}

export async function resolveAuto(slide: Slide, style: Style, jev: JevFn, request = ""): Promise<{ slide: Slide; resolved: Resolved; ms: number }> {
  const out = structuredClone(slide), qs = collect(out);
  if (!qs.length) return { slide: out, resolved: {}, ms: 0 };
  // The user's words ("curves", "since launch", "each line") often settle a choice the slide alone does not.
  const r = await jev(`Deck style: ${style}.${request ? `\nThe user's request: ${request}` : ""}\nSlide: ${slideText(out)}`, Object.fromEntries(qs.map((q) => [q.id, { instructions: q.instructions, options: q.options }])));
  const picks = Object.fromEntries(qs.map((q) => { const a = r[q.id]; return [q.id, a && a.p >= q.min ? { value: a.choice, p: a.p } : { value: q.fallback, p: a?.p ?? 0 }]; }));
  // Comparable series (same unit) that were all auto get one mark: the most confident pick.
  // Mark questions exist only when the chart has series.
  if (out.template === "chart" && out.chart?.series) {
    const c = out.chart, series = out.chart.series, groups: Record<string, string[]> = {};
    qs.filter((q) => q.id.startsWith("mark")).forEach((q) => { const x = series[Number(q.id.slice(4))]; (groups[fmtOf(c, x)] ||= []).push(q.id); });
    Object.values(groups).forEach((ids) => { const best = ids.reduce((a, b) => (picks[b].p > picks[a].p ? b : a)); ids.forEach((id) => { picks[id] = { ...picks[id], value: picks[best].value }; }); });
  }
  const resolved: Resolved = {};
  for (const q of qs) { q.apply(picks[q.id].value); resolved[q.path] = { value: picks[q.id].value, p: Math.round(picks[q.id].p * 100) / 100 }; }
  delete out.focus;
  return { slide: out, resolved, ms: r._ms || 0 };
}

/* Softer checks: what a partner would suggest to make a valid slide great. Code only, no model call; ranked below
   real problems and at most SOFT_MAX at a time, so they help rather than nag. Advice, never applied by code. */
import { plain } from "../slides/schema.js";
import type { Chart, Slide } from "../types.js";

export interface Suggestion { id: string; msg: string }
export const SOFT_MAX = 2;

const CHANGE = /\b(grew|grow|grows|rose|rise|rises|fell|fall|falls|doubled|tripled|halved|cut|jumped|dropped|up|down|gap|ahead|behind|vs\.?|versus|cagr|a year|per year)\b|\d\s*×|[+−-]\s?\d+(\.\d+)?\s?(%|pp)/i;
const JUDGED = /^(yes|no|high|medium|low|good|poor|weak|strong|partial|partly|full|none|limited)$/i;
const PLAN = /\b(plan|budget|target|forecast|goal|quota)\b/i;
const cellText = (c: unknown) => String(c && typeof c === "object" ? (c as { value?: unknown }).value ?? "" : c ?? "").trim();

interface ChartCtx { chart: Chart; headline: string; hasNotes: boolean; label?: string }

/** Every chart on a slide (the main chart, or each half of a pair). */
function chartContexts(s: Slide): ChartCtx[] {
  const deckHead = plain(`${s.title} ${s.subtitle ?? ""}`);
  if (s.template === "chart" && s.chart)
    return [{ chart: s.chart, headline: deckHead, hasNotes: !!(s.notes?.length) }];
  if (s.template === "pair" && s.halves?.length)
    return s.halves.flatMap((h, i) => (h.chart
      ? [{ chart: h.chart, headline: plain(`${deckHead} ${h.caption ?? ""}`), hasNotes: !!(h.bullets?.length), label: h.caption?.trim() || (s.halves!.length > 1 ? `chart ${i + 1}` : undefined) }]
      : []));
  return [];
}

/** Bars chart with no annotation or notes yet; at least one bar-capable series. */
function barsCanvas(chart: Chart, hasNotes: boolean): boolean {
  const kind = chart.kind ?? "bars";
  if (kind !== "bars" || chart.annotations?.length || hasNotes) return false;
  if ((chart.stacking ?? "none") !== "none") return false;
  const series = chart.series ?? [];
  return series.length > 0 && series.some((x) => x && x.mark !== "line");
}

function barValues(chart: Chart): number[] | null {
  const series = chart.series ?? [];
  const bar = series.find((x) => x && x.mark !== "line") ?? series[0];
  const vals = bar?.values ?? [];
  return vals.length ? vals : null;
}

const withLabel = (label: string | undefined, msg: string) => (label ? `${label}: ${msg}` : msg);

function chartSoft(out: Suggestion[], { chart, headline, hasNotes, label }: ChartCtx): void {
  const kind = chart.kind ?? "bars";
  if (chart.series?.length && kind === "bars" && !chart.annotations?.length && !hasNotes && (chart.stacking ?? "none") === "none" && CHANGE.test(headline))
    out.push({ id: "S2", msg: withLabel(label, "The title claims a change: offer to add a difference, CAGR or target annotation (code draws the arrow and the figure)") });
  if (!barsCanvas(chart, hasNotes)) return;
  const cats = chart.categories ?? [], vals = barValues(chart);
  if (cats.length >= 4 && vals && vals.length >= cats.length && vals[0] > 0 && vals[cats.length - 1] > 0)
    out.push({ id: "S4", msg: withLabel(label, "Several periods on the bars and no annotation yet: offer a CAGR from the first to the last (code draws the arrow and rate)") });
  const series = chart.series ?? [];
  if (series.length >= 2 && series.some((x) => x?.name && PLAN.test(x.name)))
    out.push({ id: "S5", msg: withLabel(label, "A plan or target series beside actuals: offer a target annotation on the bars (code draws the line and the figure)") });
}

export function softChecks(s: Slide): Suggestion[] {
  const out: Suggestion[] = [];
  chartContexts(s).forEach((ctx) => chartSoft(out, ctx));
  if (s.template === "table") {
    const judged = (s.table?.rows ?? []).flatMap((r) => (r.cells ?? []).slice(1)).map(cellText).filter((t) => JUDGED.test(t)).length;
    if (judged >= 3) out.push({ id: "S3", msg: "Judgements in words read faster as marks: ✓ / ✗ for has or lacks, Harvey balls for degree" });
  }
  return out.slice(0, SOFT_MAX);
}

/* Softer checks: what a partner would suggest to make a valid slide great. Code only, no model call; ranked below
   real problems and at most SOFT_MAX at a time, so they help rather than nag. Advice, never applied by code. */
import { plain } from "../slides/schema.js";
import type { Slide } from "../types.js";

export interface Suggestion { id: string; msg: string }
export const SOFT_MAX = 2;

const CHANGE = /\b(grew|grow|grows|rose|rise|rises|fell|fall|falls|doubled|tripled|halved|cut|jumped|dropped|up|down|gap|ahead|behind|vs\.?|versus|cagr|a year|per year)\b|\d\s*×|[+−-]\s?\d+(\.\d+)?\s?(%|pp)/i;
const JUDGED = /^(yes|no|high|medium|low|good|poor|weak|strong|partial|partly|full|none|limited)$/i;
const cellText = (c: unknown) => String(c && typeof c === "object" ? (c as { value?: unknown }).value ?? "" : c ?? "").trim();

export function softChecks(s: Slide): Suggestion[] {
  const out: Suggestion[] = [];
  const chart = s.template === "chart" ? s.chart : undefined, kind = chart?.kind ?? "bars";
  // Notes may already explain the change; stacked and percent charts show parts, not one change.
  if (chart?.series?.length && kind === "bars" && !chart.annotations?.length && !s.notes?.length && (chart.stacking ?? "none") === "none" && CHANGE.test(plain(`${s.title} ${s.subtitle ?? ""}`)))
    out.push({ id: "S2", msg: "The title claims a change: show it on the chart with a difference, CAGR or target annotation" });
  if (s.template === "table") {
    const judged = (s.table?.rows ?? []).flatMap((r) => (r.cells ?? []).slice(1)).map(cellText).filter((t) => JUDGED.test(t)).length;
    if (judged >= 3) out.push({ id: "S3", msg: "Judgements in words read faster as marks: ✓ / ✗ for has or lacks, Harvey balls for degree" });
  }
  return out.slice(0, SOFT_MAX);
}

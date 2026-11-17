/* Heat shading: a figure's step on a 5-step scale by its share of the largest (0 = unshaded). Shared by a table's heat
   columns and the small grids in a flow, so both read on one scale. */
export type HeatStep = 0 | 1 | 2 | 3 | 4 | 5;
const CUTS = [0.1, 0.25, 0.4, 0.65] as const;

/** Null, zero and negatives are 0; the rest 1–5 by value / max, cut at 0.1, 0.25, 0.4 and 0.65. */
export function heatSteps(values: readonly (number | null)[]): HeatStep[] {
  const max = Math.max(0, ...values.map((v) => v ?? 0));
  return values.map((v) => (v === null || v <= 0 || max <= 0 ? 0 : ((1 + CUTS.filter((c) => v / max >= c).length) as HeatStep)));
}

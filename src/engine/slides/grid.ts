/* The chart as a grid of inputs (spec 4.3): what the user edits in place of the chart. fromGrid merges the grid
   back into the chart it came from, so marks, colours, focus, format and annotations are never lost. */
import { describe, type FieldView } from "./schema";
import type { Chart, Style } from "../types";

export type Grid =
  | { kind: "bars"; categories: string[]; series: { name: string; values: number[] }[] }
  | { kind: "waterfall"; items: { label: string; value: number | null; total: boolean }[] }
  | { kind: "timeline"; periods: string[]; rows: { label: string; start: number; end: number }[]; milestones: { label: string; at: number }[] };
export interface Limits { categories: [number, number]; series: [number, number]; items: [number, number]; periods: [number, number]; rows: [number, number]; milestones: [number, number] }

export function gridLimits(style: Style): Limits {
  const f = describe("chart", style).fields.chart.fields as Record<string, FieldView>;
  const lim = (k: string): [number, number] => [f[k].items?.min ?? 0, f[k].items?.max ?? Infinity];
  return { categories: lim("categories"), series: lim("series"), items: lim("items"), periods: lim("periods"), rows: lim("rows"), milestones: lim("milestones") };
}

export function chartGrid(c: Chart): Grid {
  if (c.kind === "waterfall") return { kind: "waterfall", items: (c.items ?? []).map((i) => ({ label: i.label, value: i.value ?? null, total: !!i.total })) };
  if (c.kind === "timeline") return { kind: "timeline", periods: [...(c.periods ?? [])], rows: (c.rows ?? []).map(({ label, start, end }) => ({ label, start, end })), milestones: (c.milestones ?? []).map(({ label, at }) => ({ label, at })) };
  return { kind: "bars", categories: [...(c.categories ?? [])], series: (c.series ?? []).map((s) => ({ name: s.name, values: [...s.values] })) };
}

export function fromGrid(c: Chart, g: Grid): Chart {
  if (g.kind === "waterfall") return { ...c, items: g.items.map((i, k) => {
    const { value: _v, total: _t, ...rest } = c.items?.[k] ?? { label: "" };
    return { ...rest, label: i.label, ...(i.total ? { total: true } : i.value !== null ? { value: i.value } : {}) };
  }) };
  if (g.kind === "timeline") return { ...c, periods: g.periods,
    rows: g.rows.map((r, k) => ({ ...(c.rows?.[k] ?? {}), label: r.label, start: r.start, end: r.end })),
    ...(g.milestones.length || c.milestones ? { milestones: g.milestones.map((m, k) => ({ ...(c.milestones?.[k] ?? {}), label: m.label, at: m.at })) } : {}) };
  const last = c.series?.at(-1);
  // Annotations point at category and series indices; one that no longer points at anything is dropped (the agent adds it back on request).
  const inRange = (a: NonNullable<Chart["annotations"]>[number]) => (a.from ?? 0) < g.categories.length && (a.to ?? 0) < g.categories.length && (a.series ?? 0) < g.series.length;
  return { ...c, ...(c.annotations ? { annotations: c.annotations.filter(inRange) } : {}), categories: g.categories, series: g.series.map((s, k) => {
    const old = c.series?.[k] ?? { mark: last?.mark ?? "bar", ...(last?.color ? { color: "neutral" as const } : {}), ...(last?.format ? { format: last.format } : {}) };
    return { ...old, name: s.name, values: s.values };
  }) };
}

const within = (n: number, [lo, hi]: [number, number]) => n >= lo && n <= hi;
const clamp = (n: number, hi: number) => Math.max(0, Math.min(n, hi));

export function addRow(g: Grid, lim: Limits): Grid {
  if (g.kind === "bars") return within(g.categories.length + 1, lim.categories) ? { ...g, categories: [...g.categories, ""], series: g.series.map((s) => ({ ...s, values: [...s.values, 0] })) } : g;
  if (g.kind === "waterfall") return within(g.items.length + 1, lim.items) ? { ...g, items: [...g.items.slice(0, -1), { label: "", value: 0, total: false }, ...g.items.slice(-1)] } : g;
  return within(g.rows.length + 1, lim.rows) ? { ...g, rows: [...g.rows, { label: "", start: 0, end: 0 }] } : g;
}
export function removeRow(g: Grid, i: number, lim: Limits): Grid {
  if (g.kind === "bars") return within(g.categories.length - 1, lim.categories) ? { ...g, categories: g.categories.filter((_, k) => k !== i), series: g.series.map((s) => ({ ...s, values: s.values.filter((_, k) => k !== i) })) } : g;
  if (g.kind === "waterfall") return within(g.items.length - 1, lim.items) ? { ...g, items: g.items.filter((_, k) => k !== i) } : g;
  return within(g.rows.length - 1, lim.rows) ? { ...g, rows: g.rows.filter((_, k) => k !== i) } : g;
}
export function addSeries(g: Grid, lim: Limits): Grid {
  return g.kind === "bars" && within(g.series.length + 1, lim.series) ? { ...g, series: [...g.series, { name: "", values: g.categories.map(() => 0) }] } : g;
}
export function removeSeries(g: Grid, i: number, lim: Limits): Grid {
  return g.kind === "bars" && within(g.series.length - 1, lim.series) ? { ...g, series: g.series.filter((_, k) => k !== i) } : g;
}
export function addPeriod(g: Grid, lim: Limits): Grid {
  return g.kind === "timeline" && within(g.periods.length + 1, lim.periods) ? { ...g, periods: [...g.periods, ""] } : g;
}
export function removePeriod(g: Grid, i: number, lim: Limits): Grid {
  if (g.kind !== "timeline" || !within(g.periods.length - 1, lim.periods)) return g;
  const hi = g.periods.length - 2, shift = (n: number) => clamp(n > i ? n - 1 : n, hi);
  return { ...g, periods: g.periods.filter((_, k) => k !== i), rows: g.rows.map((r) => ({ ...r, start: shift(r.start), end: shift(r.end) })), milestones: g.milestones.map((m) => ({ ...m, at: shift(m.at) })) };
}
export function addMilestone(g: Grid, lim: Limits): Grid {
  return g.kind === "timeline" && within(g.milestones.length + 1, lim.milestones) ? { ...g, milestones: [...g.milestones, { label: "", at: 0 }] } : g;
}
export function removeMilestone(g: Grid, i: number, lim: Limits): Grid {
  return g.kind === "timeline" && within(g.milestones.length - 1, lim.milestones) ? { ...g, milestones: g.milestones.filter((_, k) => k !== i) } : g;
}

/* The timeline as a gantt (spec 4.3): bars painted across period columns, milestones placed on a period. Pure patches for
   applyPatch, the same path the agent writes on; limits come from the schema. Period indices shift with the periods. */
import { describe, type FieldView } from "./schema";
import type { Chart, Slide, Style } from "../types";

type Patch = Record<string, unknown>;
const splice = <T,>(xs: T[], at: number, del: number, ...ins: T[]) => { const a = xs.slice(); a.splice(at, del, ...ins); return a; };
const move = <T,>(xs: T[], from: number, to: number) => { const a = xs.slice(), [x] = a.splice(from, 1); a.splice(to, 0, x); return a; };

export function ganttFor(slide: Slide, style: Style) {
  const c: Chart = slide.chart ?? {}, periods = c.periods ?? [], rows = c.rows ?? [], miles = c.milestones ?? [];
  const f = describe("chart", style).fields.chart.fields as Record<string, FieldView>;
  const lim = (k: string): [number, number] => [f[k].items?.min ?? 0, f[k].items?.max ?? Infinity];
  const [pMin, pMax] = lim("periods"), [rMin, rMax] = lim("rows"), [mMin, mMax] = lim("milestones");
  /** Bars and milestones with their period indices rewritten by `f`, as one patch. */
  const reindex = (f: (n: number) => number, extra: Patch = {}): Patch => ({
    ...extra,
    "chart.rows": rows.map((r) => ({ ...r, start: f(r.start ?? 0), end: Math.max(f(r.start ?? 0), f(r.end ?? 0)) })),
    ...(miles.length ? { "chart.milestones": miles.map((m) => ({ ...m, at: f(m.at) })) } : {}),
  });
  return {
    periods, rows, milestones: miles,
    setBar: (i: number, a: number, b: number): Patch => ({ [`chart.rows[${i}].start`]: Math.min(a, b), [`chart.rows[${i}].end`]: Math.max(a, b) }),
    setMilestone: (i: number, at: number): Patch => ({ [`chart.milestones[${i}].at`]: at }),
    /** A period at `at`: later periods move along, and a bar that spans the place grows by one. */
    insertPeriod: (at: number): Patch | null => {
      if (periods.length + 1 > pMax) return null;
      // Later periods move along; a bar that runs across the place keeps its near end and grows by one.
      return reindex((n) => (n >= at ? n + 1 : n), { "chart.periods": splice(periods, at, 0, "") });
    },
    removePeriod: (i: number): Patch | null => {
      if (periods.length - 1 < pMin) return null;
      const hi = periods.length - 2;
      return reindex((n) => Math.max(0, Math.min(n > i ? n - 1 : n, hi)), { "chart.periods": splice(periods, i, 1) });
    },
    insertRow: (at: number): Patch | null => (rows.length + 1 > rMax ? null : { "chart.rows": splice(rows, at, 0, { label: "", start: 0, end: 0 }) }),
    removeRow: (i: number): Patch | null => (rows.length - 1 < rMin ? null : { "chart.rows": splice(rows, i, 1) }),
    moveRow: (from: number, to: number): Patch | null => (from === to || [from, to].some((n) => n < 0 || n >= rows.length) ? null : { "chart.rows": move(rows, from, to) }),
    insertMilestone: (): Patch | null => (miles.length + 1 > mMax ? null : { "chart.milestones": [...miles, { label: "", at: 0 }] }),
    removeMilestone: (i: number): Patch | null => (miles.length - 1 < mMin ? null : miles.length === 1 ? { "chart.milestones": null } : { "chart.milestones": splice(miles, i, 1) }),
  };
}

/* The timeline as a gantt (spec 4.3): bars painted across period columns, milestones placed on a period. Pure patches for
   applyPatch, the same path the agent writes on; limits come from the schema. Period indices shift with the periods. */
import { timelineLines } from "./charts/timeline-rows";
import { describe, type FieldView } from "./schema";
import type { Chart, Slide, Style, TimelineRow } from "../types";

type Patch = Record<string, unknown>;
const splice = <T,>(xs: T[], at: number, del: number, ...ins: T[]) => { const a = xs.slice(); a.splice(at, del, ...ins); return a; };

export function ganttFor(slide: Slide, style: Style) {
  const c: Chart = slide.chart ?? {}, periods = c.periods ?? [], rows = c.rows ?? [], miles = c.milestones ?? [];
  const f = describe("chart", style).fields.chart.fields as Record<string, FieldView>;
  const lim = (k: string): [number, number] => [f[k].items?.min ?? 0, f[k].items?.max ?? Infinity];
  const [pMin, pMax] = lim("periods"), [rMin, rMax] = lim("rows"), [mMin, mMax] = lim("milestones");
  const lines = timelineLines(rows), spans = new Map<TimelineRow, [number, number]>(lines.map((l) => [l.row, [l.start, l.end]]));
  const TOP = 8;

  /** Rows in the shape the schema wants: a group has no dates, everything else has them (a group that lost its last child keeps its old span). */
  const norm = (next: readonly TimelineRow[]): TimelineRow[] => {
    const ls = timelineLines(next);
    return next.map((r, i) => {
      const { level, start, end, ...rest } = r, [s0, e0] = spans.get(r) ?? [0, 0];
      const base: TimelineRow = { ...rest, ...(level === 1 && i > 0 ? { level: 1 as const } : {}) };
      return ls[i].group ? base : { ...base, start: start ?? s0, end: end ?? e0 };
    });
  };
  const fits = (next: readonly TimelineRow[]) => next.length >= rMin && next.length <= rMax && next.filter((r) => r.level !== 1).length <= TOP;
  const write = (next: TimelineRow[]): Patch | null => { const n = norm(next); return fits(n) ? { "chart.rows": n } : null; };
  /** The span a new sub-row of row `i` (or of `i`'s group) starts on, so the parent's bar does not move. */
  const parentSpan = (i: number): { start: number; end: number } => { let k = i; while (k > 0 && lines[k].level === 1) k--; return { start: lines[k]?.start ?? 0, end: lines[k]?.end ?? 0 }; };
  /** A row and the children under it, as [from, to). */
  const family = (i: number): [number, number] => { let e = i + 1; if (lines[i]?.group) while (rows[e]?.level === 1) e++; return [i, e]; };
  /** Bars and milestones with their period indices rewritten by `f`, as one patch. */
  const reindex = (f: (n: number) => number, extra: Patch = {}): Patch => ({
    ...extra,
    "chart.rows": rows.map((r) => (r.start === undefined || r.end === undefined ? r : { ...r, start: f(r.start), end: Math.max(f(r.start), f(r.end)) })),
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
    lines,
    insertRow: (at: number): Patch | null => write(splice(rows, at, 0, rows[at]?.level === 1 ? { label: "", level: 1 as const, ...parentSpan(at) } : { label: "", start: 0, end: 0 })),
    addSubRow: (i: number): Patch | null => write(splice(rows, family(i)[1], 0, { label: "", level: 1 as const, ...parentSpan(i) })),
    indent: (i: number): Patch | null => (i < 1 || rows[i].level === 1 || lines[i].group ? null : write(rows.map((r, k) => (k === i ? { ...r, level: 1 as const } : r)))),
    outdent: (i: number): Patch | null => {
      if (rows[i]?.level !== 1) return null;
      let e = i + 1; while (rows[e]?.level === 1) e++;
      const out = rows.slice(), [row] = out.splice(i, 1);
      out.splice(e - 1, 0, { ...row, level: 0 });
      return write(out);
    },
    /** Drop row `from` (with its children, if a group) before row `before` of the current list, at `level`. */
    place: (from: number, before: number, level: 0 | 1): Patch | null => {
      const [a, b] = family(from), len = b - a;
      if (before > a && before < b) return null;
      let at = before >= b ? before - len : before;
      const rest = [...rows.slice(0, a), ...rows.slice(b)];
      // A top-level drop that lands inside a group goes after the group, not into the middle of its sub-rows.
      if (level === 0 || len > 1) while (rest[at]?.level === 1) at++;
      const lv = len > 1 || at === 0 ? 0 : level;
      const moved = rows.slice(a, b).map((r, k) => (k === 0 ? { ...r, level: lv } : r));
      const next = [...rest.slice(0, at), ...moved, ...rest.slice(at)];
      return JSON.stringify(norm(next)) === JSON.stringify(norm(rows)) ? null : write(next);
    },
    /** One highlighted row at a time: setting it moves it, clearing removes it. */
    setHighlight: (i: number, on: boolean): Patch => ({
      ...Object.fromEntries(lines.filter((l) => l.focus && (!on || l.index !== i)).map((l) => [`chart.rows[${l.index}].focus`, null])),
      ...(on ? { [`chart.rows[${i}].focus`]: true } : {}),
    }),
    removeRow: (i: number, withChildren = false): Patch | null => {
      const [a, b] = family(i), kids = b - i - 1;
      return write(withChildren ? [...rows.slice(0, a), ...rows.slice(b)] : [...rows.slice(0, i), ...rows.slice(i + 1).map((r, k) => (k < kids ? { ...r, level: 0 as const } : r))]);
    },
    insertMilestone: (): Patch | null => (miles.length + 1 > mMax ? null : { "chart.milestones": [...miles, { label: "", at: 0 }] }),
    removeMilestone: (i: number): Patch | null => (miles.length - 1 < mMin ? null : miles.length === 1 ? { "chart.milestones": null } : { "chart.milestones": splice(miles, i, 1) }),
  };
}

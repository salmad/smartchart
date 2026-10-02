/* A chart as a sheet (spec 4.3): rows and columns a person edits like a spreadsheet. A SheetModel reads and writes the real
   slide paths through patches for applyPatch, the same path the agent writes on, so reordering a series moves the series
   itself (its mark and colour with it). Limits come from the schema; an action that would break one returns null. */
import { applyPatch } from "../agent/patch.js";
import { addColumn, moveColumn, removeColumn } from "./edit.js";
import { describe, type FieldView } from "./schema.js";
import type { Chart, Slide, Style } from "../types.js";

export type Patch = Record<string, unknown>;
export type Cellv = string | number | boolean | null;
export interface SheetCol { header: string; headerPath?: string; type: "text" | "number" | "flag" }
export interface SheetModel {
  kind: "bars" | "waterfall" | "ranked" | "matrix" | "table";
  cols: SheetCol[]; rows: number;
  get(r: number, c: number): Cellv;
  /** The slide field the cell shows: where its issues are looked up. */
  path(r: number, c: number): string;
  readOnly?(r: number, c: number): boolean;
  set(r: number, c: number, raw: string): Patch | { error: string };
  setHeader(c: number, raw: string): Patch | null;
  insertRow(at: number): Patch | null; removeRows(r0: number, r1: number): Patch | null; moveRow(from: number, to: number): Patch | null;
  insertCol?(at: number): Patch | null; removeCols?(c0: number, c1: number): Patch | null; moveCol?(from: number, to: number): Patch | null;
}

/** A refused cell write: `{ error }`, as opposed to a patch. */
export const failed = (p: Patch | { error: string } | null | undefined): p is { error: string } => !!p && Object.keys(p).length === 1 && typeof (p as { error?: unknown }).error === "string";

/* ─────────── Reading what people type and paste ─────────── */

/** "1,200", "(3.1)", "−5", "12%", "£1.2m" read as numbers; the unit lives in the chart's format. Anything else is null. */
export function parseNum(raw: string): number | null {
  let t = raw.trim().replace(/[£$€%\s]/g, "").replace(/[−–]/g, "-").replace(/(?<=\d)(bn|m|k|x)$/i, "");
  const neg = /^\(.*\)$/.test(t);
  if (neg) t = `-${t.slice(1, -1)}`;
  // A comma is a thousands separator ("1,200") unless it stands alone before one or two digits ("1,5"), which is a decimal comma.
  t = /^-?\d+,\d{1,2}$/.test(t) ? t.replace(",", ".") : t.replace(/,/g, "");
  return /^-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(t) ? Number(t) : null;
}

/** Tab-separated text as spreadsheets copy it: quoted cells, CRLF, a trailing newline. */
export function parseTsv(text: string): string[][] {
  const rows: string[][] = [[]];
  let cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false; } else cell += ch; continue; }
    if (ch === '"' && cell === "") quoted = true;
    else if (ch === "\t") { rows.at(-1)?.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; rows.at(-1)?.push(cell); cell = ""; rows.push([]); }
    else cell += ch;
  }
  rows.at(-1)?.push(cell);
  if (rows.at(-1)?.length === 1 && rows.at(-1)?.[0] === "") rows.pop();
  return rows;
}
export const toTsv = (rows: string[][]): string => rows.map((r) => r.map((c) => (/[\t\n"]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join("\t")).join("\n");

/* ─────────── Models ─────────── */

interface Limits { categories: [number, number]; series: [number, number]; items: [number, number]; ranking: [number, number]; points: [number, number] }
function limits(style: Style): Limits {
  const f = describe("chart", style).fields.chart.fields as Record<string, FieldView>;
  const lim = (k: string): [number, number] => [f[k].items?.min ?? 0, f[k].items?.max ?? Infinity];
  return { categories: lim("categories"), series: lim("series"), items: lim("items"), ranking: lim("ranking"), points: lim("points") };
}
const splice = <T,>(xs: T[], at: number, del: number, ...ins: T[]) => { const a = xs.slice(); a.splice(at, del, ...ins); return a; };
const move = <T,>(xs: T[], from: number, to: number) => { const a = xs.slice(), [x] = a.splice(from, 1); a.splice(to, 0, x); return a; };
const inRange = (n: number, [lo, hi]: [number, number]) => n >= lo && n <= hi;
const NEEDS_NUMBER = { error: "Enter a number" };

function bars(chart: Chart, style: Style): SheetModel {
  const cats = chart.categories ?? [], series = chart.series ?? [], lim = limits(style);
  /** Annotations point at category and series indices: a row or series that moves takes them along, and one whose row or series is gone is dropped. */
  type Map = (i: number) => number | null;
  const same: Map = (i) => i;
  const remap = (cat: Map, ser: Map = same): Patch => {
    if (!chart.annotations) return {};
    const out = chart.annotations.flatMap((a) => {
      const f = cat(a.from ?? 0), t = cat(a.to ?? 0), k = ser(a.series ?? 0);
      if (f === null || t === null || k === null) return [];
      return [{ ...a, ...(f !== (a.from ?? 0) ? { from: f } : {}), ...(t !== (a.to ?? 0) ? { to: t } : {}), ...(k !== (a.series ?? 0) ? { series: k } : {}) }];
    });
    return { "chart.annotations": out };
  };
  const ins = (at: number): Map => (i) => (i >= at ? i + 1 : i);
  const del = (lo: number, hi: number): Map => (i) => (i < lo ? i : i <= hi ? null : i - (hi - lo + 1));
  const perm = (from: number, to: number): Map => (i) => (i === from ? to : from < to ? (i > from && i <= to ? i - 1 : i) : i >= to && i < from ? i + 1 : i);
  const rowsWrite = (f: <T>(xs: T[]) => T[], cat: Map): Patch => ({ "chart.categories": f(cats), ...Object.fromEntries(series.map((s, j) => [`chart.series[${j}].values`, f(s.values)])), ...remap(cat) });
  return {
    kind: "bars", rows: cats.length,
    cols: [{ header: "", type: "text" }, ...series.map((s, j) => ({ header: s.name, headerPath: `chart.series[${j}].name`, type: "number" as const }))],
    get: (r, c) => (c === 0 ? cats[r] ?? "" : series[c - 1]?.values[r] ?? null),
    path: (r, c) => (c === 0 ? `chart.categories[${r}]` : `chart.series[${c - 1}].values[${r}]`),
    set(r, c, raw) {
      if (c === 0) return { [`chart.categories[${r}]`]: raw };
      const n = parseNum(raw);
      return n === null ? NEEDS_NUMBER : { [`chart.series[${c - 1}].values[${r}]`]: n };
    },
    setHeader: (c, raw) => (c >= 1 ? { [`chart.series[${c - 1}].name`]: raw } : null),
    insertRow: (at) => (inRange(cats.length + 1, lim.categories) ? rowsWrite((xs) => splice(xs as unknown[], at, 0, xs === cats ? "" : 0) as typeof xs, ins(at)) : null),
    removeRows: (r0, r1) => (inRange(cats.length - (r1 - r0 + 1), lim.categories) ? rowsWrite((xs) => splice(xs, r0, r1 - r0 + 1), del(r0, r1)) : null),
    moveRow: (from, to) => (from === to || [from, to].some((i) => i < 0 || i >= cats.length) ? null : rowsWrite((xs) => move(xs, from, to), perm(from, to))),
    insertCol: (at) => {
      if (at < 1 || !inRange(series.length + 1, lim.series)) return null;
      const like = series.at(-1);
      return { "chart.series": splice(series, at - 1, 0, { name: "", values: cats.map(() => 0), mark: like?.mark ?? "bar", ...(like?.color ? { color: "neutral" as const } : {}), ...(like?.format ? { format: like.format } : {}) }), ...remap(same, ins(at - 1)) };
    },
    removeCols: (c0, c1) => (c0 < 1 || !inRange(series.length - (c1 - c0 + 1), lim.series) ? null : { "chart.series": splice(series, c0 - 1, c1 - c0 + 1), ...remap(same, del(c0 - 1, c1 - 1)) }),
    moveCol: (from, to) => (from < 1 || to < 1 || from === to || from > series.length || to > series.length ? null : { "chart.series": move(series, from - 1, to - 1), ...remap(same, perm(from - 1, to - 1)) }),
  };
}

function waterfall(chart: Chart, style: Style): SheetModel {
  const items = chart.items ?? [], lim = limits(style);
  return {
    kind: "waterfall", rows: items.length,
    cols: [{ header: "Step", type: "text" }, { header: "Value", type: "number" }, { header: "Total", type: "flag" }],
    get: (r, c) => (c === 0 ? items[r]?.label ?? "" : c === 1 ? items[r]?.value ?? null : !!items[r]?.total),
    path: (r, c) => `chart.items[${r}].${c === 0 ? "label" : c === 1 ? "value" : "total"}`,
    readOnly: (r, c) => c === 1 && !!items[r]?.total,
    set(r, c, raw) {
      if (c === 0) return { [`chart.items[${r}].label`]: raw };
      if (c === 2) return raw === "true" ? { [`chart.items[${r}].total`]: true, [`chart.items[${r}].value`]: null } : { [`chart.items[${r}].total`]: null, [`chart.items[${r}].value`]: items[r]?.value ?? 0 };
      const n = parseNum(raw);
      return n === null ? NEEDS_NUMBER : { [`chart.items[${r}].value`]: n };
    },
    setHeader: () => null,
    insertRow: (at) => (inRange(items.length + 1, lim.items) ? { "chart.items": splice(items, at, 0, { label: "", value: 0 }) } : null),
    removeRows: (r0, r1) => (inRange(items.length - (r1 - r0 + 1), lim.items) ? { "chart.items": splice(items, r0, r1 - r0 + 1) } : null),
    moveRow: (from, to) => (from === to || [from, to].some((i) => i < 0 || i >= items.length) ? null : { "chart.items": move(items, from, to) }),
  };
}

/** A list of { label, numbers… } rows: ranked bars (label, value) and matrix points (label, x, y). */
function listSheet(kind: "ranked" | "matrix", list: Record<string, unknown>[], field: string, cols: [string, string][], lim: [number, number]): SheetModel {
  const blank = Object.fromEntries(cols.map(([k], j) => [k, j ? (kind === "matrix" ? 50 : 0) : ""]));
  return {
    kind, rows: list.length,
    cols: cols.map(([, header], j) => ({ header, type: j ? "number" as const : "text" as const })),
    get: (r, c) => (list[r]?.[cols[c][0]] as Cellv) ?? (c ? null : ""),
    path: (r, c) => `chart.${field}[${r}].${cols[c][0]}`,
    set(r, c, raw) {
      if (c === 0) return { [`chart.${field}[${r}].label`]: raw };
      const n = parseNum(raw);
      return n === null ? NEEDS_NUMBER : { [`chart.${field}[${r}].${cols[c][0]}`]: n };
    },
    setHeader: () => null,
    insertRow: (at) => (inRange(list.length + 1, lim) ? { [`chart.${field}`]: splice(list, at, 0, blank) } : null),
    removeRows: (r0, r1) => (inRange(list.length - (r1 - r0 + 1), lim) ? { [`chart.${field}`]: splice(list, r0, r1 - r0 + 1) } : null),
    moveRow: (from, to) => (from === to || [from, to].some((i) => i < 0 || i >= list.length) ? null : { [`chart.${field}`]: move(list, from, to) }),
  };
}
const RANKED_COLS: [string, string][] = [["label", "Item"], ["value", "Value"]];
const MATRIX_COLS: [string, string][] = [["label", "Point"], ["x", "Across (0–100)"], ["y", "Up (0–100)"]];

function tableSheet(slide: Slide): SheetModel {
  const t = slide.table ?? { columns: [], rows: [] }, cols = t.columns, rows = t.rows;
  const text = (r: number, c: number) => { const x = rows[r]?.cells[c]; return typeof x === "object" && x ? x.value ?? "" : x ?? ""; };
  const pathOf = (r: number, c: number) => { const x = rows[r]?.cells[c], base = `table.rows[${r}].cells[${c}]`; return typeof x === "object" && x ? `${base}.value` : base; };
  const ROWS: [number, number] = [1, 8];
  const colWrite = (f: (s: Slide) => { table?: unknown }): Patch | null => { const p = f(slide); return p.table ? (p as Patch) : null; };
  return {
    kind: "table", rows: rows.length,
    cols: cols.map((c, j) => ({ header: c.label ?? "", headerPath: `table.columns[${j}].label`, type: "text" as const })),
    get: text, path: pathOf,
    set: (r, c, raw) => ({ [pathOf(r, c)]: raw }),
    setHeader: (c, raw) => ({ [`table.columns[${c}].label`]: raw }),
    insertRow: (at) => (inRange(rows.length + 1, ROWS) ? { "table.rows": splice(rows, at, 0, { cells: cols.map(() => "") }) } : null),
    removeRows: (r0, r1) => (inRange(rows.length - (r1 - r0 + 1), ROWS) ? { "table.rows": splice(rows, r0, r1 - r0 + 1) } : null),
    moveRow: (from, to) => (from === to || [from, to].some((i) => i < 0 || i >= rows.length) ? null : { "table.rows": move(rows, from, to) }),
    insertCol: (at) => colWrite((s) => addColumn(s, at)),
    removeCols: (c0, c1) => { let s = slide; for (let i = c0; i <= c1; i++) { const p = removeColumn(s, c0); if (!p.table) return null; s = { ...s, table: p.table }; } return s.table ? { table: s.table } : null; },
    moveCol: (from, to) => colWrite((s) => moveColumn(s, from, to)),
  };
}

/* A pair's chart is edited as a chart of its own: the model reads the chart alone, and every path it writes is
   re-rooted under `charts[i]`, so the patches land on the real slide. */
const alone = (chart: Chart): Slide => ({ template: "chart", title: "", chart });
const reroot = (pre: string) => <T extends Patch | { error: string } | null>(p: T): T => (!p || failed(p) ? p : Object.fromEntries(Object.entries(p).map(([k, v]) => [`${pre}${k}`, v])) as T);
function within(m: SheetModel, pre: string): SheetModel {
  const r = reroot(pre);
  return { ...m, path: (row, c) => `${pre}${m.path(row, c)}`, set: (row, c, raw) => r(m.set(row, c, raw)), setHeader: (c, raw) => r(m.setHeader(c, raw)),
    insertRow: (at) => r(m.insertRow(at)), removeRows: (a, b) => r(m.removeRows(a, b)), moveRow: (a, b) => r(m.moveRow(a, b)),
    ...(m.insertCol ? { insertCol: (at: number) => r(m.insertCol?.(at) ?? null) } : {}), ...(m.removeCols ? { removeCols: (a: number, b: number) => r(m.removeCols?.(a, b) ?? null) } : {}),
    ...(m.moveCol ? { moveCol: (a: number, b: number) => r(m.moveCol?.(a, b) ?? null) } : {}) };
}

/** The sheet for a slide's data, or null where there is none (the timeline has its own gantt). `which` picks a pair's chart. */
export function sheetFor(slide: Slide, style: Style, which = 0): SheetModel | null {
  if (slide.template === "pair") { const c = slide.charts?.[which]?.chart, m = c ? sheetFor(alone(c), style) : null; return m && within(m, `charts[${which}].`); }
  if (slide.template === "table" && slide.table) return tableSheet(slide);
  const c = slide.chart;
  if (!c) return null;
  if (c.kind === "waterfall") return waterfall(c, style);
  if (c.kind === "ranked") return listSheet("ranked", (c.ranking ?? []) as unknown as Record<string, unknown>[], "ranking", RANKED_COLS, limits(style).ranking);
  if (c.kind === "matrix") return listSheet("matrix", (c.points ?? []) as unknown as Record<string, unknown>[], "points", MATRIX_COLS, limits(style).points);
  return c.kind === "timeline" ? null : bars(c, style);
}

/** Pasted cells written from `at`: rows are added up to the schema's limit, numbers are parsed, and what could not be
    kept is said, never dropped silently. One result slide, so one undo step. */
export function pasteInto(slide: Slide, style: Style, at: { r: number; c: number }, data: string[][], which = 0): { slide: Slide; note?: string } {
  let cur = slide, kept = 0, bad = 0, wide = 0;
  const run = (p: Patch | { error: string } | null) => { if (!p || failed(p)) return false; const r = applyPatch(cur, p); if (!r.slide) return false; cur = r.slide; return true; };
  for (let i = 0; i < data.length; i++) {
    const r = at.r + i;
    let m = sheetFor(cur, style, which);
    if (!m) break;
    while (r >= m.rows) { if (!run(m.insertRow(m.rows))) break; m = sheetFor(cur, style, which); if (!m) break; }
    if (!m || r >= m.rows) break;
    kept++;
    data[i].forEach((raw, j) => {
      const c = at.c + j, now = sheetFor(cur, style, which);
      if (!now || c >= now.cols.length) { if (raw !== "") wide++; return; }
      if (now.readOnly?.(r, c)) return;
      const p = now.set(r, c, now.cols[c].type === "flag" ? String(/^(true|yes|1|total)$/i.test(raw)) : raw);
      if (!run(p)) bad++;
    });
  }
  const notes = [kept < data.length ? `Pasted ${kept} of ${data.length} rows; the chart takes ${kept}.` : "", bad ? `${bad} cell${bad === 1 ? " was" : "s were"} not a number and ${bad === 1 ? "was" : "were"} left as they were.` : "", wide ? `${wide} cell${wide === 1 ? "" : "s"} past the last column ${wide === 1 ? "was" : "were"} not kept.` : ""].filter(Boolean);
  return { slide: cur, ...(notes.length ? { note: notes.join(" ") } : {}) };
}


/** A pasted table becomes the chart's data (select all, paste): for bars, a header row names the series and the first column
    names the categories; for a waterfall, label, value and an optional total column. Existing series keep their own look
    by position; what does not fit the schema's limits is dropped and said. */
export function replaceFromTable(slide: Slide, style: Style, table: string[][], which = 0): { slide: Slide; note?: string } {
  if (slide.template === "table" && slide.table) return replaceTable(slide, table);
  if (slide.template === "pair") {
    const c = slide.charts?.[which]?.chart;
    if (!c) return { slide };
    const r = replaceFromTable(alone(c), style, table), out = structuredClone(slide);
    if (out.charts?.[which] && r.slide.chart) out.charts[which].chart = r.slide.chart;
    return { slide: out, ...(r.note ? { note: r.note } : {}) };
  }
  const chart = slide.chart;
  if (!chart || chart.kind === "timeline" || !table.length) return { slide };
  const lim = limits(style), notes: string[] = [];
  const out = structuredClone(slide), c = out.chart as Chart;
  if (chart.kind === "ranked" || chart.kind === "matrix") {
    const ranked = chart.kind === "ranked", cap = ranked ? lim.ranking[1] : lim.points[1];
    // A header row is text in its number columns.
    const body = table[0].slice(1).every((cell) => cell.trim() === "" || parseNum(cell) === null) ? table.slice(1) : table, rows = body.slice(0, cap);
    if (rows.length < body.length) notes.push(`Kept ${rows.length} of ${body.length} rows; the chart takes ${cap}.`);
    const num = (v: string | undefined, d: number) => parseNum(v ?? "") ?? d;
    if (ranked) c.ranking = rows.map((r, i) => ({ label: r[0] ?? "", value: num(r[1], 0), ...(chart.ranking?.[i]?.focus ? { focus: true } : {}) }));
    else c.points = rows.map((r, i) => ({ label: r[0] ?? "", x: num(r[1], 50), y: num(r[2], 50), ...(chart.points?.[i]?.focus ? { focus: true } : {}) }));
    return { slide: out, ...(notes.length ? { note: notes.join(" ") } : {}) };
  }
  if (chart.kind === "waterfall") {
    const rows = table.slice(0, lim.items[1]);
    if (rows.length < table.length) notes.push(`Kept ${rows.length} of ${table.length} rows; the chart takes ${lim.items[1]}.`);
    c.items = rows.map((r) => {
      const label = r[0] ?? "", total = /^(true|yes|1|total)$/i.test(r[2] ?? ""), n = parseNum(r[1] ?? "");
      return total ? { label, total: true } : { label, value: n ?? 0 };
    });
    return { slide: out, ...(notes.length ? { note: notes.join(" ") } : {}) };
  }
  // A header row is text all the way across; one number in it makes it data.
  const first = table[0].slice(1).filter((cell) => cell.trim() !== ""), header = first.length > 0 && first.every((cell) => parseNum(cell) === null);
  const body = header ? table.slice(1) : table, names = header ? table[0].slice(1) : [];
  const width = Math.max(0, ...table.map((r) => r.length - 1));
  const rows = body.slice(0, lim.categories[1]), cols = Math.min(width, lim.series[1]);
  if (rows.length < body.length) notes.push(`Kept ${rows.length} of ${body.length} rows; the chart takes ${lim.categories[1]}.`);
  if (cols < width) notes.push(`Kept ${cols} of ${width} columns; the chart takes ${lim.series[1]}.`);
  let bad = 0;
  const old = chart.series ?? [], like = old.at(-1);
  c.categories = rows.map((r) => r[0] ?? "");
  c.series = Array.from({ length: cols }, (_, j) => {
    const base = old[j] ?? { mark: like?.mark ?? "bar", ...(like?.color ? { color: "neutral" as const } : {}), ...(like?.format ? { format: like.format } : {}) };
    return { ...base, name: (names[j] ?? `Series ${j + 1}`).trim(), values: rows.map((r) => { const n = parseNum(r[j + 1] ?? ""); if (n === null) { if ((r[j + 1] ?? "").trim() !== "") bad++; return 0; } return n; }) } as Chart["series"] extends (infer S)[] | undefined ? S : never;
  });
  if (bad) notes.push(`${bad} cell${bad === 1 ? " was" : "s were"} not a number and became 0.`);
  c.annotations = (chart.annotations ?? []).filter((a) => (a.from ?? 0) < rows.length && (a.to ?? 0) < rows.length && (a.series ?? 0) < cols);
  return { slide: out, ...(notes.length ? { note: notes.join(" ") } : {}) };
}

/** A pasted table replaces a table slide's: the first row is the header, the rest are rows (up to the schema's 5 columns and 8 rows). */
function replaceTable(slide: Slide, table: string[][]): { slide: Slide; note?: string } {
  const old = slide.table, notes: string[] = [];
  if (!old || table.length < 2) return { slide };
  const width = Math.max(...table.map((r) => r.length)), cols = Math.min(width, 5), body = table.slice(1), rows = body.slice(0, 8);
  if (cols < width) notes.push(`Kept ${cols} of ${width} columns; a table takes 5.`);
  if (rows.length < body.length) notes.push(`Kept ${rows.length} of ${body.length} rows; a table takes 8.`);
  const out = structuredClone(slide);
  out.table = {
    columns: Array.from({ length: Math.max(2, cols) }, (_, j) => ({ ...(old.columns[j] ?? {}), label: (table[0][j] ?? "").trim() })),
    rows: rows.map((r) => ({ cells: Array.from({ length: Math.max(2, cols) }, (_, j) => r[j] ?? "") })),
  };
  return { slide: out, ...(notes.length ? { note: notes.join(" ") } : {}) };
}

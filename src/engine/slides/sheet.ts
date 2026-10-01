/* A chart as a sheet (spec 4.3): rows and columns a person edits like a spreadsheet. A SheetModel reads and writes the real
   slide paths through patches for applyPatch, the same path the agent writes on, so reordering a series moves the series
   itself (its mark and colour with it). Limits come from the schema; an action that would break one returns null. */
import { applyPatch } from "../agent/patch";
import { addColumn, moveColumn, removeColumn } from "./edit";
import { describe, type FieldView } from "./schema";
import type { Chart, Slide, Style } from "../types";

export type Patch = Record<string, unknown>;
export type Cellv = string | number | boolean | null;
export interface SheetCol { header: string; headerPath?: string; type: "text" | "number" | "flag" }
export interface SheetModel {
  kind: "bars" | "waterfall" | "table";
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
  const t = raw.trim().replace(/[£$€,%\s]/g, "").replace(/[−–]/g, "-").replace(/(?<=\d)(bn|m|k|x)$/i, "");
  if (t === "") return null;
  const neg = /^\(.*\)$/.test(t), n = Number(neg ? `-${t.slice(1, -1)}` : t);
  return Number.isFinite(n) ? n : null;
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

interface Limits { categories: [number, number]; series: [number, number]; items: [number, number] }
function limits(style: Style): Limits {
  const f = describe("chart", style).fields.chart.fields as Record<string, FieldView>;
  const lim = (k: string): [number, number] => [f[k].items?.min ?? 0, f[k].items?.max ?? Infinity];
  return { categories: lim("categories"), series: lim("series"), items: lim("items") };
}
const splice = <T,>(xs: T[], at: number, del: number, ...ins: T[]) => { const a = xs.slice(); a.splice(at, del, ...ins); return a; };
const move = <T,>(xs: T[], from: number, to: number) => { const a = xs.slice(), [x] = a.splice(from, 1); a.splice(to, 0, x); return a; };
const inRange = (n: number, [lo, hi]: [number, number]) => n >= lo && n <= hi;
const NEEDS_NUMBER = { error: "Enter a number" };

function bars(chart: Chart, style: Style): SheetModel {
  const cats = chart.categories ?? [], series = chart.series ?? [], lim = limits(style);
  /** Annotations point at category and series indices; one that no longer points at anything is dropped. */
  const keep = (n: number, m: number): Patch => (chart.annotations ? { "chart.annotations": chart.annotations.filter((a) => (a.from ?? 0) < n && (a.to ?? 0) < n && (a.series ?? 0) < m) } : {});
  const rowsWrite = (f: <T>(xs: T[]) => T[], n: number): Patch => ({ "chart.categories": f(cats), ...Object.fromEntries(series.map((s, j) => [`chart.series[${j}].values`, f(s.values)])), ...keep(n, series.length) });
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
    insertRow: (at) => (inRange(cats.length + 1, lim.categories) ? rowsWrite((xs) => splice(xs as unknown[], at, 0, xs === cats ? "" : 0) as typeof xs, cats.length + 1) : null),
    removeRows: (r0, r1) => (inRange(cats.length - (r1 - r0 + 1), lim.categories) ? rowsWrite((xs) => splice(xs, r0, r1 - r0 + 1), cats.length - (r1 - r0 + 1)) : null),
    moveRow: (from, to) => (from === to || [from, to].some((i) => i < 0 || i >= cats.length) ? null : rowsWrite((xs) => move(xs, from, to), cats.length)),
    insertCol: (at) => {
      if (at < 1 || !inRange(series.length + 1, lim.series)) return null;
      const like = series.at(-1);
      return { "chart.series": splice(series, at - 1, 0, { name: "", values: cats.map(() => 0), mark: like?.mark ?? "bar", ...(like?.color ? { color: "neutral" as const } : {}), ...(like?.format ? { format: like.format } : {}) }), ...keep(cats.length, series.length + 1) };
    },
    removeCols: (c0, c1) => (c0 < 1 || !inRange(series.length - (c1 - c0 + 1), lim.series) ? null : { "chart.series": splice(series, c0 - 1, c1 - c0 + 1), ...keep(cats.length, series.length - (c1 - c0 + 1)) }),
    moveCol: (from, to) => (from < 1 || to < 1 || from === to || from > series.length || to > series.length ? null : { "chart.series": move(series, from - 1, to - 1) }),
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

function tableSheet(slide: Slide): SheetModel {
  const t = slide.table ?? { columns: [], rows: [] }, cols = t.columns, rows = t.rows;
  const text = (r: number, c: number) => { const x = rows[r]?.cells[c]; return typeof x === "object" && x ? x.value : x ?? ""; };
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

/** The sheet for a slide's data, or null where there is none (the timeline has its own gantt). */
export function sheetFor(slide: Slide, style: Style): SheetModel | null {
  if (slide.template === "table" && slide.table) return tableSheet(slide);
  const c = slide.chart;
  if (!c) return null;
  if (c.kind === "waterfall") return waterfall(c, style);
  return c.kind === "timeline" ? null : bars(c, style);
}

/** Pasted cells written from `at`: rows are added up to the schema's limit, numbers are parsed, and what could not be
    kept is said, never dropped silently. One result slide, so one undo step. */
export function pasteInto(slide: Slide, style: Style, at: { r: number; c: number }, data: string[][]): { slide: Slide; note?: string } {
  let cur = slide, kept = 0, bad = 0, wide = 0;
  const run = (p: Patch | { error: string } | null) => { if (!p || failed(p)) return false; const r = applyPatch(cur, p); if (!r.slide) return false; cur = r.slide; return true; };
  for (let i = 0; i < data.length; i++) {
    const r = at.r + i;
    let m = sheetFor(cur, style);
    if (!m) break;
    while (r >= m.rows) { if (!run(m.insertRow(m.rows))) break; m = sheetFor(cur, style); if (!m) break; }
    if (!m || r >= m.rows) break;
    kept++;
    data[i].forEach((raw, j) => {
      const c = at.c + j, now = sheetFor(cur, style);
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
export function replaceFromTable(slide: Slide, style: Style, table: string[][]): { slide: Slide; note?: string } {
  if (slide.template === "table" && slide.table) return replaceTable(slide, table);
  const chart = slide.chart;
  if (!chart || chart.kind === "timeline" || !table.length) return { slide };
  const lim = limits(style), notes: string[] = [];
  const out = structuredClone(slide), c = out.chart as Chart;
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

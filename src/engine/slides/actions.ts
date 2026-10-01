/* What can be done to the thing under the pointer or the selection (hand editing). One pure function: the context
   menu, the floating bar and the keyboard all read it, so they cannot disagree. Every action is a patch for
   applyPatch, which is how the agent writes too. Limits (min, max) come from the schema through listOps. */
import { addColumn, getAt, listOf, listOps, moveColumn, moveItem, newItem, removeColumn, removeItem } from "./edit.js";
import { hasMark, plainOf, toggleSpans, type Mark } from "./markup.js";
import { BALLS, CROSS, TICK } from "./marks.js";
import type { Slide, Style } from "../types.js";

/** What is selected, in model coordinates (never DOM nodes: the slide is redrawn under it). A table's header row is -1. */
export type Target =
  | { kind: "text"; path: string; from: number; to: number }
  | { kind: "item"; item: string }
  | { kind: "cells"; r0: number; c0: number; r1: number; c1: number }
  | { kind: "slide" };

export interface Result { set: Record<string, unknown>; focus?: string; target?: Target }
export interface Action {
  id: string; label: string; group: "text" | "item" | "row" | "column" | "format" | "mark";
  /** Shown on the floating bar as well as in the menu. */
  bar?: boolean; checked?: boolean; shortcut?: string;
  run(): Result;
}

type Tone = "normal" | "muted" | "focus";
const MARKUP_KIND = /^(title|subtitle|takeaway|footnote|source|number\.caption|body\[|notes\[\d+\]\.(title|text)|cards\[\d+\]\.(title|text|bullets|facts\[\d+\]\.text)|steps\[\d+\]\.text|table\.rows\[\d+\]\.cells)/;
const isMarkupPath = (p: string) => MARKUP_KIND.test(p);

/** The path holding a table body cell's words: the cell itself, or its `.value` when it is { value, note }. */
export function cellField(slide: Slide, r: number, c: number): string | null {
  const cell = slide.table?.rows[r]?.cells[c];
  if (cell === undefined) return null;
  const base = `table.rows[${r}].cells[${c}]`;
  return typeof cell === "object" && cell ? `${base}.value` : base;
}

/** The patch for one or more columns' tone: muted and focus are exclusive. Other columns keep their own tone. */
export function tonePatch(cols: number | number[], tone: Tone): Record<string, unknown> {
  const list = Array.isArray(cols) ? cols : [cols], set: Record<string, unknown> = {};
  for (const j of list) { set[`table.columns[${j}].muted`] = tone === "muted" ? true : null; set[`table.columns[${j}].focus`] = tone === "focus" ? true : null; }
  return set;
}

const range = (a: number, b: number) => Array.from({ length: Math.abs(b - a) + 1 }, (_, i) => Math.min(a, b) + i);

function markActions(slide: Slide, t: Target): Action[] {
  const spans = (): { path: string; markup: string; from: number; to: number }[] => {
    if (t.kind === "text") return isMarkupPath(t.path) ? [{ path: t.path, markup: String(getAt(slide, t.path) ?? ""), from: t.from, to: t.to }] : [];
    if (t.kind !== "cells") return [];
    const rows = range(Math.max(0, t.r0), Math.min(t.r1, (slide.table?.rows.length ?? 1) - 1)), cols = range(t.c0, Math.min(t.c1, (slide.table?.columns.length ?? 1) - 1));
    return rows.flatMap((r) => cols.flatMap((c) => { const path = cellField(slide, r, c); if (!path) return []; const markup = String(getAt(slide, path) ?? ""); return [{ path, markup, from: 0, to: plainOf(markup).length }]; }));
  };
  const all = spans().filter((s) => s.from !== s.to);
  if (!all.length) return [];
  const make = (mark: Mark, id: string, label: string, shortcut?: string): Action => ({
    id, label, group: "text", bar: true, shortcut, checked: all.every((s) => hasMark(s.markup, s.from, s.to, mark)),
    run: () => { const next = toggleSpans(all, mark); return { set: Object.fromEntries(all.map((s, i) => [s.path, next[i]])) }; },
  });
  return [make("b", "bold", "Bold", "Mod+B"), make("f", "focus", "Focus", "Mod+Shift+H")];
}

function itemActions(slide: Slide, style: Style, item: string, prefix = ""): Action[] {
  const ops = listOps(slide, style), hit = listOf(ops, item);
  if (!hit) return [];
  const { op, index } = hit, out: Action[] = [];
  const at = (i: number) => `${op.path}[${i}]`;
  if (op.length < op.max) {
    out.push({ id: `${prefix}insert-before`, label: "Insert before", group: "item", run: () => ({ set: newItem(slide, style, op, index), focus: at(index) }) });
    out.push({ id: `${prefix}insert-after`, label: "Insert after", group: "item", run: () => ({ set: newItem(slide, style, op, index + 1), focus: at(index + 1) }) });
  }
  if (index > 0) out.push({ id: `${prefix}move-earlier`, label: "Move earlier", group: "item", shortcut: "Alt+Shift+Up", run: () => ({ set: moveItem(slide, op.path, index, index - 1), target: { kind: "item", item: at(index - 1) } }) });
  if (index < op.length - 1) out.push({ id: `${prefix}move-later`, label: "Move later", group: "item", shortcut: "Alt+Shift+Down", run: () => ({ set: moveItem(slide, op.path, index, index + 1), target: { kind: "item", item: at(index + 1) } }) });
  if (op.length > op.min || !op.required) out.push({ id: `${prefix}delete`, label: "Delete", group: "item", shortcut: "Backspace", run: () => ({ set: removeItem(op, index), target: { kind: "slide" } }) });
  return out;
}

function tableActions(slide: Slide, style: Style, t: Extract<Target, { kind: "cells" }>): Action[] {
  const rowsN = slide.table?.rows.length ?? 0, colsN = slide.table?.columns.length ?? 0, out: Action[] = [];
  const c0 = Math.min(t.c0, t.c1), c1 = Math.max(t.c0, t.c1), cols = range(c0, Math.min(c1, colsN - 1));
  const r = Math.max(0, Math.min(t.r0, t.r1));
  if (rowsN > 0 && Math.max(t.r0, t.r1) >= 0) {
    const rows = range(r, Math.min(Math.max(t.r0, t.r1), rowsN - 1)), on = rows.every((i) => slide.table?.rows[i]?.focus);
    out.push({ id: "row-focus", label: "Focus row", group: "format", checked: on, run: () => ({ set: Object.fromEntries(rows.map((i) => [`table.rows[${i}].focus`, on ? null : true])) }) });
    const row = itemActions(slide, style, `table.rows[${r}]`, "row-");
    const rename: Record<string, [string, string]> = { "row-insert-before": ["Insert row above", "row"], "row-insert-after": ["Insert row below", "row"], "row-move-earlier": ["Move row up", "row"], "row-move-later": ["Move row down", "row"], "row-delete": ["Delete row", "row"] };
    for (const a of row) out.push({ ...a, group: "row", label: rename[a.id]?.[0] ?? a.label });
  }
  const colTarget = (c: number): Target => ({ kind: "cells", r0: -1, c0: c, r1: rowsN - 1, c1: c });
  if (colsN < 5) {
    out.push({ id: "col-insert-before", label: "Insert column left", group: "column", run: () => ({ set: addColumn(slide, c0), target: colTarget(c0) }) });
    out.push({ id: "col-insert-after", label: "Insert column right", group: "column", run: () => ({ set: addColumn(slide, c1 + 1), target: colTarget(c1 + 1) }) });
  }
  if (c0 > 0) out.push({ id: "col-move-earlier", label: "Move column left", group: "column", shortcut: "Alt+Shift+Left", run: () => ({ set: moveColumn(slide, c0, c0 - 1), target: colTarget(c0 - 1) }) });
  if (c1 < colsN - 1) out.push({ id: "col-move-later", label: "Move column right", group: "column", shortcut: "Alt+Shift+Right", run: () => ({ set: moveColumn(slide, c0, c0 + 1), target: colTarget(c0 + 1) }) });
  if (colsN > 2) out.push({ id: "col-delete", label: "Delete column", group: "column", run: () => ({ set: removeColumn(slide, c0), target: { kind: "slide" } }) });
  const flag = (key: "bold" | "italic") => cols.every((j) => slide.table?.columns[j]?.[key]);
  for (const [key, label] of [["bold", "Bold column"], ["italic", "Italic column"]] as const)
    out.push({ id: `col-${key}`, label, group: "format", checked: flag(key), run: () => ({ set: Object.fromEntries(cols.map((j) => [`table.columns[${j}].${key}`, flag(key) ? null : true])) }) });
  const toneOf = (j: number): Tone => (slide.table?.columns[j]?.focus ? "focus" : slide.table?.columns[j]?.muted ? "muted" : "normal");
  for (const tone of ["normal", "muted", "focus"] as const)
    out.push({ id: `col-tone-${tone}`, label: `${tone[0].toUpperCase()}${tone.slice(1)} column`, group: "format", checked: cols.every((j) => toneOf(j) === tone), run: () => ({ set: tonePatch(cols, tone) }) });
  return out;
}

/** Scores by hand: every selected body cell becomes one mark (a Harvey ball, a tick or a cross), or loses it. */
const MARKS: [string, string, string][] = [["ball-0", "Harvey ball: none", BALLS[0]], ["ball-1", "Harvey ball: quarter", BALLS[1]], ["ball-2", "Harvey ball: half", BALLS[2]],
  ["ball-3", "Harvey ball: three quarters", BALLS[3]], ["ball-4", "Harvey ball: full", BALLS[4]], ["tick", "Tick", TICK], ["cross", "Cross", CROSS]];
function scoreActions(slide: Slide, t: Extract<Target, { kind: "cells" }>): Action[] {
  // Body cells only: not the header row (-1) and not the label column (0).
  const span = (lo: number, hi: number) => (lo > hi ? [] : range(lo, hi));
  const rows = span(Math.max(0, Math.min(t.r0, t.r1)), Math.min(Math.max(t.r0, t.r1), (slide.table?.rows.length ?? 0) - 1));
  const cols = span(Math.max(1, Math.min(t.c0, t.c1)), Math.min(Math.max(t.c0, t.c1), (slide.table?.columns.length ?? 0) - 1));
  const paths = rows.flatMap((r) => cols.flatMap((c) => { const p = cellField(slide, r, c); return p ? [p] : []; }));
  if (!paths.length) return [];
  return MARKS.map(([id, label, ch]) => {
    const on = paths.every((p) => String(getAt(slide, p) ?? "").trim() === ch);
    return { id: `mark-${id}`, label, group: "mark", checked: on, run: () => ({ set: Object.fromEntries(paths.map((p) => [p, on ? "" : ch])) }) };
  });
}

export function actionsFor(target: Target, slide: Slide, style: Style): Action[] {
  switch (target.kind) {
    case "text": return markActions(slide, target);
    case "item": return itemActions(slide, style, target.item);
    // A selection that includes the header is a column (or more): it takes the column format, not text marks.
    case "cells": return [...(Math.min(target.r0, target.r1) < 0 ? [] : markActions(slide, target)), ...tableActions(slide, style, target), ...scoreActions(slide, target)];
    default: return [];
  }
}

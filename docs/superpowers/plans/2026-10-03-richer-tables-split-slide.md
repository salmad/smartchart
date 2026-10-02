# Richer tables, split slide, capability guidance: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tables gain header icons, bullets in cells, marks with notes, status labels and group headings; `pair` becomes two halves (chart, table, number or points); consulting notes get longer; every template card where the agent has a choice explains when to use each capability.

**Architecture:** All slide rules live in `src/engine/slides/schema.ts` (field defs in `MENU`, validation in `check()` / `checkRules()`), rendering in `render.ts` + `slides.css`, the editor's data grid in `sheet.ts` + `edit.ts`. The template card (`describe()`) is what both the in-app agent and MCP read, so capability guidance is added there once.

**Tech Stack:** TypeScript (strict), vitest, Playwright, lucide icons, plain HTML/CSS slides at 1920×1080.

**Spec:** `docs/superpowers/specs/2026-10-03-richer-tables-split-slide-design.md`

## Global Constraints

- Read `CLAUDE.md` first. No `any`, no inline styles in React. Slides use `slides.css`; app chrome never styles slide internals.
- Examples come only from `src/engine/starters/starters.json`; never add another example set. Rewrite content; don't add or remove starters (count lock: 24).
- Checks warn or error with the path, what was measured, the limit and the fix. Code never silently rewrites a slide.
- Never red or green for status or emphasis; the focus colour is the only emphasis.
- `tests/fixtures/example-shapes.json` says "Never -u" and `tests/fixtures/example-lines.json` is a line-count lock. Do NOT re-record either; if a task's change makes them fail, stop and report to the controller (the user decides).
- Run `npm test` (vitest) and `npm run build` (typecheck) before every commit. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Old decks with `charts` are not migrated (spec §4.4).

## Review Focus

1. A table cell written the old way (`"text"` or `{ value, note }`) must validate, render and edit exactly as before. Covered in Task 1 and Task 2 tests ("old cells unchanged").
2. A group row (one cell) in a table that is then edited by column operations (add, remove, move column) must keep its single cell. Covered in Task 3.
3. A slide still carrying `charts` (an old deck) must not crash rendering or the editor: it renders empty halves and `validate` names `halves`. Covered in Task 4 and Task 5.
4. A half with two bodies (`chart` and `table`) or none gets one clear error naming the fields found. Covered in Task 4.
5. A pitch table with bullet cells: bullets are hidden in pitch, so the validator warns rather than silently losing content. Covered in Task 1.

---

### Task 1: Table cells and table validation

**Files:**
- Create: `src/engine/slides/align.ts`
- Modify: `src/engine/types.ts` (`Cell`, `Table`)
- Modify: `src/engine/slides/render.ts:57-70` (remove `columnAlign`, `NUMERIC`, `cellValue`; import from `align.ts`)
- Modify: `src/engine/slides/schema.ts` (table field defs ~289-318, `check()` "cell" case ~533-539, `checkRules()` table case ~723-743)
- Modify: `tests/unit/render.test.ts:3` (import `columnAlign` from `@/engine/slides/align`)
- Test: `tests/unit/table-cells.test.ts` (create)

**Interfaces:**
- Produces: `type Cell = string | { value?: string; note?: string; bullets?: string[]; status?: boolean }`
- Produces: `interface Table { columns: { label?: string; icon?: string; focus?: boolean; muted?: boolean; bold?: boolean; italic?: boolean }[]; rows: { cells: Cell[]; style?: 'muted' | 'total' | 'group'; focus?: boolean }[] }`
- Produces: `columnAlign(t: Pick<Table, "columns" | "rows">): Align[]` and `type Align = "text" | "num" | "sym"` from `src/engine/slides/align.ts`
- Produces (schema.ts, not exported): `checkGrid(t: Partial<Table>, base: string, style: Style, out: Out, half?: boolean): void`. Task 4 calls it for half tables.
- Produces (schema.ts, not exported): `TABLE_COLUMN`, `TABLE_CELLS` field defs. Task 4 reuses them for the half table.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/table-cells.test.ts`:

```ts
import { test, expect } from 'vitest'
import { validate } from '@/engine/slides/schema'
import { columnAlign } from '@/engine/slides/align'
import type { Cell, Slide, Table } from '@/engine/types'

const T = (columns: Table['columns'], rows: Table['rows'], extra: Partial<Slide> = {}): Slide => ({ template: 'table', title: 'Acme leads on every criterion SMEs ask for', table: { columns, rows }, ...extra })
const cols = (n: number, extra: Partial<Table['columns'][number]> = {}) => [{ label: 'Provider' }, ...Array.from({ length: n - 1 }, (_, i) => ({ label: `C${i}`, ...extra }))]
const row = (...cells: Cell[]) => ({ cells })
const errs = (s: Slide, style: 'consulting' | 'pitch' = 'consulting') => validate(s, style).errors.join('\n')
const warns = (s: Slide, style: 'consulting' | 'pitch' = 'consulting') => validate(s, style).warnings.join('\n')

test('old cells unchanged: strings and { value, note } still validate', () => {
  expect(validate(T(cols(3), [row('Bank', '£25k', { value: '£120', note: 'per year' })])).errors).toEqual([])
})

test('a mark may carry a note', () => {
  expect(validate(T(cols(3), [row('Bank', { value: '✓', note: 'from Q2' }, '✗')])).errors).toEqual([])
})

test('bullets in a cell: 1–3 of at most 50 characters, not with a note, one column, at most 4 columns', () => {
  expect(validate(T(cols(3), [row('Bank', 'Branches', { value: 'Slow', bullets: ['Underwrites on filed accounts', 'Caps at £25k'] })])).errors).toEqual([])
  expect(errs(T(cols(3), [row('Bank', 'x', { bullets: ['a', 'b', 'c', 'd'] })]))).toMatch(/cells\[2\]\.bullets: 1–3 bullets/)
  expect(errs(T(cols(3), [row('Bank', 'x', { bullets: ['x'.repeat(51)] })]))).toMatch(/cells\[2\]\.bullets\[0\]: 51 characters, limit 50/)
  expect(errs(T(cols(3), [row('Bank', 'x', { value: 'a', note: 'n', bullets: ['b'] })]))).toMatch(/bullets or a note, not both/)
  expect(errs(T(cols(3), [row('Bank', { bullets: ['a'] }, { bullets: ['b'] })]))).toMatch(/bullets in 2 columns; at most one column/)
  expect(errs(T(cols(5), [row('Bank', 'a', 'b', 'c', { bullets: ['d'] })]))).toMatch(/5 columns; a table with bullets in cells takes at most 4/)
  expect(warns(T(cols(3), [row('Bank', 'x', { bullets: ['a'] })], { subtitle: 'A claim.' }), 'pitch')).toMatch(/pitch hides bullets in cells/)
})

test('a cell object takes only value, note, bullets, status', () => {
  expect(errs(T(cols(2), [row('Bank', { value: 'x', colour: 'red' } as unknown as Cell)]))).toMatch(/cells\[1\]\.colour: not a cell field\. Allowed: value, note, bullets, status/)
  expect(errs(T(cols(2), [row('Bank', { note: 'n' })]))).toMatch(/cells\[1\]\.value: required/)
})

test('status labels: a boolean flag; more than 4 distinct values in a column warns', () => {
  const st = (v: string): Cell => ({ value: v, status: true })
  expect(validate(T(cols(2), [row('A', st('Live')), row('B', st('Pilot'))])).errors).toEqual([])
  expect(warns(T(cols(2), ['Live', 'Pilot', 'Planned', 'Paused', 'Closed'].map((v, i) => row(`R${i}`, st(v)))))).toMatch(/columns\[1\]: 5 different status labels/)
})

test('header icons: every column after the first, or none; never the label column; not on numbers', () => {
  expect(validate(T(cols(3, { icon: 'zap' }), [row('Bank', '✓', '✗')])).errors).toEqual([])
  const some = T([{ label: 'Provider' }, { label: 'A', icon: 'zap' }, { label: 'B' }], [row('Bank', '✓', '✗')])
  expect(errs(some)).toMatch(/table\.columns: 1 of 2 columns have an icon/)
  expect(errs(T([{ label: 'P', icon: 'zap' }, { label: 'A' }], [row('Bank', '✓')]))).toMatch(/columns\[0\]\.icon: the label column has no icon/)
  expect(errs(T(cols(2, { icon: 'not-an-icon' }), [row('Bank', '✓')]))).toMatch(/icon: "not-an-icon" is not allowed/)
  expect(warns(T(cols(2, { icon: 'coins' }), [row('Bank', '£25k'), row('Neo', '£5k')]))).toMatch(/columns\[1\]\.icon: an icon on a column of numbers/)
})

test('group rows: one cell, exempt from the column count, warn below 6 rows or with a group of 1, not counted in the 8-row cap', () => {
  const g = (h: string) => ({ cells: [h], style: 'group' as const })
  const data = (n: number) => Array.from({ length: n }, (_, i) => row(`R${i}`, '1', '2'))
  expect(validate(T(cols(3), [g('Fees'), ...data(3), g('Limits'), ...data(3)])).errors).toEqual([])
  expect(validate(T(cols(3), [g('Fees'), ...data(3), g('Limits'), ...data(3)])).warnings).toEqual([])
  expect(errs(T(cols(3), [{ cells: ['Fees', 'x'], style: 'group' }, ...data(6)]))).toMatch(/rows\[0\]\.cells: a group row has one cell, its heading \(got 2\)/)
  expect(warns(T(cols(3), [g('Fees'), ...data(2), g('Limits'), ...data(2)]))).toMatch(/group headings with 4 rows; use them only with 6 or more/)
  expect(warns(T(cols(3), [g('Fees'), ...data(5), g('Limits'), ...data(1)]))).toMatch(/rows\[6\]: a group of 1 row; a group needs at least 2/)
  expect(errs(T(cols(3), [g('A'), ...data(4), g('B'), ...data(4)]))).not.toMatch(/at most 8/)
  expect(errs(T(cols(3), data(9)))).toMatch(/table\.rows: 9 rows; at most 8/)
})

test('budget: bullets rows, group rows and header icons cost lines', () => {
  // 7 rows with 3 bullets each = 7 × 2.5 = 17.5 > 10.5
  const heavy = Array.from({ length: 7 }, (_, i) => row(`R${i}`, 'x', { value: 'y', bullets: ['a', 'b', 'c'] }))
  expect(errs(T(cols(3), heavy))).toMatch(/costs 17\.5 rows, budget 10\.5/)
  expect(errs(T(cols(3), heavy, { subtitle: 'A claim.' }), 'pitch')).not.toMatch(/costs/)
})

test('columnAlign: group rows are skipped; status and bullet cells make a text column', () => {
  const t: Table = { columns: cols(3), rows: [{ cells: ['Fees'], style: 'group' }, row('A', '£5', { value: 'Live', status: true }), row('B', '£7', { value: 'Pilot', status: true })] }
  expect(columnAlign(t)).toEqual(['text', 'num', 'text'])
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/table-cells.test.ts`
Expected: FAIL (cannot resolve `@/engine/slides/align`).

- [ ] **Step 3: Create `src/engine/slides/align.ts`**

Move `cellValue`, `NUMERIC`, `Align` and `columnAlign` out of `render.ts` into this file. Skip group rows, and make any column with a status or bullet cell `text`:

```ts
/* Column alignment from content (spec 3.6 L2). Framework-free: the renderer and the validator both use it. */
import { plainOf } from "./markup.js";
import type { Cell, Table } from "../types.js";

const cellValue = (c: Cell | undefined) => plainOf(String(c && typeof c === "object" ? c.value ?? "" : c ?? "")).trim();
const NUMERIC = /^~?\(?[+−-]?[£$€]?\d[\d,.]*(?:[–-]\d[\d,.]*)?\s?(%|x|×|k|m|bn|pp|bps)?\)?(\/\w+)?$/i;
const rich = (c: Cell | undefined) => !!c && typeof c === "object" && (!!c.status || !!c.bullets);

/** Alignment per column from its content: label column text, numbers right, short symbols centred. */
export type Align = "text" | "num" | "sym";
export function columnAlign(t: Pick<Table, "columns" | "rows">): Align[] {
  const rows = t.rows.filter((r) => r.style !== "group");
  return t.columns.map((_, j) => {
    if (j === 0) return "text";
    if (rows.some((r) => rich(r.cells?.[j]))) return "text";
    const vals = rows.map((r) => cellValue(r.cells?.[j])).filter((v) => v && v !== "—" && v !== "–" && v !== "-");
    // Symbols are marks (✓, —, ●) or yes/no; a short word such as "CEO" is text.
    if (!vals.length || vals.every((v) => v.length <= 3 && !/\d/.test(v) && (!/\p{L}/u.test(v) || /^(yes|no|y|n|n\/a)$/i.test(v)))) return "sym";
    return vals.every((v) => NUMERIC.test(v)) ? "num" : "text";
  });
}
```

In `render.ts`, delete the moved code and add `import { columnAlign } from "./align.js";`. Update `tests/unit/render.test.ts:3` to import from `../../src/engine/slides/align`.

- [ ] **Step 4: Update the types in `src/engine/types.ts`**

```ts
export type Cell = string | { value?: string; note?: string; bullets?: string[]; status?: boolean }
export interface Table { columns: { label?: string; icon?: string; focus?: boolean; muted?: boolean; bold?: boolean; italic?: boolean }[]; rows: { cells: Cell[]; style?: 'muted' | 'total' | 'group'; focus?: boolean }[] }
```

Run `npm run build` and fix every compile error where code assumed `value` is always a string (use `c.value ?? ""`). Expected places: `render.ts` table cell, `sheet.ts` `tableSheet` `text()`, `marks.ts` `cellText` (already uses `String(...)`).

- [ ] **Step 5: Table field defs in `schema.ts`**

Pull the column and cells defs out of the `table` entry into named consts above `MENU`, so Task 4 can reuse them. Add `icon` to the full-table column, `group` to the row style, and raise the rows list max to 10 (group rows don't count toward the 8; `checkGrid` enforces 8 data rows):

```ts
/* Table pieces, shared by the table template and a half table in the pair. */
const COLUMN_FIELDS = {
  label: f("text", "Header text. The first (label) column's header may be left out.", { max: 26 }),
  focus: f("boolean", "Highlight this column. Not with `muted`.", { default: false }),
  muted: f("boolean", "A quieter column, for context. Not with `focus`.", { default: false }),
};
const TABLE_COLUMN = f("object", "Column.", { fields: {
  ...COLUMN_FIELDS,
  icon: f("enum", "Optional icon over the header, from the curated set: on every column after the first, or none.", { values: ICONS }),
  bold: f("boolean", "Set the whole column in bold.", { default: false }),
  italic: f("boolean", "Set the whole column in italic.", { default: false }),
} });
const TABLE_CELLS = f("list", "One cell per column. A string (it may use the inline markup: **bold**, [[focus]] to highlight one cell), or an object: { value, note } puts a small note under the value; { value?, bullets } adds 1–3 short bullets explaining the position; { value, status: true } draws a status label (Live, Pilot). A score is a cell holding only a mark: a Harvey ball ○ ◔ ◑ ◕ ● (none to full), or ✓ / ✗; a mark may take a note. A group row has one cell: its heading.", { required: true, of: f("cell", "Cell.", { max: 40 }) });
```

The `table` entry's `table.fields` becomes:

```ts
columns: f("list", "Column headers, left to right. The first column is usually the row label.", { required: true, items: { min: 2, max: 5 }, of: TABLE_COLUMN }),
rows: f("list", "Rows, top to bottom: at most 8, plus group headings.", { required: true, items: { min: 1, max: 10 }, of: f("object", "Row.", { fields: {
  cells: TABLE_CELLS,
  style: f("enum", "`muted`: a context row, hidden in pitch. `total`: the bottom line, drawn with a rule above. `group`: a heading over the rows below it (one cell).", { values: ["muted", "total", "group"] }),
  focus: f("boolean", "Highlight this row.", { default: false }),
} }) }),
```

Replace the table `rules` with:

```ts
rules: [
  "Budget: a row costs 1, a row with a cell note 1.5, a row with bullets 1 + 0.75 per bullet after the first, a group heading 0.75, header icons 0.5, a takeaway 1.5, a caption 1, the Harvey-ball key 1 (consulting). Consulting: at most 10.5. Pitch: at most 7 (cell notes, bullets and muted rows are hidden in pitch).",
  "Scores: one kind of mark per table, Harvey balls or ticks, not both.",
  "Bullets in cells: one column at most, in a table of at most 4 columns; 1–3 bullets of up to 50 characters; not with a note in the same cell.",
  "Header icons: on every column after the first, or none.",
  "With notes: at most 4 columns, 3 notes, and first-column text of at most 24 characters.",
],
```

- [ ] **Step 6: The "cell" case in `check()`**

Replace the existing `case "cell"` block with:

```ts
case "cell": {
  if (typeof value === "string" || typeof value === "number") {
    const len = plain(String(value)).length;
    if (max && len > max) out.errors.push(`${path}: ${len} characters, limit ${max}.`);
    break;
  }
  if (typeof value !== "object" || Array.isArray(value)) { out.errors.push(`${path}: a cell is a string, or an object with value, note, bullets or status.`); break; }
  const v = fieldsOf(value);
  for (const k of Object.keys(v)) if (!CELL_KEYS.includes(k)) out.errors.push(`${path}.${k}: not a cell field. Allowed: ${CELL_KEYS.join(", ")}.`);
  if (v.value === undefined && !Array.isArray(v.bullets)) out.errors.push(`${path}.value: required (a cell with bullets may leave it out).`);
  else if (v.value !== undefined && typeof v.value !== "string" && typeof v.value !== "number") out.errors.push(`${path}.value: must be text.`);
  else if (v.value !== undefined && max && plain(String(v.value)).length > max) out.errors.push(`${path}: ${plain(String(v.value)).length} characters, limit ${max}.`);
  if (v.note !== undefined && String(v.note).length > 32) out.errors.push(`${path}.note: limit is 32 characters.`);
  if (v.bullets !== undefined) {
    if (!Array.isArray(v.bullets) || v.bullets.length < 1 || v.bullets.length > 3) out.errors.push(`${path}.bullets: 1–3 bullets.`);
    else v.bullets.forEach((b: unknown, k: number) => {
      if (typeof b !== "string") out.errors.push(`${path}.bullets[${k}]: must be text.`);
      else if (plain(b).length > 50) out.errors.push(`${path}.bullets[${k}]: ${plain(b).length} characters, limit 50.`);
    });
  }
  if (v.status !== undefined && typeof v.status !== "boolean") out.errors.push(`${path}.status: must be true or false.`);
  if (v.status && v.bullets) out.errors.push(`${path}: a status label has no bullets.`);
  break;
}
```

Add near `cellOf`: `const CELL_KEYS = ["value", "note", "bullets", "status"];`. Delete `cellOf` if nothing else uses it. Run `grep -rn "a cell is a string" tests` and update any test that pinned the old message to the new text.

- [ ] **Step 7: `checkGrid` and the table case in `checkRules()`**

Add above `checkRules` (import `columnAlign` from `./align.js`; `Table` from `../types.js`):

```ts
/* Rules every table shares, the table template's and a half table's: cells per column, column flags, marks,
   header icons, bullets, status labels and group headings. `half`: no bullets at half width. */
function checkGrid(t: Partial<Table>, base: string, style: Style, out: Out, half = false): void {
  const cols = Array.isArray(t.columns) ? t.columns : [], rows = Array.isArray(t.rows) ? t.rows : [], n = cols.length;
  const obj = (c: Cell | undefined) => (c && typeof c === "object" ? c : null);
  rows.forEach((r, i) => {
    if (!r || !Array.isArray(r.cells)) return;
    if (r.style === "group") { if (r.cells.length !== 1) out.errors.push(`${base}.rows[${i}].cells: a group row has one cell, its heading (got ${r.cells.length}).`); return; }
    if (r.cells.length !== n) out.errors.push(`${base}.rows[${i}].cells: ${r.cells.length} cells, but there are ${n} columns. Use "—" for an empty cell.`);
  });
  cols.forEach((c, j) => { if (c?.muted && c.focus) out.errors.push(`${base}.columns[${j}]: muted or focus, not both.`); });
  cols.forEach((c, j) => { if (j > 0 && c && !c.label) out.errors.push(`${base}.columns[${j}].label: required. Header text.`); });
  const data = rows.filter((r) => r?.style !== "group").length;
  if (data > 8) out.errors.push(`${base}.rows: ${data} rows; at most 8 (group headings not counted). Cut or merge rows.`);
  if (markKinds(t).size > 1) out.warnings.push(`${base}: mixes Harvey balls and ticks. Score with one kind of mark per table.`);
  // Header icons: all columns after the first, or none.
  if (cols[0]?.icon) out.errors.push(`${base}.columns[0].icon: the label column has no icon.`);
  const iconed = cols.slice(1).filter((c) => c?.icon).length;
  if (iconed && iconed !== n - 1) out.errors.push(`${base}.columns: ${iconed} of ${n - 1} columns have an icon; give every column after the first an icon, or none.`);
  if (iconed && cols.every(Boolean) && rows.every((r) => r && Array.isArray(r.cells))) {
    const al = columnAlign({ columns: cols, rows: rows as Table["rows"] });
    cols.forEach((c, j) => { if (c?.icon && al[j] === "num") out.warnings.push(`${base}.columns[${j}].icon: an icon on a column of numbers adds nothing; remove it.`); });
  }
  // Bullets in cells.
  const bulletCols = new Set<number>();
  rows.forEach((r, i) => (r?.cells || []).forEach((c, j) => { const o = obj(c); if (o?.bullets) { bulletCols.add(j); if (o.note) out.errors.push(`${base}.rows[${i}].cells[${j}]: bullets or a note, not both.`); } }));
  if (bulletCols.size && half) out.errors.push(`${base}: bullets in cells do not fit half a slide. Use a phrase, or the table template.`);
  else if (bulletCols.size) {
    if (bulletCols.size > 1) out.errors.push(`${base}: bullets in ${bulletCols.size} columns; at most one column of bullets. More than that is cards or notes.`);
    if (n > 4) out.errors.push(`${base}.columns: ${n} columns; a table with bullets in cells takes at most 4.`);
    if (style === "pitch") out.warnings.push(`${base}: pitch hides bullets in cells; say it in the cell or the subtitle.`);
  }
  // Status labels: a few distinct values per column, so they can be told apart.
  cols.forEach((_, j) => {
    const vals = new Set(rows.flatMap((r) => { const o = obj(r?.cells?.[j]); return o?.status ? [plain(String(o.value ?? ""))] : []; }));
    if (vals.size > 4) out.warnings.push(`${base}.columns[${j}]: ${vals.size} different status labels; use at most 4 so they can be told apart.`);
  });
  // Group headings.
  const groups = rows.map((r, i) => (r?.style === "group" ? i : -1)).filter((i) => i >= 0);
  if (groups.length) {
    if (data < 6) out.warnings.push(`${base}: group headings with ${data} rows; use them only with 6 or more.`);
    groups.forEach((g, k) => {
      const size = (k + 1 < groups.length ? groups[k + 1] : rows.length) - g - 1;
      if (size < 2) out.warnings.push(`${base}.rows[${g}]: a group of ${size} row${size === 1 ? "" : "s"}; a group needs at least 2.`);
    });
  }
}
```

Replace the body of the `case "table":` in `checkRules` with:

```ts
case "table": {
  const t: Partial<Table> = s.table || {}, n = (t.columns || []).length;
  checkGrid(t, "table", style, out);
  const rows = (t.rows || []).filter((r) => r && !(style === "pitch" && r.style === "muted"));
  const rowCost = (r: Table["rows"][number]) => {
    if (r.style === "group") return 0.75;
    if (style === "pitch") return 1;
    const cells = r.cells || [];
    const b = Math.max(0, ...cells.map((c) => (c && typeof c === "object" && Array.isArray(c.bullets) ? c.bullets.length : 0)));
    if (b) return 1 + 0.75 * (b - 1);
    return cells.some((c) => c && typeof c === "object" && c.note) ? 1.5 : 1;
  };
  const key = style === "consulting" && markKinds(t).has("balls") ? 1 : 0, icons = (t.columns || []).some((c) => c?.icon) ? 0.5 : 0;
  const cost = rows.reduce((sum, r) => sum + rowCost(r), 0) + (s.takeaway ? 1.5 : 0) + (s.caption ? 1 : 0) + key + icons, budget = style === "pitch" ? 7 : 10.5;
  if (cost > budget) out.errors.push(`table: this table costs ${cost} rows, budget ${budget} for ${style} (row = 1, row with a cell note = 1.5, row with bullets = 1 + 0.75 per extra bullet, group heading = 0.75, header icons = 0.5, takeaway = 1.5, caption = 1, Harvey-ball key = 1). Cut rows, drop cell notes or bullets, the takeaway or the caption.`);
  if (s.notes?.length) {
    checkNotes(s, style, out);
    if (s.notes.length > 3) out.errors.push(`notes: ${s.notes.length} notes; beside a table at most 3.`);
    if (n > 4) out.errors.push(`table.columns: ${n} columns; with notes at most 4. Drop a column or the notes.`);
    (t.rows || []).forEach((r, i) => { if (r?.style === "group") return; const c = r?.cells?.[0], v = typeof c === "object" ? c?.value : c;
      if (v && String(v).length > 24) out.errors.push(`table.rows[${i}].cells[0]: ${String(v).length} characters; with notes at most 24.`); });
  }
  break;
}
```

The old pitch-ignores-notes behaviour is kept: in pitch every non-group row costs 1.

- [ ] **Step 8: Run the tests**

Run: `npx vitest run tests/unit/table-cells.test.ts && npm test && npm run build`
Expected: all pass. If an existing test pinned an old message (`table.rows[0].cells: …` text is unchanged; the marks warning now starts with `table:`, as before), update only the message string.

- [ ] **Step 9: Commit**

```bash
git add src/engine/slides/align.ts src/engine/types.ts src/engine/slides/render.ts src/engine/slides/schema.ts tests/unit/table-cells.test.ts tests/unit/render.test.ts
git commit -m "Table cells: header icons, bullets, status labels, group rows; checks per table

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Table rendering

**Files:**
- Modify: `src/engine/slides/render.ts` (`tableHTML` ~72-81, `BODY.table`, `sizeTable` ~188-197)
- Modify: `src/engine/slides/slides.css` (table block ~168-225)
- Modify: `tests/fixtures/stress.ts` (add one table slide), `tests/unit/starters.test.ts` (stress count 33 → 34)
- Test: `tests/unit/table-render.test.ts` (create)

**Interfaces:**
- Consumes: `Cell`, `Table` (Task 1), `columnAlign` from `./align.js`
- Produces: `tableHTML(t: Table, base = "table", key = true): string` (module-private). Task 5 calls it with `base = "halves[i].table"` and `key = false`.
- Produces: `ballKey()` stays module-private; Task 5 uses it.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/table-render.test.ts`:

```ts
import { test, expect } from 'vitest'
import { slideHTML } from '@/engine/slides/render'
import type { Slide, Table } from '@/engine/types'

const CTX = { page: 1, section: 0, kicker: '', footer: '' }
const html = (table: Table, style: 'consulting' | 'pitch' = 'consulting') => slideHTML({ template: 'table', title: 'T', table } as Slide, CTX, { style, theme: 'ink' })

test('old cells unchanged: a plain mark keeps its path on the cell', () => {
  const h = html({ columns: [{ label: 'P' }, { label: 'A' }], rows: [{ cells: ['Bank', '✓'] }] })
  expect(h).toContain('score" data-path="table.rows[0].cells[1]" data-kind="md"><span class="mk-tick">')
})

test('a mark with a note draws the mark and the note under it', () => {
  const h = html({ columns: [{ label: 'P' }, { label: 'A' }], rows: [{ cells: ['Bank', { value: '✓', note: 'from Q2' }] }] })
  expect(h).toContain('score has-note"><span data-path="table.rows[0].cells[1].value" data-kind="md"><span class="mk-tick">')
  expect(h).toContain('<small data-path="table.rows[0].cells[1].note" data-kind="esc">from Q2</small>')
})

test('header icons sit above the label, which keeps its own path', () => {
  const h = html({ columns: [{ label: 'P' }, { label: 'Speed', icon: 'zap' }], rows: [{ cells: ['Bank', '✓'] }] })
  expect(h).toContain('has-ic"><i data-lucide="zap"></i><span data-path="table.columns[1].label" data-kind="esc">Speed</span></th>')
})

test('bullets, status labels and group rows', () => {
  const h = html({ columns: [{ label: 'P' }, { label: 'Stage' }, { label: 'Why' }], rows: [
    { cells: ['Launch'], style: 'group' },
    { cells: ['Bank', { value: 'Live', status: true }, { value: 'Slow', bullets: ['Filed accounts', 'Caps at £25k'] }] },
  ] })
  expect(h).toContain('<tr class="group" data-item="table.rows[0]"><td colspan="3" data-path="table.rows[0].cells[0]" data-kind="md">Launch</td></tr>')
  expect(h).toContain('status"><span class="pill" data-path="table.rows[1].cells[1].value" data-kind="esc">Live</span></td>')
  expect(h).toContain('has-bul"><span data-path="table.rows[1].cells[2].value" data-kind="md">Slow</span><ul class="bullets"><li data-item="table.rows[1].cells[2].bullets[0]" data-path="table.rows[1].cells[2].bullets[0]" data-kind="md">Filed accounts</li>')
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/table-render.test.ts`
Expected: FAIL on everything except "old cells unchanged".

- [ ] **Step 3: Rewrite `tableHTML`**

```ts
function tableHTML(t: Table, base = "table", key = true) {
  const al = columnAlign(t), n = t.columns.length;
  const cls = (c: Table["columns"][number] | undefined, j: number) => [`al-${al[j]}`, c?.focus ? "focus" : "", c?.muted ? "muted" : "", c?.bold ? "bold" : "", c?.italic ? "italic" : ""].filter(Boolean).join(" ");
  const P = (r: number, j: number) => `${base}.rows[${r}].cells[${j}]`;
  const note = (o: { note?: string }, p: string) => (o.note ? `<small${at(`${p}.note`, "esc")}>${esc(o.note)}</small>` : "");
  const cell = (c: Cell, r: number, j: number) => {
    const p = P(r, j), o = typeof c === "object" && c ? c : null, text = o ? o.value ?? "" : c ?? "", mark = markOf(String(text)), k = cls(t.columns[j], j);
    if (mark && o?.note) return `<td class="${k} score has-note"><span${at(`${p}.value`, "md")}>${markHTML(mark, plain(String(text)))}</span>${note(o, p)}</td>`;
    if (mark) return `<td class="${k} score"${at(o ? `${p}.value` : p, "md")}>${markHTML(mark, plain(String(text)))}</td>`;
    if (o?.status) return `<td class="${k} status"><span class="pill"${at(`${p}.value`, "esc")}>${esc(o.value ?? "")}</span>${note(o, p)}</td>`;
    if (o?.bullets) return `<td class="${k} has-bul">${o.value ? `<span${at(`${p}.value`, "md")}>${md(o.value)}</span>` : ""}${list(o.bullets, `${p}.bullets`)}</td>`;
    if (o) return `<td class="${k}"><span${at(`${p}.value`, "md")}>${md(o.value ?? "")}</span>${note(o, p)}</td>`;
    return `<td class="${k}"${at(p, "md")}>${md(c ?? "")}</td>`;
  };
  const head = (c: Table["columns"][number], j: number) => c.icon
    ? `<th class="${cls(c, j)} has-ic"><i data-lucide="${esc(c.icon)}"></i><span${at(`${base}.columns[${j}].label`, "esc")}>${esc(c.label ?? "")}</span></th>`
    : `<th class="${cls(c, j)}"${at(`${base}.columns[${j}].label`, "esc")}>${esc(c.label ?? "")}</th>`;
  const row = (r: Table["rows"][number], i: number) => {
    if (r.style === "group") { const g = r.cells[0], o = typeof g === "object" && g ? g : null;
      return `<tr class="group"${item(`${base}.rows[${i}]`)}><td colspan="${n}"${at(o ? `${P(i, 0)}.value` : P(i, 0), "md")}>${md(o ? o.value ?? "" : g ?? "")}</td></tr>`; }
    return `<tr class="${[r.style, r.focus ? "focus" : ""].filter(Boolean).join(" ")}"${item(`${base}.rows[${i}]`)}>${r.cells.map((c, j) => cell(c, i, j)).join("")}</tr>`;
  };
  return `<table class="tbl${n <= 2 ? " narrow" : ""}"><colgroup>${t.columns.map(() => "<col>").join("")}</colgroup>
    <thead><tr>${t.columns.map(head).join("")}</tr></thead>
    <tbody>${t.rows.map(row).join("")}</tbody></table>${key && markKinds(t).has("balls") ? ballKey() : ""}`;
}
```

Check the existing test files (`render-html.test.ts`, `render-paths.test.ts`, `render.test.ts`) still pass; the plain-cell and plain-mark output is unchanged by design.

- [ ] **Step 4: `sizeTable` sizes every table and skips group rows**

```ts
/* L1: the label column takes its natural width within 20–40%; fixed layout splits the rest equally. Every table on the
   slide (a pair can have two). Group rows span the table, so they are not measured. */
function sizeTable(slide: HTMLElement) {
  slide.querySelectorAll<HTMLElement>(".tbl").forEach((tbl) => {
    const col = tbl.querySelector<HTMLElement>("col");
    if (!col) return;
    tbl.classList.add("measuring");
    const natural = Math.max(...[...tbl.querySelectorAll("tr:not(.group) > :first-child")].map((c) => c.scrollWidth));
    tbl.classList.remove("measuring");
    // +2px: at exactly its natural width, subpixel rounding can wrap the label.
    const share = Math.min(.4, Math.max(.2, (natural + 2) / tbl.clientWidth));
    col.style.width = `${(share * 100).toFixed(2)}%`;
  });
}
```

(`col.style.width` is DOM measurement, not a React inline style; it's the existing pattern.)

- [ ] **Step 5: CSS in `slides.css`, table block**

Add after the `.tbl td small` rules. The canvas is 1920 wide, so a 30px icon reads at about 16px on a laptop screen:

```css
/* Header icons: above the label, quiet, aligned with the column. */
.tbl th.has-ic svg { display: block; width: 30px; height: 30px; margin-bottom: 14px; color: var(--muted); }
.tbl th.al-sym.has-ic svg { margin-inline: auto; }
.tbl th.al-num.has-ic svg { margin-left: auto; }
/* A mark with a note: the mark centred, the note under it. */
.tbl td.score.has-note small { text-align: center; margin-top: 6px; }
/* Status: a neutral outline label. The value is the information, never a colour. */
.tbl td .pill { display: inline-block; padding: 7px 14px 6px; border: 1.5px solid var(--line); border-radius: 999px; font: 500 18px/1 var(--mono); letter-spacing: .12em; text-transform: uppercase; color: var(--fg-2); white-space: nowrap; }
.tbl .focus .pill, .tbl tr.focus .pill { color: var(--focus); border-color: currentColor; }
.tbl td.status small { margin-top: 8px; }
/* Bullets in a cell: the position's lead in semibold, the reasons as small bullets under it. */
.tbl td.has-bul > span { font-weight: 600; }
.tbl td.has-bul .bullets { margin-top: 8px; font-size: 23px; line-height: 1.35; gap: 6px; color: var(--fg-2); }
.tbl td.has-bul > .bullets:first-child { margin-top: 0; }
/* Group heading: a spanning label in the header's voice, a hairline above, no fill. */
.tbl tr.group td { padding: 26px 0 10px; border-bottom: 1px solid var(--line); font: 500 19px/1 var(--mono); letter-spacing: .14em; text-transform: uppercase; color: var(--muted); }
.tbl tbody tr.group:first-child td { padding-top: 14px; }
```

Next to the existing `.style-pitch .tbl td small, .style-pitch .tbl tr.muted { display: none; }` add:

```css
.style-pitch .tbl td.has-bul .bullets { display: none; }
```

- [ ] **Step 6: Stress fixture: one rich table**

In `tests/fixtures/stress.ts`, after the "Stress · table + notes" entry, add a consulting/pitch slide at the limits. `W(n)` and `TIMES(n)` already exist in the file:

```ts
{ template: "table", name: "Stress · table rich", ...frame("table"), takeaway: undefined, table: {
  columns: [{ label: W(20) }, { label: W(12), icon: "zap" }, { label: W(12), icon: "clock" }, { label: W(12), icon: "users" }],
  rows: [
    { cells: [W(18)], style: "group" },
    ...TIMES(3).map((_, i) => ({ cells: [W(20), { value: "✓", note: W(20) }, { value: "Live", status: true }, { value: W(16), bullets: [W(50), W(50)] }], focus: i === 0 })),
    { cells: [W(18)], style: "group" },
    ...TIMES(3).map(() => ({ cells: [W(20), "✗", { value: "Pilot", status: true }, { value: W(16), bullets: [W(50)] }] })),
  ] } },
```

Run `npx vitest run tests/unit/starters.test.ts`. If the new slide breaks the budget in either style, cut bullets in the fixture (the fixture must pass `validate`; never relax the rule). Update the count lock in `tests/unit/starters.test.ts` from 33 to 34.

- [ ] **Step 7: Run all tests and the build**

Run: `npm test && npm run build`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/engine/slides/render.ts src/engine/slides/slides.css tests/unit/table-render.test.ts tests/fixtures/stress.ts tests/unit/starters.test.ts
git commit -m "Table rendering: header icons, mark notes, status labels, bullets, group rows

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Table editing keeps the new shapes

**Files:**
- Modify: `src/engine/slides/sheet.ts` (`tableSheet` ~157-175)
- Modify: `src/engine/slides/edit.ts` (`moveColumn`, `addColumn`, `removeColumn` ~133-153)
- Test: `tests/unit/sheet.test.ts` (append)

**Interfaces:**
- Consumes: `Table` with group rows (Task 1)
- Produces: `tableSheet(slide: Slide): SheetModel` unchanged signature; Task 5 calls it for half tables.

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/sheet.test.ts` (it already imports `sheetFor` and `applyPatch`; add `addColumn, removeColumn, moveColumn` from `@/engine/slides/edit` and `failed` from `@/engine/slides/sheet` if missing):

```ts
test('table sheet: a group row shows its heading in the first cell, the rest read-only; edits keep bullets, notes and status', () => {
  const s: Slide = { template: 'table', title: 'T', table: { columns: [{ label: 'P' }, { label: 'Stage' }, { label: 'Why' }], rows: [
    { cells: ['Launch'], style: 'group' },
    { cells: ['Bank', { value: 'Live', status: true }, { value: 'Slow', bullets: ['a', 'b'] }] },
  ] } }
  const m = sheetFor(s, 'consulting')
  if (!m) throw new Error('no sheet')
  expect(m.get(0, 0)).toBe('Launch'); expect(m.get(0, 1)).toBe(''); expect(m.readOnly?.(0, 1)).toBe(true)
  expect(m.set(0, 1, 'x')).toEqual({ error: 'A group heading has one cell.' })
  const p = m.set(1, 2, 'Slower')
  if (!p || failed(p)) throw new Error('no patch')
  const out = applyPatch(s, p).slide?.table?.rows[1].cells[2]
  expect(out).toEqual({ value: 'Slower', bullets: ['a', 'b'] })
  const st = m.set(1, 1, 'Pilot')
  if (!st || failed(st)) throw new Error('no patch')
  expect(applyPatch(s, st).slide?.table?.rows[1].cells[1]).toEqual({ value: 'Pilot', status: true })
})

test('column operations leave a group row alone', () => {
  const s: Slide = { template: 'table', title: 'T', table: { columns: [{ label: 'P' }, { label: 'A' }, { label: 'B' }], rows: [
    { cells: ['Fees'], style: 'group' }, { cells: ['Bank', '1', '2'] } ] } }
  expect(addColumn(s, 1).table?.rows[0].cells).toEqual(['Fees'])
  expect(removeColumn(s, 0).table?.rows[0].cells).toEqual(['Fees'])
  expect(moveColumn(s, 0, 2).table?.rows[0].cells).toEqual(['Fees'])
  expect(addColumn(s, 1).table?.rows[1].cells).toEqual(['Bank', '', '1', '2'])
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/sheet.test.ts`
Expected: FAIL (`readOnly` undefined; column ops change the group row).

- [ ] **Step 3: `tableSheet` changes**

In `tableSheet`, replace `text` and `set`, and add `readOnly`. Writes go to `.value` for object cells already (`pathOf`), so bullets, notes and status are kept:

```ts
const isGroup = (r: number) => rows[r]?.style === "group";
const text = (r: number, c: number) => { if (isGroup(r) && c > 0) return ""; const x = rows[r]?.cells[c]; return typeof x === "object" && x ? x.value ?? "" : x ?? ""; };
```

and in the returned model:

```ts
get: text, path: pathOf,
readOnly: (r, c) => isGroup(r) && c > 0,
set: (r, c, raw) => (isGroup(r) && c > 0 ? { error: "A group heading has one cell." } : { [pathOf(r, c)]: raw }),
```

- [ ] **Step 4: Column operations skip group rows**

In `edit.ts`, in `moveColumn`, `addColumn` and `removeColumn`, change `rows: t.rows.map((r) => ({ ...r, cells: … }))` to leave group rows untouched:

```ts
rows: t.rows.map((r) => (r.style === "group" ? r : { ...r, cells: mv(r.cells) })),
```

(Use `put(r.cells, "")` and `drop(r.cells)` in the other two, matching their current bodies.)

- [ ] **Step 5: Run the tests and the build**

Run: `npm test && npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/slides/sheet.ts src/engine/slides/edit.ts tests/unit/sheet.test.ts
git commit -m "Table sheet: group rows read-only past the heading; edits keep cell shapes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Pair becomes halves (schema, types, checks, gallery data)

**Files:**
- Modify: `src/engine/types.ts` (`Exhibit` → `Half`; `Slide.charts` → `Slide.halves`)
- Modify: `src/engine/slides/schema.ts` (`HALF_CHART` ~240-244, `pair` entry ~275-288, `checkRules` pair case ~745-764, `PICKING_GUIDE` pair line)
- Modify: `src/engine/agent/checks.ts:24,44`
- Modify: `src/engine/starters/starters.json` (the `pair` starter, both styles)
- Modify: `tests/unit/pair.test.ts` (rewrite the validation tests), `tests/fixtures/stress.ts` (the two pair entries)
- Modify: `tests/unit/__snapshots__/agent-prompt.test.ts.snap` (pair summary line; update with `npx vitest run tests/unit/agent-prompt.test.ts -u` after checking the diff only changes the pair line and the picking-guide line)

**Interfaces:**
- Consumes: `TABLE_CELLS`, `COLUMN_FIELDS`, `checkGrid` (Task 1)
- Produces: `interface Half { caption?: string; chart?: Chart; bullets?: string[]; table?: Table; number?: { value: string; caption: string; tone?: Tone }; points?: string[] }` and `Slide.halves?: Half[]`
- Produces: `export const HALF_BODIES = ["chart", "table", "number", "points"] as const` from `schema.ts` (Task 5 uses it)

- [ ] **Step 1: Rewrite the validation tests in `tests/unit/pair.test.ts`**

Replace the first two tests and the `pair` helper (leave the rendering and sheet tests for Task 5; change their `charts` to `halves` now so the file compiles, and mark them `test.skip` until Task 5):

```ts
const pair = (a: Chart, b: Chart, extra: Partial<Slide> = {}): Slide => ({ template: 'pair', title: 'The market grows a third by 2030 while Acme takes 7% of it',
  halves: [{ caption: 'Market · £bn', chart: a }, { caption: 'Share · %', chart: { ...b, series: (b.series ?? []).map((s) => ({ ...s, color: 'focus' as const })) } }], ...extra })

test('two chart halves: each needs a caption, and the half-width limits hold', () => {
  expect(validate(pair(bars(6), bars(5))).errors).toEqual([])
  expect(errs({ ...pair(bars(3), bars(3)), halves: [{ chart: bars(3) }, { caption: 'B', chart: bars(3) }] } as Slide)).toMatch(/halves\[0\]\.caption: required with a chart or table/)
  expect(errs(pair(bars(7), bars(3)))).toMatch(/halves\[0\]\.chart\.categories: 7 categories; half a slide takes 6/)
  const three = bars(3, { series: ['a', 'b', 'c'].map((name) => ({ name, mark: 'bar' as const, values: [1, 2, 3] })) })
  expect(errs(pair(three, bars(3)))).toMatch(/3 series; half a slide takes 2/)
  const tl = errs(pair({ kind: 'timeline', periods: ['Q1', 'Q2', 'Q3'], rows: [{ label: 'a', start: 0, end: 1 }, { label: 'b', start: 1, end: 2 }] }, bars(3)))
  expect(tl).toMatch(/halves\[0\]\.chart\.kind: "timeline" is not allowed. Use one of: bars, waterfall, ranked/)
  const half = card('pair').fields.halves.of?.fields?.chart.fields ?? {}
  expect(Object.keys(half).sort()).toEqual(['categories', 'format', 'items', 'kind', 'ranking', 'series', 'stacking'])
  const wf = (n: number): Chart => ({ kind: 'waterfall', format: '£{v}m', items: [{ label: 'Start', value: 10 }, ...Array.from({ length: n - 2 }, () => ({ label: 'Step', value: 1 })), { label: 'End', total: true }] })
  expect(errs({ ...pair(wf(6), bars(3)), subtitle: 'A claim.' }, 'pitch')).toMatch(/6 items; half a slide takes 5/)
})

test('chart halves: bullets are one line, at most 1 each with a takeaway; only under a chart', () => {
  const s = pair(bars(3), bars(3), { takeaway: 'So what.' })
  s.halves?.forEach((h) => { h.bullets = ['One', 'Two'] })
  expect(errs(s)).toMatch(/halves\[0\]\.bullets: with a takeaway at most 1 per chart/)
  expect(card('pair').fields.halves.of?.fields?.bullets.of?.maxChars).toBe(55)
  expect(errs({ ...pair(bars(3), bars(3)), halves: [{ caption: 'A', chart: bars(3) }, { points: ['One point here', 'Another one'], bullets: ['x'] }] } as Slide)).toMatch(/halves\[1\]\.bullets: only under a chart/)
})

test('a half has exactly one body: chart, table, number or points', () => {
  const tbl = { columns: [{ label: 'Year' }, { label: 'Share' }], rows: [{ cells: ['2026', '0.5%'] }, { cells: ['2030', '7%'], focus: true }] }
  const ok: Slide = { template: 'pair', title: 'T', halves: [{ caption: 'Market · £bn', chart: bars(3) }, { caption: 'Share · %', table: tbl }] }
  expect(validate(ok).errors).toEqual([])
  expect(validate({ template: 'pair', title: 'T', halves: [{ number: { value: '7%', caption: 'Acme’s share of spend by 2030.' } }, { points: ['**Cards** replace transfers', 'Spend grows 13% a year'] }] }).errors).toEqual([])
  expect(errs({ template: 'pair', title: 'T', halves: [{ caption: 'A', chart: bars(3), table: tbl }, { points: ['a b', 'c d'] }] })).toMatch(/halves\[0\]: has chart and table; give exactly one of chart, table, number, points/)
  expect(errs({ template: 'pair', title: 'T', halves: [{ caption: 'A' }, { points: ['a b', 'c d'] }] })).toMatch(/halves\[0\]: has no body; give exactly one of chart, table, number, points/)
})

test('a half table: at most 3 columns and 5 rows, no bullets, no group rows, no icons', () => {
  const t = (cols: number, rows: number, cell: Cell = '1') => ({ columns: Array.from({ length: cols }, (_, i) => ({ label: `C${i}` })), rows: Array.from({ length: rows }, () => ({ cells: Array.from({ length: cols }, () => cell) })) })
  const s = (table: unknown) => ({ template: 'pair', title: 'T', halves: [{ caption: 'A', chart: bars(3) }, { caption: 'B', table }] }) as Slide
  expect(errs(s(t(4, 2)))).toMatch(/halves\[1\]\.table\.columns: at most 3 items/)
  expect(errs(s(t(2, 6)))).toMatch(/halves\[1\]\.table\.rows: at most 5 items/)
  expect(errs(s(t(2, 2, { value: 'x', bullets: ['y'] })))).toMatch(/halves\[1\]\.table: bullets in cells do not fit half a slide/)
  expect(errs(s({ ...t(2, 2), columns: [{ label: 'A' }, { label: 'B', icon: 'zap' }] }))).toMatch(/halves\[1\]\.table\.columns\[1\]\.icon: not a field here/)
})

test('an old `charts` field names `halves`', () => {
  expect(errs({ template: 'pair', title: 'T', charts: [] } as unknown as Slide)).toMatch(/charts: `charts` is now `halves`/)
})
```

Add `Cell` to the `@/engine/types` import.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/pair.test.ts`
Expected: FAIL (no `halves` field).

- [ ] **Step 3: Types**

In `src/engine/types.ts` replace `Exhibit` and `charts`:

```ts
/** One half of a pair: a caption and exactly one body (a chart with optional bullets, a table, a number or points). */
export interface Half { caption?: string; chart?: Chart; bullets?: string[]; table?: Table; number?: { value: string; caption: string; tone?: Tone }; points?: string[] }
```

and in `Slide`: `halves?: Half[]` (remove `charts`).

- [ ] **Step 4: Schema**

Drop `required: true` from `HALF_CHART` (a half may have another body). Add after it:

```ts
/* A small table for half a slide: no icons, no group headings, no bullets in cells (checked in checkGrid). */
const HALF_TABLE = f("object", "A small table for half the slide: 2–3 columns, at most 5 rows. Marks, cell notes and status labels work; bullets, icons and group headings do not.", { fields: {
  columns: f("list", "Column headers, left to right.", { required: true, items: { min: 2, max: 3 }, of: f("object", "Column.", { fields: COLUMN_FIELDS }) }),
  rows: f("list", "Rows, top to bottom.", { required: true, items: { min: 1, max: 5 }, of: f("object", "Row.", { fields: {
    cells: TABLE_CELLS,
    style: f("enum", "`muted`: context, hidden in pitch. `total`: the bottom line.", { values: ["muted", "total"] }),
    focus: f("boolean", "Highlight this row.", { default: false }),
  } }) }),
} });
export const HALF_BODIES = ["chart", "table", "number", "points"] as const;
```

Replace the `pair` entry:

```ts
pair: {
  summary: "Two halves side by side, each a chart, a table, a number or points.",
  use: "Two related things that each need their own exhibit: a trend and the figures behind it, market and share, a number and its cause. One exhibit: chart or table.",
  fields: {
    halves: f("list", "The two halves, left then right. Each has exactly one of chart, table, number or points.", { required: true, items: { min: 2, max: 2 }, of: f("object", "One half.", { fields: {
      caption: f("text", "What this half shows, then ' · ' and the unit: 'UK SME card spend · £bn'. Required with a chart or table; optional with a number or points.", { max: 40 }),
      chart: HALF_CHART,
      bullets: f("list", "Chart halves only: 1–2 points under the chart, one line each.", { items: { min: 1, max: 2 }, of: f("markup", "Point.", { max: { consulting: 55, pitch: 40 } }) }),
      table: HALF_TABLE,
      number: f("object", "A big figure and what it means.", { fields: {
        value: f("text", "The number with its unit: '£3.6bn', '7%'.", { required: true, max: 7 }),
        caption: f("markup", "What it means, as one sentence.", { required: true, max: 80 }),
        tone: TONE,
      } }),
      points: f("list", "2–4 short points; a **bold** lead-in is allowed.", { items: { min: 2, max: 4 }, of: f("markup", "Point.", { max: 70 }) }),
    } }) }),
  },
  variant: () => "pair",
  rules: ["Each half has exactly one body: chart, table, number or points.",
    "Chart half: bars (at most 6 categories and 2 series, names of up to 16 characters), a waterfall (at most 6 items, pitch 5, labels of up to 8 characters) or ranked (at most 6 items of up to 20 characters).",
    "One focus across the slide: the series, item or row the title is about, in one of the two halves.", "With a takeaway: at most 1 bullet per chart.", ...CHART_GUIDE.slice(0, 3)],
},
```

In `PICKING_GUIDE` change the pair line to `["two related things that each need their own exhibit, side by side", "pair"]`.

Replace the `case "pair":` body in `checkRules`:

```ts
case "pair": {
  if ((s as { charts?: unknown }).charts !== undefined) out.errors.push("charts: `charts` is now `halves`; each half has one of chart, table, number, points.");
  (s.halves || []).forEach((h, i) => {
    if (!h || typeof h !== "object") return;
    const p = `halves[${i}]`, found = HALF_BODIES.filter((k) => h[k] !== undefined);
    if (found.length !== 1) out.errors.push(`${p}: ${found.length ? `has ${found.join(" and ")}` : "has no body"}; give exactly one of chart, table, number, points.`);
    if ((h.chart || h.table) && !h.caption) out.errors.push(`${p}.caption: required with a chart or table. What it shows, then ' · ' and the unit.`);
    if (h.bullets && !h.chart) out.errors.push(`${p}.bullets: only under a chart. A list on its own is points.`);
    if (h.table && typeof h.table === "object") checkGrid(h.table, `${p}.table`, style, out, true);
    const c = h.chart, at = `${p}.chart`;
    if (!c || typeof c !== "object") return;
    // One focus across the slide is checked by the agent checks, so a chart without one is not flagged here.
    checkChart(c, at, out, true);
    const kind = c.kind || "bars";
    if (kind === "timeline" || kind === "matrix") return out.errors.push(`${at}.kind: "${kind}" is too dense for half a slide. Use bars, a waterfall or ranked, or the chart template.`);
    // …keep every existing per-kind half-width check from the old case, with `at` as above…
    if (s.takeaway && (h.bullets || []).length > 1) out.errors.push(`${p}.bullets: with a takeaway at most 1 per chart.`);
  });
  break;
}
```

Copy the existing per-kind lines (categories, series, series names, waterfall labels, waterfall count, ranked count, ranked labels) unchanged between the two comments; only `at` differs.

Note: `validate`'s top-level loop may also say `charts: not a field here`. Both messages are fine.

- [ ] **Step 5: Agent checks (`src/engine/agent/checks.ts`)**

Line 24, focus count across halves (a chart's focus series/items, or a table's focus row/column):

```ts
case "pair": return (s.halves || []).reduce((sum, h) => sum + (h?.chart ? focusCount({ template: "chart", title: "", chart: h.chart }) ?? 0 : 0)
  + (h?.table ? focusCount({ template: "table", title: "", table: h.table }) ?? 0 : 0), 0);
```

Line 44 in `claimText`, replace `...(s.charts || []).flatMap((c) => c.bullets || [])` with:

```ts
...(s.halves || []).flatMap((h) => [...(h.bullets || []), ...(h.points || []), h.number?.caption])
```

- [ ] **Step 6: Gallery: rewrite the `pair` starter**

In `starters.json`, the starter with `"id": "pair"`: set `"label": "Two halves"`, `"blurb": "Two exhibits side by side"`.

`consulting`: replace `"charts"` with `"halves"`. Keep the first half (market chart and its bullet) as it is. Replace the second half with a table:

```json
{
 "caption": "Acme share and spend book · £bn",
 "table": {
  "columns": [{ "label": "Year" }, { "label": "Share" }, { "label": "Spend book" }],
  "rows": [
   { "cells": ["2026", "0.5%", "£0.2bn"] },
   { "cells": ["2028", "3%", "£1.2bn"] },
   { "cells": ["2030", "7%", "£3.6bn"], "focus": true }
  ]
 }
}
```

`pitch`: title `"Market and share"`; keep the subtitle; `"halves"`: first a number half, then the market chart half:

```json
[
 { "number": { "value": "7%", "caption": "Acme’s share of UK SME card spend by 2030." } },
 { "caption": "UK SME card spend · £bn", "chart": { …the pitch version's existing market chart, unchanged… } }
]
```

Copy the existing pitch market chart object verbatim into the second half. Drop the pitch share chart.

Run `npx vitest run tests/unit/starters.test.ts tests/unit/example-shapes.test.ts`. `starters.test.ts` must pass (no errors or warnings in either style). `example-shapes.test.ts` is expected to FAIL for the pair starter only. Do not run `-u`; record the failure in your report (Global Constraints).

- [ ] **Step 7: Stress fixture pair entries**

In `tests/fixtures/stress.ts`, rename `charts` to `halves` in both pair entries, and change the `max("pair", st, "charts", "bullets")` calls to `max("pair", st, "halves", "bullets")`. Add two more pair entries:

```ts
{ template: "pair", name: "Stress · chart + table", ...frame("pair"), takeaway: undefined, halves: [
  { caption: `${W(30)} · £m`, chart: { categories: TIMES(6).map((_, i) => `Y${i + 1}`), format: "£{v}m", series: [{ name: W(16), mark: "bar", color: "focus", values: [3, 5, 8, 12, 17, 23] }] }, bullets: TIMES(2).map(() => W(max("pair", st, "halves", "bullets"))) },
  { caption: `${W(30)} · £m`, table: { columns: [{ label: W(12) }, { label: W(10) }, { label: W(10) }], rows: TIMES(5).map((_, i) => ({ cells: [W(14), { value: "(1,234)", note: "8% × £10.5k" }, "12,345"], focus: i === 4 })) } }] },
{ template: "pair", name: "Stress · number + points", ...frame("pair"), halves: [
  { number: { value: "€4,000b", caption: W(80) } },
  { caption: W(36), points: TIMES(4).map(() => W(70)) }] },
```

Update the count lock in `tests/unit/starters.test.ts` (34 → 36).

- [ ] **Step 8: Run tests and build**

Run: `npm test && npm run build`
Expected: PASS, except `example-shapes.test.ts` (reported, not fixed), and compile errors in `render.ts`, `sheet.ts`, `edit.ts` and the editor for `charts`. Task 5 fixes those. To keep this commit building, make the minimal compile fixes now: replace `s.charts` with `s.halves` in `render.ts:106,164` and `sheet.ts` (behaviour stays chart-only until Task 5), and `edit.draft.charts` with `edit.draft.halves` in `EditMode.tsx:69` and `EditMenu.tsx:66-67`.

- [ ] **Step 9: Commit**

```bash
git add -A src tests
git commit -m "Pair: two halves, each a chart, table, number or points

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Halves: rendering and editing

**Files:**
- Modify: `src/engine/slides/render.ts` (`BODY.pair` ~106, `mountSlide` ~164)
- Modify: `src/engine/slides/slides.css` (pair block ~229-234)
- Modify: `src/engine/slides/sheet.ts` (`sheetFor` pair branch ~191, `replaceFromTable` pair branch ~231-236, the comment at ~177)
- Modify: `src/engine/slides/edit.ts:16-18` (`SKIP`)
- Modify: `src/app/edit/EditOverlay.tsx:56-57`, `src/app/edit/EditBar.tsx:11`
- Test: `tests/unit/pair.test.ts` (un-skip and extend the rendering and sheet tests)

**Interfaces:**
- Consumes: `tableHTML(t, base, key)`, `ballKey()` (Task 2); `tableSheet(slide)` (Task 3); `Half`, `HALF_BODIES` (Task 4)
- Produces: each half renders as `<div class="half …" data-item="halves[i]" data-grid="i">`. The editor opens the grid for `data-grid` as well as `data-chart`.

- [ ] **Step 1: Write the failing tests**

In `tests/unit/pair.test.ts`, un-skip the rendering and sheet tests, change their expected paths from `charts[` to `halves[`, and add:

```ts
test('halves render by body: chart host, table, number, points; the caption row stays for alignment', () => {
  const s: Slide = { template: 'pair', title: 'T', halves: [
    { number: { value: '7%', caption: 'Acme’s share by 2030.' } },
    { caption: 'Share · %', table: { columns: [{ label: 'Year' }, { label: 'Share' }], rows: [{ cells: ['2026', '◑'] }] } },
  ] }
  const html = slideHTML(s, { page: 1, section: 0, kicker: '', footer: '' }, { style: 'consulting', theme: 'ink' })
  expect(html).toContain('<div class="half" data-item="halves[0]" data-grid="0"><p class="cap blank "></p><div class="half-num"><div class="big-v" data-path="halves[0].number.value" data-kind="esc">7%</div>')
  expect(html).toContain('data-path="halves[1].table.rows[0].cells[0]"')
  // The Harvey-ball key appears once, under the pair, not inside the half.
  expect(html.match(/class="mk-key"/g)).toHaveLength(1)
  expect(html.indexOf('class="mk-key"')).toBeGreaterThan(html.lastIndexOf('class="half'))
  const pts = slideHTML({ template: 'pair', title: 'T', halves: [{ caption: 'A', points: ['One', 'Two'] }, { caption: 'B', points: ['Three', 'Four'] }] }, { page: 1, section: 0, kicker: '', footer: '' }, { style: 'consulting', theme: 'ink' })
  expect(pts).toContain('<ul class="bullets points"><li data-item="halves[0].points[0]" data-path="halves[0].points[0]" data-kind="md">One</li>')
})

test('an old `charts` slide renders empty halves, never throws', () => {
  expect(() => slideHTML({ template: 'pair', title: 'T', charts: [{ caption: 'A', chart: bars(3) }] } as unknown as Slide, { page: 1, section: 0, kicker: '', footer: '' }, { style: 'consulting', theme: 'ink' })).not.toThrow()
})

test('the sheet edits a half table under halves[i].table; number and points halves have no sheet', () => {
  const s: Slide = { template: 'pair', title: 'T', halves: [{ caption: 'A', chart: bars(3) }, { caption: 'B', table: { columns: [{ label: 'Year' }, { label: 'Share' }], rows: [{ cells: ['2026', '1%'] }] } }] }
  const m = sheetFor(s, 'consulting', 1)
  expect(m?.path(0, 1)).toBe('halves[1].table.rows[0].cells[1]')
  expect(m?.set(0, 1, '2%')).toEqual({ 'halves[1].table.rows[0].cells[1]': '2%' })
  expect(sheetFor({ ...s, halves: [{ points: ['a b', 'c d'] }, s.halves![1]] }, 'consulting', 0)).toBeNull()
  const replaced = replaceFromTable(s, 'consulting', [['Year', 'Share'], ['2030', '7%']], 1).slide
  expect(replaced.halves?.[1].table?.rows[0].cells).toEqual(['2030', '7%'])
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/pair.test.ts`
Expected: FAIL.

- [ ] **Step 3: Render halves**

In `render.ts`, replace `BODY.pair`:

```ts
pair: (s) => {
  const halves = s.halves ?? [];
  const half = (h: Half, i: number) => {
    const p = `halves[${i}]`;
    const body = h.chart ? `<div class="chart" data-chart="${i}"></div>${h.bullets?.length ? list(h.bullets, `${p}.bullets`) : ""}`
      : h.table ? tableHTML(h.table, `${p}.table`, false)
      : h.number ? `<div class="half-num"><div class="big-v${h.number.tone && h.number.tone !== "focus" ? ` ${h.number.tone}` : ""}"${at(`${p}.number.value`, "esc")}>${esc(h.number.value)}</div><p${at(`${p}.number.caption`, "md")}>${md(h.number.caption)}</p></div>`
      : h.points ? list(h.points, `${p}.points`).replace('<ul class="bullets">', '<ul class="bullets points">')
      : "";
    return `<div class="half${h.table ? " has-table" : ""}"${item(p)} data-grid="${i}">${capHTML(h.caption, "", h.caption ? `${p}.caption` : "")}${body}</div>`;
  };
  const balls = halves.some((h) => h?.table && markKinds(h.table).has("balls"));
  return `<div class="pair grow">${halves.map(half).join("")}</div>${balls ? ballKey() : ""}`;
},
```

Import `Half` from `../types.js`. In `mountSlide`, change the chart lookup to `s.halves?.[Number(i)]?.chart`.

`growTable` already applies only to `.t-table` slides, so pairs are untouched (spec §4.3).

- [ ] **Step 4: CSS for halves**

Replace the pair block in `slides.css`:

```css
/* ═════════════ Pair: two halves side by side, each a chart, a table, a number or points ═════════════ */
.pair { display: grid; grid-template-columns: 1fr 1fr; column-gap: 96px; }
.pair > .half { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.pair > .half > .chart { flex: 1; min-height: 0; }
.pair .bullets { margin-top: 24px; font-size: 26px; gap: 10px; }
.style-pitch .pair .bullets { font-size: 30px; }
/* A half table fills its half: the two-column "narrow" rule is for full-width tables. */
.pair .tbl, .pair .tbl.narrow { width: 100%; }
/* A number half: the value at half size, its sentence under it, both from the top like a chart. */
.half-num { display: flex; flex-direction: column; gap: 28px; }
.half-num .big-v { font-size: 220px; }
.style-consulting .half-num .big-v { font-size: 190px; }
.half-num p { font-size: 34px; line-height: 1.3; color: var(--fg-2); max-width: 24ch; }
/* Points: the half's own list, larger than the bullets under a chart. */
.pair .bullets.points { margin-top: 0; font-size: 32px; line-height: 1.35; gap: 22px; }
.style-pitch .pair .bullets.points { font-size: 36px; }
```

Font sizes are first estimates; Task 9 tunes them on the review page.

- [ ] **Step 5: Sheet for halves**

In `sheet.ts`, update the comment above `alone` to say halves, and replace the pair branch of `sheetFor`:

```ts
if (slide.template === "pair") {
  const h = slide.halves?.[which], pre = `halves[${which}].`;
  if (h?.chart) { const m = sheetFor(alone(h.chart), style); return m && within(m, pre); }
  if (h?.table) return within(tableSheet({ template: "table", title: "", table: h.table }), pre);
  return null;
}
```

And the pair branch of `replaceFromTable`:

```ts
if (slide.template === "pair") {
  const h = slide.halves?.[which];
  if (!h?.chart && !h?.table) return { slide };
  const inner: Slide = h.chart ? alone(h.chart) : { template: "table", title: "", table: h.table };
  const r = replaceFromTable(inner, style, table), out = structuredClone(slide), dst = out.halves?.[which];
  if (dst && h.chart && r.slide.chart) dst.chart = r.slide.chart;
  if (dst && h.table && r.slide.table) dst.table = r.slide.table;
  return { slide: out, ...(r.note ? { note: r.note } : {}) };
}
```

`tableSheet`'s column operations call `addColumn` and friends on the slide they are given (the stand-alone table), and `within` re-roots the resulting `table` patch under `halves[i].`; no other change is needed. The half table's 3-column / 5-row limits are not enforced by the grid; `validate` flags them (checks warn, never silently rewrite).

- [ ] **Step 6: `edit.ts` and the editor**

`edit.ts:16-18`:

```ts
// Chart and table data have their own grid (a pair's halves too; the pair itself can swap); table columns change every row,
// and cells follow the columns.
const SKIP = /^chart\b|^halves\[\d+\]\.chart\b|^halves\[\d+\]\.table\.columns$|^table\.columns$|\.cells$/;
```

`EditOverlay.tsx:56-57`:

```ts
// A pair's halves are numbered (data-chart / data-grid "0", "1"); a chart slide's one host has no number.
const click = (e: MouseEvent) => { const host = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-chart], [data-grid]') : null; if (host) onChart(Number(host.dataset.chart || host.dataset.grid || 0)) }
```

Then check: a click on a number or points half opens `ChartGrid` with a null model, which shows "This chart has no table view." Change `ChartGrid.tsx`'s fallback text to `This part has no table view.` so it reads right for a half.

`EditBar.tsx:11`: `pair: 'Two halves'`.

- [ ] **Step 7: Run tests, build and the browser edit tests**

Run: `npm test && npm run build && npx playwright test tests/browser/edit.spec.ts --config tests/browser/playwright.config.ts`
Expected: PASS (except the known `example-shapes` failure from Task 4).

- [ ] **Step 8: Commit**

```bash
git add src tests
git commit -m "Halves render and edit by body: chart, table, number, points

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Longer consulting notes

**Files:**
- Modify: `src/engine/slides/schema.ts` (`notes()` ~253-262, `checkNotes` ~685-692)
- Modify: `tests/fixtures/stress.ts` (`notes()` helper: `W(i ? 75 : 50)` → `W(i ? 120 : 90)`)
- Test: `tests/unit/schema.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/schema.test.ts` (it uses `node:assert` style; match it):

```ts
test("consulting notes take 120 characters each; with a takeaway, 300 in total", () => {
  const chart = { categories: ["A", "B", "C"], series: [{ name: "S", mark: "bar", color: "focus", values: [1, 2, 3] }] };
  const n = (len: number) => ({ title: "Note", text: "x".repeat(len) });
  const base = { template: "chart", title: "T", chart };
  assert.deepEqual(validate({ ...base, notes: [n(120), n(120), n(60)] } as never, "consulting").errors, []);
  assert.match(validate({ ...base, notes: [n(121), n(10), n(10)] } as never, "consulting").errors.join("\n"), /notes\[0\]\.text: 121 characters, limit 120/);
  assert.deepEqual(validate({ ...base, takeaway: "So what.", notes: [n(100), n(100), n(100)] } as never, "consulting").errors, []);
  assert.match(validate({ ...base, takeaway: "So what.", notes: [n(120), n(120), n(61)] } as never, "consulting").errors.join("\n"), /301 characters in total; with a takeaway the limit is 300/);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/schema.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

In `notes()`, set `text` `max: 120` (keep `styles: CONSULTING`). In `checkNotes`, change both `200`s to `300`.

Extend the `notes()` description with the judgement (it is the field-level guidance that Task 7's capability entry repeats in one line): `"Optional numbered observations beside the chart or table: 3, or none. Each says something the body does not already show: a cause, a caveat, an implication. Never restate the title, the takeaway or a value the reader can see. In pitch, prefer none. Two notes only restate the title and takeaway: write a third or leave them out. Numbers are added automatically."`

- [ ] **Step 4: Stress fixture**

In `tests/fixtures/stress.ts` `notes()`: `text: W(i ? 120 : 90)`. With a takeaway that is 90 + 120 + 120 = 330 > 300. Set the first note to `W(60)` so the total is 300.

- [ ] **Step 5: Run tests and build**

Run: `npm test && npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/slides/schema.ts tests/unit/schema.test.ts tests/fixtures/stress.ts
git commit -m "Consulting notes: 120 characters each, 300 in total with a takeaway

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Capability guidance on the template cards

**Files:**
- Create: `src/engine/slides/capabilities.ts` (the guidance text and samples, so `schema.ts` doesn't grow past ~900 lines)
- Modify: `src/engine/slides/schema.ts` (`MenuEntry`, `TemplateCard`, `describe()`, `CHART_GUIDE`, chart `rules`)
- Modify: `tests/unit/schema.test.ts:81-83,270` (CHART_GUIDE assertions)
- Test: `tests/unit/capabilities.test.ts` (create)

**Interfaces:**
- Produces: `interface Capability { name: string; use: string; avoid: string; sample: Record<string, unknown>; styles?: readonly Style[] }`, `interface Shape { content: string; shape: string }`
- Produces: `MenuEntry.capabilities?: Capability[]`, `MenuEntry.shapes?: Shape[]`
- Produces: `TemplateCard.capabilities?: { name: string; use: string; avoid: string; sample: Record<string, unknown> }[]`, `TemplateCard.shapes?: Shape[]`
- Produces: `CAPABILITIES: Partial<Record<TemplateId, Capability[]>>` and `SHAPES: Partial<Record<TemplateId, Shape[]>>` exported from `capabilities.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/capabilities.test.ts`:

```ts
import { test, expect } from 'vitest'
import { describe, validate, MENU } from '@/engine/slides/schema'
import type { Slide, Style, TemplateId } from '@/engine/types'

const frame = (id: TemplateId, style: Style) => ({ template: id, title: 'Title', ...(style === 'pitch' ? { subtitle: 'A claim.' } : {}) })

test('every capability sample validates in the styles it declares', () => {
  for (const id of Object.keys(MENU) as TemplateId[]) for (const style of ['consulting', 'pitch'] as const) {
    for (const cap of MENU[id].capabilities ?? []) {
      if (cap.styles && !cap.styles.includes(style)) continue
      const r = validate({ ...frame(id, style), ...cap.sample } as Slide, style)
      expect(r.errors, `${id} / ${cap.name} / ${style}`).toEqual([])
    }
  }
})

test('guidance only where there is a choice; at most 7 entries; use and avoid one sentence each', () => {
  const withCaps = (Object.keys(MENU) as TemplateId[]).filter((id) => MENU[id].capabilities?.length)
  expect(withCaps.sort()).toEqual(['cards', 'chart', 'pair', 'steps', 'table'])
  for (const id of withCaps) {
    const caps = MENU[id].capabilities ?? []
    expect(caps.length, id).toBeLessThanOrEqual(7)
    for (const c of caps) { expect(c.use.split(/\.\s/).length, `${id}/${c.name} use`).toBeLessThanOrEqual(2); expect(c.avoid.length).toBeGreaterThan(0) }
  }
})

test('the card carries capabilities and shapes, filtered by style', () => {
  const t = describe('table', 'consulting')
  expect(t.capabilities?.map((c) => c.name)).toContain('Scoring')
  expect(t.shapes?.length).toBe(4)
  expect(describe('pair', 'pitch').shapes?.length).toBe(6)
  expect(describe('cover', 'consulting').capabilities).toBeUndefined()
  expect(describe('chart', 'consulting').capabilities?.map((c) => c.name)).toEqual(expect.arrayContaining(['Waterfall', 'Ranked', 'Matrix', 'Timeline']))
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/capabilities.test.ts`
Expected: FAIL (no `capabilities` on `MenuEntry`).

- [ ] **Step 3: Types and `describe()` in `schema.ts`**

```ts
export interface Capability { name: string; use: string; avoid: string; sample: Record<string, unknown>; styles?: readonly Style[] }
export interface Shape { content: string; shape: string }
```

Add `capabilities?: Capability[]; shapes?: Shape[];` to `MenuEntry`, and `capabilities?: Omit<Capability, "styles">[]; shapes?: Shape[]` to `TemplateCard`. In `describe()`:

```ts
const caps = (t.capabilities ?? []).filter((c) => !c.styles || c.styles.includes(style)).map(({ name, use, avoid, sample }) => ({ name, use, avoid, sample }));
return {
  template: id, summary: t.summary, use: t.use,
  fields: …unchanged…,
  rules: …unchanged…,
  ...(caps.length ? { capabilities: caps } : {}),
  ...(t.shapes ? { shapes: t.shapes } : {}),
};
```

Wire the lists in at the end of `schema.ts`, after `MENU` is defined (avoids a circular import; `capabilities.ts` imports only types):

```ts
import { CAPABILITIES, SHAPES } from "./capabilities.js";
for (const id of Object.keys(MENU) as TemplateId[]) { MENU[id].capabilities = CAPABILITIES[id]; MENU[id].shapes = SHAPES[id]; }
```

Put the import at the top with the others; the loop at the end of the file.

- [ ] **Step 4: `CHART_GUIDE` keeps only the mark and stacking guide**

Remove the last five lines of `CHART_GUIDE` (waterfall, ranked, matrix, timeline, annotations). Jev's resolver (`resolve.ts`) only answers mark and stacking questions. Add their how-to parts to the chart entry's `rules` instead, as a new const before `MENU`:

```ts
/* How to write each chart kind: enforced or mechanical, so rules. When to choose one is in the chart's capabilities. */
const CHART_KINDS = [
  "Waterfall: write the start total, then each driver as a signed change, and end with `{ \"label\": \"FY25\", \"total\": true }`: code computes the total. Never write a total you have not checked.",
  "Ranked: largest first, 'Other' last.",
  "Matrix: positions 0–100 on both axes.",
  "Timeline: a workstream made of smaller steps is a group (the steps have `level: 1`).",
  "Annotations are computed by code; never write their figure yourself. At most 3 (2 with notes); only when the user asked for them.",
];
```

and in the chart entry, `rules: [...existing first lines..., ...CHART_GUIDE, ...CHART_KINDS]`.

Update `tests/unit/schema.test.ts`: line 81 `CHART_GUIDE.length` 13 → 8. Line 270: replace the ranked/matrix `CHART_GUIDE` assertion with `assert.ok(describe("chart").capabilities?.some((c) => c.name === "Ranked") && describe("chart").capabilities?.some((c) => c.name === "Matrix"));`.

- [ ] **Step 5: Write `src/engine/slides/capabilities.ts`**

```ts
/* What each template can do, and when to use each capability (spec 2). The agent reads these on the template
   card whatever the gallery shows. Judgement only: what validate() enforces is in the template's rules.
   Each sample is a complete body for its template (no frame); tests/unit/capabilities.test.ts validates them. */
import type { Style, TemplateId } from "../types.js";

export interface Capability { name: string; use: string; avoid: string; sample: Record<string, unknown>; styles?: readonly Style[] }
export interface Shape { content: string; shape: string }

const bars = { categories: ["2024", "2025", "2026"], format: "£{v}m", series: [{ name: "Revenue", mark: "bar", color: "focus", values: [12, 18, 26] }] };
const notes = { name: "Notes", use: "Three numbered observations beside the exhibit, each saying what it does not show: a cause, a caveat, an implication.", avoid: "Notes that restate the title, the takeaway or a visible value; in pitch prefer none, and fewer than three good notes means none." };

export const CAPABILITIES: Partial<Record<TemplateId, Capability[]>> = {
  chart: [
    { name: "Bars and lines", use: "Bars compare sizes across categories or up to about 6 periods; lines show a trend over 7 or more periods, a forecast or a scenario.", avoid: "Exact figures the reader must compare (a table), or one series as bars and a comparable one as a line.", sample: { chart: bars } },
    { name: "Waterfall", use: "A bridge from one total to another by driver: revenue FY24 to FY25, a cost walk, an EBITDA bridge.", avoid: "Parts that do not add up to the change; use bars.", sample: { chart: { kind: "waterfall", format: "£{v}m", items: [{ label: "FY24", value: 40 }, { label: "Price", value: 6 }, { label: "Churn", value: -3 }, { label: "FY25", total: true }] } } },
    { name: "Ranked", use: "Named items ordered by one measure: share by provider, spend by category.", avoid: "Items with a natural order, such as years or stages; use bars.", sample: { chart: { kind: "ranked", format: "{v}%", ranking: [{ label: "Acme", value: 31, focus: true }, { label: "Bank", value: 24 }, { label: "Other", value: 12 }] } } },
    { name: "Timeline", use: "Workstreams that run in parallel or overlap in time.", avoid: "2–5 phases one after another; use the steps template.", sample: { chart: { kind: "timeline", periods: ["Q1", "Q2", "Q3", "Q4"], rows: [{ label: "Build", start: 0, end: 2 }, { label: "Pilot", start: 1, end: 3 }] } } },
    { name: "Matrix", use: "Items placed on two judged dimensions, such as impact against effort.", avoid: "Measured values on both axes; a matrix shows judgement, not data.", sample: { chart: { kind: "matrix", axes: { x: "Effort", y: "Impact" }, points: [{ label: "Pricing", x: 20, y: 80, focus: true }, { label: "Rewards", x: 70, y: 40 }] } } },
    { name: "Annotations", use: "The title claims a growth rate (cagr), a gap between two categories (difference) or a comparison with a goal (target), and the user asked for it.", avoid: "Decoration; never write the figure yourself.", sample: { chart: { ...bars, annotations: [{ type: "cagr", from: 0, to: 2 }] } } },
    { ...notes, sample: { chart: bars, notes: [{ title: "Price drove half" }, { title: "Churn fell to 2%" }, { title: "Mix is shifting" }] } },
  ],
  table: [
    { name: "Scoring", use: "✓ / ✗ when each option has the property or not; Harvey balls when degree matters in 3+ steps; the figure itself when the reader needs the value; \"—\" when it does not apply.", avoid: "Turning a figure into a mark, ✗ for not applicable (✗ means lacks it), or mixing balls and ticks.", sample: { table: { columns: [{ label: "Provider" }, { label: "Instant approval" }, { label: "Credit limit" }], rows: [{ cells: ["Bank", "✗", "◑"] }, { cells: ["Acme", "✓", "●"], focus: true }] } } },
    { name: "Cell note", use: "A short qualifier the value needs to be read right, under a figure or a mark: \"✓ · from Q2\", \"£25k · 12-month cap\".", avoid: "Restating the column header, or notes in more than about 1 cell in 3.", sample: { table: { columns: [{ label: "Provider" }, { label: "No annual fee" }], rows: [{ cells: ["Bank", { value: "✗", note: "£120 a year" }] }, { cells: ["Acme", "✓"] }] } } },
    { name: "Bullets in a cell", use: "A row that explains a position (why an option leads, how a competitor plays), usually in the last column.", avoid: "When a phrase would do; two columns of bullets means the content is cards or notes.", sample: { table: { columns: [{ label: "Competitor" }, { label: "Limit" }, { label: "How they compete" }], rows: [{ cells: ["Bank", "£25k", { value: "Branches", bullets: ["Underwrites on filed accounts", "Bundles the card with loans"] }] }] } }, styles: ["consulting"] },
    { name: "Header icons", use: "Columns are categories the reader scans across (features, criteria, segments), most of all 4–5 columns of marks.", avoid: "Number columns (years, £m) or icons on only some columns.", sample: { table: { columns: [{ label: "Provider" }, { label: "Limit", icon: "wallet" }, { label: "Speed", icon: "zap" }], rows: [{ cells: ["Bank", "◑", "◔"] }, { cells: ["Acme", "●", "●"], focus: true }] } } },
    { name: "Status labels", use: "A stage or state the reader filters by: Live, Pilot, Planned; typically in action and roadmap tables.", avoid: "Good or bad judgements, which are marks; more than 4 different labels in a column.", sample: { table: { columns: [{ label: "Action" }, { label: "Owner" }, { label: "Status" }], rows: [{ cells: ["Sign the issuer", "CEO", { value: "Under way", status: true }] }, { cells: ["Hire credit head", "CEO", { value: "Final round", status: true }] }] } } },
    { name: "Group headings", use: "6 or more rows that fall into 2–3 named groups (Fees, Limits, Rewards).", avoid: "Short tables, or a group of one row.", sample: { table: { columns: [{ label: "Term" }, { label: "Acme" }], rows: [{ cells: ["Fees"], style: "group" }, { cells: ["Annual", "£0"] }, { cells: ["FX", "0%"] }, { cells: ["Cash", "£0"] }, { cells: ["Limits"], style: "group" }, { cells: ["Credit", "£250k"] }, { cells: ["Daily", "£50k"] }, { cells: ["Cards", "50"] }] } }, styles: ["consulting"] },
    { ...notes, sample: { table: { columns: [{ label: "Provider" }, { label: "Limit" }], rows: [{ cells: ["Bank", "£25k"] }, { cells: ["Acme", "£250k"], focus: true }] }, notes: [{ title: "Banks cap at £25k" }, { title: "Neobanks stop at debit" }, { title: "Charge cards cost £550" }] } },
  ],
  pair: [
    { name: "Chart half", use: "A measure that needs its own chart beside another exhibit; up to 2 bullets under it for what it means.", avoid: "Timelines and matrices, which need the full width.", sample: { halves: [{ caption: "Market · £bn", chart: { ...bars, series: [{ ...bars.series[0], color: "neutral" }] } }, { caption: "Acme share · %", chart: { categories: ["2024", "2025", "2026"], format: "{v}%", series: [{ name: "Share", mark: "bar", color: "focus", values: [1, 3, 7] }] } }] } },
    { name: "Table half", use: "The exact figures or breakdown behind the other half: 2–3 columns, up to 5 rows.", avoid: "A table that needs bullets, group headings or more columns; use the table template.", sample: { halves: [{ caption: "Market · £bn", chart: bars }, { caption: "Spend book · £bn", table: { columns: [{ label: "Year" }, { label: "Share" }, { label: "Book" }], rows: [{ cells: ["2026", "7%", "£3.6bn"], focus: true }] } }] } },
    { name: "Number half", use: "A headline figure beside the trend or breakdown that produced it.", avoid: "A number that is the whole point on its own; use the number template.", sample: { halves: [{ number: { value: "7%", caption: "Acme’s share of spend by 2030." } }, { caption: "Market · £bn", chart: bars }] } },
    { name: "Points half", use: "2–4 short reasons or a side of a contrast in prose, with a **bold** lead-in.", avoid: "Numbered observations about a chart (a chart with notes), or two short sides (framed cards).", sample: { halves: [{ caption: "Problem", points: ["**Banks** cap limits at £25k", "**Neobanks** offer debit only"] }, { caption: "Acme", points: ["**£250k** limits from day one", "**No fee**, 1% back"] }] } },
  ],
  cards: [
    { name: "Icon cards", use: "2–4 parallel ideas (pillars, features, options) where a symbol helps recognition; icon \"auto\" lets code pick.", avoid: "Ideas that are really figures; use value cards.", sample: { cards: [{ icon: "zap", title: "Fast", text: "Approval in minutes." }, { icon: "wallet", title: "Big limits", text: "Up to £250k." }] } },
    { name: "Value cards", use: "2–4 independent figures, each with one line of context.", avoid: "One figure that makes the point alone (number template) or figures on one measure (a chart).", sample: { cards: [{ value: "5 min", title: "To approve", text: "From application to card." }, { value: "£250k", title: "Top limit", text: "Ten times a bank's." }] } },
    { name: "Framed contrast", use: "A two-way contrast, them against us or before against after: the losing case left, the winning case right with tone focus.", avoid: "More than two sides, or sides that are not opposed; use icon cards.", sample: { framed: true, cards: [{ label: "Banks", title: "Too slow", text: "Weeks to approve.", tone: "neutral" }, { label: "Acme", title: "Instant", text: "Minutes to approve.", tone: "focus" }] } },
    { name: "Bullets or text", use: "Bullets when each card holds 2–3 separate facts (consulting); one line of text when it holds one.", avoid: "Mixing bullets and text across cards.", sample: { cards: [{ icon: "zap", title: "Fast", bullets: ["Minutes to approve", "Cards issued same day"] }, { icon: "wallet", title: "Big limits", bullets: ["Up to £250k", "Raised with spend"] }] }, styles: ["consulting"] },
  ],
  steps: [
    { name: "Steps", use: "A sequence in time of 2–5 phases: a plan, a process, a history.", avoid: "Workstreams that overlap (a chart timeline) or items with no order (cards).", sample: { steps: [{ when: "Q4 2026", title: "Build", text: "Issuer signed." }, { when: "Q1 2027", title: "Prove", text: "First 100 customers." }] } },
    { name: "Focus step", use: "Highlight the one phase the slide is about: where we are, or what comes next.", avoid: "More than one focus step.", sample: { steps: [{ when: "Q4 2026", title: "Build", text: "Issuer signed.", focus: true }, { when: "Q1 2027", title: "Prove", text: "First 100 customers." }] } },
  ],
};

export const SHAPES: Partial<Record<TemplateId, Shape[]>> = {
  table: [
    { content: "Options against criteria", shape: "Marks, optional header icons, a focus column or row on our option." },
    { content: "Exact figures", shape: "Words and figures, a total row, no marks." },
    { content: "Explaining positions", shape: "A short first column and one column of bullets." },
    { content: "Actions", shape: "Owner, date and status-label columns; a cell note for the detail." },
  ],
  pair: [
    { content: "Two related measures (market and share)", shape: "chart + chart" },
    { content: "A trend and the figures behind it", shape: "chart + table" },
    { content: "A chart and its reasons", shape: "chart + points (numbered observations: a chart with notes instead)" },
    { content: "A headline figure and the trend that produced it", shape: "number + chart" },
    { content: "Before and after, or us and them, in the same columns", shape: "table + table" },
    { content: "A two-way contrast in prose", shape: "points + points (short sides: framed cards instead)" },
  ],
};
```

Fix any sample that `validate` rejects by changing the sample (smallest valid form), never the schema. Likely ones: the matrix sample may need `quadrants`; the timeline may need more rows. Read the error and adjust.

- [ ] **Step 6: Snapshots and tests**

Run: `npm test`. `tests/unit/__snapshots__/tools-registry.test.ts.snap` changes only if it pins card content. If it does, check the diff contains only added `capabilities` / `shapes` and the CHART_GUIDE → CHART_KINDS move, then update with `npx vitest run tests/unit/tools-registry.test.ts -u`.

Measure the card size growth and put the numbers in the commit message:

```bash
node --import tsx -e "import('./src/engine/slides/schema.ts').then(({describe})=>{for (const id of ['chart','pair','table','cards','steps']) console.log(id, JSON.stringify(describe(id,'consulting')).length)})"
```

Rough guide: 4 characters ≈ 1 token. If `table` grows by more than ~2,400 characters (~600 tokens), shorten the `use` / `avoid` text, not the samples.

- [ ] **Step 7: Build and commit**

```bash
npm run build
git add src/engine/slides/capabilities.ts src/engine/slides/schema.ts tests/unit/capabilities.test.ts tests/unit/schema.test.ts tests/unit/__snapshots__
git commit -m "Template cards say when to use each capability, with a checked sample

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Gallery tables use the new capabilities

**Files:**
- Modify: `src/engine/starters/starters.json` (starters `scoring`, `table-notes`, `next-steps`, both styles)

- [ ] **Step 1: `scoring`: header icons on the four criteria**

Both styles, `table.columns`:

```json
[{ "label": "Provider" }, { "label": "Credit limit", "icon": "wallet" }, { "label": "Rewards", "icon": "sparkles" }, { "label": "Approval speed", "icon": "zap" }, { "label": "No fees", "icon": "banknote" }]
```

- [ ] **Step 2: `table-notes`: a ✓ / ✗ column whose ✗ carries the fee**

Both styles: column 2 `{ "label": "Fee" }` → `{ "label": "No annual fee" }`, and its cells, top to bottom:

```json
{ "value": "✗", "note": "£120 a year" }
"✓"
{ "value": "✗", "note": "£550 a year" }
"✓"
```

- [ ] **Step 3: `next-steps`: a status column**

Both styles: add a fourth column `{ "label": "Status" }` and, row by row, the cells:

```json
{ "value": "Under way", "status": true }
{ "value": "Under way", "status": true }
{ "value": "Final round", "status": true }
{ "value": "Not started", "status": true }
```

- [ ] **Step 4: Validate**

Run: `npx vitest run tests/unit/starters.test.ts tests/unit/starters-content.test.ts`
Expected: PASS, with no errors or warnings in either style. `example-shapes.test.ts` will also fail for these three; report it, don't re-record.

- [ ] **Step 5: Commit**

```bash
git add src/engine/starters/starters.json
git commit -m "Gallery: header icons on the scorecard, a fee tick with notes, action status labels

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Review at full size, tune, and agent check (controller)

This needs the browser and judgement. The controller runs it, not a Sonnet implementer.

- [ ] **Step 1:** `preview_start` the dev server and open `/src/dev/review.html`, `?stress=1`, and each changed starter with `?only=<i>&full=1` in both styles. Screenshot each: the 3 changed tables, the pair (consulting chart + table, pitch number + chart), and the stress slides "table rich", "chart + table", "number + points", "chart + notes".
- [ ] **Step 2:** Check for overflow (`window.__fit`), gaps, alignment of the two halves' captions, icon size against the 19px headers, status label weight, the bullets column wrap, the 120-character notes. Append findings to `docs/temp/apple-bar-review.md`.
- [ ] **Step 3:** Tune the provisional numbers to what fits: the budget costs in Task 1 Step 7, the half number and points sizes in Task 5 Step 4, the notes total (300). Each change is a code edit plus its test, committed with the reason.
- [ ] **Step 4:** Run `npm run test:browser`. The `example-lines` lock is expected to fail for changed starters; report to the user with the diff, together with `example-shapes`, and ask whether to re-record both.
- [ ] **Step 5:** Agent harness: run 4 prompts against the live agent: "compare these four cards on fees, limits, rewards and app", "show ARR growth and the figures behind it", "what each competitor does differently", "our actions this quarter and where each stands". Pass if the agent picks the expected shape (scoring table with marks; pair chart + table; table with a bullets column; table with status labels). Record results in `docs/temp/`.

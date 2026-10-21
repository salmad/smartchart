# Object settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (inline, stopping at each task boundary). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Every schema setting of a chart, table, card, step or row is editable by hand from a short, progressively disclosed right-click menu; add `align` to table columns and `highlight` (one bar) to bars charts.

**Architecture:** A pure `settingsFor(target, slide, style)` in `src/engine/slides/settings.ts` reads the object's own fields from the schema (`describe(...).fields`, as `listOps` does), offers each enum and boolean, hides any choice whose patch makes `validate` report a new error, and writes the same patches `applyPatch` already takes. `EditMenu` renders its result as submenus. Two schema additions (`align`, `highlight`) close the gaps the spec names. Decks and docs share the edit surface, so one change serves both.

**Tech Stack:** TypeScript (strict), React 18, shadcn/Radix context menu, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-20-object-settings-design.md`

## Global Constraints

- A hand edit changes only what the schema allows. No colour picker, no number boxes for sizes (spec, Principles).
- Emphasis is a choice among Highlight, Normal, Mute (and Contrast for a chart series); the palette says what each draws as. An object never carries a colour.
- A menu item is a patch to a schema path through `edit.apply(result)`; undo, Save, Discard, checks and versions are unchanged.
- `align` is `left` | `centre` | `right`, default `auto` (today's derived behaviour). `chart.highlight` is `{ series, index }`, both 0-based, for `kind: bars` only.
- No existing chart or table draws differently: every existing slide (look-lock, review page) stays pixel-identical.
- Token budgets in `tests/unit/budgets.test.ts` hold: chart card (consulting) ≤ 3600, table card ≤ 3600 with capabilities else 3000. Cut descriptions to fit; do not raise a budget.
- Code style: no `any`, no inline styles, files under ~300 lines, existing comment density.

## Review Focus

1. Inserting, deleting or moving a category (or a series) in the data grid must keep `highlight` on the same bar, or clear it when its bar is gone (Task 2 owns the test).
2. `highlight` on a stacked or percent-stacked chart picks one segment; labels inside segments follow the focus slot (Task 2).
3. An explicit `align` must not change a column's kind: bars still need a figures column, and a header icon or logo follows the alignment (Task 1).
4. Mutual exclusions: setting a column Highlight clears Mute and the reverse, in one patch; undo restores both (Task 3).
5. The Settings submenu inside a doc figure takes the page's theme (the `look` prop), and a submenu opens fully on screen near the window edge (Task 5).

---

### Task 1: `align` on table columns

**Files:**
- Modify: `src/engine/slides/schema.ts` (`TABLE_COLUMN`, near line 284), `src/engine/slides/align.ts`, `src/engine/components/table.ts` (line 24, the `cls` helper), `src/engine/components/components.css` (near lines 153–156, 180–181, 399)
- Test: `tests/unit/align.test.ts` (create), `tests/unit/schema.test.ts`

**Interfaces:**
- Produces: `TABLE_COLUMN.fields.align` (enum `["left","centre","right","auto"]`, default `"auto"`); `export type Place = "left" | "centre" | "right"`; `export function placeOf(col: Table["columns"][number] | undefined): Place | null` in `align.ts` (null for `auto` or missing); the table render adds class `pl-left | pl-centre | pl-right` to a column's cells and header when set. `columnAlign` is unchanged (it stays the column's kind).

- [ ] **Step 1: Write the failing tests** in `tests/unit/align.test.ts`: `placeOf({label:'A', align:'right'})` is `'right'`; `'auto'` and no field give `null`; `columnAlign` for a column with `align:'right'` and text content is still `'text'` (kind unchanged); `validate` of a table slide with `columns[1].align = 'right'` has no errors and `'middle'` has one error naming `align`; `tableHTML` of a table whose column 1 has `align:'centre'` contains `pl-centre` on that column's `td` and `th` and none on column 0.
- [ ] **Step 2: Run** `npx vitest run tests/unit/align.test.ts`. Expected: FAIL (`placeOf` not exported).
- [ ] **Step 3: Implement** the schema field with the description "Text alignment of the column; auto follows the content." (short, for the token budget), `placeOf` in `align.ts`, and the class in `table.ts`'s `cls` helper. In `components.css` add `.tbl .pl-left { text-align: left } .tbl .pl-centre { text-align: center } .tbl .pl-right { text-align: right }` after the `al-*` rules, and make the header icon and logo margin rules (the `ic-above th.al-sym` / `th.al-num` and `th.al-num.has-lg` / `th.al-sym.has-lg` lines) have `pl-*` equivalents that win, so an icon or logo sits on the chosen side.
- [ ] **Step 4: Run** `npx vitest run tests/unit/align.test.ts tests/unit/schema.test.ts tests/unit/budgets.test.ts`. Expected: PASS.
- [ ] **Step 5: Browser check.** `npm run test:browser -- tests/browser/look-lock.spec.ts tests/browser/review.spec.ts`: no slide moved. Then render a table with `align` set on the review page (`npm run dev`, `/src/dev/review.html`) and read it at full size: left, centre and right columns, with a header icon and a logo on one.
- [ ] **Step 6: Commit** `git add -A && git commit -m "Tables: a column's align (left, centre, right), auto by default"`

### Task 2: `chart.highlight`, one bar

**Files:**
- Modify: `src/engine/slides/schema.ts` (`CHART` fields near line 166–200, `KIND_FIELDS` line 157, the bars rules near line 745), `src/engine/slides/colours.ts` (`seriesSlots`, line 118), `src/engine/components/charts/chart.ts` (`bars()`, lines 51–110), `src/engine/slides/sheet.ts` (`bars()` model: `remap`, line 74), `src/engine/agent/checks.ts` and `src/engine/docs/checks.ts` (`focusCount`, so R4 counts the highlighted bar as the one focus)
- Test: `tests/unit/highlight.test.ts` (create); `tests/browser/chart-highlight.spec.ts` (create)

**Interfaces:**
- Produces: `chart.highlight?: { series: number; index: number }`; `seriesSlots(chart)` gives no series the `"focus"` slot when `chart.highlight` is set; `drawChart` draws the bar `highlight` names with class `c-focus` (and its value or segment label), and every other bar with its series' slot; each bar path carries `data-i="<category index>"` beside `data-series`.

- [ ] **Step 1: Write the failing unit tests** in `tests/unit/highlight.test.ts` (use the `chart-lines`/bars starters via `starterSlide`, as `tests/unit/actions.test.ts` does): `validate` accepts `{series:0,index:1}`; refuses `index` out of range, `series` out of range, a chart that also has a series with `color:'focus'`, a lines-only chart, and any non-bars kind (message names `chart.highlight`); `seriesSlots` with `highlight` has no `"focus"`; with a stacked chart `focusCount` still returns 1; the sheet model's `insertRow(at)` before the highlighted category moves `index` up by one, `removeRows` of that category removes `highlight`, `moveRow` carries it (read the patch the model returns and assert `chart.highlight`).
- [ ] **Step 2: Run** `npx vitest run tests/unit/highlight.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the field as an object with two `idx(...)` numbers, description "The one bar the title is about; leave `color: focus` off every series when you use it. Bars only." (cut to fit the budget); add `"highlight"` to `KIND_FIELDS.bars`; the validator rules in the bars branch (range, no focus series, no lines-only chart); `seriesSlots` skips the focus slot when `highlight` is set; `bars()` overrides class and label slot for the one bar and adds `data-i`; extend `remap` in `sheet.ts` so a returned patch includes `chart.highlight` moved, or `null` when removed (reuse the `Map` functions already there, for categories and for series order); make `focusCount` count `highlight` as one focus.
- [ ] **Step 4: Run** `npx vitest run tests/unit` . Expected: PASS (including budgets).
- [ ] **Step 5: Browser test** `tests/browser/chart-highlight.spec.ts`, patterned on `tests/browser/chart-area.spec.ts`: a doc whose bars chart has `highlight: {series:0,index:2}` draws exactly one `path.bar.c-focus` in `.doc figure[data-kind="chart"] svg` and the other bars are not `c-focus`.
- [ ] **Step 6: Run** the browser test, then `npm run test:browser -- tests/browser/look-lock.spec.ts`: no slide moved. Read a bars chart with `highlight` on the review page at full size, in both themes, and in stacked form.
- [ ] **Step 7: Commit** `git commit -m "Charts: highlight one bar (chart.highlight), drawn in the focus colour"`

### Task 3: `settingsFor`, the schema-driven settings

**Files:**
- Create: `src/engine/slides/settings.ts`
- Modify: `src/engine/slides/actions.ts` (add `bar` and `series` targets to `Target`; export nothing else new)
- Test: `tests/unit/settings.test.ts` (create)

**Interfaces:**
- Consumes: `describe(template, style).fields` (`FieldView`: `type`, `values`, `default`), `getAt`, `validate(slide, style)`, `applyPatch(slide, set)` from `src/engine/agent/patch.ts`, the `Target` type.
- Produces:
  - `Target` gains `{ kind: "bar"; series: number; index: number }` and `{ kind: "series"; series: number }`.
  - `export type Setting = { id: string; label: string; path: string } & ({ kind: "choice"; options: { value: string; label: string }[]; value: string; set(value: string): Record<string, unknown> } | { kind: "flag"; on: boolean; set(on: boolean): Record<string, unknown> })`
  - `export function settingsFor(target: Target, slide: Slide, style: Style): Setting[]`

- [ ] **Step 1: Write the failing tests** in `tests/unit/settings.test.ts` (starters: `chart-lines`, a bars starter, a table starter, `cards-icon`, a steps starter): for a `series` target on a lines chart, the settings include `Emphasis` with options `focus`, `neutral`, `contrast` labelled Highlight, Normal, Contrast, and `Dashed`, `Fill under the line` as flags; for a `bar` target the settings include a `Highlight this bar` flag whose `set(true)` is `{ "chart.highlight": { series, index } }` and `set(false)` is `{ "chart.highlight": null }`; for a table column target (`cells` with `r0: -1`) the settings include `Emphasis` with Highlight / Normal / Mute where `set('focus')` is `{ "table.columns[j].focus": true, "table.columns[j].muted": null }` and `set('muted')` the reverse, plus `Alignment` (left, centre, right, auto), `Bold`, `Italic`, `Bars`; for a card `item` target the settings include its `tone`; every `set(...)` result is accepted by `applyPatch` and the patched slide `validate`s with no new error; a choice whose patch would add a validator error is absent (for example `Bars` on a column that reads as words; `Fill under the line` on a chart with a bar series); fields named `kind`, any text, number, list, image or `icon`/`logo` field are never offered; a field added to a stub schema entry appears with no other code.
- [ ] **Step 2: Run** `npx vitest run tests/unit/settings.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `settingsFor`: resolve the target to an object path (`item` → its path; `cells` with `r0 === -1` → `table.columns[c0]` (one setting per selected column range writes every column in it); `cells` with rows → `table.rows[r0]`; `series` → `chart.series[i]`; `bar` → the series plus the highlight flag; `slide` with a chart → the chart's own fields, such as `stacking`); walk that object's `FieldView` fields (as `listOps` does), keep enums with a fixed `values` list (not `kind`) and booleans; apply the small `EMPHASIS` table that folds the schema's own emphasis fields into one `Emphasis` choice with the mappings in the spec's Goal 3 (series `color`; column `focus`+`muted`; row `focus`+`style: muted`; card `tone`; step/point/waterfall/timeline `focus`); labels come from a small `LABELS` map with the field name as fallback; hide a choice when `validate(applyPatch(slide, patch).slide)` has an error the unpatched slide did not. The existing `chart-area` action in `actions.ts` is superseded by the series `area` flag: delete it and its two tests from `tests/unit/actions.test.ts` in this task, and say so in the commit.
- [ ] **Step 4: Run** `npx vitest run tests/unit`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Settings: settingsFor reads an object's settings from the schema"`

### Task 4: Targets for bars and series

**Files:**
- Modify: `src/app/edit/selection.ts` (`targetAt`), `src/engine/components/charts/chart.ts` (line paths and bar paths already carry `data-series`; `data-i` from Task 2)
- Test: `tests/unit/selection.test.ts` (create; jsdom is not configured, so test `targetAt` with a minimal element stub built in the test, or move the DOM-free part to a pure helper and test that) and a browser assertion in Task 5

**Interfaces:**
- Consumes: `Target` bar/series kinds (Task 3); bars carry `data-series` and `data-i`.
- Produces: `targetAt(el, current)` returns `{ kind: 'bar', series, index }` for a bar, `{ kind: 'series', series }` for a line path, and `{ kind: 'slide' }` elsewhere on a chart, as before.

- [x] **Step 1: Write the failing test** for the pure mapping `chartTargetOf(el: { closest(sel: string): { dataset: Record<string, string> } | null } | null): Target | null` exported from `selection.ts`: a bar with `data-series="1" data-i="2"` gives `{kind:'bar',series:1,index:2}`; a line with only `data-series="0"` gives `{kind:'series',series:0}`; anything else gives `null`.
- [x] **Step 2: Run** it. Expected: FAIL.
- [x] **Step 3: Implement** `chartTargetOf` and call it in `targetAt` before the `slide` fallback (text and cell targets keep priority).
- [x] **Step 4: Run** `npx vitest run tests/unit && npx tsc --noEmit -p .`. Expected: PASS.
- [x] **Step 5: Commit** `git commit -m "Edit: a bar and a line are targets"`

### Task 5: The Settings menu

**Files:**
- Modify: `src/app/edit/EditMenu.tsx` (render `settingsFor` as submenus; Score becomes a submenu), `src/app/components/ui/context-menu.tsx` only if a radio item or sub-component is missing (use `npx shadcn@latest add context-menu` rules; do not hand-write primitives)
- Test: `tests/browser/settings-menu.spec.ts` (create)

**Interfaces:**
- Consumes: `settingsFor`, `Setting`, `actionsFor` (Score actions have `group: "mark"`).
- Produces: a `Settings` submenu in the context menu: one `ContextMenuSub` per `Setting` of kind `choice` (trigger shows the label and current value; content is a radio list), flags as checkable items in the Settings submenu itself; `Score` is one submenu holding the existing seven `mark` actions; `look` (`MenuLook`) classes apply to every submenu so a doc figure's menu keeps the page's colours.

- [x] **Step 1: Write the failing browser tests** in `tests/browser/settings-menu.spec.ts`, patterned on `tests/browser/chart-area.spec.ts` (a seeded doc, a figure opened in place) and `tests/browser/edit.spec.ts` (a deck): (a) right-click a table column header, Settings, Alignment, Right: after Done and Save the saved Markdown has `"align": "right"` and the column's cells have class `pl-right`; (b) right-click a series (line), Settings, Emphasis, Contrast: the saved JSON has `"color": "contrast"`; (c) right-click one bar, Settings, Highlight this bar: exactly one `path.bar.c-focus`; choose it again: none; (d) right-click a table cell range: the menu has one `Score` entry and no `Harvey ball` row at the top level; (e) the top level of a table column's menu holds at most 6 entries.
- [x] **Step 2: Run** `npm run test:browser -- tests/browser/settings-menu.spec.ts`. Expected: FAIL.
- [x] **Step 3: Implement** the menu rendering with `ContextMenuSub`, `ContextMenuSubTrigger`, `ContextMenuSubContent`, `ContextMenuRadioGroup`/`ContextMenuRadioItem` and `ContextMenuCheckboxItem`, calling `edit.apply({ set: setting.set(value) })`; group Score; keep every existing item.
- [x] **Step 4: Run** the new spec, then the whole suite: `npm run lint && npm run build && npm test && npm run test:browser`. Expected: all pass.
- [x] **Step 5: Look at it.** In the dev app, open a deck and a doc, right-click a column, a series, a bar, a card; read each menu at full size in Ink and Paper. Submenus open on screen at the window edge. Log what you see in `docs/temp/apple-bar-review.md`.
- [x] **Step 6: Update the docs.** Mark the spec "built" with the calls made; add `align` and `highlight` in one sentence each to `get_guide` text only if the guide names table or chart settings today (otherwise the card descriptions are the instruction); add a line to `docs/product/FUTURE.md` for what was left out (highlighting several bars, pair halves).
- [x] **Step 7: Commit** `git commit -m "Edit: the Settings menu, built from the schema; Score is one submenu"`

---

**Built (Tasks 4 and 5).** Task 4: `chartTargetOf` and its use in `targetAt`. Task 5: `SettingsMenu.tsx` and the Score submenu in `EditMenu.tsx`; `tests/browser/settings-menu.spec.ts` (table align, Score, a line's emphasis, one-bar highlight, menu size), and `chart-area.spec.ts` now right-clicks the line. Calls and the one gap (a pair half's chart) are in the spec's "As built". The plan named a "Mute" test for a series: a series' emphasis words are Highlight, Normal and Contrast (Mute is for columns, rows and cards), so the spec tests Contrast.

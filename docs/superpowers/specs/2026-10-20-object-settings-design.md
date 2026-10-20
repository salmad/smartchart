# Object settings: every schema setting is editable by hand, from the right-click menu

> Status: built, 2026-10-20. Settings menu, `align`, and the per-bar highlight are in; see "As built" at the end for the calls made.

## Why

A person editing a deck or a doc by hand can change an object's words and data, and a few of its settings, but not most
of them. In one sitting the user wanted to change a chart's colour fill, a table column's alignment, and to highlight one
bar, and could do none of it. The settings exist: the schema (`src/engine/slides/schema.ts`) already holds about forty
enum and boolean fields for charts, tables, cards, steps and rows, each with its allowed values, default and a
description. Almost none has a control. One has no field at all: a table column's alignment is derived from its content
(`columnAlign` in `src/engine/slides/align.ts`) and cannot be set by a person or an agent.

An agent is in the same position for that last gap: `update_slide` can write any schema path, so anything the schema
holds, an agent can already set. What an agent cannot set is what the schema lacks.

## Principles (the user's, as stated)

- **The schema is the whole space.** A hand edit may change only what the schema allows. No free colour picker, no
  number boxes for sizes: the styles and palette decide how things look.
- **Emphasis is a choice among a few words** (highlight, normal, mute, and where the schema has it, contrast). The
  document's palette and accent, set once for the whole document (the Look panel), say what each draws as. An object
  never carries a colour of its own.
- **A person and an agent write the same path.** A menu item is a patch to a schema path, as the existing actions
  already are (`src/engine/slides/actions.ts`), so undo, Save, Discard, checks and versions behave as for any edit, and
  an agent can write the same thing with `update_slide` or `update_block`.
- **A short menu.** Settings are disclosed in steps: one entry per setting at the top, its choices one level down.

## Goals

1. Right-click any object that has settings (a chart, a series, a table column, a table row, a card, a step, a timeline
   row, a waterfall step, a ranked item) and a **Settings** submenu lists that object's settings, one entry each, with the
   current value shown beside it. Opening an entry shows its choices as a radio list (a boolean is a single checked
   item).
2. The menu is **built from the schema**: for the object's path it reads each enum and boolean field's allowed values
   and default, and offers them. A field added to the schema later gets its control without new menu code. Labels come
   from a small table of friendly names (the field name when there is none).
3. Emphasis reads the same everywhere: where a schema field means "this one stands out" or "this one recedes", the
   menu shows it as Highlight, Normal and Mute (and Contrast for a chart series), mapped to the real paths: a series'
   `color` (`focus` / `neutral` / `contrast`), a column's `focus` and `muted`, a row's `focus` and `style: muted`, a
   card's `tone`, a step's or point's `focus`. The user chooses a word; the path is written underneath.
4. **One new field: a table column's `align`** (`left`, `centre`, `right`; default `auto`, which keeps today's rule from
   the content). Rendering reads it when set. The agent guide and the table card name it, in the fewest words.
5. The scores group (Harvey balls, tick, cross: seven rows today) becomes one **Score** submenu.
6. Decks and docs both: docs open a figure with the deck's own edit surface, so the one change serves both.
7. **One new chart field: `highlight`, one bar of a `bars` chart** (section "The per-bar highlight" below).
   `chart.highlight = { series, index }` draws that one bar in the focus colour and every other bar in the quiet and
   context colours. Right-clicking a single bar offers "Highlight this bar", checked when it is the one; choosing it
   writes `chart.highlight`, choosing it again removes it. An agent writes the same path.

## Non-goals

- No colours, sizes or fonts a person can type or pick. Not in this change, not later without a new decision.
- No setting that the schema does not already hold, except `align` and the chart's `highlight` (Goals 4 and 7). A setting
  someone wants and the schema lacks is a schema change, decided on its own.
- No change to how the palette, accent or Look panel work.
- No change to which objects can be selected today, beyond what Goal 1 needs (see Targets).
- The existing quick items stay where they are: Bold and Focus on selected text, insert / move / delete, "Edit chart
  data…", "Fill under the line" (built 2026-10-20). Settings is added beside them, not instead.

## Anti-goals

- A menu longer than today's. If a single object lists more than about six settings at the top, the builder groups them
  before shipping, not after.
- A setting that writes a value the validator would refuse (for example `area` beside a bar series, or `focus` together
  with `muted`). The menu hides or disables such a choice, using the same rules the validator uses, never a copy.
- An edit that silently rewrites other fields. A choice patches one path (or the few that one choice needs, as the
  existing Focus / Muted column toggle does: setting one clears the other).

## Design

**Where.** `actionsFor` (`src/engine/slides/actions.ts`) returns today's actions for the target. It gains a second
result: `settingsFor(target, slide)`, a pure function that returns, for the object under the pointer, a list of
`{ label, path, kind: "choice" | "flag", options, value }`. The menu (`src/app/edit/EditMenu.tsx`) renders it as
submenus. Everything the menu draws comes from this one function, so the floating bar and keyboard cannot disagree
(the rule the file already states).

**Reading the schema.** The schema's field views (`describe` / `FieldView`, already used by `listOps`) give each field's
type, values and default. `settingsFor` walks the object's own fields, keeps enums with a fixed list of values and
booleans, skips text, numbers, lists and anything the existing `SKIP` rule hides, and skips fields the object cannot
take right now (validator rules, above). Which fields count as emphasis (Goal 3) is a small table beside it, not a
second source of truth for the values: the allowed values still come from the schema.

**Targets.** Objects selectable today: card, step and similar items (`item`), table cells (rows, columns), text. New:
a chart series (its bars or its line carry `data-series` already, `chart.ts`) and a pair half's chart. Right-clicking a
bar or a line selects its series; right-clicking elsewhere on a chart selects the chart. The builder decides how a
target is represented, following the existing `Target` type.

**`align`.** Added to the table column field list. `columnAlign` returns the column's own `align` when it is `left`,
`centre` or `right`, and today's derived value otherwise. The validator accepts it; the table card in `get_template`
mentions it in one clause. Nothing else about table layout changes.

**Agents.** No new tool. `update_slide` / `update_block` already write any schema path. The guide gets one sentence that
settings are paths with a fixed set of values, and the table card gets `align`. The token budgets in
`tests/unit/budgets.test.ts` still hold (the area description had to be cut to fit them once already).

## What changes visibly

- Right-clicking a chart, a series, a column, a row, a card or a step has a Settings entry.
- Tables can have columns aligned by hand, and an agent can set it.
- The seven score rows become one entry.
- Nothing is drawn differently for existing content: every new control writes a value the schema already accepted, and
  `align` defaults to today's behaviour.

## Tests

- Unit: `settingsFor` on a bar chart, a series, a table column, a row, a card and a step returns the schema's values
  and defaults, hides choices the validator would refuse, and writes patches that `applyPatch` accepts and `validate`
  passes. `columnAlign` honours an explicit `align` and falls back to the derived value for `auto` or none.
- Unit: a field added to a test schema appears in `settingsFor` without other code (the "built from the schema" goal).
- Browser: in a deck and in a doc, right-click a table column, set it to right, Save, reload, and it is right-aligned;
  right-click a series, choose Mute, and it draws in the quiet colour; Settings stays within a few entries.
- Look-lock and the review page show no slide moved.

## My calls (to check while reading)

- Settings is one submenu beside the existing quick items, which stay; only Score collapses into a submenu.
- A choice that depends on another (focus and muted) shows the choice that is valid and writes both paths.
- `align` default `auto` (today's behaviour), not `left`.
- Friendly labels come from a small table, not from rewriting the schema's descriptions.

## The per-bar highlight (`chart.highlight`)

The `bars` chart has no per-bar setting today: a series is the unit, and `color: focus` makes every bar of it the
highlight. The `ranked` chart already has a per-item `focus`, and waterfall steps, timeline rows and matrix points have
one too; `bars` is the gap, and it is the one the user hit.

- **Schema.** `chart.highlight`: an object `{ series, index }`, both indexes (the `idx(...)` helper the annotations use),
  for `kind: bars` only, with a description a writer can act on in one line ("the one bar the title is about; omit
  `color: focus` on every series when you use it"). Not a boolean on the category, because categories are plain
  strings.
- **Rules (validator).** `index` is inside `categories` and `series` inside `series`. Not together with a series whose
  `color` is `focus` (the chart's one focus is the bar), the same one-focus rule the chart checks already state
  (R4, "at most one focus element"). Bars only: refused on a chart that draws as lines, since a line's emphasis is its
  series.
- **Allocator** (`seriesSlots` in `src/engine/slides/colours.ts`, colour spec C3 to C5). With a `highlight`, no series
  takes the focus slot; every series takes its context slot as it does today when a chart has no focus series, and the
  highlighted bar alone is drawn with the focus slot. Slots stay per series, so legends and value labels keep working;
  the one bar's class and its value label are overridden when drawn (`bars()` in
  `src/engine/components/charts/chart.ts`, which already marks each bar with `data-series`).
- **Targets and menu.** The bars gain `data-i` (the category index) next to `data-series`, so a click lands on a series
  and a category. Right-click a bar: Settings holds "Highlight this bar" and the series' own emphasis (Goal 3).
  Right-click the plot elsewhere: the chart's settings (stacking, and "Fill under the line" for line charts).
- **Editing categories.** Inserting, deleting or moving a category (the data grid, `src/engine/slides/sheet.ts` and the
  list operations in `edit.ts`) must keep `highlight.index` on the same bar, or clear `highlight` if its category is
  deleted. The builder confirms every path that changes `categories` or `series` order does this.
- **Stacked and grouped.** Works for both: one bar or one stack segment is picked by `{ series, index }`.
- **Not in this change.** Highlighting several bars, a highlight on a line's point (a note or annotation names a
  point), and a highlight in a waterfall, timeline or matrix chart, which have their own `focus` and get a Settings
  entry from the generic mechanism with no extra work.

## Tests for the highlight

- Unit: the validator accepts `{ series, index }` in range, refuses it out of range, with a `color: focus` series, and
  on a lines-only chart. `seriesSlots` gives no focus slot when `highlight` is set. Deleting or inserting a category
  through the edit operations moves or clears `highlight`.
- Browser: in a deck and in a doc, right-click one bar, choose "Highlight this bar", and that bar draws in the focus
  colour while the others are grey; choose it again and the chart returns to its first look; Save and reload keep it.
- The review page and look-lock show no slide moved (no existing chart sets `highlight`).

## As built

- **Menu.** The right-click menu gains one **Settings** submenu (`src/app/edit/SettingsMenu.tsx`) beside the existing quick
  items. A choice is a nested submenu of radio items, its current value shown beside the entry; a flag is a checkable item in
  Settings itself. Score is one submenu of the seven rows. Every pick is `edit.apply({ set: setting.set(value) })`, the path an
  agent writes.
- **Targets.** `chartTargetOf` (`src/app/edit/selection.ts`) reads the `data-series` and `data-i` the chart already draws: a bar
  is `{ bar, series, index }`, a line `{ series }`. Right-clicking elsewhere on a chart is still the chart. Text, cells and card
  items keep priority.
- **"Fill under the line"** is the series' `area` flag in Settings (a line only, in a chart of only lines), no longer a
  chart-level item. `tests/browser/chart-area.spec.ts` right-clicks the focus line itself.
- **A pair half's chart.** Bar and series targets carry an optional `half` (read from the chart host's `data-chart="0"|"1"`; a
  chart slide's host has no number). `settingsFor` then reads and writes under `halves[half].chart`. A half takes no
  `highlight` in its schema, so "Highlight this bar" is not offered there; Emphasis, Dashed, the fill and the rest are.
- **Submenus** open on screen near the window edge (collision padding) and take the doc page's look in a figure.
- **Tests drive the menu by keyboard** (focus, then → or Enter): a menu opens under the pointer, so Playwright's hover has
  nothing to move and Radix opens submenus on movement.

# Roadmaps M3: Matrix and Duplicate

> Status: draft 2026-11-10. Parent: `docs/superpowers/specs/2026-11-09-roadmaps-design.md` (§ Matrix, Milestones 3, Views, Rollups, Instant). Shipped: M1 table (`src/engine/roadmaps/view.ts`, table UI, `applyOp`) and M2 Gantt (`src/engine/roadmaps/gantt.ts`, `ViewSettings.layout` `'table' | 'gantt'`). Mockup `roadmap-views-v7.html` is gitignored; this spec takes the parent's Matrix section as the picture. Calls marked **(my call)** are not the owner's.

## Why

The owner looks across a launch by place: the same piece of work in the UK, France and Singapore, with a rollup where a country was never planned. The table and the Gantt show the tree. They do not line the tree up against the fields that *are* the places. M3 adds that pivot, and the one write it needs: duplicate a country subtree, then set the new country's field with the bulk bar that already exists.

## Goals

- A **Matrix** layout over the issues already on the client. Switching to it never fetches.
- Rows are the issue tree, with an optional choice field as group headers. Columns are one or two choice fields. A cell is the top-most matching issues under that row, with descendants rolled in.
- Filters, sort, and collapse stay the ones the table and the Gantt already use.
- **Duplicate** on the table copies the selected issues and their subtrees (new keys, field values, no comments and no past events) so "add Singapore" is: select the UK rows, Duplicate, Set Country.

## Non-goals

- Checks, the agent, MCP tools, and roadmap-to-slide. Those are milestone 4.
- Editing a cell in place (status, assignee, dates, fields). The cell opens the issue. Changes happen in the panel or the table.
- Creating an issue from an empty cell, dragging on the matrix, or multi-select on the matrix.
- Multi-choice fields. A value that spans places is its own option ("Global"), as in the parent. Code does not treat any option name as special.
- Matching or grouping by title. The matrix never reads titles to decide a row, a column, or a cell.
- A second progress formula. Leaf weights stay the parent's: Done 1, In progress 0.25, anything else 0, Cancelled left out.
- Saved shared views, views across roadmaps, dependencies.

## Concepts

- **Row field.** An optional choice field (`matrix.rowField`). It groups the roots of the tree, the way table Group by groups the top of each tree. Children stay in the parent's group whatever their own value.
- **Column fields.** One or two choice fields (`matrix.cols`). A column is one option, or one pair of options. Text, number, date, and person are not axes.
- **Hit.** An issue that itself matches every filter chip. The same predicate as the table.
- **Top-most.** Among the hits in a row's subtree that match a column, those with no ancestor in that subtree that also matches that column. Everything under a top-most hit is rolled into it and is not a second entry in that cell **(parent)**.
- **Duplicate.** One op that copies live issues. New ids, new numbers, the same parent unless the parent is copied too. Comments and the old event log stay behind.

## Data

No new tables and no new columns. `duplicatedFrom` is a path on the `created` event, not a column.

`ViewSettings.layout` gains `'matrix'`. Old `?v=` blobs and localStorage blobs have no `matrix` key; `mergeView` fills the default below and leaves an unknown `layout` as `'table'`.

```ts
interface MatrixSettings {
  /** Choice field id, or null for no group headers. */
  rowField: string | null
  /** One or two choice field ids, in header order. Never includes rowField. */
  cols: string[]
  /** Options shown even when no hit carries them. */
  pins: { fieldId: string; optionId: string }[]
  show: { status: boolean; progress: boolean; dates: boolean; assignee: boolean }
}
```

Default **(my call)**: `rowField: null`, `cols: []`, `pins: []`, `show` status, progress, and dates on, assignee off. Stored on `ViewSettings.matrix` inside the same URL blob as chips and collapse. Table `groupBy` and `columns` are left untouched while the layout is matrix, and matrix settings are left untouched on the table and the Gantt.

`liveMatrix(defs, matrix)` drops a row field or column that is missing or not a choice, drops pins whose field or option is gone, and drops a column id equal to the row field. The stored blob can stay stale; the grid reads the live result. Same idea as `liveChips`.

## What is reused

| Already shipped | Matrix | Duplicate |
|---|---|---|
| Top bar, filter chips, `useViewSettings` | Third tab. Chips apply. No Gantt scale. | — |
| `tableRows` | Not the grid. Gantt keeps using it. | — |
| Chip match, dim ancestors, sort, `collapsed` | Same functions, so the rules cannot drift | — |
| `visibleRows` (filters ignore collapse) | Same helper, widened to this row shape | — |
| `progress`, `dateSpan` | Single-issue cells | — |
| `ProgressBar`, `StatusGlyph`, `keyOf` | Cell and the sticky title | — |
| Issue panel (`onOpenIssue`) | Cell click and title click | — |
| Bulk bar Set status / assignee / field / Delete | Hidden on the matrix | Duplicate sits beside them |
| `act` → optimistic `applyOp`, undo on refuse | Grid recomputes from the new issues | The op goes through `act` |

`tableRows` flattens a list. The matrix needs a column for every option combination and a cell that is not the row issue. That is `matrixGrid` in `src/engine/roadmaps/matrix.ts`. It calls the shared filter and sort, then pivots.

## Matrix

### The shape it is built for

Nothing forces this tree. Any other shape still pivots; fewer cells run across the columns.

Workstream Vendors, no Country, is the parent. Each country is a child with the same title and that country's option, and the tasks sit under the country. A new sub-issue already copies its parent's fields once (shipped), so those tasks also carry the country. The top-most rule is what stops those tasks becoming extra cells.

Worked grid, row field Workstream, one column field Country. Today `2026-11-10`.

- `U` "Underwriting", `{ws: vendors}`, no country.
  - `U-uk` "Underwriting", country UK, in progress, due `2027-02-01`.
    - `T1` "Send RFP", country UK, done.
    - `T2` "Chase", country UK, blocked, due `2026-01-01`.
  - `U-fr` "Underwriting", country France, to do.
  - `U-sg` "Underwriting", country Singapore, to do.

Group header "Vendors". Row `U`:

- UK: one issue, `U-uk`. `T1` and `T2` are under it, so they are not listed. Glyph is in progress. Quarter is `Q1 2027` (display due). Progress is the leaves: Done and Blocked → 0.5. `U-uk`'s own due is not before today, so no overdue line.
- France: one issue, `U-fr`. Progress 0 (a to-do leaf). Quarter omitted (no due).
- Singapore: the same for `U-sg`.

Expand `U`. Row `U-uk`'s UK cell is `U-uk` again (it is the top-most hit in its own subtree). France and Singapore on that row are dashes. Row `T1`'s UK cell is `T1` itself.

The group cell for UK is the union of the *root* rows' UK cells, here just `U-uk`. It is not the union of the expanded child rows.

### Rows

`matrixGrid` returns every group and issue the table would walk for the same chips, sort, and collapse flags, then attaches cells. `cells[i]` is column `cols[i]`.

- No row field: roots of the forest, then their children, at any depth.
- Row field set: bucket each **root** by that field's option. Header label is the option name (emoji in the header if the option has one). Roots with the field unset go in a last group labelled "Empty". Order of groups is the field's option order, not alphabetical **(my call)**. Table group headers stay alphabetical; this view does not change them.
- Sibling order inside a parent uses `view.sort` (the table's comparator, exported and shared).
- `open` comes from `view.collapsed`. One collapse set for table, Gantt, and matrix: opening a branch in one view opens it in the others.
- The component hides a row whose ancestor is collapsed, via `visibleRows`. When any chip is set, `visibleRows` already returns every walked row, so a match under a collapsed parent still appears. Cell *contents* do not depend on collapse either way.

Title column, sticky: chevron (same control as the table), depth indent of `w-4` per level, title, and `keyOf` in `text-ink-3`. A dim row uses the table's dim title treatment. Clicking the title opens the panel. The chevron only toggles collapse.

Group title column: option label and the count of issue rows under the group (the same count `tableRows` puts on a group). Group column-cells are below.

### Columns

Built from hits only (issues that themselves match the chips). A dim ancestor does not open a column with its own values.

- One field: an option is a column when a hit stores that option, or the option is pinned. Order is the field's option order.
- Two fields: a pair is a column when a hit stores both options. A pinned option is crossed with the *other* field's options that are either used by a hit or themselves pinned **(my call)**. Pinning Singapore when Card and Account are already in use shows Singapore × Card and Singapore × Account, including the empty pairs. It does not cross Singapore with every product nobody has used. Pinning Singapore when the other field has no used option and no pin shows no column yet; the pin stays saved and the Display section says, in one line, that the column appears once the other field has a value or a pin.
- A missing field value matches no column. That is the parent with no country. There is no Empty column.
- Pins still show while a filter is on, even if the filter leaves them empty **(my call)**.
- Header: emoji (if any) and option name. Two fields: second line is the other option. `aria` name is the two names joined.

The same field is not both the row field and a column. Picking it as a row removes it from `cols`.

### Cells

For row issue `R` and column `C`, candidates are hits in `R`'s subtree (including `R`) whose stored value for every column field equals `C`. Top-most candidates are the cell. Descendants of a top-most hit are not candidates, including descendants that fail the chips **(my call)**: the rollup is the subtree, so a status filter does not shrink progress once the top-most hit is chosen.

A non-hit is never a candidate. If the country parent fails the filter and a task under it is a hit for that column, the task is the cell. The dim parent row shows that task in the column.

Three shapes:

- **None.** An em dash. `aria-label` "Not planned here". Not a button. Toggles do not apply.
- **One.** The issue's `StatusGlyph`. Display due as a calendar quarter of `dateSpan(issues, id).due` (`Q1 2027`), UTC, the same end the Gantt bar uses. No quarter when that due is null. `ProgressBar` (the percent stays in its tooltip). Assignee avatar when the toggle is on and `assignee` is set. Slots with the toggle off are absent. If every toggle is off the cell is still a button **(my call)**.
- **Several.** The count of top-most issues, always. Progress and the quarter follow the toggles. The quarter is the latest display due among the top-most issues, one quarter, not a range **(my call)**. Assignee only when every top-most issue has the same assignee. Outline below.

**Worst state** looks at the top-most issues only, not every leaf **(my call)**. A blocked *task* under an in-progress country does not outline the country cell.

- One issue: the glyph carries status. Add a `bad` inset line when that issue is overdue. Overdue matches the date chip: own `due` is before `today`, and status is not Done or Cancelled. A parent whose only due is a rolled-up child span is not overdue. Blocked keeps the glyph; no second line.
- Several, and group cells: a `bad` inset line when any top-most issue is Blocked or overdue by that same rule. The bar does not turn green for Done. Colour stays status or a problem.

**Group cells** use that several-treatment without a count and without a click. Membership is the union of each root row's cell for that column, so collapsing a root does not change the group cell. Progress pools leaves under those ids (below), it is not the average of the child bars.

`progress` stays the one-id function. Add `progressUnder(issues, ids)` in `rollup.ts`: pool the same leaves `progress` would count under each id, skip an id that sits inside another id in the set, return null when every counted leaf is Cancelled. Many-cells and group cells call it. Do not "fix" the table's group header, which averages per-issue progress; that is outside M3.

### Click and keys

- One issue: `onOpenIssue`, the side panel, same as Enter on a table row.
- Several: a shadcn popover listing those issues only (glyph, key, title). Choosing one opens the panel. Escape closes the list.
- Dash and group cells: nothing.
- Arrow keys move a focused cell among the rows `visibleRows` left on screen. Enter does the click. The grid does not take `c`; New issue stays the top-bar button **(my call)**.

No in-cell editors.

### Display and empty

The Display popover on this layout keeps Sort and hides table Group by and table Columns, so there is one grouping control. A `MatrixDisplay` section (its own file) holds:

- Rows: None, then each choice field.
- Columns: two slots, choice fields, second optional, not the row field.
- For each column field, a checkbox per option, "Show when empty", bound to `pins`.
- Cell shows: Status, Progress, Dates, Assignee.

Copy when there is nothing to pivot, one sentence each, no field names baked in as vocabulary:

- No issues: the table's empty state (the screen already has one).
- Issues, but no choice field left after `liveMatrix`: "Add a choice field to line the work up in columns."
- Choice fields exist, none chosen as a column: "Choose a column field in Display."

### Worked filter

Chips: status is Blocked. The only hit in the example is `T2`.

- Rows on screen: `U` and `U-uk` dim, `T2` bright. `U-fr` and `U-sg` are absent (no hit under them).
- Columns: UK only, unless France or Singapore is pinned (those pinned columns are dashes).
- `U`'s UK cell is `T2`, not `U-uk`, because `U-uk` is not a hit. Progress is `T2` alone (Blocked → 0). The outline is `bad` because `T2` is Blocked.
- With the parent collapsed and the chip set, `visibleRows` still shows the branch. With the chip cleared, collapse hides `T2` and `U`'s UK cell goes back to `U-uk`.

## Duplicate

A table action **(parent)**. The control is on `BulkBar`, label "Duplicate", Lucide `Copy`, visible only when the table can edit and at least one row is selected. The matrix and the Gantt do not offer it.

### What the user does

Select the UK country issue (or the UK sub-issues). Duplicate. The copies sit as the next siblings of their sources, selected, so the existing "Set {field}" applies to them. Set Country to Singapore. The matrix, already holding every issue, shows the new column on the next paint. Set still clears the selection afterwards, as it does today.

### Op

```ts
{ op: 'duplicate'; copies: { id: string; sourceId: string }[] }
```

The client walks the live subtree of the selection, mints every new id with `newIssueId()` before `act`, and sends the whole map. The server does not invent ids. Optimistic rows and saved rows are the same ids.

`applyOp` rules, all or nothing, one `seq` bump, same as a multi-create:

1. Every `sourceId` in the *selection roots* is a live issue. A missing or deleted one refuses with "No such issue."
2. Roots are the selected ids whose ancestor is not also selected. A parent and its child produce one copy of the parent, with the child inside it, not a second copy **(my call)**.
3. The live subtree of those roots (deleted descendants omitted) must each have an id in `copies`. If a teammate added a child since the client built the map, refuse with "Duplicate needs a new id for each issue." Extra map entries that are not in that subtree are ignored. The client undoes the optimistic rows, as any refused op already does.
4. New ids are unique and unused. Otherwise "Each copy needs its own id." or "That issue already exists."
5. An empty `copies` refuses with "Select an issue to duplicate."
6. Place each new root immediately after its source, under the source's parent. Process roots in sibling order so the anchors stay put (`A, A', B, B'`). Children of a copy keep the source children's order under the new parent, new `sortKey`s from `siblingKey`.
7. `canParent` still runs. A copy under the same parent has the same depth as the source.

Each new issue copies title, status, assignee, start, due, and field values **(my call: status and dates are copied; Duplicate is a copy, and Set status is the way to start fresh)**. Title is unchanged, with no "copy" suffix, because the country rows share a title. `createdBy` / `createdAt` are the actor and `ctx.now`. `bodyRev` is 0. `deletedAt` is null. Numbers come from `nextNumber` in preorder, then `nextNumber` advances by the count.

One `created` event per new issue:

```ts
{ what: 'created', changes: [
  { path: 'title', from: null, to: title },
  { path: 'duplicatedFrom', from: null, to: sourceId },
]}
```

No `commented` events, and no copy of the source's event rows. The activity line does not need a new sentence in M3; it can keep rendering `created`.

### Body and comments

`Issue` has no body. `applyOp` does not pretend it does. Comments are not copied (the new row keeps `[]`).

The body text **is** copied **(my call)**: the description is part of the work being duplicated, and the parent only called out comments and events as left behind. `bodyRev` stays 0 so the first Save bases on 0.

Three writers, in the same transaction as the issue insert, after `applyOp`:

- `api/_lib/db-roadmaps.ts` `writeRoadmap`: `upsertIssue` must keep leaving `body` and `body_rev` alone on conflict. For this op only, a following statement sets `body` from the source row in the same roadmap. Inserts that default `body` to empty are not the result the client reads back.
- `tests/unit/fake-db-roadmaps.ts`: the same copy, so a store test can read the body.
- `src/app/roadmaps.ts` local `write`: the new stored issue gets the source `body` and `comments: []`.

`changed` issues still have no body. Merging them updates the issue row only and must not wipe a detail already loaded.

Opening a copy before the save commits: the panel shows title and properties from the optimistic row. `useIssueDetail` refetches when that issue's `seq` changes, and it does not remember a null detail, so the copied body arrives when the write lands **(my call)**.

## Instant

`matrixGrid` is a pure function of the roadmap state, the view, and today. No request on tab change, filter, sort, expand, pin, or cell-shows. Duplicate is optimistic through `act`: the new rows and, on the matrix, the new column appear before the response. A refused save drops the pending op and the screen returns, with the existing toast path (`said`).

## Agent and MCP

Not in M3. No new tool, no prompt line, no in-app chat path. The op exists in the engine so milestone 4 can send it; M4 is the milestone that wraps it. Until then an agent has no duplicate tool and cannot set `layout`.

## Milestone boundary

In: matrix grid, matrix view settings, Display controls, the tab, cell open, row collapse, Duplicate on the table, body copy in the three writers, unit tests, one browser test.

Out: checks tab, MCP, chat on a roadmap, timeline slide, in-cell edit, create-from-dash, matrix multi-select, column virtualisation, a new activity sentence, changing table group progress.

## Where the code goes

Engine, framework-free:

- `src/engine/roadmaps/matrix.ts` — grid, quarters, `liveMatrix`.
- `src/engine/roadmaps/rollup.ts` — `progressUnder`.
- `src/engine/roadmaps/view.ts` — `layout`, `MatrixSettings`, shared match and sort exports. `tableRows` calls those exports.
- `src/engine/roadmaps/ops.ts` — the `duplicate` op.

App (`src/app/components/roadmap/`, shadcn, no file over ~300 lines):

- `Matrix.tsx` — scroll, sticky title and header, key handling, `visibleRows`.
- `MatrixCell.tsx` — dash, one, several, group.
- `MatrixPicker.tsx` — the several-issue popover.
- `MatrixDisplay.tsx` — the Display section.
- `TopBar.tsx`, `DisplayMenu.tsx`, `RoadmapScreen.tsx`, `BulkBar.tsx`, `IssueTable.tsx` — tab, branch, button, id map, selection.
- `issueTableView.tsx` — `visibleRows` takes this row shape.
- `useViewSettings.ts` — default `matrix`.
- `useIssueDetail.ts` — refetch on `seq`.

Writers: `api/_lib/db-roadmaps.ts`, `tests/unit/fake-db-roadmaps.ts`, `src/app/roadmaps.ts`.

Tests: `tests/unit/roadmap-matrix.test.ts`, cases added to `tests/unit/roadmap-ops.test.ts`, `tests/browser/roadmap-matrix.spec.ts` next to `roadmap.spec.ts`.

## Global constraints

- TypeScript strict. No `any`.
- No inline styles. Dynamic columns are a `<table>` with `min-w-[148px]` on each column and horizontal scroll on the wrapper, title column `sticky left-0`, header row sticky. No CSS-variable width on the element.
- App tokens already in the roadmap UI: `ink`, `ink-2`, `ink-3`, `line`, `bad`, `panel`, `raise`. The overdue line is `bad`. The progress bar stays the shared component (`fill-ink-2`).
- shadcn `Popover`, `Button`, `Command` for the picker and the menus. Checkboxes in Display follow the native checkbox the table Display already uses.
- Split before a file passes ~300 lines. `MatrixDisplay` exists so `DisplayMenu` does not grow into the pivot controls.
- `slides.css` and `components.css` stay out of this. The matrix is app chrome.
- Row virtualisation uses the table's `VIRT` threshold. Column virtualisation is out **(my call)**; a choice field holds at most `MAX_OPTIONS` (100), and only pairs that occur or are pinned are columns.

## Review focus

1. **Top-most vs copied fields.** Tasks under a country carry the country's option, so a naive "every match" walk paints one cell per task. Test: the worked example, UK under `U` is only `U-uk`; expand to `T1` and that row's UK cell is `T1`; `T1` is absent from `U`'s id list.
2. **Dim filter vs column.** A blocked task must show on the dim ancestor's cell, and a dim parent with no country must not invent a column. Test: the worked filter (rows, the UK id is `T2`, France hidden, pinned France is a dash). Also a chip that the parent fails and the country issue passes: the cell id is the country issue, and progress still counts a child the chip excludes.
3. **Duplicate once, with a body, without history.** Selecting a parent and its child copies the child once. Comments stay `[]`, source events are absent, one `created` event carries `duplicatedFrom`, the body equals the source, `bodyRev` is 0. Test the op and the fake-db writer. Test the race: a live child missing from the map refuses and leaves the previous state.
4. **Rollup is a leaf pool.** Two top-most issues, one with two Done leaves and one with a single To do, are not 50%. `progressUnder` is 2/3. Group UK progress in the worked example is 0.5, and it stays 0.5 when `U` is collapsed. Overdue uses own `due`: `U` with only a rolled due gets the quarter and no `bad` line.
5. **Columns stay the combinations that exist.** Two fields do not emit the full cartesian product. A deleted option disappears through `liveMatrix` without a throw. The row field cannot also be a column. A filter hides an unused country and a pin brings that empty column back.

## Interfaces

Shared from `view.ts` (table and matrix both call these; `tableRows` stops using private copies):

```ts
export function matchesChips(issue: Issue, chips: Chip[], today: string): boolean
export function sortIssues(list: Issue[], sort: ViewSettings['sort']): Issue[]

export interface MatrixSettings {
  rowField: string | null
  cols: string[]
  pins: { fieldId: string; optionId: string }[]
  show: { status: boolean; progress: boolean; dates: boolean; assignee: boolean }
}

export interface ViewSettings {
  // …chips, groupBy, sort, columns, collapsed, scale unchanged
  layout: 'table' | 'gantt' | 'matrix'
  matrix: MatrixSettings
}
```

`rollup.ts`:

```ts
/** Leaf pool under ids. An id inside another id in the set is skipped. */
export function progressUnder(issues: Issue[], ids: string[]): number | null
```

`matrix.ts`:

```ts
export interface MatrixCol {
  key: string
  parts: { fieldId: string; optionId: string; name: string; emoji?: string }[]
}

export type MatrixCell =
  | { kind: 'empty' }
  | { kind: 'one'; issueId: string }
  | { kind: 'many'; issueIds: string[] }

export interface MatrixGroupCell {
  issueIds: string[]
  progress: number | null
  worst: boolean
}

export type MatrixRow =
  | { kind: 'group'; key: string; label: string; count: number; cells: MatrixGroupCell[] }
  | { kind: 'issue'; issue: Issue; depth: number; dim: boolean; hasChildren: boolean; open: boolean; cells: MatrixCell[] }

export function liveMatrix(defs: FieldDef[], matrix: MatrixSettings): MatrixSettings
export function dueQuarter(iso: string): string // "Q1 2027"
export function matrixGrid(state: RoadmapState, view: ViewSettings, today: string): { cols: MatrixCol[]; rows: MatrixRow[] }
```

`worst` on a one-issue cell is derived in the UI from the issue (overdue or not); the engine cell stays the id. Group cells carry `worst` because they have no single issue. Many-cells: the UI computes `worst` from `issueIds` with the same helper the group uses, exported next to the grid:

```ts
export function cellWorst(issues: Issue[], ids: string[], today: string): boolean
```

`ops.ts`:

```ts
| { op: 'duplicate'; copies: { id: string; sourceId: string }[] }
```

`applyOp` return shape is unchanged: `state`, `changed`, `events`, or `{ refused: string }`.

`visibleRows` accepts any row with `kind`, and for issues `depth`, `open`, `hasChildren`. Matrix rows qualify.

App components, props in the same style as `IssueTable` / `Gantt`:

```ts
interface MatrixProps {
  state: RoadmapState
  view: ViewSettings
  members: MemberLite[]
  today: string
  onView: (v: ViewSettings | ((prev: ViewSettings) => ViewSettings)) => void
  onOpenIssue?: (id: string) => void
}
```

`BulkBar` gains `onDuplicate: () => void`. `IssueTable` builds the id map, calls `act`, and on `'ok'` sets the selection to every new id.

## Tests

Unit (`roadmap-matrix.test.ts`): the worked grid, the blocked filter, pin crossing, `liveMatrix` drops, `progressUnder`, `dueQuarter`, collapse does not change ids.

Unit (`roadmap-ops.test.ts`): subtree dedupe, sibling order, numbers, events, refusal sentences, body on the fake db, comments empty.

Browser: from the roadmap helper, make the worked tree, open Matrix, see UK / France / Singapore on the parent row, open `U-uk` from the UK cell, switch to the table, duplicate that row, set the country field, return to the matrix and see the issue in the new column. Duplicate stays off the matrix toolbar.

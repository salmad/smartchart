# Roadmaps M2: Gantt — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A roadmap gains a Gantt tab: the table's rows (same nesting, grouping, filters) beside a timeline at Week, Month or Quarter scale, where every dated issue is a bar, a parent is a bracket and a one-day issue is a milestone diamond, and dates change by dragging.

**Architecture:** One pure module, `src/engine/roadmaps/gantt.ts`, owns the date maths: the visible range, the scale's ticks, each row's mark (bar, bracket, milestone, none) with its alert and label, and what a drag does to dates. The app draws it: rows come from the existing `tableRows` + `visibleRows`, so filters, grouping and collapse behave exactly as in the table. Every date change is one existing `set` op through the existing `act`, so optimistic writes, undo-on-failure, live updates and the event log come free. Nothing new on the server.

**Tech Stack:** React 18 + TypeScript strict, Tailwind + shadcn/ui, lucide, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-09-roadmaps-design.md` (M2 = "Gantt", section "Views → 2. Gantt"; "Rollups and dates"). Layout cue: the Gantt section of `.superpowers/brainstorm/37137-1794152840/content/roadmap-views-v6.html` (left list 330px, 30px scale row, gold Today line with a date tag, brackets, diamond). Where the mockup and the spec differ, the spec wins: no progress fill and no percentage on bars.

## Global Constraints

- Everything in M1's Global Constraints still holds (no `any`, no inline styles, files under ~300 lines, shadcn, lucide, app tokens `app-bg`, `panel`, `raise`, `line`, `ink`, `ink-2`, `ink-3`, `ok`, `gold`, `bad`).
- Timeline marks, grid and Today line are SVG, positioned by SVG attributes (`x`, `width`, `d`), never by `style`. Colours come from Tailwind classes on the SVG elements (`fill-ok`, `stroke-bad`).
- Scale: `week`, `month`, `quarter`, shown "Week", "Month", "Quarter". Pixels per day: week 28, month 6, quarter 2.
- Colour: neutral bars; Done fills `ok`; Blocked or overdue outlined `bad`. Nothing else is coloured. Today line `gold`. No percentage labels.
- Labels only for: overdue (`Overdue 9 days`), blocked (`Blocked`), both (`Overdue 9 days · blocked`), and milestones (`UK launch · 1 Apr`). Dates in labels use `shortDate` from `src/app/components/roadmap/dates.ts`.
- Overdue: `due < today` and status not `done` or `cancelled` (same rule as the table's `dates: overdue` chip).
- Dates are ISO days, maths in UTC (`Date.UTC`), never local time.
- Each drag is one `{ op: 'set', ids: [id], props: { start, due } }`: one event. A drag that changes nothing sends nothing.
- A new date range from a drop is 14 days (start + 13), one constant `DROP_DAYS`.
- Switching Table and Gantt, scale, Today and scrolling never call the server.

## Review Focus

1. **A click is not a drag.** Pointer down and up on a bar within 3px opens the issue panel and sends no op. Test in Task 4.
2. **Dragging an end past the other end.** Start dragged beyond due stops at due (a one-day bar, which reads as a milestone); never refused with "Start must be before due." Test in Task 1 (`dragDates`) and Task 4.
3. **A failed save during a drag.** The bar lands at the new dates at once; when the save fails it returns to the old dates and the store's sentence shows (M1's undo path). Test in Task 4 (fake offline as M1's failed-save test does).
4. **A parent with no dates of its own.** Draws a bracket over its children's span, cannot be dragged (hover title "Dates come from its sub-issues."), and moves the moment a child is dragged. Tests in Task 1 and Task 3.
5. **Dates far from today, or none at all.** An issue two years out widens the range to include it; a roadmap with no dated issues still shows a timeline around today and every row reads "No dates". Tests in Task 1 and Task 3.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/engine/roadmaps/gantt.ts` | day maths, `Scale`, range, ticks, `markFor`, `dragDates`, `dropDates` |
| `src/engine/roadmaps/view.ts` | `ViewSettings` gains `layout` and `scale` |
| `src/app/components/roadmap/useViewSettings.ts` | `mergeView` defaults for the two new keys |
| `src/app/components/roadmap/TopBar.tsx` | Table / Gantt tabs; Gantt's controls when on Gantt |
| `src/app/components/roadmap/GanttControls.tsx` | Week / Month / Quarter segmented control, Today button |
| `src/app/components/roadmap/Gantt.tsx` | the two-pane view: one scroll box, sticky list column and scale row, virtualised rows |
| `src/app/components/roadmap/GanttList.tsx` | left rows: twisty, status glyph, title, "No dates", group rows; dateless rows draggable |
| `src/app/components/roadmap/GanttTimeline.tsx` | scale header, grid, Today line, one lane per row with its mark and label (SVG) |
| `src/app/components/roadmap/useBarDrag.ts` | pointer drag of a bar or its ends, preview, commit one op |
| `src/app/components/roadmap/RoadmapScreen.tsx` | render `Gantt` instead of `IssueTable` when `layout === 'gantt'` |
| `tests/unit/roadmap-gantt.test.ts` | engine tests |
| `tests/browser/roadmap-gantt.spec.ts` | the Gantt browser test (reuses `openFreshRoadmap`/`seedSixIssues`: move them to `tests/browser/roadmap-helpers.ts`) |

---

### Task 1: Gantt engine

**Files:**
- Create: `src/engine/roadmaps/gantt.ts`
- Test: `tests/unit/roadmap-gantt.test.ts`

**Interfaces:**
- Consumes: `Issue`, `Status` from `types.ts`; `dateSpan` from `rollup.ts`; `buildIndex` from `index.ts`.
- Produces:
  ```ts
  export type Scale = 'week' | 'month' | 'quarter'
  export const SCALES: readonly Scale[]
  export const SCALE_LABEL: Record<Scale, string>
  export const PX_PER_DAY: Record<Scale, number>       // 28, 6, 2
  export const DROP_DAYS = 14
  export function addDays(iso: string, n: number): string
  export function daysBetween(a: string, b: string): number   // b - a, whole days
  export interface Range { from: string; to: string }          // inclusive days
  export function ganttRange(issues: Issue[], today: string, scale: Scale): Range
  export interface Tick { iso: string; label: string; x: number } // x in px from range.from
  export function ticks(range: Range, scale: Scale, today: string): Tick[]
  export type Mark =
    | { kind: 'bar'; start: string; due: string; done: boolean; alert: boolean; label: string | null }
    | { kind: 'bracket'; start: string; due: string; own: boolean; alert: boolean; label: string | null }
    | { kind: 'milestone'; day: string; done: boolean; alert: boolean; label: string }
    | { kind: 'none' }
  export function markFor(issues: Issue[], id: string, today: string, fmt: (iso: string) => string): Mark
  export type DragMode = 'move' | 'start' | 'end'
  export function dragDates(start: string, due: string, mode: DragMode, days: number): { start: string; due: string }
  export function dropDates(day: string): { start: string; due: string }
  ```

- [ ] **Step 1: Write the failing tests** in `tests/unit/roadmap-gantt.test.ts`, building issues with M1's test helper style (`issue({ id, parentId, start, due, status })`):
  - `addDays('2026-12-30', 3)` is `'2027-01-02'`; `addDays('2026-03-28', 2)` is `'2026-03-30'` (across a DST change); `daysBetween('2026-11-01', '2026-11-09')` is `8`.
  - `ganttRange` with no dated issues and today `2026-11-09`, `month`: `from` is `'2026-10-01'`, `to` is `'2027-05-31'` (one month before today's month, six after, snapped to month starts/ends). With an issue due `2028-11-20`: `to` is `'2028-12-31'` (latest date's month + 1, snapped). Week snaps to Mondays/Sundays (one week before, then eight after); quarter to quarter starts/ends (one before, three after).
  - `ticks(range, 'month', today)`: first tick `{ iso: '2026-10-01', label: 'Oct', x: 0 }`; the January tick reads `Jan '27` when today is 2026; `x` of the November tick is `31 * 6`. Week labels are the Monday's `2 Nov`; quarter labels `Q1 '27` style (`Q4` inside today's year).
  - `markFor`: leaf with start and due → `bar`; leaf with `start === due` → `milestone` with label `'UK launch · 1 Apr'` (pass `fmt` returning `'1 Apr'`); a leaf with only one date → `milestone` on that day; parent with no own dates and dated children → `bracket` with `own: false` spanning the children; parent with own dates → `bracket` with `own: true` and its own dates; nothing dated anywhere below → `none`.
  - Alerts: `due` before today and status `todo` → `alert: true`, label `'Overdue 9 days'`; status `blocked` with future due → `'Blocked'`; both → `'Overdue 9 days · blocked'`; status `done` with past due → `alert: false`, `done: true`, label `null`; `cancelled` past due → no alert.
  - `dragDates('2026-11-02','2026-11-10','move', 3)` → `{ start: '2026-11-05', due: '2026-11-13' }`; `'start', 20` → `{ start: '2026-11-10', due: '2026-11-10' }` (clamped, never past due); `'end', -20` → `{ start: '2026-11-02', due: '2026-11-02' }`.
  - `dropDates('2026-11-09')` → `{ start: '2026-11-09', due: '2026-11-22' }`.

- [ ] **Step 2: Run to see them fail**

  Run: `npx vitest run tests/unit/roadmap-gantt.test.ts`
  Expected: FAIL, cannot resolve `gantt`.

- [ ] **Step 3: Implement `src/engine/roadmaps/gantt.ts`** to the signatures above. Parse ISO days with `Date.UTC`; format back with `getUTC*`. `markFor` uses `buildIndex(issues).children(id).length` to tell a parent from a leaf and `dateSpan` for a parent without both own dates. Bracket alert follows its own status and own due only (children carry their own alerts). Export the module from wherever M1 re-exports engine modules, if it does.

- [ ] **Step 4: Run to see them pass**

  Run: `npx vitest run tests/unit/roadmap-gantt.test.ts`
  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add src/engine/roadmaps/gantt.ts tests/unit/roadmap-gantt.test.ts
  git commit -m "Roadmaps: Gantt engine (range, ticks, marks, drag dates)."
  ```

### Task 2: Table / Gantt tabs and scale in the view settings

**Files:**
- Modify: `src/engine/roadmaps/view.ts` (`ViewSettings`, `DEFAULT_VIEW`)
- Modify: `src/app/components/roadmap/useViewSettings.ts` (`mergeView`)
- Modify: `src/app/components/roadmap/TopBar.tsx`
- Create: `src/app/components/roadmap/GanttControls.tsx`
- Modify: `src/app/components/roadmap/RoadmapScreen.tsx`
- Create: `tests/browser/roadmap-helpers.ts` (move `openFreshRoadmap`, `seedSixIssues`, `EMPTY`, `ROADMAPS_KEY` out of `roadmap.spec.ts`; `seedSixIssues` takes optional `over: Record<string, { start?: string; due?: string; status?: string }>` keyed by issue id)
- Test: `tests/browser/roadmap-gantt.spec.ts`

**Interfaces:**
- Consumes: `Scale`, `SCALES`, `SCALE_LABEL` (Task 1).
- Produces: `ViewSettings` gains `layout: 'table' | 'gantt'` (default `'table'`) and `scale: Scale` (default `'month'`). `GanttControls({ scale, onScale, onToday }: { scale: Scale; onScale: (s: Scale) => void; onToday: () => void })`. `TopBar` gains `onToday?: () => void`. `RoadmapScreen` holds a `todayRequest` counter bumped by Today and passed to `Gantt` (Task 3) as `todayRequest: number`.

- [ ] **Step 1: Write the failing browser test** `'switches to Gantt and keeps it after reload'`: open a fresh roadmap, seed six issues, reload; click the `Gantt` tab in the `Roadmap views` navigation; expect it `aria-pressed="true"`, a `region` named `Timeline` visible, the `Month` radio checked in a `radiogroup` named `Scale`; click `Quarter`; reload; expect Gantt still on and `Quarter` checked; click `Table`; expect a `columnheader` named `Status`.

- [ ] **Step 2: Run to see it fail**

  Run: `npm run test:browser -- tests/browser/roadmap-gantt.spec.ts`
  Expected: FAIL, no `Gantt` button.

- [ ] **Step 3: Implement.** `mergeView` fills `layout` and `scale` from `DEFAULT_VIEW` when missing (old saved views keep working). `TopBar`'s tabs become two buttons with `aria-pressed`, the same look as the M1 tab. When `layout === 'gantt'`, `GanttControls` sits after the tabs: a shadcn `ToggleGroup` (`type="single"`, `aria-label="Scale"`, add it with `npx shadcn@latest add toggle-group` if absent) and a ghost `Today` button. `RoadmapScreen` renders a placeholder `<section aria-label="Timeline">` for Gantt until Task 3 replaces it; the filter row shows in both layouts.

- [ ] **Step 4: Run to see it pass**, plus M1's suite to prove the move of helpers broke nothing.

  Run: `npm run test:browser -- tests/browser/roadmap-gantt.spec.ts tests/browser/roadmap.spec.ts`
  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add -A src/engine/roadmaps/view.ts src/app/components/roadmap tests/browser
  git commit -m "Roadmaps: Table and Gantt tabs, scale and Today in the view."
  ```

### Task 3: Gantt — reading

**Files:**
- Create: `src/app/components/roadmap/Gantt.tsx`, `GanttList.tsx`, `GanttTimeline.tsx`
- Modify: `src/app/components/roadmap/RoadmapScreen.tsx` (replace the placeholder)
- Test: `tests/browser/roadmap-gantt.spec.ts`

**Interfaces:**
- Consumes: `tableRows` (view.ts), `visibleRows`, `rowSlice`, `OVERSCAN` (issueTableView.tsx); `ganttRange`, `ticks`, `markFor`, `PX_PER_DAY`, `daysBetween` (Task 1); `StatusGlyph`; `shortDate`.
- Produces: `Gantt({ state, view, today, onView, canEdit, act, onOpenIssue, todayRequest }: { state: RoadmapState; view: ViewSettings; today: string; onView: …same as IssueTable…; canEdit: boolean; act: (op: RoadmapOp) => 'ok' | string; onOpenIssue?: (id: string) => void; todayRequest: number })`. `GanttTimeline` renders lanes for `rows` given `range`, `scale`, `today`, and a `markOf(id) => Mark`; it exposes `xOf(iso) => number` and `dayAt(x) => string` via a small object Task 4 and 5 use: `export interface Axis { from: string; px: number; xOf(iso: string): number; dayAt(x: number): string }` exported from `GanttTimeline.tsx`.

- [ ] **Step 1: Write the failing browser test** `'draws bars, a bracket, a milestone and alert labels'`: seed with `i_done` 2026-10-01→2026-10-20 done, `i_blk` start 2026-10-05 due yesterday (computed in the test) blocked, `i_fr_a` start = due = 2027-04-01, `i_fr_b` no dates; reload; open Gantt. Expect (by `data-mark` attributes on lane elements, `data-issue` = issue id):
  - `i_uk` has `data-mark="bracket"`; `i_done` `data-mark="bar"` with `data-done="true"`; `i_blk` `data-alert="true"` and the lane's text `Overdue 1 day · blocked`; `i_fr_a` `data-mark="milestone"` with text `France task A · 1 Apr`; `i_fr_b`'s list row contains `No dates`.
  - The `Today` line (`role="separator"`, `aria-label` today's `shortDate`) is visible and the scroll box has scrolled so it is in view.
  - Collapse `UK launch` with its twisty: its children's lanes are gone in Gantt and stay collapsed after switching to Table.
  - Add a filter chip `Status is Blocked`: `UK launch` shows dimmed (`data-dim="true"`) with `Blocked piece` under it.
  - Clicking the `Shipped piece` bar opens the `Issue panel`.

- [ ] **Step 2: Run to see it fail.** Run: `npm run test:browser -- tests/browser/roadmap-gantt.spec.ts`. Expected: FAIL, no lanes.

- [ ] **Step 3: Implement.**
  - `Gantt`: one scroll container (both axes). Inside, a CSS grid `grid-cols-[330px_1fr]`; the list column is `sticky left-0 z-10 bg-app-bg`; the scale row is `sticky top-0`. Rows are 32px; above `VIRT` rows render only `rowSlice` (with padding rows top and bottom), the same windowing as the table. Rows = `visibleRows(tableRows(state, view, today), view.chips.length > 0)`; memoise marks per row id with `useMemo` on `state.issues` and `today`.
  - On mount and whenever `todayRequest` changes, set `scrollLeft` so today sits at a quarter of the visible width.
  - `GanttList`: group rows (`bg-panel`, label, count) and issue rows (indent 20px per depth, twisty when `hasChildren` toggling `view.collapsed`, `StatusGlyph`, title, muted `No dates` when the mark is `none`, `opacity-50` when `dim`). Click opens the panel.
  - `GanttTimeline`: an `<svg>` per lane (width = range days × px, height 32). Bar: rect `y=9 h=14 rx=4`, fill `ink/10` stroke `ink/15`; `done` fill `ok` at 0.6; `alert` stroke `bad`. Bracket: a path 8px high with no bottom edge, stroke `ink-3` (`ink-2` when `own`); `alert` stroke `bad`. Milestone: 11px square rotated 45°, fill `ink` (`ok` when done; `bad` stroke when alert). Label text 11.5px `ink-2` (alerts `bad`) starting 6px after the mark. Group lanes: a bracket over the group's tops' span. Grid: a 1px `line` line at each tick; weekend shading only on Week (`panel`). Today: 1px `gold` line with a tag showing `shortDate(today)`. Colours come from Tailwind classes on SVG (`className="fill-ok stroke-bad"`), not literals.

- [ ] **Step 4: Run to see it pass.** Same command. Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add src/app/components/roadmap tests/browser/roadmap-gantt.spec.ts
  git commit -m "Roadmaps: Gantt rows, bars, brackets, milestones and Today."
  ```

### Task 4: Drag a bar or its ends

**Files:**
- Create: `src/app/components/roadmap/useBarDrag.ts`
- Modify: `src/app/components/roadmap/GanttTimeline.tsx`
- Test: `tests/browser/roadmap-gantt.spec.ts`

**Interfaces:**
- Consumes: `dragDates`, `DragMode` (Task 1); `Axis` (Task 3); `act`.
- Produces: `useBarDrag({ axis, canEdit, act, onOpen }: { axis: Axis; canEdit: boolean; act: (op: RoadmapOp) => 'ok' | string; onOpen: (id: string) => void })` returning `{ preview: { id: string; start: string; due: string } | null; handlers(id: string, start: string, due: string, mode: DragMode): { onPointerDown: (e: PointerEvent) => void } }`.

- [ ] **Step 1: Write the failing browser test** `'drags a bar, its end, and a click still opens'`, on Month (6px/day): seed `i_fr_b` 2026-12-01→2026-12-10; drag the bar body 60px right with `page.mouse` (down, move in 5 steps, up): switch to Table, its Start reads `11 Dec` and Due `20 Dec`; back on Gantt drag the right end (last 6px of the bar) 30px left: Due reads `15 Dec`, Start unchanged; drag the left end 300px right: Start and Due both `15 Dec` and the mark becomes a milestone. Open the issue panel's activity: one `set` event per drag (three lines, not more). Press, move 2px, release on the bar: the Issue panel opens and no new activity line appears. Then the offline case, as M1's failed-save test sets it up: drag again; the bar lands, then returns to `15 Dec` and the sentence shows. As a viewer (M1's viewer setup, if present; else `canEdit=false` unit-level check in Step 3): bars have no `cursor-grab` and pointer down opens the panel only.

- [ ] **Step 2: Run to see it fail.** Expected: FAIL, dates unchanged.

- [ ] **Step 3: Implement `useBarDrag`.** Pointer capture on down; mode from the hit zone (first and last 6px of a bar are `start`/`end`, the rest `move`; a milestone only `move`; a bracket with `own: false` none, with title `Dates come from its sub-issues.`). Days moved = `Math.round(dx / axis.px)`. Under 3px total movement on up → `onOpen(id)`, no op. Otherwise show `preview` while moving (the lane draws the preview dates), and on up send one `set` with both dates if either changed; a refused result shows through `toast` like the table's refusals. `Escape` during a drag drops the preview and sends nothing. Cursor `ew-resize` on ends, `grab`/`grabbing` on the body.

- [ ] **Step 4: Run to see it pass.** Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add src/app/components/roadmap tests/browser/roadmap-gantt.spec.ts
  git commit -m "Roadmaps: drag a Gantt bar or its ends, one event per drag."
  ```

### Task 5: Give dates by dragging an issue onto the timeline

**Files:**
- Modify: `src/app/components/roadmap/GanttList.tsx`, `GanttTimeline.tsx`
- Test: `tests/browser/roadmap-gantt.spec.ts`

**Interfaces:**
- Consumes: `dropDates`, `DROP_DAYS` (Task 1); `Axis.dayAt` (Task 3).
- Produces: nothing new for later tasks.

- [ ] **Step 1: Write the failing browser test** `'drops a dateless issue onto the timeline'`: seed `i_fr_b` with no dates; open Gantt; drag its list row (`dragTo`) onto the timeline at the x of `2026-12-07` (read the Dec tick's box and add 6×6px); Table shows Start `7 Dec`, Due `20 Dec`. Hovering the empty lane of a dateless row shows `Drag the issue here to give it dates`. A row with dates is not draggable from the list (`draggable` false).

- [ ] **Step 2: Run to see it fail.** Expected: FAIL.

- [ ] **Step 3: Implement.** Dateless issue rows in `GanttList` are `draggable` (editors only) with MIME `application/x-occam-issue-dates` and the issue id; the timeline's lanes accept that MIME on `dragover`, show a ghost of `DROP_DAYS` at the pointer's day, and on `drop` send one `set` with `dropDates(axis.dayAt(x))`. Parents without own dates are draggable too (they get own dates; their bracket becomes `own`).

- [ ] **Step 4: Run to see it pass.** Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add src/app/components/roadmap tests/browser/roadmap-gantt.spec.ts
  git commit -m "Roadmaps: drag a dateless issue onto the Gantt to give it dates."
  ```

### Task 6: Whole check

- [ ] `npm test`, `npm run build`, `npm run test:browser` pass (lint shows no new problems over the 11 already on main).
- [ ] With M1's 2,000-issue seed helper, dated across a year: Gantt opens in under 1 s from the kept copy, vertical and horizontal scrolling stay smooth, a bar drag tracks the pointer every frame, switching Table ↔ Gantt has no visible wait.
- [ ] Capture Gantt at 1440 wide with M1's apple-bar capture hook on Week, Month and Quarter; look at each at full size for collisions (labels over the next bar, Today tag over the scale text, brackets over milestones) and fix them in the components. Append the critique to `docs/temp/apple-bar-review.md`.
- [ ] Commit fixes: `git commit -m "Roadmaps M2: checked end to end."`

---

## Self-review notes

- Spec coverage: scales and Today (Tasks 2–3); same rows, nesting, grouping, filters (Task 3 reuses `tableRows`); bar per dated issue, bracket for parents, no percentages, labels only for overdue/blocked/milestones (Tasks 1, 3); drag move and ends, drag a dateless issue on, one event per drag (Tasks 4–5); colours (Task 3); milestone = start equals due (Task 1); parent span not written back (Task 1 `markFor` reads only); instant (every change is the existing optimistic `set`).
- My calls, flagged for the owner: a leaf with only one date draws as a milestone on that day; dropped dates last 14 days; derived brackets aren't draggable; a group row draws a bracket over its issues' span (as the mockup); px per day 28/6/2 with horizontal scroll rather than fit-to-width.

# Roadmap Sprints and Sprint View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Repeating sprints on a roadmap (Linear-style), a way to put an issue in a sprint, Linear-style rollover of unfinished work, and a fifth roadmap layout, **Sprint**, listing the current sprint's open leaf tasks grouped by assignee with the viewer first.

**Architecture:** Sprint maths and the Sprint view's rows are pure engine code (`src/engine/roadmaps/sprints.ts`, `sprintView.ts`). The issue's sprint is a new `set` prop. The rhythm goes through the `roadmap` op, and rollover is a new engine op. The API runs rollover on the first access after a sprint ends. The UI adds one layout component and a picker built from existing parts.

**Tech Stack:** React 18 + TS strict, Vite, Tailwind + shadcn/ui, lucide, vitest, Playwright, Postgres via `api/_lib/db.ts`.

**Spec:** `docs/superpowers/specs/2026-11-17-roadmaps-sprint-view-design.md` (read it first; it wins over this plan where they differ).

## Global Constraints

- Read `CLAUDE.md` first. No `any`, no inline styles. Reuse the app's parts (`components/ui`, the roadmap's `MenuParts`, `PropertyPick`, `StatusGlyph`, `GroupLabel`, `Avatar`, `ToolButton`) unchanged; never copy class strings.
- Chrome stays silent: an empty value draws nothing (no dashes).
- User-facing product name is "Occam". The system user that rollover writes as has id `occam` and shows as "Occam".
- `today` is the UTC ISO date (`new Date().toISOString().slice(0, 10)`), on the server and in the app, as `RoadmapScreen` already does.
- Sprint length: integer weeks 1–8. `Issue.sprint` stores the **start date** of the sprint, never a number.
- Rollover moves only status `todo`, `in_progress`, `blocked`. Backlog, Done and Cancelled stay.
- Nothing can be put in a sprint that has ended. Refusal copy: `That sprint has ended.` Without a rhythm: `Sprints aren't set up for this roadmap.`
- **Do not commit.** The working tree already holds unrelated, uncommitted roadmap work in some of these same files; leave everything uncommitted for the owner to review. Never revert or reformat code you didn't write.

## Review Focus

- **Rhythm starting in the future:** before `start` there is no current sprint. The view shows "Sprint 1 starts 23 Nov" with nothing listed, the picker offers Sprint 1 onwards, and rollover does nothing. Test in Task 1 and Task 4.
- **Viewer opens the roadmap after a sprint ends:** rollover still runs (it writes as `occam`, not as the reader), and runs once when two loads race. Test in Task 3.
- **Issue whose only sub-issues are deleted:** it counts as a leaf. Test in Task 4.
- **Rhythm changed or removed:** a stored date falls into whichever new sprint contains it. With the rhythm removed, sprint pickers and the column hide, values stay, rollover stops. Test in Tasks 1 and 3.
- **Assignee who left the workspace:** their group still shows, labelled the way the table already labels a missing member. Test in Task 4.

---

### Task 1: Sprint maths and types

**Files:**
- Modify: `src/engine/roadmaps/types.ts` (add `SprintRhythm`, `Roadmap.sprints`, `Issue.sprint`, `Issue.carried`)
- Create: `src/engine/roadmaps/sprints.ts`; export from `src/engine/roadmaps/index.ts`
- Test: `tests/unit/roadmap-sprints.test.ts`; update `tests/unit/roadmap-builders.ts` defaults (`sprint: null, carried: 0`, `sprints: null`)

**Interfaces (produces):**
```ts
export interface SprintRhythm { start: string; weeks: number; rolled: string | null }
// Roadmap: sprints: SprintRhythm | null      Issue: sprint: string | null; carried: number
export interface Sprint { n: number; start: string; end: string } // end = last day, inclusive
export const MAX_SPRINT_WEEKS = 8
export function checkRhythm(r: { start: string; weeks: number }): 'ok' | string
export function sprintOf(r: SprintRhythm, date: string): Sprint | null      // null before r.start
export function sprintAt(r: SprintRhythm, n: number): Sprint | null          // n >= 1
export function currentSprint(r: SprintRhythm, today: string): Sprint | null
export function nextSprint(r: SprintRhythm, today: string): Sprint             // current+1, or Sprint 1 when before start
export function sprintEnded(r: SprintRhythm, date: string, today: string): boolean
export function sprintLabel(s: Sprint): string                               // "Sprint 14"
```

- [x] **Step 1: Write failing tests** — with `r = { start: '2026-11-02', weeks: 2, rolled: null }`:
  - `sprintOf(r, '2026-11-02')` → `{ n: 1, start: '2026-11-02', end: '2026-11-15' }`; `'2026-11-15'` → n 1; `'2026-11-16'` → n 2, start `'2026-11-16'`; `'2026-11-01'` → `null`.
  - `currentSprint(r, '2026-11-17')?.n === 2`; `nextSprint(r, '2026-10-01').n === 1`; `sprintAt(r, 3)?.start === '2026-11-30'`.
  - Rhythm change: an issue date `'2026-11-16'` under `{ start: '2026-11-02', weeks: 3 }` → n 1.
  - `checkRhythm({ start: '2026-11-02', weeks: 9 })` and `weeks: 0`, `1.5`, and `start: '2026-02-30'` are refused; `weeks: 8` is ok.
  - `sprintEnded(r, '2026-11-02', '2026-11-16') === true`, `'2026-11-17'` same sprint as today → false.
- [x] **Step 2:** `npx vitest run tests/unit/roadmap-sprints.test.ts` → FAIL (module missing).
- [x] **Step 3:** Implement with UTC date arithmetic only (`Date.UTC`, day counts), reusing `isIsoDate` from `fields.ts`.
- [x] **Step 4:** Run the test → PASS. `npm run build` will flag every `Issue`/`Roadmap` literal missing the new keys; fix builders/fixtures and `ops.ts` create (`sprint: null, carried: 0`).

### Task 2: Ops — set sprint, rhythm, rollover, duplicate

**Files:**
- Modify: `src/engine/roadmaps/ops.ts`
- Test: `tests/unit/roadmap-ops.test.ts`

**Interfaces:**
- Consumes Task 1.
- Produces: `IssueProps` gains `sprint?: string | null`. `RoadmapOp` `'roadmap'` gains `sprints?: { start: string; weeks: number } | null`. New `{ op: 'rollover'; today: string }`. `export const SYSTEM_USER = 'occam'`. `export function rolloverDue(r: Roadmap, today: string): boolean` (rhythm set, a current sprint exists, and `r.sprints.rolled !== current.start`).

- [x] **Step 1: Write failing tests:**
  - `set` with `sprint: '2026-11-20'` (rhythm above, ctx.now on 2026-11-17) stores `'2026-11-16'`, resets `carried` to 0, and logs change `{ path: 'sprint', from: null, to: '2026-11-16' }`.
  - `set` `sprint` with no rhythm → `{ refused: "Sprints aren't set up for this roadmap." }`; with `'2026-11-03'` (ended) → `{ refused: 'That sprint has ended.' }`; `sprint: null` always allowed.
  - `roadmap` op with `sprints: { start, weeks: 2 }` stores `{ start, weeks: 2, rolled: null }`; with a bad rhythm, refused with `checkRhythm`'s message; `sprints: null` clears it.
  - `rollover` at today `2026-11-17`: issues in sprint `'2026-11-02'` with statuses todo/in_progress/blocked move to `'2026-11-16'`, `carried` 0→1, one `set` event each by `SYSTEM_USER` with change path `sprint`; backlog/done/cancelled and deleted issues untouched; `roadmap.sprints.rolled === '2026-11-16'`. An issue from two sprints back moves straight to current. A second `rollover` same day changes nothing (`changed` empty).
  - `rolloverDue` true before, false after.
  - `duplicate` copies `sprint`, sets `carried: 0`.
- [x] **Step 2:** Run → FAIL.
- [x] **Step 3:** Implement. `today` for `set` validation is `new Date(ctx.now).toISOString().slice(0, 10)`. Rollover does not check `ctx.members` (the system user isn't a member) and touches only `sprint`, `carried` and the roadmap's `rolled`.
- [x] **Step 4:** Run → PASS.

### Task 3: API and storage

**Files:**
- Modify: `api/_lib/db.ts` (add `alter table roadmaps add column if not exists sprints jsonb`, `alter table issues add column if not exists sprint date`, `alter table issues add column if not exists carried integer not null default 0`, placed after the matching `create table`)
- Modify: `api/_lib/db-roadmaps.ts` (select/insert/upsert the new columns; roadmap row ↔ `sprints`; rollover-on-access)
- Modify: `api/_lib/roadmaps.ts` (`issueProps` parses `sprint`: null or string; `roadmapOp` `'roadmap'` parses `sprints`: null or `{ start: string, weeks: number }`; `'rollover'` is **not** accepted from clients)
- Modify: `tests/unit/fake-db-roadmaps.ts` to match
- Test: `tests/unit/roadmaps-api.test.ts`

**Interfaces:**
- Consumes `applyOp`, `rolloverDue`, `SYSTEM_USER`.
- Produces: `getRoadmap`, `roadmapChanges` and `writeRoadmap` first call a private `rollIfDue(id)`. It reads state, and when `rolloverDue(state.roadmap, today)` it applies `{ op: 'rollover', today }` with ctx `{ by: SYSTEM_USER, byClient: 'occam', now, members: [] }` through the same retrying, seq-guarded write path `writeRoadmap` uses. A lost race is fine: rereading finds `rolled` set.

- [x] **Step 1: Write failing tests:** new fields round-trip through create/set/get; `set` `sprint` with no rhythm → 4xx with the refusal copy; a client-sent `{ op: 'rollover' }` → 400; with a rhythm whose sprint ended and an open issue in it, two concurrent `getRoadmap` calls by a **viewer** yield one rollover (issue `carried === 1`, one `occam` event); after removing the rhythm, `getRoadmap` does not roll.
- [x] **Step 2:** `npx vitest run tests/unit/roadmaps-api.test.ts` → FAIL.
- [x] **Step 3:** Implement.
- [x] **Step 4:** Run → PASS; `npm test` green.

### Task 4: Sprint view rows and the layout setting

**Files:**
- Create: `src/engine/roadmaps/sprintView.ts`
- Modify: `src/engine/roadmaps/view.ts` (`layout` union gains `'sprint'`)
- Modify: `src/app/components/roadmap/useViewSettings.ts` (accept `'sprint'` from stored blobs)
- Test: `tests/unit/roadmap-sprint-view.test.ts`

**Interfaces (produces):**
```ts
export type SprintRow =
  | { kind: 'group'; key: string; assignee: string | null; label: string; count: number; mine: boolean; open: boolean }
  | { kind: 'issue'; key: string; issue: Issue; parentTitle: string | null; carried: boolean }
export function sprintRows(
  s: RoadmapState, sprint: Sprint, opts: { me: string; today: string; filters: readonly ViewFilter[]; folded: string[]; names: ReadonlyMap<string, string> },
): SprintRow[]
```
Group key is `sprint/<assigneeId|none>` so it shares `folded` without colliding with other views' paths.

- [x] **Step 1: Write failing tests:** only live leaves (an issue whose sub-issues are all deleted is a leaf); only todo/in_progress/blocked; only `issue.sprint` inside `sprint` (start..end); `me`'s group first, others by name, Unassigned last; within a group Blocked → In progress → To do, then due date (null last), then tree order; `parentTitle` is the live parent's title; `carried` is `issue.carried > 0`; folded group keeps its row and count, hides its issues; filters/search (`matchesChips` with the filters) apply; a missing member's group uses the label `names` gives or the table's fallback.
- [x] **Step 2:** Run → FAIL.
- [x] **Step 3:** Implement, reusing `buildIndex`/`matchesChips` from `view.ts`/`index.ts`.
- [x] **Step 4:** Run → PASS.

### Task 5: Sprint view UI

**Files:**
- Create: `src/app/components/roadmap/SprintView.tsx` (header + list), `src/app/components/roadmap/SprintRhythm.tsx` (popover form: first day, weeks 1–8)
- Modify: `src/app/components/roadmap/TopBar.tsx` (`VIEWS` gains Sprint, lucide `Timer` icon), `src/app/components/roadmap/RoadmapScreen.tsx` (render `SprintView` for `layout === 'sprint'`; offset is local `useState(0)`, reset when the layout changes)

- [x] **Step 1:** Header: `Sprint 14 · 23 Nov – 6 Dec · 9 days left` (use `dates.ts` formatting; "Last day" on the final day; for a future sprint `starts 23 Nov`), previous/next `ToolButton`s, and for editors a settings button that opens `SprintRhythm`. Changing an existing rhythm shows the one-line warning `Sprint numbers will change. Issues keep their dates.`
- [x] **Step 2:** Rows: `GroupLabel`-style group headers with `Avatar` and count, foldable through the shared `folded`. Issue rows: `StatusGlyph` (status menu as in the table), `PREFIX-number`, title, parent title in `text-ink-3`, a quiet `Carried over` label, due date. Clicking opens the issue panel the way the table does.
- [x] **Step 3:** States: no rhythm → `Sprints aren't set up for this roadmap.` plus, for editors, a `Set up sprints` button; empty → `Nothing left in Sprint 14.`
- [x] **Step 4:** `npm run build && npm run lint` clean.

### Task 6: Putting work in a sprint

**Files:**
- Modify: `src/app/components/roadmap/IssueProperties.tsx` (Sprint property via `PropertyPick`: Current, Next, the six after, None; a set past sprint shows its label and isn't in the list), table column `sprint` (`issueTableView.tsx`, `cells/`, `DisplayMenu.tsx` column list), `BulkBar.tsx` Set → Sprint, `issueActivityLine.ts` (`path === 'sprint'` → `moved it from Sprint 13 to Sprint 14` when both set, `added it to Sprint 14`, `removed it from the sprint`; it needs the rhythm to label, so pass it in), and the member-name lookup so `occam` shows as "Occam".
- All hidden while `roadmap.sprints` is null.

- [x] **Step 1:** Unit test for `issueActivityLine` sprint lines in its existing test file (or a new `tests/unit/roadmap-activity-line.test.ts`).
- [x] **Step 2:** Implement; `npm run build && npm run lint && npm test` clean.

### Task 7: Agent and MCP

**Files:**
- Modify: `src/engine/tools/roadmap-writes.ts` (`update_issue`, `create_issues` accept `sprint`: date or null; describe it as "any date inside the sprint; stored as the sprint's first day"), the roadmap-level tool that edits name/fields (`set_fields` or wherever the `roadmap` op is sent) accepts `sprints`, the read tools (`get_roadmap` adds `sprints` and `currentSprint: { n, start, end } | null`; issues carry `sprint`, `carried`)
- Modify: `src/engine/tools/guide-text.ts` roadmap guide, two lines: what a sprint is (repeating, numbered, open work rolls over automatically), and put work in a sprint only when the user asks.
- Test: `tests/unit/roadmap-tools.test.ts`

- [x] **Step 1:** Failing tests: `update_issue` with `sprint` writes it; `get_roadmap` returns `currentSprint`.
- [x] **Step 2:** Implement → PASS.

### Task 8: Verify

- [x] `npm run build`, `npm run lint`, `npm test` all clean.
- [x] Add a Playwright case beside the existing roadmap browser tests: set up sprints on a seeded roadmap, put an issue in the current sprint from the issue panel, switch to Sprint, see it under its assignee.
- [x] `npm run test:browser` green.
- [x] Report: files changed, test output, anything not done.

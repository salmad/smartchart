# Roadmaps M4: Checks, then the agent

> Status: draft 2026-11-10. Parent: `docs/superpowers/specs/2026-11-09-roadmaps-design.md` (§4 Checks, § Agent and MCP, milestone 4). M1 (table) and M2 (Gantt) are shipped. M3 (Matrix, Duplicate) is assumed shipped for the view tabs: `ViewSettings['layout']` includes `'matrix'`, the top bar has a Matrix tab, and the matrix honours the same `Chip[]` as the table. This spec does not redesign the matrix.
>
> Calls marked **(my call)** were made by the writer, not the owner. The review focus at the end of each half is the list to confirm.

M4 is two deliverables. **M4a is what gets built from this spec.** **M4b is specified here so the seams are stable, and gets its own plan later.** Do not build M4b in the M4a plan.

| | In this spec | Built from |
|---|---|---|
| **M4a** | Checks tab: the 7 checks, counts, cards, click → table filtered | This spec, its own plan |
| **M4b** | Agent chat on a roadmap, the MCP tools, roadmap → timeline slide | A later plan. Interfaces and dependencies only |

Philosophy, from the parent and from `CLAUDE.md`: checks point, a person or an agent decides. They never write, never change a date, status, assignee or field, and never raise an event.

## Why

A launch of a few thousand issues hides the work that is late, undated, unowned, or marked done while it is still open. The table and the Gantt already show status and dates; they do not gather the problems. The Checks tab is that gathering, over the same issues the other views already hold in the browser.

The agent half exists so the same record can be read and written from the chat and from MCP, and so a filtered view can become a timeline slide. The slide stays a snapshot for an audience. The roadmap stays the record.

## Goals (M4a)

- A **Checks** tab on the roadmap, beside Table, Gantt and Matrix, with a badge of how many issues fail at least one check.
- Seven cards, always, in a fixed order. Each card shows its count. A card with a count opens the **table** filtered to those issues.
- One pure function, `runChecks`, in `src/engine/roadmaps/checks.ts`. The screen, the tests and (later) the agent all call it. No second copy of the rules.
- Thresholds live in one constant, `CHECK_THRESHOLDS`.
- The same instant behaviour as the table: the cards are computed from the issues already on the client. An optimistic edit changes the counts in the same paint. A failed save rolls the counts back with the issues. Switching to Checks never calls the server.

## Non-goals (M4a)

- Agent chat, MCP tools, and the timeline slide (M4b).
- A check inside the issue panel or on the full issue page. The tab is the surface.
- A "fix" action, a bulk edit from a card, or any write. Opening the table is the hand-off; editing stays the table's.
- New statuses, new fields, or a check the owner can define.
- Email, notifications, or "everything assigned to me" across roadmaps.
- Storing check results. They are derived.

## Anti-goals (M4a)

- A check that writes, or a save that "clears" a check by filling a date or an assignee.
- Two overdue definitions. The Overdue card and the existing "Due overdue" chip must match on the same issues.
- Flagging the shape the parent recommends. A parent with no dates of its own, whose children carry the dates, is how a matrix row spans countries. That parent is not "No dates" **(my call)**, see the rule below.
- Colour as decoration. Red is only for a contradiction or a slipped date, and only on a count above zero.

# M4a — Checks

## Terms

Used by every rule. Implemented once in `checks.ts`.

- **Live issue.** `deletedAt === null`. Soft-deleted issues and their soft-deleted descendants are gone. Use `buildIndex` from `src/engine/roadmaps/index.ts`, which already drops them.
- **Open.** Status is not `done` and not `cancelled` (`backlog`, `todo`, `in_progress`, `blocked`).
- **Leaf.** A live issue with no live children. A parent whose children are all soft-deleted is a leaf.
- **Today.** The `YYYY-MM-DD` string the roadmap screen already computes (`new Date().toISOString().slice(0, 10)`). That is UTC, and it is the same value `tableRows` and the Gantt receive. Checks take it as an argument. They do not read the clock. "Due today" is not overdue (`due < today`, the same comparison as the overdue chip in `view.ts`).
- **Own dates.** The `start` and `due` stored on that issue. Never `dateSpan`. A span filled in from children is for the Gantt and the matrix; it is not written back, and it is not a bound.

`ops.ts` already refuses a start after its due (`Start must be before due.`). Checks do not invent a card for that. If a row ever arrives with `start > due`, it is not Long and it is not outside its parent on that inverted side; the other rules still apply.

An issue is listed on every card it fails. Cards do not exclude each other.

## The seven checks

Order is the card order and the order of `CHECK_IDS`.

| id | Card | Fires when |
|---|---|---|
| `no_dates` | No dates | Open **leaf**, and `start` is null or `due` is null (either missing). |
| `overdue` | Overdue | `due` is set, `due < today`, and the issue is not Done or Cancelled. Same set as the overdue chip. A missing due is not overdue. |
| `blocked` | Blocked | `status === 'blocked'`. Parents and leaves. Done and Cancelled cannot be blocked. |
| `no_assignee` | No assignee | Open leaf with `assignee === null`. A parent is not flagged: ownership sits on the leaves. An open parent with no children is a leaf, so it is flagged. |
| `long` | Long | Open leaf with both dates, and the number of calendar days from `start` to `due` is greater than `CHECK_THRESHOLDS.longDays`. |
| `outside_parent` | Outside its parent | Not Cancelled. The direct parent has at least one own date. The child starts before the parent's own start (both starts set), or ends after the parent's own due (both dues set). A missing side on the parent is not a bound. A missing side on the child is not a breach of that side. Grandparents are not walked: each issue is judged against its parent, so a parent that sticks out of *its* parent fails on its own. |
| `done_open` | Done with open children | `status === 'done'` and some live descendant (any depth) is open. Cancelled descendants do not count as open. A Done leaf passes. A Done parent whose remaining descendants are all Done or Cancelled passes. |

### Departures from the parent's wording **(my call)**

The parent says "No dates (open issues without start or due)" and "Long (a leaf longer than 3 months)". Two narrowings, both to stop the tab nagging on a healthy plan:

1. **No dates is leaves only.** An open parent with no own dates is the normal group (the parent spec's "takes the span of its children for display"). Flagging it would put every Workstream header on the card. A leaf is the work that can actually be scheduled.
2. **Long is open leaves only.** A Done leaf that ran for half a year is history. The card is for work still on the plan.

Confirm both in review. If the owner wants every open issue on No dates, delete the leaf requirement and accept the group headers.

### Long, in days

`longDays` is **92**. Day count is UTC calendar days, `due` minus `start`, not an inclusive count and not "plus three calendar months" (that moves with the month lengths).

- 1 Jan → 3 Apr is 92 days in a non-leap year. It does **not** fire.
- 1 Jan → 4 Apr is 93 days. It fires.
- A milestone (`start === due`) is 0 days. It does not fire.
- A leaf with only one date does not fire Long. It fires No dates when it is open.

92 is the only threshold. Copy on the card says "longer than 3 months" so the person does not see "92".

### Outside its parent, examples

Parent own dates 1 Mar–30 Jun:

- Child 1 Feb–30 Jun fails (starts before).
- Child 1 Mar–15 Jul fails (ends after).
- Child 1 Mar–30 Jun passes.
- Child with no start and due 15 Jul fails the due side only.
- Parent with no own dates: no child fails this check, whatever `dateSpan` would draw.
- Parent with only a due: only the due side is tested.

## Copy

Fixed, in `CHECK_COPY`. The UI does not invent a sentence.

| id | detail |
|---|---|
| `no_dates` | Open, with no sub-issues, and no start or no due. |
| `overdue` | Due date has passed, and it isn’t Done or Cancelled. |
| `blocked` | Status is Blocked. |
| `no_assignee` | Open, with no sub-issues, and no one assigned. |
| `long` | Open, with no sub-issues, and longer than 3 months. |
| `outside_parent` | Starts before or ends after its parent’s own dates. |
| `done_open` | Marked Done while work under it is still open. |

Empty tab, when `issues === 0`: one line, "Nothing to look at." The seven cards still render, counts at zero, so the set is visible on an empty roadmap.

## Types

```ts
export const CHECK_IDS = [
  'no_dates',
  'overdue',
  'blocked',
  'no_assignee',
  'long',
  'outside_parent',
  'done_open',
] as const

export type CheckId = (typeof CHECK_IDS)[number]

/** The only tuneable number. Days from start to due, UTC, exclusive of the bound. */
export const CHECK_THRESHOLDS = { longDays: 92 } as const

export const CHECK_COPY: Record<CheckId, { label: string; detail: string }>

export interface CheckCard {
  id: CheckId
  /** Live issues that fail this check, after the non-check chips. Tree order (sibling sortKey, parents before children). */
  issueIds: readonly string[]
  count: number
}

export interface CheckReport {
  /** Distinct issue ids across the cards. This is the tab badge, not the sum of the counts. */
  issues: number
  /** Always 7, in CHECK_IDS order, zeros included. */
  cards: readonly CheckCard[]
}

export function runChecks(
  issues: readonly Issue[],
  opts: { today: string; chips?: readonly Chip[] },
): CheckReport
```

`Issue` and `Chip` are the existing types (`types.ts`, `view.ts`). `runChecks` builds one index, drops deleted issues, applies every chip whose `on` is not `'check'`, then runs the seven predicates. A `'check'` chip is ignored so the badge does not collapse to the card the person already opened.

`count === issueIds.length`. Ids are stable for a given issue list and chip list.

No React, no `Date.now`, no field-name literals (`Workstream`, `Country`, `Epic`). The rules read only built-in columns.

## The chip

A check is a filter, not a second view of the data. Extend `Chip` in `view.ts`:

```ts
| { on: 'check'; id: CheckId }
```

`chipMatches` for that variant is the same predicate `runChecks` uses for that id (one function, called from both). `liveChips` already keeps non-field chips, so deleting a field definition does not drop the check chip. `chipLabel` gains a case; it must not fall through to "Filter".

Labels:

| id | chip |
|---|---|
| `no_dates` | No dates |
| `overdue` | Overdue |
| `blocked` | Blocked |
| `no_assignee` | No assignee |
| `long` | Long |
| `outside_parent` | Outside its parent |
| `done_open` | Done with open children |

Rules for the chip **(my call)**:

- At most one. Choosing a card replaces any check chip. It does not clear the other chips. Cards are AND with status, assignee, field and date chips, so "Overdue" inside "Country is UK" shows the UK overdue issues, and the card's count was computed with those same chips.
- "+ Filter" does not offer the seven. They are entered from the Checks tab. The person removes one like any other chip.
- The chip is part of `ViewSettings`, so it already round-trips through `?v=` and the per-roadmap localStorage entry. Nothing new is stored.
- Table, Gantt and Matrix all go through `chipMatches`. After the table is filtered, switching to Gantt or Matrix keeps the chip. No matrix-specific list.
- Tree behaviour is unchanged: a matching issue shows with dimmed ancestors (`dim: true`). Ancestors are not part of `count`.

Clicking a card with `count === 0` does nothing (the row is not a button). Clicking a card with a count sets:

```ts
{ ...view, layout: 'table', chips: [...chipsWithoutCheck, { on: 'check', id }] }
```

That is one `onView`. The table is already mounted from local issues. No fetch.

## The tab

`ViewSettings['layout']` gains `'checks'`. Top bar order: Table, Gantt, Matrix, Checks. The Checks control is `aria-pressed` like the others, inside the existing `nav` ("Roadmap views").

Badge: `report.issues`, rendered only when it is above zero. Accessible name when it is above zero: `Checks, N issues`. When it is zero, the name is `Checks`. The badge is not the sum of the cards (one issue on two cards counts once).

The screen computes `runChecks(live, { today, chips: view.chips })` in a memo on the live issue list, the chips and `today`. Same `today` value the table uses.

While `layout === 'checks'`:

- The filter row stays, so a chip can narrow the cards.
- Display (columns, group, sort) hides. Those settings stay in the view and come back on the table. They do not change cards.
- Gantt scale and Today stay hidden, as they are today.
- Fields and New issue stay.
- The main pane is the card list, including when the roadmap has no issues yet. The empty-table sentence ("No issues yet…") is for the table, Gantt and matrix only. Do not gate Checks on `showTable`.

Each card is one row: label, the detail sentence, the count at the end. Full width of the view, one column, the app's type scale. Not a grid of tiles.

Count colour, only when `count > 0` **(my call)**:

- `text-bad`: Overdue, Blocked, Outside its parent, Done with open children. These are a slipped date, the blocked status, or a contradiction.
- `text-ink`: No dates, No assignee, Long. Incomplete or too big, not an alarm.

Zero counts are `text-ink-3`. No card background, no left border, no icon per check. The whole row is the button when the count is above zero. Its accessible name is `{label}, {count} issues`.

Viewers see the tab. There is nothing to edit.

Keyboard: the tab is in the view nav; a card is a button. No new shortcut. (The parent's "left to the builder" still covers shortcuts beyond the ones already named.)

## Instant

Checks add no request and no optimistic write of their own.

- Painting Checks is a read of the local issue list, the same list the table uses (`useRoadmap` / the local copy).
- A status, date, assignee, parent or delete that the screen already applies optimistically changes the cards in that paint. The rollback toast the table already shows puts the cards back, because the issues came back.
- Live edits from someone else arrive through the existing "changes since seq" merge. The memo reruns. No poll of a checks endpoint.
- `today` is the screen's existing memo. It does not tick at midnight until the next mount, which is already true of the overdue chip. Do not add a clock.

Scale: up to 5,000 live issues, one index, one pass. Fine on each keystroke that already replaces the issue array. Do not virtualise seven rows.

## Tests (M4a)

Unit, `tests/unit/roadmap-checks.test.ts`, fixtures from `tests/unit/roadmap-builders.ts`:

- Each id fires on the smallest issue that should fail, and stays quiet on the boundary next to it.
- Long: 92 days quiet, 93 days fires; a milestone is quiet; an open leaf with one date is No dates and not Long; a Done leaf of 200 days is quiet.
- No dates: open leaf missing start, missing due, or missing both; an open parent with children and no own dates is quiet; a Done leaf with no dates is quiet.
- Overdue: due yesterday fires; due today is quiet; Done with a past due is quiet; no due is quiet.
- The overdue check and `tableRows` with `{ on: 'dates', when: 'overdue' }` return the same issue ids on one shared fixture.
- No assignee: open leaf, not an open parent that has a child, not a Done leaf.
- Blocked: a blocked parent and a blocked leaf; an issue may be both Blocked and Overdue.
- Outside parent: the examples above, including a parent whose `dateSpan` is wider than its missing own dates (no hit), and a grandchild judged only against its parent.
- Done with open children: a Done parent with an open grandchild fires; with only Cancelled descendants it does not; a Done leaf does not.
- One issue on two cards: `issues === 1`, the sum of counts is 2.
- A soft-deleted issue is absent. A parent whose only child is soft-deleted is a leaf.
- A field chip AND a run: the card count drops. A `{ on: 'check' }` chip in `opts.chips` does not change the report.
- `issueIds` follow sibling `sortKey`, parent before child.

Unit, added to `tests/unit/roadmap-view.test.ts`:

- A check chip keeps a matching leaf and dims its ancestor.
- A check chip AND a status chip.
- `chipLabel` for each id.
- `liveChips` keeps a check chip when a field definition disappears.

Browser, `tests/browser/roadmap-checks.spec.ts`, helpers in `tests/browser/roadmap-helpers.ts`:

- On a roadmap with one overdue issue and one clean issue: the Checks tab shows a badge of 1; Overdue reads 1; the other cards read 0.
- Activating Overdue lands on the table, the overdue issue is visible, the clean issue is not a matching row, and a removable chip reads "Overdue".
- Removing the chip shows both issues again.
- No request fires for the tab switch (the issues were already loaded). Assert the checks route is not fetched; the existing roadmap GET is enough.

## Files (M4a)

| File | Change |
|---|---|
| `src/engine/roadmaps/checks.ts` | New. `CHECK_IDS`, `CHECK_THRESHOLDS`, `CHECK_COPY`, `runChecks`, and the single predicate the chip calls. |
| `src/engine/roadmaps/view.ts` | `Chip` variant `{ on: 'check'; id: CheckId }`. `chipMatches` delegates to that predicate. |
| `src/app/components/roadmap/chipLabel.ts` | The seven labels. |
| `src/app/components/roadmap/TopBar.tsx` | Checks tab and badge. Hide Display when `layout === 'checks'`. |
| `src/app/components/roadmap/Checks.tsx` | New. The seven rows. Props in, `onOpen(id)` out. No data fetching. Under ~300 lines. |
| `src/app/components/roadmap/RoadmapScreen.tsx` | Memoised `runChecks`. Render `Checks` when `layout === 'checks'`, including the empty roadmap. Card click writes the view as above. |
| `tests/unit/roadmap-checks.test.ts` | New. |
| `tests/unit/roadmap-view.test.ts` | Chip cases. |
| `tests/browser/roadmap-checks.spec.ts` | The one flow above. |

No new API route, no schema change, no CSS file. Classes are the existing Tailwind tokens (`text-ink`, `text-ink-3`, `text-bad`, `border-line`, `bg-app-bg`). No inline styles. No `any`. shadcn is already the button and popover set; a card row is a `<button>`, not a new primitive.

`src/engine/roadmaps/tree.ts` does not need to re-export checks. Callers import `checks.ts`.

## Review focus (M4a)

1. **No dates is open leaves only**, not every open issue. This is the one real departure from the parent's sentence. The reason is the undated group parent.
2. **Long is 92 UTC days, open leaves only.** 1 Jan → 3 Apr passes; 1 Jan → 4 Apr fails. Copy still says "3 months".
3. **Outside its parent uses stored dates, direct parent only, and skips Cancelled.** A derived Gantt span is not a bound.
4. **Done with open children walks every descendant.** Cancelled descendants are ignored.
5. **The badge is distinct issues.** Card counts can sum higher.
6. **Red counts** only on Overdue, Blocked, Outside its parent, and Done with open children.
7. **One check chip, AND with the chips already set, click always opens the table.** Gantt and Matrix keep the chip if the person switches after that. The Checks tab ignores a check chip when counting, so the cards do not collapse to the open filter.
8. **Nothing is written** by opening a card or by computing a report.

## Left to the builder (M4a)

- The exact row padding, as long as it uses the app type scale and the tokens above.
- Whether the badge sits inside the tab label or immediately after it. It is part of the accessible name either way.
- Memo dependency: the issue-array reference the store already replaces is enough. Do not deep-hash 5,000 issues.

# M4b — Agent, MCP, roadmap to slide

Specified so M4a does not paint M4b into a corner. A later plan builds it. UI beyond the seams below is that plan's job; this section does not choose message layout, empty-chat illustration, or pill copy.

M4b depends on M4a being shipped: `runChecks`, the check `Chip`, and the predicates. It also depends on M1 writes (`ops.ts`, `db-roadmaps`, the event log, workspace roles) and on the existing timeline schema (`chart.kind: "timeline"`, `checkTimeline` in `src/engine/slides/schema.ts`).

## Principles

- Thin harness. New code is storage, validation, the check function that already exists, and the date binning that must fit the timeline's limits. Wording and which issues to create stay in the model.
- The agent does not silently rewrite the plan. A failing check comes back as data. The model clears it only when the user's words ask for that change.
- `delete_issue` is described as only when the user asked, the same way `delete_slide` is. There is no intent classifier in code. The tool requires `request`, as every write does.
- Field names come from the roadmap. The prompt forbids inventing Workstream, Country, Function, Epic.
- Jev is for closed-set choices. A roadmap turn is open-ended, so it uses the main model through the existing agent step (`api/glm.ts`), the way the doc agent does. No PRE router, no template menu.
- Viewers can call the read tools. Writes return the existing not-allowed sentence (`NO_EDIT` / the roadmap permission rule). The in-app composer does not send when `canEdit` is false.
- Every write lands in `issue_events` with `by_client` set to the agent name, as deck writes do, and passes the user's words as `request`.

## In-app chat

The deck and the doc already share `ChatPanel`. The roadmap uses that panel.

Seam, not a layout spec:

- `App` already owns `chatOpen` and ⌘L. Pass them into `RoadmapScreen` the way `DocScreen` receives them. The header gains the same show/hide agent control the doc header has.
- `ChatPanel` with no `start` style switcher. A roadmap has no consulting/pitch choice.
- One turn function, `runRoadmapTurn`, beside the doc turn: history in, reply out, tools from the registry. The system prompt is short and is the principles above plus "call `runChecks` results, do not restate rules from memory" and "a timeline slide is a snapshot".
- The open roadmap paints agent writes immediately. The tool returns the changed issues; the screen applies them onto the local copy the same way an optimistic edit does, and the existing seq poll reconciles. The person does not wait for the poll to see a created issue.
- Chat is stored on the roadmap, like a deck's `chat` column and unlike the doc chat (which is memory for the session) **(my call)**. Column `roadmaps.chat jsonb`, kept apart from issues. A roadmap is a record; the conversation that filled it should survive a reload. Shape matches the deck chat object (`history`, `messages`). Clearing the chat writes that column and nothing else.

Out of M4b chat: suggestions that rewrite the plan, a model pass over the seven checks, anchoring a message to an issue.

## MCP tools

New file `src/engine/tools/roadmaps.ts`, registered in `TOOLS`. New scope `'roadmap'` on `ToolContext` (the loaded roadmap and its live issues, without bodies until `get_issue`). New `AccountPort` methods for the queries the handlers cannot do as pure functions (list, load, save, events). Handlers stay free of HTTP and Neon, same as the deck tools. The MCP and REST views are derived from the registry; no new Vercel function (the parent already spends the route budget).

Reads return check ids from `runChecks` for the issues in the payload (`today` = UTC date on the server, the same expression as the screen). There is no `check_roadmap` tool **(my call)**. A second tool would drift from the tab. Writes return `checks: { issueId, ids: CheckId[] }[]` for the issues that write touched, plus the usual `issues` / `warnings` sentences when validation refuses. They do not include a model judgement.

`list_issues` filters are the `Chip` union, including `{ on: 'check', id }`, AND between chips. The server runs the same `chipMatches` as the table. Results are matching issues, not dimmed ancestors.

| Tool | Read / write | Contract |
|---|---|---|
| `list_roadmaps` | read | The user's roadmaps in one workspace (the one named, else the latest), each with `roadmapId`, `name`, `prefix`, `parent`, `updated`. Same parent shape as `list_decks`. |
| `create_roadmap` | write | `name`, `prefix` (the existing `PREFIX` rule), optional `parent` page, `request`. Returns `roadmapId` and `links.edit` (`/r/:id`). |
| `get_roadmap` | read | Field definitions in order, and the live issue tree without bodies or comments: id, number, key (`prefix-number`), title, status, assignee, start, due, parentId, sortKey, field values, `checks: CheckId[]`. |
| `list_issues` | read | `roadmapId`, `chips`, optional cursor. The matching issues in tree order, with the same fields as `get_roadmap` and their check ids. |
| `get_issue` | read | One issue plus `body`, comments, and the latest events. `checks` included. |
| `create_issues` | write | Many issues in one call. Each item: `ref` (a caller key, unique in the call), `title`, optional status, assignee, start, due, field values, and `parent` either an existing issue id or another item's `ref`. The server assigns ids and numbers, copies nothing unless the item says so. New sub-issues do not auto-copy the parent's fields in this call unless the item sets them; the UI's "copy parent fields" stays a UI behaviour **(my call)** so the agent does not inherit values it did not name. One transaction. One `created` event per issue. |
| `update_issue` | write | Paths, like `update_slide`: `title`, `status`, `assignee`, `start`, `due`, `fields.<fieldId>`. Not parent and not order (those are `move_issue`). Unknown field, bad type, bad option, or start after due: refused with the sentence `ops.ts` already returns. One event, `what: 'set'`. |
| `move_issue` | write | `parentId` (or null) and `before` / `after` among siblings, the page-move shape. Cycle and depth (`MAX_DEPTH`) refused with the existing sentences. One `moved` event. |
| `list_changes` | read | Events since an ISO date, so the agent can draft a status update. `roadmapId`, `since`. Returns the log rows the UI already stores (`what`, `changes`, who, when). Not a generated paragraph. |
| `delete_issue` | write | Soft-deletes the subtree. Result states how many issues went. Requires `request`. One `deleted` event on the root; the subtree shares the `deleted_at` as the UI delete does. |
| `set_fields` | write | The whole ordered definition list, validated by the existing field validation. Removing a definition strips its values in that transaction and logs it, which is already the write rule. |
| `roadmap_timeline` | read | See below. Not a slide write. |

`move_page` learns `kind: "roadmap"` so a roadmap can sit in the tree the way the UI already places it. That is a one-line widening of `PageArg`, in this milestone, because the agent cannot otherwise nest a deck under a roadmap it just created.

Guide: `get_guide` with `style: "roadmap"` returns one page. It names the tools, says checks warn and never authorise a silent edit, says to pass `request`, and points at the timeline limits. No new vocabulary.

## Roadmap to slide

The agent reads a filtered view and writes a `chart.kind: "timeline"` slide with the existing `create_slide`. The slide does not subscribe to the roadmap.

The hard part is fitting dates into the timeline's existing limits. That is a pure function, `timelineDraft`, in `src/engine/roadmaps/timeline-draft.ts`. The tool `roadmap_timeline` calls it and returns the result. The agent copies a successful `chart` into `create_slide`. The tool does not create a deck or a slide.

Limits, already enforced by `checkTimeline` and the chart card (do not invent new ones):

- Periods: 3–16, each label at most 8 characters. With notes on the slide the card tightens to 8 periods, 6 lines and 20-character labels; the draft aims at the looser card (16 / 12 / 28) and the agent drops notes if the slide will not pass. The draft's job is a chart body that passes `checkTimeline` with no notes.
- Rows: at most 12 lines, at most 8 level-0 workstreams. A level-0 row with level-1 rows directly under it is a group and omits its own `start` and `end`.
- Milestones: at most 6, label at most 16, `at` a period index.

```ts
export interface TimelineDraftInput {
  issues: readonly Issue[]
  fields: readonly FieldDef[]
  chips: readonly Chip[]
  today: string
  /** First grain. The function may widen week → month → quarter to stay within 16 periods. It does not narrow. */
  scale: 'week' | 'month' | 'quarter'
  /** Level-0 groups. Null: each matching root is its own workstream. Only choice, status, assignee, or a choice field — the same group-by the table allows. */
  groupBy: ViewSettings['groupBy']
}

export type TimelineDraft =
  | {
      ok: true
      chart: {
        kind: 'timeline'
        periods: string[]
        rows: { label: string; level?: 0 | 1; start?: number; end?: number }[]
        milestones: { label: string; at: number }[]
      }
      /** Dated work that fitted. */
      used: readonly string[]
      /** Matching issues with no own dates and no derived span. Named, not dropped from a row that should have existed. */
      undated: readonly string[]
    }
  | { ok: false; refused: string }
```

Refuse, don't drop **(my call)**. If the filtered, grouped set needs more than 8 workstreams, more than 12 lines, more than 16 periods even at quarter grain, or more than 6 milestones, return `ok: false` and a sentence with the counts and what to change (filter, or group, or a coarser scale). Do not keep the first 8 and omit the rest. A silent omission is a rewritten plan.

What becomes a row: a matching issue with a drawable span (own dates, or a derived span when it is a group). An issue with `start === due` is a milestone, not a bar. Undated matching issues are listed in `undated` and do not become rows. Group headers are the group-by value. Child bars are level 1 under that header. Labels that do not fit the schema (row 28, period 8, milestone 16) cause a refusal that names the label, not a silent cut. No `focus` flag: the agent sets focus only when the user named the workstream.

The draft does not read titles to invent groups. Grouping is `groupBy` or the parent tree.

## Dependencies (M4b)

| Needs | From |
|---|---|
| `runChecks`, `CheckId`, check chip, `chipMatches` | M4a |
| Issue writes, events, roles, seq, field validation | M1 `ops.ts`, `api/_lib/db-roadmaps.ts` |
| `create_slide`, timeline schema and `checkTimeline` | Shipped slide tools |
| `ChatPanel`, ⌘L, `api/glm.ts` agent step | Shipped app shell and doc/deck chat |
| Matrix tab | M3, display only. The agent does not need a matrix tool. `list_issues` with chips is the filtered view. |
| Page tree `kind: 'roadmap'` | Shipped. `move_page`'s `PageArg` is the gap. |

M4b does not depend on Duplicate, on the Gantt drag code, or on doc suggestions.

## Files (M4b, for the later plan)

| File | Change |
|---|---|
| `src/engine/roadmaps/timeline-draft.ts` | New. `timelineDraft`. |
| `src/engine/tools/roadmaps.ts` | New. The twelve tools. |
| `src/engine/tools/types.ts` | Scope `'roadmap'`, port methods, context field. |
| `src/engine/tools/index.ts` | Register the tools. |
| `src/engine/tools/pages.ts` | `PageArg` accepts `roadmap`. |
| `src/engine/tools/guide-text.ts` (or the guide module the doc guide uses) | Roadmap guide page. |
| `src/engine/agent/roadmap-turn.ts` | New. The in-app loop. |
| `api/_lib/db-roadmaps.ts` | Load and save `chat`; the port's queries. No new Vercel function. |
| `src/app/App.tsx`, `src/app/components/roadmap/RoadmapScreen.tsx` | Pass the chat toggle; mount `ChatPanel`; apply tool results onto the local copy. |
| Tests | Unit: each tool's refusal sentences, `timelineDraft` limits (refuse at 9 workstreams, accept at 8, widen week to month), write results include `checks` from `runChecks`. Browser: one chat turn that creates an issue and shows it without a reload. MCP snapshot: the new tools appear in the registry snapshot test. |

## Review focus (M4b)

1. **No `check_roadmap` tool.** Check ids ride on `get_roadmap`, `list_issues`, `get_issue`, and on write results.
2. **`create_issues` does not copy parent field values** unless the agent set them. The UI still copies on inline add.
3. **`roadmap_timeline` refuses instead of dropping** rows, periods, or milestones. Undated issues are listed, not drawn.
4. **The draft never writes a slide.** `create_slide` does, and the slide is a snapshot.
5. **Chat is persisted** on `roadmaps.chat`, deck-style.
6. **No Jev routing** on a roadmap turn.

## Non-goals (M4b)

Confirmed out, so the later plan does not grow them: CSV import, cross-roadmap search, notifications, dependencies, custom statuses, restoring a roadmap from the event log, a live link from the slide back to the issues, a button on the Checks tab that "asks the agent to fix".

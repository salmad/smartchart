# Roadmaps: Sprints and the Sprint view

> Status: draft 2026-11-17. Parent: `docs/superpowers/specs/2026-11-09-roadmaps-design.md`. Shipped views: table, Gantt, Matrix, Checks (`ViewSettings.layout`). Calls marked **(my call)** are not the owner's.

## Why

Before the next meeting, a person wants to know one thing: what specifically do I need to do. Table, Gantt and Matrix show the whole plan. The Sprint view shows only the work due this sprint, at the level someone actually does it, with their own tasks first.

## Goals

- A roadmap can have a **sprint rhythm**: a first day and a length in weeks. Sprints are numbered from it (Sprint 1, 2, 3…), and the current sprint comes from today's date. No one has to start or close a sprint.
- An issue can be **put in a sprint**, the way it gets an assignee: from the issue panel, a table column, the bulk bar, and the agent's tools.
- A fifth layout, **Sprint**, lists the current sprint's open leaf tasks, grouped by assignee, with the viewer's group first.
- Work left open when a sprint ends **moves to the next sprint**, as in Linear. It shows there marked carried over, and the move is in the issue's activity.

## Non-goals

- Sprints of different lengths, named sprints, or sprints made by hand (the owner chose a fixed rhythm).
- Capacity, points, burndown, sprint goals, sprint reports.
- Linear's cooldowns, editing one sprint's dates or name, and adding started work to a sprint automatically (kept for `docs/product/FUTURE.md`).
- A per-row timeline bar. The sprint's dates and days left sit in the header; each row shows its due date **(my call; the request said "with timeline in the current sprint", read as "falls in the current sprint")**.

## Approaches

1. **Repeating sprints, like Linear's cycles (chosen).** One rhythm per roadmap; the current sprint comes from the date; an issue holds which sprint it is in. Always current with no upkeep. The cost is that every sprint is the same length.
2. **Sprints you name and date yourself.** Fits meetings that don't follow a schedule, but someone has to make each one, and the view goes empty when nobody does.
3. **No sprints, only due dates.** The least to build, but a task can't be put in a sprint, which the owner asked for.

The owner picked 1.

## Data

- `Roadmap.sprints: { start: string; weeks: number; rolled: string | null } | null`. `weeks` is 1–8, as in Linear. `start` is an ISO date. `rolled` is the start of the last sprint unfinished work was moved into (see Rollover). Null means no sprints yet. New column `sprints jsonb` on `roadmaps`, null by default.
- `Issue.sprint: string | null`, the **start date of the sprint** it is in, not its number **(my call)**. If the rhythm changes later, an issue belongs to whichever new sprint contains that date, so no issue changes sprint because of a renumbering. New column `sprint date` on `issues`.
- `Issue.carried: number`, how many times rollover has moved it; set back to 0 when a person or the agent sets `sprint` **(my call: the view's "Carried over" label needs it, and the event log isn't on the client)**. New column `carried integer not null default 0`.
- `sprintOf(rhythm, date) → { n, start, end }` and `currentSprint(rhythm, today)` live in a new `src/engine/roadmaps/sprints.ts`. Dates before `start` are in no sprint.
- The `set` op takes `sprint` (validated: an ISO date, the roadmap has a rhythm, and the sprint has not ended: as in Linear, nothing is put in a closed sprint). It is stored as the start of the sprint that contains it. The `roadmap` op takes `sprints`. Both log events as usual.
- Duplicate copies `sprint`.

## The Sprint view

`ViewSettings.layout` gains `'sprint'`, plus `sprintOffset: number` (0 is current, -1 previous, +1 next) so someone can look one sprint ahead to plan. The offset is not saved between visits; the view always opens on the current sprint **(my call)**.

**Which rows:** live issues that
- have no live sub-issues (leaves),
- have status To do, In progress or Blocked,
- are in the sprint shown. For a past sprint (previous arrow) that is whatever is still recorded there, since open work has moved on. Rows with `carried > 0` show "Carried over".

The usual filter chips and search apply on top, as in every view.

**Grouping:** by assignee, always. The viewer's own group comes first, then the others by name, then Unassigned. Groups fold, sharing `folded` with the other views. The view ignores the view's `groupBy` and `sort` settings. Within a group: Blocked, then In progress, then To do, then by due date (empty dates last), then by the tree's order **(my call)**.

**Header:** "Sprint 14 · 23 Nov – 6 Dec · 9 days left", with previous and next arrows. These use the app's existing parts.

**Row:** status glyph (click to change, as in the table), number, title, the parent's title muted after it so the task keeps its context, a small "Carried over" label where it applies, and the due date (empty if none). Clicking a row opens the issue panel. Keyboard and selection work as in the table where the table's hooks can be shared.

**No rhythm yet:** the view shows one quiet line, "Sprints aren't set up for this roadmap", and, for editors, a button that opens the rhythm settings. Viewers see only the line.

**Nothing to do:** "Nothing left in Sprint 14." No other placeholder.

## Setting things

- **Rhythm:** a small popover from the Sprint view's header (first day, length 1–8 weeks). Editors only. Changing it later warns in one line that sprint numbers will change; issues keep their dates.
- **Issue → sprint:** a Sprint property in `IssueProperties` (picker: Current, Next, the six after it, then None; a past sprint shows as its label when set but can't be picked). A `sprint` column option in the table. "Sprint" in the bulk bar's Set menu. All use the existing picker and menu parts.
- Hidden everywhere while the roadmap has no rhythm.

## Rollover

When a sprint ends, every live issue in that sprint (or earlier) with status To do, In progress or Blocked moves to the current sprint: `sprint` becomes the current sprint's start, `carried` goes up by one, and a `set` event records the change, by a system user ("Occam") so the activity reads "Moved from Sprint 13 to Sprint 14". Backlog, Done and Cancelled stay where they are, as in Linear.

There is no scheduler today, so rollover runs **on the first read or write of the roadmap after a sprint has ended** **(my call)**: the API compares `sprints.rolled` with the current sprint's start and, if they differ, applies one rollover op and sets `rolled` in the same transaction as the seq bump, so two readers at once move work once. If several sprints passed unseen, work moves straight to the current one. Clients get the moves through the usual changes feed. It is an engine op (`{ op: 'rollover'; today }`) so it is tested like the others.

Changing the rhythm does not roll anything by itself; the next read does, against the new current sprint.

## Agent and MCP

- `get_roadmap` returns the rhythm and the current sprint (`n`, `start`, `end`). Issues carry `sprint` (start date) in `list_issues` / `get_issue`.
- `update_issue` and `create_issues` accept `sprint` as a date inside the target sprint; `set_fields`-style roadmap edits accept `sprints`.
- The roadmap guide (`guide-text.ts`) gets two lines: what a sprint is, and that the agent puts work in a sprint only when asked.

## Testing

- Unit: `sprintOf` / `currentSprint` at edges (first day, last day, before start, rhythm change), the `set` op's validation and normalisation, the rollover op (which statuses move, several missed sprints, runs once), the Sprint rows (leaf, status, carried label, offset, own group first, order).
- API: the new columns round-trip; `sprint` is rejected without a rhythm or for an ended sprint; two loads after a sprint ends roll over once.
- Browser: the Sprint view renders for a seeded roadmap; setting a sprint from the panel moves the row in.

## Left to the builder

The exact layout of the row and header inside the app's existing parts; whether table keyboard hooks can be shared or need a slim copy; migration statement ordering in `db.ts`.

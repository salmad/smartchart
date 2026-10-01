# Gantt: groups, colour roles and milestones

Status: draft for review. Extends section 4.3 of `2026-10-01-manual-slide-editing-design.md` (the gantt editor) and the timeline kind in `2026-09-27-chart-capabilities-design.md`.

## Why

A timeline today is a flat list of 2–8 bars, one of them optionally the focus. Real plans have big initiatives made of smaller ones, a milestone that belongs to the programme, and a bar that is not grey. The editor can paint bars and add or delete rows, but cannot express any of that, and neither can the agent.

Decided with the user (2026-10-01):

1. A sub-row is a **group with a derived span**: the parent's bar is the earliest child start to the latest child end. Two levels.
2. **Colour only tells top-level from sub-level.** It is derived from the row's level, never stored, never a highlight: no colour field, no colour menu, no colour on milestones.
3. Milestones **stay in the shared foot lane**. The editor gets better; the cap rises to 6.
4. Groups are stored **flat with a level**, so dragging a row under another is a change of position and level, nothing more.

Out of scope: more than two levels, dependencies between bars, per-row milestones, any colour choice, a legend, bars that skip periods. The existing `focus` flag on a row is left exactly as it is (the starter timeline uses it); whether to remove it is a separate question for the user.

## Data

`chart.rows[]` stays one flat list.

| field | meaning |
|---|---|
| `label` | name, max 28 characters |
| `level` | `0` (default) or `1`. A level-1 row is a child of the nearest level-0 row above it. |
| `start`, `end` | 0-based period indices, inclusive. **Omitted on a group.** |
| `focus` | unchanged: the one highlighted row, at most one |

A **group** is a level-0 row that has at least one level-1 row directly after it. A level-0 row with no children after it is a plain row with its own `start` and `end`, identical to today's row.

`chart.milestones[]`: `label`, `at`; the cap rises from 4 to 6.

Derived span: a group spans `min(child.start)` to `max(child.end)`. One pure helper, `timelineLines(rows)`, in `src/engine/slides/charts/timeline-rows.ts`, is used by the renderer, the checks and the editor. Nothing stores a derived value.

### Limits

8 top-level rows, 12 lines in total (groups and children), 2 lines minimum, and with notes 6 lines in total and 20 characters per label. The periods limits are unchanged (3–16, and 8 with notes).

### Checks (warn, never rewrite)

Errors, in the existing `checkTimeline`:

- a level-1 row with no level-0 row above it;
- a group row that carries its own `start` or `end`;
- a level-1 row without `start` and `end`, or any row whose indices fall outside the periods;
- more than one row with `focus`;
- a `level` other than 0 or 1;
- total lines over the limits above.

## Rendering (`charts/chart-timeline.ts`)

- Every line is a row of equal height; row height shrinks with the line count, as now.
- A group: bold label; a thin bracket (a flat bar with short end caps) over its derived span.
- A child: label indented; the normal pill bar.
- Colour follows level, from the existing allocator slots. When the chart has sub-rows, top-level lines (groups and plain rows) draw in `ctx1` (the strongest grey) and sub-rows in `ctx3` (the quietest), the two ends of the grey scale. With no sub-rows every bar stays the quiet grey it is today, so existing slides do not change. A `focus` row keeps the focus colour.
- `colours.ts` marks `ctx1` and `ctx3` used (in place of `quiet`) when any row has `level: 1`, so the allocator's distance and contrast checks apply in every theme.
- Milestones are drawn as now.
- No inline styles in app chrome; slide CSS stays in `slides.css`.

## Agent

The `rows` description gains `level` and "a group omits `start` and `end`". The prompt rule stays one sentence: use a group when an initiative has two or more sub-steps. The agent does not choose colours. The starters' rows are still valid, so `starters.json` needs no change. The chart-capabilities line in `suggest.ts` mentions groups.

## Editor (`edit/Gantt.tsx`, `slides/gantt.ts`)

All writes are patches through `applyPatch`, the agent's path, so ⌘Z is the slide's history.

Row menu (right-click a row, same menu as today, extended):

- Insert workstream above / below, Add sub-row, Delete.
- Indent (becomes the last child of the group above) and Outdent (becomes top-level, after its group). A first row cannot indent.
- Deleting a group asks nothing: its children move up a level (undo restores), unless the row menu's Delete group and sub-rows is chosen.

Drag: grip as today. The drop line shows the target position; dropping on the right half of a row nests under it (or under its group), the left half makes it top-level. The result is one patch.

Group rows: the bar is drawn from the derived span and is read-only (painting on it does nothing; Space on it does nothing). Moving a child recomputes the span for free.

Period insert and delete reindex only rows that have their own `start`/`end`.

Milestones: Add milestone from the menu or the button (up to 6); click a period in the milestone's row to move it (as now); delete as now.

Grid: group and child rows get the indent and the bold label; the editor's bars follow the same rule: darker for top-level, lighter for sub-rows when any exist.

## Tests

Unit (`tests/unit/gantt.test.ts`, a new `timeline-rows.test.ts`, `schema` and `render` tests):

- `rowSpans`: group span from children; plain row unchanged; group with no children falls back to plain.
- Checks: each error above; a row with `focus: true` still validates.
- Editor operations: add sub-row, indent, outdent, move under another group, delete group (children move up), delete with children, period insert and delete across groups, milestone cap 6.
- Render: group bracket and indented child present; top-level and sub-row bars differ in colour only when sub-rows exist, and a chart without sub-rows renders as before; the allocator accepts the slots in every theme.
- Existing gantt tests pass unchanged.

Browser (`tests/browser/edit.spec.ts`): add a sub-row from the menu; drag a row under another group and see the group's bar grow; add and move a milestone; ⌘Z for each. The review page (`/src/dev/review.html`) shows a group example in both styles at full size, checked for gaps and overflow.

## Order of work

1. Data and checks: schema, `rowSpans`, checks, legacy `focus`.
2. Renderer and colours.
3. Agent description and prompt.
4. Editor operations (pure, in `gantt.ts`), then the UI.
5. Browser tests and the review page.

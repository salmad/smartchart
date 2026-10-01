# Gantt: groups, colour roles and milestones

Status: draft for review. Extends section 4.3 of `2026-10-01-manual-slide-editing-design.md` (the gantt editor) and the timeline kind in `2026-09-27-chart-capabilities-design.md`.

## Why

A timeline today is a flat list of 2–8 bars, one of them optionally the focus. Real plans have big initiatives made of smaller ones, a milestone that belongs to the programme, and a bar that is not grey. The editor can paint bars and add or delete rows, but cannot express any of that, and neither can the agent.

Decided with the user (2026-10-01):

1. A sub-row is a **group with a derived span**: the parent's bar is the earliest child start to the latest child end. Two levels.
2. Colour is a **role per row** (`focus`, `contrast`, `neutral`), never a hex. The allocator keeps contrast and distinctness in every theme.
3. Milestones **stay in the shared foot lane**. The editor gets better; the cap rises.
4. Groups are stored **flat with a level**, so dragging a row under another is a change of position and level, nothing more.

Out of scope: more than two levels, dependencies between bars, per-row milestones, free colours, a legend, bars that skip periods.

## Data

`chart.rows[]` stays one flat list.

| field | meaning |
|---|---|
| `label` | name, max 28 characters |
| `level` | `0` (default) or `1`. A level-1 row is a child of the nearest level-0 row above it. |
| `start`, `end` | 0-based period indices, inclusive. **Omitted on a group.** |
| `color` | optional `focus`, `contrast` or `neutral`. Absent means quiet grey, as today. |
| `focus` | legacy boolean. Read as `color: "focus"`. The editor clears it and writes `color` on the next edit of that row. Existing slides need no rewrite. |

A **group** is a level-0 row that has at least one level-1 row directly after it. A level-0 row with no children after it is a plain row with its own `start` and `end`, identical to today's row.

`chart.milestones[]`: `label`, `at`, and a new optional `color` (same roles). The cap rises from 4 to 6.

Derived span: a group spans `min(child.start)` to `max(child.end)`. One pure helper, `rowSpans(rows)`, in `src/engine/slides/charts/timeline-rows.ts`, is used by the renderer, the checks and the editor. Nothing stores a derived value.

### Limits

8 top-level rows, 12 lines in total (groups and children), 2 lines minimum, and with notes 6 lines in total and 20 characters per label. The periods limits are unchanged (3–16, and 8 with notes).

### Checks (warn, never rewrite)

Errors, in the existing `checkTimeline`:

- a level-1 row with no level-0 row above it;
- a group row that carries its own `start` or `end`;
- a level-1 row without `start` and `end`, or any row whose indices fall outside the periods;
- more than one row with the focus role (by `color` or legacy `focus`);
- a `level` other than 0 or 1;
- total lines over the limits above.

## Rendering (`charts/chart-timeline.ts`)

- Every line is a row of equal height; row height shrinks with the line count, as now.
- A group: bold label; a thin bracket (a flat bar with short end caps) over its derived span.
- A child: label indented; the normal pill bar.
- The role maps through the colour allocator: `focus`, `contrast`, `neutral`, else `quiet`. `colours.ts` marks those slots used when any row or milestone asks for them, so the existing distance and contrast checks apply.
- A milestone with a role draws its diamond in that colour. The dashed line and the lane layout are unchanged.
- No inline styles in app chrome; slide CSS stays in `slides.css`.

## Agent

The `rows` description gains `level`, "a group omits `start` and `end`" and `color`. The prompt rule stays one sentence: use a group when an initiative has two or more sub-steps; at most one focus. The starters' rows are still valid, so `starters.json` needs no change. The chart-capabilities line in `suggest.ts` mentions groups.

## Editor (`edit/Gantt.tsx`, `slides/gantt.ts`)

All writes are patches through `applyPatch`, the agent's path, so ⌘Z is the slide's history.

Row menu (right-click a row, same menu as today, extended):

- Insert workstream above / below, Add sub-row, Delete.
- Indent (becomes the last child of the group above) and Outdent (becomes top-level, after its group). A first row cannot indent.
- Colour: Focus, Contrast, Neutral, None. Choosing Focus moves it off any other row.
- Deleting a group asks nothing: its children move up a level (undo restores), unless the row menu's Delete group and sub-rows is chosen.

Drag: grip as today. The drop line shows the target position; dropping on the right half of a row nests under it (or under its group), the left half makes it top-level. The result is one patch.

Group rows: the bar is drawn from the derived span and is read-only (painting on it does nothing; Space on it does nothing). Moving a child recomputes the span for free.

Period insert and delete reindex only rows that have their own `start`/`end`.

Milestones: Add milestone from the menu or the button (up to 6); click a period in the milestone's row to move it (as now); Colour entry in the milestone's menu; delete as now.

Grid: group and child rows get the indent and the bold label; the editor's bars follow the same colour mapping (ink for focus, mid for contrast, soft for neutral, light for none).

## Tests

Unit (`tests/unit/gantt.test.ts`, a new `timeline-rows.test.ts`, `schema` and `render` tests):

- `rowSpans`: group span from children; plain row unchanged; group with no children falls back to plain.
- Checks: each error above, and legacy `focus: true` accepted.
- Editor operations: add sub-row, indent, outdent, move under another group, delete group (children move up), delete with children, colour set and focus exclusivity, period insert and delete across groups, milestone cap 6.
- Render: group bracket and indented child present; colour classes `c-focus`, `c-contrast`, `c-neutral`, `c-quiet`; colours validate in every theme (allocator's own test).
- Existing gantt tests pass unchanged.

Browser (`tests/browser/edit.spec.ts`): add a sub-row from the menu; drag a row under another group and see the group's bar grow; set a colour and see it on the slide; add and move a milestone; ⌘Z for each. The review page (`/src/dev/review.html`) shows a group example in both styles at full size, checked for gaps and overflow.

## Order of work

1. Data and checks: schema, `rowSpans`, checks, legacy `focus`.
2. Renderer and colours.
3. Agent description and prompt.
4. Editor operations (pure, in `gantt.ts`), then the UI.
5. Browser tests and the review page.

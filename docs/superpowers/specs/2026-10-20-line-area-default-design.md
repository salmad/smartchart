# The area fill under a focus line: on by default, and editable

> Status: approved and built 2026-10-20. Calls made while building: the menu item sits in its own "Chart" group; pair halves are not covered (a half has no focus-line action yet); the schema description was cut to fit the chart card's token budget.

## Why

The gallery's line chart shades the area under its focus line (a soft gradient in the focus colour). It does that only
because its JSON says `"area": true`. A line chart written without the flag (by an agent, or by hand) draws a bare
line. The production teardown doc's revenue chart is one: it should match the gallery chart, and it doesn't. Nobody
can fix that from the editor either: no control in a deck or a doc sets `area` (the chart's right-click menu holds
only "Edit chart data…").

Two defects, one change:
1. The fill is opt-in, so most line charts miss the look the product is known for.
2. A person has no way to turn it on or off by hand.

## Goals

- A line chart whose series are all lines draws the fill under its focus series, with no flag needed. Decks and docs,
  both themes, the same way (they share one chart renderer).
- Turning it off is explicit: `"area": false` on the focus series.
- A person can turn it on or off from the chart's right-click menu, in a deck and in a doc. It is a patch to
  `chart.series[i].area` through the slide's own edit path, so undo, Save and Discard behave as for any edit.
- Agents are told in the schema description (what `get_template` and the guides show) that the fill is the default and
  how to turn it off.

## Non-goals

- No other chart setting gets a control here (focus series, bar or line, stacking, annotations). A per-series menu is
  its own spec; this change adds the one item.
- No change to charts with any bar series: they never fill (the schema already refuses `area` beside bars, and that
  stays).
- No change to the fill's look (strength 28% on Ink, 16% on Paper stay as they are).
- No migration. Stored decks and docs are not rewritten: their line charts simply start to show the fill when drawn.

## Anti-goals

- A fill that appears on a series that isn't the focus, or on several lines at once.
- A write that silently changes someone's saved JSON. The default is applied when drawing, never written back.

## Design

**Default.** The renderer (`lines()` in `src/engine/components/charts/chart.ts`) fills the focus series unless that
series says `area: false`. Today the test is `s.area && slot === "focus"`; it becomes `s.area !== false && slot === "focus"`.
Only reached when every series is a line, as before. A chart with a focus series that is a bar, or mixed marks, is
unchanged.

**Schema.** In `src/engine/slides/schema.ts` the `area` field's default flips to `true` and its description says: the
focus series of a line-only chart is shaded by default; write `false` for a plain line. The hand-edit defaulting in
`src/engine/slides/edit.ts` reads the same default. The validation rule that refuses `area` on a bar series, or beside
bars, stays and only looks at an explicit `true`.

**Agents.** The new description is the instruction. If a chart guide or prompt names `area`, it gets the same
sentence; the builder searches for it and adds nothing if there is none (thin harness: no new check).

**The control.** In the chart's right-click menu (`src/app/edit/EditMenu.tsx`, beside "Edit chart data…") a checkable
item "Fill under the line", shown only when the chart draws as lines and has a focus series. Checked means drawn. A
click patches the focus series' `area` to `false` or `true`. Decks and docs share the menu (docs open a figure with
the deck's edit surface), so one change serves both. How the menu learns that the chart is all lines is left to the
builder: it should reuse what the renderer already works out, not recompute the rule.

## What changes visibly

- Every line chart with a focus series and no `area` field gains the fill, including old decks and the production
  teardown doc's chart-1. That is the point.
- Review page and look-lock baselines for such charts change; the builder checks each changed chart at full size and
  confirms no other slide moved.

## Tests

- Unit: a line chart with no `area` draws the fill; with `area: false` it does not; a bar chart, a mixed chart and a
  non-focus line never do; the schema still refuses `area: true` on a bar series.
- Browser: in a deck and in a doc, right-click a line chart, untick "Fill under the line", Done or Save, reload, and the
  chart has no fill; tick it and it returns. The item is absent on a bar chart.

## Left to the builder (my calls, to check)

- Naming the menu item "Fill under the line" (my wording).
- Showing the item only for line-only charts with a focus series, rather than disabled.
- Leaving the strength of the fill alone.

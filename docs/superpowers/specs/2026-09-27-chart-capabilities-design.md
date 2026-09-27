# Chart capabilities (think-cell style): design

Status: scope agreed in chat 2026-09-27 (annotations, waterfall, timeline); built in the v5 prototype (`v5/chart*.js`, tests in `tests/chart-math.test.js`, `tests/schema.test.js`; examples 10–15 and stress 7–14 on `v5/review.html`).
Depends on: `2026-09-27-colour-allocator-design.md`. Parent: `2026-09-26-slide-system-architecture-design.md`.

## 1. Principle

think-cell's value is **computed annotations**, not chart types: the tool does the arithmetic and the placement. Here the agent writes data and at most a small intent object (`{ "type": "cagr", "from": 0, "to": 4 }`); code computes every figure, draws it and keeps labels clear. No new menu entry: these are all the `chart` entry (D16). The agent picks `chart.kind`; Jev is not asked (the kind changes the data shape, so the writer decides).

## 2. `chart.kind`

| kind | Data the agent writes | Drawn by code |
|---|---|---|
| `bars` (default, omitted) | `categories`, `series` (as today) | bars/lines, plus annotations (3) |
| `waterfall` | `items: [{ label, value?, total?, focus? }]` | floating steps, connectors, subtotals, signed labels |
| `timeline` | `periods`, `rows: [{ label, start, end, focus? }]`, `milestones: [{ label, at }]` | a Gantt: one bar per row over the period columns, milestone diamonds |

### 2.1 Waterfall (bridge)

- `items`: 3–10. The **first item is a total** with a value (the start). Other items are deltas (`value`, signed) or totals (`total: true`).
- A total without a value is **computed** (running sum). A total with a value is **checked**: it must equal the running sum within rounding (0.5% or half the last displayed digit), else an error names both figures ("`items[5].value`: 118, but the steps sum to 121"). This is the think-cell "the maths is checked" guarantee.
- Colours: up = `pos-fill`, down = `neg-fill` (toned; labels in full `pos`/`neg`), totals = `ctx-3` (the quiet grey, so a total is never louder than the focus); solid hairline connectors; `focus: true` on one item draws it in `focus` (C6: meaning colours stay meaning).
- Labels: totals show their value above; deltas show a signed value (`+£3.1m`, `−£1.2m`) above the step for up and below it for down. Dashed connectors join each step's end level to the next.
- Negative running totals are allowed; the zero baseline is drawn.

### 2.2 Timeline (Gantt)

- `periods`: 3–16 short labels (columns). `rows`: 2–8, each `{ label (≤ 28), start, end }` as 0-based period indices, inclusive; `focus` on at most one. `milestones`: 0–4, `{ label (≤ 16), at }` where `at` is the period index the milestone ends.
- With notes (the narrow split layout): at most 8 periods and 4 rows, row labels ≤ 20 characters. Period labels thin out like bar categories when they would touch.
- Row bars: `quiet` (allowed by colour C4: every row is labelled), the focus row in `focus`, so the critical path carries the slide. Milestones: `fg` diamonds on a line across the rows, labels in a lane under the last row.
- `steps` stays the template for a simple 2–5 phase sequence; `timeline` is for parallel or overlapping workstreams on a time axis. This goes in the chart guide.

## 3. Annotations (`chart.annotations`, kind `bars` only)

At most 3 (2 with notes). Each is a small intent object; code computes the figure.

| type | Fields | Computes and draws |
|---|---|---|
| `cagr` | `from`, `to` (category indices), `series?` | CAGR `(v_to/v_from)^(1/(to−from)) − 1` on the series (default: the focus bar series, or the stack totals when stacked). A fine muted elbow arrow (start dot, small head) from the `from` bar to the `to` bar, with a pill holding the figure as a hero number in the display face (`+14%`, in the focus colour when it measures the focus series) and the unit as a small caption (`CAGR`). Values must be > 0. |
| `difference` | `from`, `to`, `series?`, `relative?` | `v_to − v_from` in the series format (`+£2.1m`; `pp` for a `%` format), or the % change when `relative`. The same arrow, bubble text in `pos`/`neg` by sign. |
| `target` | `value`, `label?` | A dashed line **behind** the bars at `value` in the bar unit. The chart keeps a right gutter so the label sits at the line's end, clear of every bar: caption (`PLAN`) over the figure (`£100m`) in the display face. The scale includes it. Value labels carry a halo in the background colour, so the line is cut around them, never through them. |

Arrows are placed above every bar and label in their range; several arrows stack in levels. The plot reserves headroom per annotation, so they never leave the plot.

**Also added to `bars`:**
- `stacked: "100"`: 100% stacked. Code converts to shares; segment labels are percentages; no totals.
- **Axis break (automatic):** unstacked bars where the tallest bar is more than 2.5× the next tallest (and no line or target in the bar unit sits above the cap). The tallest bar is drawn cut with a break mark, and its label keeps the true value. The agent never asks for it.

## 4. Validation (errors phrased as fixes)

- kind-specific required fields; fields of another kind are errors ("`chart.items`: only for kind waterfall").
- annotation indices in range, `from < to`, `series` is a bar series, CAGR values > 0, `target` only with bars.
- waterfall total check (2.1); timeline `start ≤ end`, indices in range, at most one focus.
- R11 (headline figures are on the slide) also accepts figures that annotations compute, so a title "grew at 14% a year" passes when a CAGR annotation shows 14%.

## 5. Tests

- Unit (`node --test`): the arithmetic (CAGR, difference, pp, relative, waterfall running sums and checks, 100% shares, break detection), the validation messages, the allocator mapping for each kind.
- Browser (Playwright on the review page): examples and stress slides for every kind in both palettes and both styles with 0 fit issues and 0 colour issues (R15); screenshots reviewed one by one.

## 6. Out of scope (now)

Mekko, scatter/bubble, cross-series level differences, "Other" grouping, user-dragged label positions.

# Richer tables, the split slide, and capability guidance

Date: 2026-10-03. Status: design approved in chat; revised after review; awaiting spec review.

## 1. Goal

Make tables and two-up slides as expressive as consulting work needs, and make sure every agent (in-app and MCP) knows what each template can do and when to use each capability, without relying on what the gallery happens to show.

Three parts, one spec:

1. **Tables:** header icons, bullets in cells, marks with notes, status labels, group headings, and judgement guidance for each.
2. **Split slide:** `pair` generalised from two charts to two halves, each a chart, table, number or points.
3. **Notes:** a longer consulting sentence and a higher total.

Running through all three: **capability guidance on the template cards.**

## 2. Capability guidance

### Problem

Today an agent learns a template from its card (fields, limits, rules) and one example: the first matching gallery slide, with its extras removed (`exampleFor`, `src/engine/agent/prompts.ts:17`). For tables that example has cell notes but no marks; ticks and Harvey balls are mentioned only inside the `cells` field description. In practice the gallery decides what the agent knows.

### Design

Templates in `MENU` (`src/engine/slides/schema.ts`) get an optional `capabilities` list. Each entry:

| Field | Meaning |
|---|---|
| `name` | Short label: "Marks: ✓ / ✗" |
| `use` | When to use it, as judgement, not a feature list |
| `avoid` | When not to, and what to use instead |
| `sample` | A complete body for this template showing the capability (the whole `table` object, or the whole `halves` list), no frame fields |
| `styles` | Optional: the styles the sample is valid in (default both) |

Templates whose content comes in recognisable shapes also get a `shapes` list (content → recommended combination). Tables and the pair have one.

**Where:** entries are written only where the agent has a real choice to make: **chart, pair, table, cards, steps** and the **notes** field (shared by chart and table). Cover, section, quote, number and summary have no choices between capabilities, so they get none. That avoids paying tokens for no decision.

**Size:** at most 7 entries per template; `use` and `avoid` one sentence each. Cards and examples are already stripped from history after the turn (`agent.ts:253–266`), so the cost is per `create_slide` / `get_template`, not cumulative. The table card is about 1k tokens plus a ~400-token example today; the target is to add no more than ~600.

**Rules vs capabilities:** `rules` say what `validate` enforces (limits, errors, warnings). `capabilities` hold judgement only. No sentence appears in both: for example "one kind of mark per table" stays a rule, and the capability says when to choose ticks over balls. `CHART_GUIDE` stays an exported array, because Jev's mark/stacking questions (`agent.ts:299`) and the pair rules (`schema.ts:287`) use it. Its judgement lines (which chart kind for which content) are copied into chart capabilities and then removed from `CHART_GUIDE`. Its enforced lines stay.

`describe()` includes `capabilities` and `shapes` in `TemplateCard`, so the in-app agent (the `create_slide` result) and MCP (`get_template`, the template resource) receive them with no other change. The gallery example stays as one worked whole slide.

### Guard

A unit test wraps each `sample` in a minimal frame (a title, plus a subtitle where the style needs one) and validates it in each style it declares: no errors. A sample the schema rejects fails the build.

## 3. Tables

### 3.1 Capabilities and schema

`Cell` (`types.ts:24`) becomes a string or `{ value, note?, bullets?, status? }`. `cellOf` and the "cell" check (`schema.ts:506, 535`) accept the new shape, and the error text lists the allowed keys.

| Capability | Schema | Validation |
|---|---|---|
| Header icons | `columns[].icon`: enum from `ICONS` | Every column after the first has an icon, or none do (error). An icon on a column of numbers: warning. |
| Mark with a note | `{ "value": "✓", "note": "from Q2" }` | Already valid. **New rendering work:** `render.ts:76` returns the mark before the note branch (`:77`), so the note is dropped today. Render the mark with a `<small>` under it; `.tbl td.score` needs padding for it. |
| Bullets in a cell | `{ "value"?: "Lead", "bullets": [...] }` | 1–3 bullets, at most 50 characters each. Not with `note` in the same cell. At most one column of bullet cells per table, and only in tables of at most 4 columns (errors). Pitch hides them like cell notes; a pitch table with bullet cells gets a warning. |
| Status label | `{ "value": "Live", "status": true }` | More than 4 distinct status values in one column: warning. |
| Group heading | row with `style: "group"` and exactly one cell | Exempt from the "one cell per column" check. Warnings if the table has fewer than 6 data rows, or any group has fewer than 2 rows. Group rows do not count toward the 8-row cap; the budget below limits height. |

**`columnAlign`** moves from `render.ts:62` to a framework-free module beside `marks.ts`, so the validator can use it (number-column check). Status and bullet cells count as text.

**Budget.** Keep today's costs (`schema.ts:314`: row 1, row with a cell note 1.5, takeaway 1.5, caption 1, Harvey-ball key 1). Add provisional costs: a row with a bullets cell costs 1 + 0.75 per bullet beyond the first; a group row costs 0.75; header icons cost 0.5 once. Bullets wrap in narrow columns, so all of these are tuned on the review page, and the rule text on the card is updated to the final numbers.

### 3.2 Visual design

- **Header icons:** 16px lucide icon above the label, in the header text colour (muted), the header row growing to fit. Not beside the label (it would crowd 19px mono headers). The first (label) column has none, so lint L1's label-column measure (`lints.ts:64–66`) is unchanged. Shown in both styles.
- **Status labels:** a neutral outline pill, mono small caps, the same colour for every value. No focus tint, never red or green: the value is the information, not the colour. If the column is `focus`, the pill takes the column's focus text colour like any other cell.
- **Bullets in a cell:** the existing bullet style at cell size, top-aligned; the row's other cells top-align too.
- **Group heading:** a spanning row in the header's mono small caps with a hairline above, no fill.
- **Mark with a note:** the mark centred, the note in the existing `<small>` style under it.

### 3.3 Guidance (the table's `capabilities`)

- **✓ / ✗:** each option has the property or doesn't. Use only when every scored cell is a clear yes or no.
- **Harvey balls:** degree matters, with 3+ steps between none and full.
- **Words or figures:** the reader needs the value itself (£5k vs £25k). Never turn a figure into a mark.
- **Not applicable:** "—", not ✗. ✗ is a judgement ("lacks it").
- **Cell note:** a qualifier the value needs to be read correctly ("✓ · from Q2"). Not a restatement of the header. At most about 1 cell in 3.
- **Bullets in a cell:** a row that explains a position (why an option leads, a competitor's approach), usually the last column. Not when a phrase would do.
- **Header icons:** columns are categories scanned across (features, criteria, segments); most useful with 4–5 columns of marks. Not on number columns.
- **Status labels:** a stage or state the reader filters by (Live / Pilot / Planned). Not good/bad judgements; those are marks.
- **Group headings:** 6+ rows that fall into 2–3 named groups.
- **Focus row or column:** the one the title is about (usually "us"). At most one.

`shapes`:

| Content | Shape |
|---|---|
| Options vs criteria | marks, optional header icons, focus column on our option |
| Exact figures | words/figures, `total` row, no marks |
| Explaining positions | short first column plus one bullets column |
| Actions | owner, date and status-label columns |

On the card the first four points are one entry, "Scoring", which gives seven entries.

## 4. Split slide (`pair` generalised)

### 4.1 Schema

- The template id stays `pair` (no churn in routing, picker or MCP; `split` is already the chart-with-notes variant name).
- `charts` becomes `halves`: exactly 2, left then right, equal width.
- Each half has exactly one body: `chart` | `table` | `number` | `points`.
  - `chart`: as today's half chart, with optional `bullets` under it (1–2, ≤ 55 consulting / 40 pitch), as today.
  - `table`: 2–3 columns, at most 5 rows; marks, cell notes and status labels allowed; no bullet cells, group headings or header icons.
  - `number`: the number template's object `{ value, caption, tone? }`; `value` at most 7 characters, `caption` at most 80.
  - `points`: 2–4 points of at most 70 characters, markup allowed (a **bold** lead-in). Named `points`, not `bullets`, because `bullets` under a chart already means something else with other limits.
- `caption` (≤ 40): required with a chart or table body, optional with number or points (a label over a big number or a list is often redundant).
- Validation: a half with no body or more than one gives an error naming the fields found. One focus across the slide. With a takeaway, at most 1 bullet under each chart (as today). An old `charts` field gives an error: "`charts` is now `halves`; each half has one of chart, table, number, points."

`types.ts`: `Exhibit` (`types.ts:30`) becomes a `Half` union by body; `Slide.charts` (`:44`) becomes `halves`.

### 4.2 Guidance (the pair's `shapes`)

- chart + chart: two related measures (market size and our share).
- chart + table: a trend and the exact figures or breakdown behind it.
- chart + points: a chart and its reasons. Numbered observations are a chart with notes instead.
- number + chart: a headline figure and the trend that produced it.
- table + table: before vs after, or us vs them, in the same columns.
- points + points: a two-way contrast in prose (problem vs solution). Short sides are framed cards instead.
- **Not a pair when** one half would merely restate the other, or one half is much heavier. Use the full-width template.

The picking guide entry for `pair` becomes "two related things that each need their own exhibit, side by side".

### 4.3 Rendering

Work in `render.ts` and `slides.css`:

- `pair` builder (`render.ts:106`) renders each half by body: the chart host as today, `tableHTML`, a number block, or a list.
- `mountSlide` reads `s.halves?.[i]?.chart` (`render.ts:164`).
- `sizeTable` (`:189`) sizes every `.tbl`, not only the first; `growTable` (`:202`) stays off for pairs (both halves share the height).
- `.tbl.narrow { width: 66.667% }` (`slides.css:170`) must not apply inside a half; a half table is full half width.
- The Harvey-ball key appears once per slide, under the half that needs it, not once per half.
- Captions top-align across both halves, as today. A half without a caption keeps the caption row's space so the bodies align.

### 4.4 Existing decks and other uses of `charts`

Following "ignore old decks", stored decks with `charts` are not migrated; such a slide renders empty halves and `validate` names `halves`. The two gallery pair slides are rewritten to `halves`.

Every other reader of `charts` moves to `halves`: `checks.ts:24,44`, `edit.ts:18`, `gantt.ts`, `sheet.ts:191–235`, `review.ts`, `landing/Close.tsx`, and the editor (`EditMode.tsx:69`, `EditMenu.tsx:66`, `EditOverlay.tsx:56`, `EditBar.tsx:11` "Two charts" → "Two halves"). `switchTemplate` keeps or drops halves by the same rule it uses for charts today.

## 5. Notes

- Consulting `notes[].text` max goes from 80 to 120. Titles stay at 28. Pitch notes stay title-only (`text` is consulting-only, `schema.ts:257`); no change there.
- `checkNotes`'s total with a takeaway stays as a server-side check, because MCP writes never see the browser measure (`fitIssuesAt`, `src/app/measure.ts:22`). The total rises from 200 to a provisional 300, tuned on the review page; the browser measure remains the layer-3 backstop.
- The notes field gets the same use/avoid guidance (a note says something the body does not already show; 3 or none; prefer none in pitch).

## 6. Manual editor

The manual-editing spec (2026-10-01, §4.3) models a table as a plain grid. Changes:

- **Sheet (`sheet.ts:158–168`):** a cell with `bullets` or `status` keeps its shape on edit (today `text()` returns `x.value`, which would flatten a bullets cell). Bullet cells edit as one line per bullet; status cells show and edit the value, with a toggle for status.
- **Group rows:** shown as a spanning label row, editable as one text field, not as cells; `insertRow` (fills one cell per column) never creates a group row; a "group heading" row action adds one.
- **Halves:** the sheet's `which` selects a half; a half table edits like a table; number and points edit as fields. Changing a half's body type is not in the editor (ask the agent).

## 7. Gallery (rewrite content, no new example set)

In `src/engine/starters/starters.json`:

- **Competition** table → options vs criteria: ✓ / ✗, one ✓ with a note, header icons, focus column on Acme.
- **Business model** table → explaining positions: a bullets column (it has 4 columns).
- **What's next** table → actions with status labels, and group headings with enough rows to need them, within the budget.
- **The two pair slides** → chart + table, and number + points.

## 8. Testing

- **Unit (vitest):** every capability `sample` validates in its declared styles; new cell shapes, header icons, status labels, group headings and half bodies validate; each limit gives an error naming the path, the measure and the fix; `charts` gives the `halves` error; `columnAlign` with status and bullet cells; `exampleFor` still finds an example per lead; the editor sheet round-trips bullets, status and group rows without flattening. Update `tests/unit/__snapshots__/tools-registry.test.ts.snap` if it pins the card shape.
- **Review page:** every changed example in both styles at full size (`?only=<i>&full=1`), checked for gaps and overflow, especially half-width tables, the bullets column, header icons and group headings. The provisional budgets in §3.1 and §5 and the limits in §4.1 are tuned here.
- **Browser (Playwright):** the existing review-page lint and smoke runs pass.
- **Agent harness:** prompts that should reach the new features without naming them, e.g. "compare these four cards on fees, limits, rewards and app", "show ARR growth and the figures behind it", "what each competitor does differently", "our actions this quarter and where each stands". Pass if the agent picks the expected shape.

## 9. Out of scope

Images, agenda slide, a plain text slide, bars inside table cells (recorded in `docs/product/FUTURE.md`).

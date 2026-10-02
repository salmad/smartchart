# Richer tables, the split slide, and capability guidance

Date: 2026-10-03. Status: design approved in chat; awaiting spec review.

## 1. Goal

Make tables and two-up slides as expressive as consulting work needs, and make sure every agent (in-app and MCP) knows what each template can do and when to use each capability, without relying on what the gallery happens to show.

Three parts, one spec:

1. **Tables:** header icons, bullets in cells, marks with notes, status labels, group headings, and judgement guidance for each.
2. **Split slide:** `pair` generalised from two charts to two halves, each a chart, table, number or bullets.
3. **Notes:** a longer consulting sentence, fit measured instead of capped by characters.

Running through all three: **capability guidance on every template card.**

## 2. Capability guidance (all templates)

### Problem

Today an agent learns a template from its card (fields, limits, rules) and one example: the first matching gallery slide, with its extras removed (`exampleFor` in `src/engine/agent/prompts.ts`). For tables that example has cell notes but no marks; ticks and Harvey balls are mentioned only inside the `cells` field description. In practice the gallery decides what the agent knows.

### Design

Each template in `MENU` (`src/engine/slides/schema.ts`) gets a `capabilities` list. Each entry has:

| Field | Meaning |
|---|---|
| `name` | Short label: "Marks: ✓ / ✗" |
| `gives` | What the reader gets |
| `use` | When to use it, as judgement, not a feature list |
| `avoid` | When not to, and what to use instead |
| `sample` | A minimal JSON fragment of the slide showing only this capability |

Templates whose content comes in recognisable shapes also get a `shapes` list (content → recommended combination of capabilities). Tables and the split slide have one; others only if useful.

`describe()` includes both lists in the `TemplateCard`, so the in-app agent (`create_slide` result) and MCP (`get_template`, the template resource) receive them with no other change. The gallery example stays as one worked whole slide; it is no longer the only place a capability is shown.

Written for **every** template (chart, pair, table, number, quote, steps, cards, summary, cover, section), not only the ones this spec changes. Existing guidance that is really capability guidance (for example `CHART_GUIDE`) moves into the chart's `capabilities` rather than being duplicated.

### Guard

A unit test merges every `sample` into that template's plain gallery example and validates it in both styles: no errors. A sample that the schema rejects fails the build, so guidance cannot drift from the code.

## 3. Tables

### 3.1 New and clarified capabilities

| Capability | Schema | Notes |
|---|---|---|
| Header icons | `columns[].icon`: an enum from `ICONS` | All columns but the first have an icon, or none do (error otherwise). Not on columns whose values are numbers (warning). |
| Mark with a note | `{ "value": "✓", "note": "from Q2" }` | Probably works already (`markOf` reads `cell.value`); verify rendering and add a test. |
| Bullets in a cell | `{ "value"?: "Lead", "bullets": ["…", "…"] }` | 1–3 bullets, at most 50 characters each. At most one column of bullet cells per table (error). Not with `note` in the same cell. Pitch: hidden like cell notes, so a pitch table should not depend on them (warning when a pitch table has bullet cells). |
| Status label | `{ "value": "Live", "status": true }` | A small label drawn in the focus colour family, neutral, never red/green. Values within a column should come from a small set (≤ 4 distinct; warning). |
| Group heading | row `style: "group"`, one cell | A heading spanning the table. Only with ≥ 6 rows of data and ≥ 2 rows per group (warnings). Costs 0.75 in the row budget. |

The **row budget** becomes a **line budget**. A bullets cell costs one line per bullet beyond the first, and rows are measured on the review page to set the final numbers. The rule text on the card is updated to match.

### 3.2 Guidance (goes into the table's `capabilities`)

- **✓ / ✗:** each option has the property or doesn't. Use only when every scored cell is a clear yes or no.
- **Harvey balls:** degree matters, with 3+ steps between none and full. Never mixed with ✓ / ✗ in one table (existing warning).
- **Words or figures:** the reader needs the value itself (£5k vs £25k). Never turn a figure into a mark.
- **Not applicable:** "—", not ✗. ✗ is a judgement ("lacks it").
- **Cell note:** a qualifier the value needs to be read correctly ("✓ · from Q2"). Not a restatement of the header. At most about 1 cell in 3.
- **Bullets in a cell:** a row that explains a position (why an option leads, a competitor's approach), usually the last column. Not when a phrase would do. Two bullet columns means the content is really cards or notes.
- **Header icons:** columns are categories scanned across (features, criteria, segments); most useful with 4–5 columns of marks. Not on number columns. All or none.
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

## 4. Split slide (`pair` generalised)

### 4.1 Schema

- The template id stays `pair` (no churn in routing, picker or MCP; `split` is already the chart-with-notes variant name).
- `charts` becomes `halves`: exactly 2, left then right, equal width.
- Each half: `caption` (required, ≤ 40), exactly one body of `chart` | `table` | `number` | `bullets`, plus optional `bullets` under a chart (1–2, as today).

| Body | Limits (first estimate; set finally from the review page) |
|---|---|
| `chart` | bars, waterfall, ranked; today's half-width limits |
| `table` | 2–3 columns, ≤ 5 rows; marks, cell notes and status labels allowed; no bullet cells, group headings or header icons |
| `number` | `{ value, text }`: a big value and a sentence ≤ 80 |
| `bullets` | 2–4 points ≤ 70, markup allowed (a **bold** lead-in) |

Validation: exactly one body per half (error naming the extra or missing field); one focus across the slide; with a takeaway, at most 1 bullet under each chart (as today).

### 4.2 Guidance (the pair's `shapes` and `capabilities`)

- chart + chart: two related measures (market size and our share).
- chart + table: a trend and the exact figures or breakdown behind it.
- chart + bullets: a chart and its reasons. Numbered observations are a chart with notes instead.
- number + chart: a headline figure and the trend that produced it.
- table + table: before vs after, or us vs them, in the same columns.
- bullets + bullets: a two-way contrast in prose (problem vs solution). Short sides are framed cards instead.
- **Not a pair when** one half would merely restate the other, or one half is much heavier. Use the full-width template.

The picking guide entry for `pair` becomes "two related things that each need their own exhibit, side by side".

### 4.3 Rendering

`render.ts` renders each half with the existing builders (half chart, `tableHTML`, a number block, a bullet list) inside the current pair grid. `slides.css` gets half-width rules for a table, a number and bullets in a half. Captions top-align across both halves as today.

### 4.4 Existing decks

Following "ignore old decks", stored decks with `charts` are not migrated. The two gallery pair slides are rewritten to `halves`.

## 5. Notes

- `notes[].text` max: consulting 120 (was 80), pitch 80. Title stays 28.
- The 200-character total with a takeaway (`checkNotes`) is replaced by the measured fit: the review page and the in-browser fit check flag an overflowing notes column; the character rule goes.
- The notes field gets the same use/avoid guidance (a note says something the body does not already show; 3 or none; prefer none in pitch).

## 6. Gallery (rewrite content, no new example set)

In `src/engine/starters/starters.json`:

- **Competition** table → options vs criteria: ✓ / ✗, one ✓ with a note, header icons, focus column on Acme.
- **Business model** table → explaining positions: a bullets column.
- **What's next** table → actions with status labels; group headings if the row count allows.
- **The two pair slides** → chart + table, and number + bullets.

## 7. Testing

- **Unit (vitest):** every capability `sample` validates in both styles; the new cell shapes, header icons, status labels, group headings and half bodies validate; each limit gives an error naming the path, the measure and the fix; an old `charts` field gives a clear error pointing to `halves`.
- **Review page:** every changed example in both styles at full size (`?only=<i>&full=1`), checked for gaps and overflow, especially half-width tables, bullets columns and group headings. Limits in §3 and §4 are tuned here.
- **Browser (Playwright):** the existing review-page lint and smoke runs pass.
- **Agent harness:** prompts that should reach the new features without naming them, e.g. "compare these four cards on fees, limits, rewards and app", "show ARR growth and the figures behind it", "what each competitor does differently", "our actions this quarter and where each stands". Pass if the agent picks the expected shape.

## 8. Out of scope

Images, agenda slide, a plain text slide, bars inside table cells (recorded in `docs/product/FUTURE.md`).

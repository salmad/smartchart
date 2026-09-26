# Hybrid agent, chart marks and layout rules: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the hybrid slide agent of spec §9 in the journey prototype: a Jev pre-step, path patches for every change to an existing slide, Jev for closed-set choices, a live working-slides block, a reply that rides on a clean write, and judgment checks after the turn. Build it on a slide contract with a bar-or-line mark per series, stacked bars, code-owned table layout and the new content checks. Then measure it against the MVP agent.

**Architecture:** Three parts, each leaving the prototype working.
- **Part A (Tasks 1–3), the slide contract:** schema, renderer and layout lints in `docs/design/proposals/v5/`.
- **Part B (Tasks 4–11), the agent:** small pure modules (`patch.js`, `autofix.js`, `resolve.js`, `pre.js`, checks), then the loop (`agent.js`) and the page (`app.js`) in `docs/design/proposals/journey/`.
- **Part C (Task 12), the evaluation:** a harness in `docs/research/2026-09-27-hybrid-agent/` that runs the §9.7 test in headless Chromium.

**Tech Stack:**
- Plain ES modules in the browser (no build step). Node 26 built-in test runner (`node --test`) for pure modules.
- Playwright 1.58.2 for browser tests and the harness.
- Models: GLM 5.3 Flash and Jev through the local proxy (`node docs/design/proposals/journey/server.mjs`).

**Spec:** `docs/superpowers/specs/2026-09-26-slide-system-architecture-design.md`: §3.6 (layout L1–L6), §4.2a (chart labels), §6 (checks R1–R14, J1–J8), §9.0–9.7 (hybrid agent). Read §9 in full before Part B.

## Global Constraints

- GLM 5.3 Flash is the agent model; **OpenRouter is used only for Jev**. No other text model.
- PRE acts only when the intent probability is **p ≥ 0.7**.
- An `auto` choice takes Jev's pick at **p ≥ 0.6**; below that, the style default. Icons always take Jev's top pick.
- A judgment check fails only when a failing value has **p ≥ 0.7**.
- At most **10 tool calls** per user turn; the turn must end with a reply.
- **Existing slides change only through `patch_slide`.** `edit_slide` writes full JSON only for a slide `create_slide` reserved in the same turn.
- A value the user named is never overridden by code or Jev.
- Layout is code-owned, never in slide JSON:
  - L1: label column 20–40% of the table; data columns equal width.
  - L3: body gap consulting **56 px**, pitch **72 px**.
  - L5: body fill **≥ 60%**; a narrow table is capped at **2/3** of the content width.
- Chart guide text: exactly as spec §9.1, stored once in `v5/schema.js` as `CHART_GUIDE`.
- Files stay under ~300 lines; no `any` (plain JS here); match the surrounding code's style: terse, comment only the why.
- Slide canvas is 1920×1080; measurement is in slide pixels.
- Commit after every task; end every commit message with the line `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

**Commands:**
- Unit tests: `node --test docs/design/proposals/tests/`, added as `npm run test:proto` in Task 1.
- Browser tests (need the server running in another shell: `node docs/design/proposals/journey/server.mjs`): `cd docs/design/proposals/tests/browser && npm i && node review.mjs`.

---

## File map

| File | Status | Responsibility |
|---|---|---|
| `v5/schema.js` | modify | chart `mark`/`stacked`, `focus: "auto"`, icon `auto`, `num` removed, `CHART_GUIDE`, `upgrade()` |
| `v5/examples.js` | modify | examples and stress deck in the new chart and table shape; a stacked stress slide |
| `v5/chart.js` | create | chart drawing moved out of `render.js`; mixed marks; stacked bars |
| `v5/render.js` | modify | table alignment from content (`columnAlign`), fixed columns, label width, table growth; imports `chart.js` |
| `v5/lints.js` | create | `fitIssues` (moved) and `layoutLints` (L1, L3, L5, L6) |
| `v5/slides.css` | modify | body gap token, table alignment classes, stacked and total labels, equal step rows |
| `v5/review.html` | modify | imports `lints.js`; layout lints listed as issues |
| `journey/patch.js` | create | `parsePath`, `applyPatch` |
| `journey/autofix.js` | create | trivia fixes (moved from `pipeline.js`) and dependent-field fixes |
| `journey/resolve.js` | create | `resolveAuto`: every `auto` in one Jev call |
| `journey/pre.js` | create | `preStep` (one Jev call) and `firstCall` |
| `journey/checks.js` | modify | R9–R14, J8 |
| `journey/agent-prompt.js` | modify | system prompt, 4 tools, `workingBlock` |
| `journey/agent.js` | rewrite | the hybrid turn |
| `journey/app.js` | modify | agent only, working set, judgment checks after the turn, `load()` for the harness, replay `upgrade()` |
| `journey/pipeline.js` | delete | the old engine (results are recorded in `docs/research/2026-09-26-agent-single-slide/`) |
| `journey/prompts.js` | modify | drop pipeline-only prompts |
| `tests/*.test.js` | create | unit tests (Node) |
| `tests/browser/*` | create | Playwright checks of the renderer and lints |
| `docs/research/2026-09-27-hybrid-agent/*` | create | the §9.7 test |

All paths below are relative to `docs/design/proposals/` unless they start with `docs/` or are repo-root files.

---

# Part A: the slide contract

### Task 1: Chart marks, stacking, `auto` values and `upgrade()` in the schema

**Files:**
- Modify: `v5/schema.js` (CHART at 80–99, notes at 102–112, `MENU` chart/table/steps/cards fields, `checkChart` at 338–355, the chart case of `checkRules` at 368–381)
- Modify: `v5/examples.js` (lines 7–14, 113–160, 163–170, 252–268)
- Modify: `package.json` (repo root: add the script)
- Create: `tests/schema.test.js`

**Interfaces:**
- Produces:
  - `CHART_GUIDE: string[]`
  - `upgrade(slide) → slide` (pure, returns a copy)
  - chart JSON `{ stacked?: true|false|"auto", categories, format?, series: [{ name, values, mark: "bar"|"line"|"auto", color?, format?, area?, dashed? }] }`
  - top-level `focus?: "auto"` on `chart`, `table`, `steps` and `cards`
  - card `icon` accepts `"auto"`
  - table columns `{ label, focus? }` (no `num`)

- [ ] **Step 1: Add the test script.** In the repo-root `package.json` `scripts`, add `"test:proto": "node --test docs/design/proposals/tests/"`.

- [ ] **Step 2: Write the failing tests** in `tests/schema.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { CHART_GUIDE, describe, upgrade, validate } from "../v5/schema.js";
import { EXAMPLES, stressFor } from "../v5/examples.js";

const chart = (c, extra = {}) => ({ template: "chart", title: "Revenue grew four times while the margin tripled", chart: c, ...extra });
const REV = { name: "Revenue", mark: "bar", color: "focus", values: [2.1, 4.8, 9.4] };
const MARGIN = { name: "Margin", mark: "line", color: "contrast", format: "{v}%", values: [12, 24, 31] };
const cats = ["2023", "2024", "2025"];
const errs = (s, style = "consulting") => validate(s, style).errors;

test("bars with a line in another unit are valid", () => {
  assert.deepEqual(errs(chart({ categories: cats, format: "£{v}m", series: [REV, MARGIN] })), []);
});

test("chart.type and series.line no longer exist", () => {
  const e = errs(chart({ type: "bars", categories: cats, series: [{ ...REV, line: false }] }));
  assert.ok(e.some((x) => x.startsWith("chart.type: not a field")));
  assert.ok(e.some((x) => x.startsWith("chart.series[0].line: not a field")));
});

test("mark is required and takes bar, line or auto", () => {
  const { mark, ...noMark } = REV;
  assert.ok(errs(chart({ categories: cats, series: [noMark] })).some((x) => x.startsWith("chart.series[0].mark: required")));
  assert.ok(errs(chart({ categories: cats, series: [{ ...REV, mark: "pie" }] })).some((x) => x.includes("Use one of: bar, line, auto")));
  assert.deepEqual(errs(chart({ categories: cats, stacked: "auto", series: [{ ...REV, mark: "auto" }] }, { focus: "auto" })), []);
});

test("a third unit is an error", () => {
  const third = { name: "Customers", mark: "line", format: "{v}k", values: [1, 2, 3] };
  assert.ok(errs(chart({ categories: cats, format: "£{v}m", series: [REV, MARGIN, third] })).some((x) => x.includes("3 units")));
});

test("stacking needs two bar series in one unit", () => {
  assert.ok(errs(chart({ categories: cats, stacked: true, series: [REV, MARGIN] })).some((x) => x.startsWith("chart.stacked:")));
  const b2 = { ...REV, name: "Services", color: "neutral" };
  assert.deepEqual(errs(chart({ categories: cats, stacked: true, format: "£{v}m", series: [REV, b2] })), []);
});

test("area and dashed are line-only", () => {
  assert.ok(errs(chart({ categories: cats, series: [{ ...REV, dashed: true }] })).some((x) => x.includes("only for line series")));
});

test("note points need a chart with bars", () => {
  const notes = { notes: [{ title: "Margin triples", point: { series: 1, index: 2 } }, { title: "Revenue grows" }] };
  assert.deepEqual(errs(chart({ categories: cats, format: "£{v}m", series: [REV, MARGIN] }, notes)), [], "a line over bars can be pinned");
  const lines = [{ ...REV, mark: "line" }, { ...REV, name: "Cost", mark: "line", color: "neutral" }];
  assert.ok(errs(chart({ categories: cats, format: "£{v}m", series: lines }, notes)).some((x) => x.startsWith("notes[0].point:")));
});

test("table columns have no num flag", () => {
  const s = { template: "table", title: "Growth leads on margin across every plan we sell", table: { columns: [{ label: "Plan" }, { label: "Price", num: true }], rows: [{ cells: ["Growth", "£49"] }] } };
  assert.ok(errs(s).some((x) => x.startsWith("table.columns[1].num: not a field")));
});

test("icon and focus accept auto", () => {
  const s = { template: "cards", title: "Three levers move the margin by a third this year", focus: "auto",
    cards: [0, 1, 2].map((i) => ({ icon: "auto", title: `Lever ${i}`, text: "One short line." })) };
  assert.deepEqual(errs(s), []);
});

test("upgrade converts old charts and tables", () => {
  const old = { template: "chart", title: "t", chart: { type: "bars", categories: cats, series: [{ name: "A", color: "focus", values: [1, 2, 3] }, { name: "B", color: "contrast", line: true, format: "{v}%", values: [1, 2, 3] }] } };
  const u = upgrade(old);
  assert.equal(u.chart.type, undefined);
  assert.deepEqual(u.chart.series.map((s) => s.mark), ["bar", "line"]);
  assert.equal(u.chart.series[1].line, undefined);
  assert.equal(old.chart.type, "bars", "upgrade must not mutate its input");
  const lines = upgrade({ template: "chart", chart: { type: "lines", categories: cats, series: [{ name: "A", values: [1, 2, 3] }] } });
  assert.equal(lines.chart.series[0].mark, "line");
  const t = upgrade({ template: "table", table: { columns: [{ label: "A" }, { label: "B", num: true }], rows: [] } });
  assert.equal(t.table.columns[1].num, undefined);
});

test("the chart card carries the chart guide", () => {
  assert.equal(CHART_GUIDE.length, 7);
  const rules = describe("chart", "consulting").rules.join("\n");
  CHART_GUIDE.forEach((g) => assert.ok(rules.includes(g)));
});

const specFor = ({ consulting, pitch, name, ...shared }, style) => ({ ...shared, ...(style === "pitch" ? pitch : consulting) });
for (const style of ["consulting", "pitch"]) {
  test(`examples validate (${style})`, () => {
    for (const ex of EXAMPLES) assert.deepEqual(errs(specFor(ex, style), style), [], ex.name);
  });
  test(`stress deck validates (${style})`, () => {
    for (const { name, ...s } of stressFor(style)) assert.deepEqual(errs(s, style), [], name);
  });
}
```

- [ ] **Step 3: Run the tests to verify they fail.**
Run: `npm run test:proto`
Expected: FAIL (`CHART_GUIDE` is not exported; `chart.type` is still a field).

- [ ] **Step 4: Replace `CHART` in `v5/schema.js` (lines 80–99)** with the guide, the new fields and a shared `FOCUS` field:

```js
/* The chart guide (spec 9.1): in the chart card for the agent, and in Jev's mark and stacking questions. */
export const CHART_GUIDE = [
  "Comparable series share one mark: series that measure the same thing in the same unit (our revenue vs a competitor's, revenue by segment, scenarios) are all bars or all lines.",
  "Bars for sizes, lines for trends: bars compare sizes across categories or a few periods (up to about 6); lines show a trend over many periods (7 or more), forecasts and scenarios.",
  "A different unit can be a line over bars: a series in another unit (a margin % or a growth rate over £m revenue) is a line on its own scale over the bars. At most two units per chart; a third needs another slide.",
  "A reference series can differ: a target, benchmark or average in the same unit may be a dashed line over bars.",
  "Stack only parts of a whole: stack bar series that add up to a total that matters (revenue by segment); keep them side by side when the point is comparing them (us vs them). Never stack rates or percentages that do not sum to a whole; lines never stack.",
  "Pitch: one series, two at most.",
  "Edits keep the rules: when the user switches one series of a comparable group, switch the whole group and say so, unless the user said only that series. A new series in another unit on a bar chart is a line.",
];

/* `auto` hands a choice to code (spec 9.1): Jev picks, and the pick comes back in `resolved`. */
const FOCUS = f("enum", "Write \"auto\" to let code pick and highlight the one item the title is about (a series, column, step or card). Leave it out when the user named the focus, and set it on that item yourself.", { values: ["auto"] });

const CHART = f("object", "A chart of bar and line series. Values are written on the data; there is no y-axis to configure.", {
  required: true,
  fields: {
    stacked: f("enum", "Bar series stacked into one column per category (true) or side by side (false). \"auto\": code decides by the chart guide.", { values: [true, false, "auto"], default: false }),
    categories: f("list", "X-axis labels, in order. Short: 'Year 1', 'Q2', 'Q1 ’27'.", { required: true, items: { min: 2, max: 12 }, of: f("text", "Category label.", { max: 10 }) }),
    format: f("text", "Value format; `{v}` is replaced by the number. E.g. '£{v}m', '{v}%'.", { default: "{v}" }),
    series: f("list", "Data series. One series is the focus: the one the title is about.", {
      required: true, items: { min: 1, max: 4 },
      of: f("object", "One series.", { fields: {
        name: f("text", "Series name, shown in the legend or end label.", { required: true, max: 24 }),
        values: f("list", "One number per category, same order. Plain numbers, no units.", { required: true, of: f("number", "Value.") }),
        mark: f("enum", "`bar` or `line` for this series. \"auto\": code decides by the chart guide. Write bar or line only when the user named it.", { required: true, values: ["bar", "line", "auto"] }),
        color: f("enum", "`focus`: the series the slide is about. `neutral`: context. `contrast`: a secondary series that must still read clearly. Leave it out when the slide has focus \"auto\".", { values: ["focus", "neutral", "contrast"] }),
        format: f("text", "Overrides the chart format for this series (a % line over £ bars)."),
        area: f("boolean", "Line series in a chart of only lines: shade the area under it. Focus series only.", { default: false }),
        dashed: f("boolean", "Line series only: dashed, for a forecast, a scenario or a reference (target, average).", { default: false }),
      } }),
    }),
  },
});
```

- [ ] **Step 5: Update the notes point, the menu fields and the chart rules.**
  - In `notes()`, change the point description to `"Optional: pin this note's number onto a data point (charts with bars only)."`.
  - In `MENU.chart`:
    - `fields: { chart: CHART, focus: FOCUS, notes: notes(true) }`
    - rules become `["With notes: at most 6 categories.", "`notes[].point` only works on a chart with bars.", "At most 3 notes when any note has text, and at most 3 in pitch.", ...CHART_GUIDE]`
  - In `MENU.table.fields`: add `focus: FOCUS` and delete the `num` line from the column fields.
  - In `MENU.steps.fields` and `MENU.cards.fields`: add `focus: FOCUS`.
  - In `MENU.cards`: change the icon field's values to `[...ICONS, "auto"]`, with the description `"Icon lead: an icon from the curated set, or \"auto\" to let code pick one from the card's text. Not with `value` or `framed`."`.

- [ ] **Step 6: Replace `checkChart` (lines 338–355)** and pass the slide's focus mode:

```js
const fmtOf = (c, s) => s?.format || c.format || "{v}";

function checkChart(c, path, out, focusAuto) {
  if (!c || !Array.isArray(c.series) || !Array.isArray(c.categories)) return;
  const bars = c.series.filter((s) => s?.mark === "bar");
  c.series.forEach((s, i) => {
    if (Array.isArray(s?.values) && s.values.length !== c.categories.length)
      out.errors.push(`${path}.series[${i}].values: ${s.values.length} values, but there are ${c.categories.length} categories. Give exactly one value per category.`);
    if (s?.mark === "bar" && (s.area || s.dashed)) out.errors.push(`${path}.series[${i}]: \`area\` and \`dashed\` are only for line series.`);
    if (s?.area && bars.length) out.errors.push(`${path}.series[${i}].area: only when every series is a line.`);
  });
  if (bars.length > 3) out.errors.push(`${path}.series: at most 3 bar series (got ${bars.length}). Cut or merge.`);
  const formats = new Set(c.series.map((s) => fmtOf(c, s)));
  if (formats.size > 2) out.errors.push(`${path}.series: ${formats.size} units (${[...formats].join(", ")}); a chart shows at most 2. Move the third to another slide.`);
  if (c.series.length && c.series.every((s) => s?.mark === "line") && formats.size > 1)
    out.errors.push(`${path}.series: a chart of only lines shares one scale, so every series uses one format. Make one unit bars, or plot it on another slide.`);
  if (c.stacked === true && (bars.length < 2 || new Set(bars.map((s) => fmtOf(c, s))).size > 1))
    out.errors.push(`${path}.stacked: stacking needs 2 or more bar series in one unit. Set it to false.`);
  if (c.format && !String(c.format).includes("{v}")) out.errors.push(`${path}.format: must contain {v}, e.g. "£{v}m".`);
  const focus = c.series.filter((s) => s?.color === "focus").length;
  if (!focusAuto && focus !== 1) out.warnings.push(`${path}.series: ${focus} series are "focus"; exactly one should be.`);
}
```

In `checkRules`, `case "chart"`:
- Call `checkChart(s.chart, "chart", out, s.focus === "auto")`.
- Replace the old line-chart point check (`if (s.chart?.type !== "bars") …`) with:

```js
        if (series.every((x) => x?.mark === "line")) return out.errors.push(`notes[${i}].point: points only work on a chart with bars; remove it.`);
```

- [ ] **Step 7: Add `upgrade()`** after `validateDeck`:

```js
/** Slides saved before the 2026-09-27 chart change: chart.type and series.line become marks; table columns lose `num`. */
export function upgrade(slide) {
  const s = structuredClone(slide), c = s.chart;
  if (c?.type) {
    (c.series || []).forEach((x) => { x.mark = c.type === "lines" || x.line ? "line" : "bar"; delete x.line; });
    if (c.type === "bars") c.stacked = false;
    delete c.type;
  }
  (s.table?.columns || []).forEach((col) => delete col.num);
  return s;
}
```

- [ ] **Step 8: Update `v5/examples.js`.**
  - `UNIT_BARS` (lines 7–14):
    - delete `type: "bars", `
    - add `mark: "bar"` to Interest income and Interchange
    - on Gross margin, replace `line: true` with `mark: "line"`
  - "Chart · full width" (163–170):
    - delete `type: "lines", `
    - add `mark: "line"` to both series
  - Delete every `, num: true` in the file.
  - Stress deck, the `bars` const:
    - delete `type: "bars", `
    - add `mark: "bar"` to its first two series
    - replace `line: true` with `mark: "line"`
  - Stress deck, "Stress · chart full":
    - delete `type: "lines", `
    - add `mark: "line"` to its three series
  - After "Stress · chart full", add a stacked slide:

```js
    { template: "chart", name: "Stress · chart stacked", ...frame("chart"), chart: { stacked: true, categories: TIMES(6).map((_, i) => `Year ${i + 1}`), format: "£{v}m",
      series: [{ name: W(24), mark: "bar", color: "focus", values: [4, 9, 15, 24, 33, 41] }, { name: W(24), mark: "bar", color: "neutral", values: [2, 5, 9, 14, 20, 26] },
        { name: W(24), mark: "bar", color: "contrast", values: [1, 2, 4, 7, 11, 15] }, { name: "Margin", mark: "line", color: "contrast", format: "{v}%", values: [12, 18, 24, 29, 33, 36] }] } },
```

- [ ] **Step 9: Run the tests.**
Run: `npm run test:proto`
Expected: PASS (every test). If "stress deck validates (pitch)" fails on the stacked slide, cut the series names to the pitch limit the error names (`W(n)`); do not raise limits.

- [ ] **Step 10: Commit.**

```bash
git add package.json docs/design/proposals/v5/schema.js docs/design/proposals/v5/examples.js docs/design/proposals/tests/schema.test.js
git commit -m "Slide schema: bar or line per series, stacked bars, auto choices, chart guide

chart.type and series.line become series.mark (bar, line, auto) and
chart.stacked (true, false, auto). focus \"auto\" on chart, table, steps
and cards; icon \"auto\". Table columns lose num (alignment is code-owned).
CHART_GUIDE goes into the chart card. upgrade() converts older slides.
node --test suite for the schema, examples and stress deck.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Render mixed and stacked charts; table layout owned by code

**Files:**
- Create: `v5/chart.js` (moved from `render.js` lines 76–222: `niceStep`, `fmt`, `lbl`, `topRounded`, `drawChart`, `bars`, `lines`, `plotRects`, `hits`, `thinCategories`, `declutter`)
- Modify: `v5/render.js` (the table and `mountSlide`; import `drawChart`)
- Modify: `v5/slides.css`
- Create: `tests/render.test.js`, `tests/browser/package.json`, `tests/browser/review.mjs`

**Interfaces:**
- Consumes: the chart and table JSON from Task 1.
- Produces:
  - `columnAlign(table) → ("text" | "num" | "sym")[]`, exported from `render.js`
  - `drawChart(host, spec, markers)`, exported from `chart.js` and re-exported from `render.js`
  - CSS classes `al-text`, `al-num`, `al-sym` and `narrow` on `.tbl`
  - CSS variable `--body-gap`
  - Existing exports of `render.js` keep their names; `fitIssues` moves in Task 3.

- [ ] **Step 1: Write the failing unit test** `tests/render.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { columnAlign } from "../v5/render.js";

test("alignment follows the column's content", () => {
  const t = { columns: [{ label: "Plan" }, { label: "Price" }, { label: "Margin" }, { label: "SLA" }, { label: "Notes" }],
    rows: [{ cells: ["Starter", "£0", "42%", "✓", "Self-serve only"] }, { cells: ["Growth", { value: "(1,234)", note: "net" }, "61%", "—", "Phone support"] }] };
  assert.deepEqual(columnAlign(t), ["text", "num", "num", "sym", "text"]);
});

test("ranges and approximations are numbers", () => {
  assert.deepEqual(columnAlign({ columns: [{ label: "Item" }, { label: "Share" }], rows: [{ cells: ["a", "40–60%"] }, { cells: ["b", "~10%"] }, { cells: ["c", "£120/yr"] }] }), ["text", "num"]);
});

test("the first column is always text; empty columns count as symbols", () => {
  assert.deepEqual(columnAlign({ columns: [{ label: "Year" }, { label: "X" }], rows: [{ cells: ["2024", "—"] }] }), ["text", "sym"]);
});
```

- [ ] **Step 2: Run it to verify it fails.**
Run: `npm run test:proto`
Expected: FAIL: `columnAlign` is not exported.

- [ ] **Step 3: Move the chart code.** Create `v5/chart.js` with this header, then move `render.js` lines 76–222 into it unchanged (from `/* ═════════════ Charts` through the end of `declutter`):

```js
/* Charts: SVG for shapes, HTML for every label. Bar and line series mix on one chart (spec 9.1);
   bars stack when chart.stacked is true. */
import { esc } from "./render.js";
```

In `render.js`, delete the moved lines and add `import { drawChart } from "./chart.js";` and `export { drawChart };` after the existing imports. `fitValues` and `fitIssues` stay in `render.js` for now.

- [ ] **Step 4: Replace `drawChart` and `bars` in `chart.js`** (the `lines` function stays; change its label and path classes from `c-${s.color}` to `c-${s.color || "neutral"}`):

```js
export function drawChart(host, spec, markers = []) {
  const allLines = spec.series.every((s) => s.mark === "line");
  const legend = allLines ? "" : `<div class="legend">${spec.series.map((s) =>
    `<span class="c-${s.color || "neutral"}"><i class="${s.mark === "line" ? "line" : ""}"></i>${esc(s.name)}</span>`).join("")}</div>`;
  host.innerHTML = `${legend}<div class="plot"></div>`;
  const box = host.querySelector(".plot"), W = box.clientWidth, H = box.clientHeight;
  (allLines ? lines : bars)(box, spec, W, H, markers);
}

// Bars, side by side or stacked, with line series over them: a line in the bars' unit shares their
// scale (a target or average); a line in another unit gets its own scale. No axes: values sit on the data.
function bars(box, spec, W, H, markers) {
  const B = spec.series.filter((s) => s.mark !== "line"), L = spec.series.filter((s) => s.mark === "line");
  const stacked = spec.stacked === true && B.length > 1, unit = B[0].format || spec.format;
  const P = { t: 96, b: 44 }, ph = H - P.t - P.b, n = spec.categories.length, band = W / n;
  const totals = spec.categories.map((_, i) => B.reduce((sum, s) => sum + Math.max(0, s.values[i]), 0));
  const bMax = stacked ? Math.max(...totals) : Math.max(...B.flatMap((s) => s.values));
  const own = L.filter((s) => (s.format || spec.format) !== unit);
  const lMax = own.length ? Math.max(...own.flatMap((s) => s.values)) : 1;
  const yb = (v) => P.t + ph - (v / bMax) * ph * .86;
  const yOf = (s) => (own.includes(s) ? (v) => P.t + ph - (v / lMax) * ph : yb);
  const gw = band * .56, bw = stacked ? gw : gw / B.length, xc = (i) => band * i + band / 2;
  let g = `<line class="base" x1="0" x2="${W}" y1="${P.t + ph}" y2="${P.t + ph}"/>`, t = "";
  const pos = spec.series.map(() => []), acc = spec.categories.map(() => 0);
  spec.categories.forEach((c, i) => { t += lbl("cat", xc(i), P.t + ph + 16, "tc", esc(c)); });
  spec.series.forEach((s, si) => {
    if (s.mark === "line") return;
    const j = B.indexOf(s), f = s.format || spec.format, top1 = stacked && j === B.length - 1;
    s.values.forEach((v, i) => {
      const x = (stacked ? xc(i) - gw / 2 : xc(i) - gw / 2 + j * bw) + 4, w = bw - 8;
      const bottom = stacked ? yb(acc[i]) : P.t + ph, top = stacked ? yb(acc[i] + Math.max(0, v)) : yb(v), h = bottom - top;
      if (h > .5) g += `<path class="bar c-${s.color}" d="${stacked && !top1 ? `M${x},${bottom}V${top}H${x + w}V${bottom}Z` : topRounded(x, top, w, h, 6)}"/>`;
      // Stacked: a segment's value sits inside it, hidden when the segment is shorter than its label (spec 4.2a).
      if (stacked) { if (h >= 44) t += lbl(`seg-lbl c-${s.color}`, x + w / 2, (top + bottom) / 2, "mc", fmt(f, v)); }
      else if (s.color === "focus" || i === n - 1) t += lbl(`v-lbl c-${s.color}`, x + w / 2, top - 10, "bc", fmt(f, v));
      acc[i] += Math.max(0, v);
      pos[si][i] = [x + w / 2, top - 34];
    });
  });
  if (stacked) totals.forEach((v, i) => { t += lbl("v-lbl c-total", xc(i), yb(v) - 10, "bc", fmt(unit, v)); });
  spec.series.forEach((s, si) => {
    if (s.mark !== "line") return;
    const y = yOf(s), pts = s.values.map((v, i) => [xc(i), y(v)]);
    g += `<path class="ln c-${s.color} ${s.dashed ? "dashed" : ""}" d="${pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join("")}"/>`;
    pts.forEach(([x, py], i) => { g += `<circle class="pt c-${s.color}" cx="${x}" cy="${py}" r="7"/>`;
      t += lbl(`v-lbl on-line c-${s.color}`, x, py - 16, "bc", fmt(s.format || spec.format, s.values[i])); pos[si][i] = [x, py - 40]; });
  });
  markers.forEach((m) => { const p = pos[m.series]?.[m.index]; if (!p) return; const [x, y] = p;
    g += `<line class="leader" data-n="${m.n}" x1="${x}" x2="${x}" y1="${y - 26}" y2="${y + 2}"/>`;
    t += lbl("mk", x, y - 46, "mc", m.n).replace("<span", `<span data-n="${m.n}"`); });
  box.innerHTML = `<svg width="${W}" height="${H}">${g}</svg>${t}`;
  thinCategories(box);
  declutter(box);
}
```

- [ ] **Step 5: Make the table code-owned in `render.js`.** Replace `tableHTML` and add `columnAlign`:

```js
const cellValue = (c) => String(c && typeof c === "object" ? c.value : c ?? "").trim();
const NUMERIC = /^~?\(?[+−-]?[£$€]?\d[\d,.]*(?:[–-]\d[\d,.]*)?\s?(%|x|×|k|m|bn|pp|bps)?\)?(\/\w+)?$/i;

/** Alignment per column from its content (spec 3.6 L2): label column text, numbers right, short symbols centred. */
export function columnAlign(t) {
  return t.columns.map((_, j) => {
    if (j === 0) return "text";
    const vals = t.rows.map((r) => cellValue(r.cells?.[j])).filter((v) => v && v !== "—" && v !== "–" && v !== "-");
    if (!vals.length || vals.every((v) => v.length <= 3 && !/\d/.test(v))) return "sym";
    return vals.every((v) => NUMERIC.test(v)) ? "num" : "text";
  });
}

function tableHTML(t) {
  const al = columnAlign(t), cls = (c, j) => [`al-${al[j]}`, c?.focus ? "focus" : ""].join(" ");
  const cell = (c, j) => { const v = typeof c === "object" && c ? c : { value: c };
    return `<td class="${cls(t.columns[j], j)}">${esc(v.value)}${v.note ? `<small>${esc(v.note)}</small>` : ""}</td>`; };
  return `<table class="tbl${t.columns.length <= 2 ? " narrow" : ""}"><colgroup>${t.columns.map(() => "<col>").join("")}</colgroup>
    <thead><tr>${t.columns.map((c, j) => `<th class="${cls(c, j)}">${esc(c.label)}</th>`).join("")}</tr></thead>
    <tbody>${t.rows.map((r) => `<tr class="${r.style || ""}">${r.cells.map(cell).join("")}</tr>`).join("")}</tbody></table>`;
}
```

- [ ] **Step 6: Size and grow the table after mounting.** In `render.js`, add these two functions and call `sizeTable(slide); growTable(slide);` in `mountSlide` right after `fitValues(slide)`:

```js
/* L1: the label column takes its natural width within 20–40%; fixed layout splits the rest equally. */
function sizeTable(slide) {
  const tbl = slide.querySelector(".tbl");
  if (!tbl) return;
  tbl.classList.add("measuring");
  const natural = Math.max(...[...tbl.querySelectorAll("tr > :first-child")].map((c) => c.scrollWidth));
  tbl.classList.remove("measuring");
  const share = Math.min(.4, Math.max(.2, natural / tbl.clientWidth));
  tbl.querySelector("col").style.width = `${(share * 100).toFixed(2)}%`;
}

/* L5: a full-width table under 60% of the body grows its rows, up to 1.5× its natural height. */
function growTable(slide) {
  const tbl = slide.matches(".t-table.v-full") && slide.querySelector(":scope > .tbl");
  if (!tbl) return;
  // The slide is scaled with a transform: measure in slide pixels.
  const R = slide.getBoundingClientRect(), k = R.width / 1920, top = (el) => (el.getBoundingClientRect().top - R.top) / k;
  const bottom = 1080 - parseFloat(getComputedStyle(slide).paddingBottom), tk = slide.querySelector(".takeaway");
  const area = (tk ? top(tk) - 40 : bottom) - top(tbl), natural = tbl.getBoundingClientRect().height / k;
  if (natural < area * .6) tbl.style.height = `${Math.min(area * .6, natural * 1.5)}px`;
}
```

- [ ] **Step 7: CSS in `v5/slides.css`.**
  1. Add the body gap token after the `.slide { … }` rule block:

```css
/* L3: one gap between the frame (title, or subtitle) and the body, per style. */
.slide { --body-gap: 56px; }
.slide.style-pitch { --body-gap: 72px; }
.slide:not(.t-cover, .t-section) > .title + :not(.subtitle, .spacer),
.slide:not(.t-cover, .t-section) > .subtitle + :not(.spacer) { margin-top: var(--body-gap); }
```

  2. Remove `margin-top` from these rules:
     - `.split` (`margin-top: 56px`)
     - `.hero` (`margin-top: 56px`)
     - `.style-pitch .hero`: delete the whole rule
     - `.cards` (`margin-top: 64px`)
     - `.cards.value` (`margin-top: 72px`)
     - `.cards.framed` (`margin-top: 48px`)
     - `.tbl` (`margin-top: 36px`); also delete the `.split .tbl { margin-top: 0; }` rule
     - `.steps` (`margin-top: 52px`)
     - `.style-pitch .steps`: delete the whole rule
     - `.t-chart .chart.full`: delete the whole rule
  3. Replace the table rules (`.tbl` through `.style-pitch .tbl td.num`) with:

```css
.tbl { width: 100%; border-collapse: collapse; table-layout: fixed; }
.tbl.narrow { width: 66.667%; }
.tbl.measuring { table-layout: auto; width: auto; }
.tbl.measuring tr > :first-child { white-space: nowrap; }
.tbl th { font: 500 19px/1 var(--mono); letter-spacing: .14em; text-transform: uppercase; color: var(--muted); padding: 0 28px 18px 0; border-bottom: 1px solid var(--line); vertical-align: bottom; }
.tbl td { font-size: 28px; line-height: 1.2; padding: 10px 28px 10px 0; border-bottom: 1px solid var(--line); vertical-align: top; }
/* L2: alignment is derived from the column's content; numbers use tabular figures so digits line up. */
.tbl .al-text { text-align: left; }
.tbl .al-num { text-align: right; }
.tbl td.al-num { font-family: var(--mono); white-space: nowrap; font-variant-numeric: tabular-nums; }
.tbl .al-sym { text-align: center; }
.tbl th:last-child, .tbl td:last-child { padding-right: 0; }
.tbl .focus { color: var(--focus); }
.tbl td small { display: block; margin-top: 2px; font: 400 17px/1.2 var(--mono); color: var(--muted); }
.tbl tr.muted td { color: var(--muted); }
.tbl tr.total td { border-top: 2px solid var(--fg); border-bottom: 0; padding-top: 16px; font-weight: 700; color: var(--pos); }
.tbl tr.total td:first-child { color: var(--fg); }
.style-pitch .tbl td small, .style-pitch .tbl tr.muted { display: none; }
.style-pitch .tbl td { font-size: 34px; padding-top: 16px; padding-bottom: 16px; }
.style-pitch .tbl td.al-num { font-size: 32px; }
```

  4. Delete `.split.with-table .tbl td { vertical-align: middle; }`: cells are top-aligned (L2).
  5. L6 (equal step rows): in `.steps`, add `grid-auto-rows: 1fr;`.
  6. Stacked chart labels, after `.v-lbl.c-focus …`:

```css
.seg-lbl { font: 500 19px/1 var(--mono); color: var(--on-focus); }
.seg-lbl.c-neutral, .seg-lbl.c-contrast { color: var(--bg); }
.v-lbl.c-total { color: var(--fg); font-weight: 600; }
```

- [ ] **Step 8: Run the unit tests.**
Run: `npm run test:proto`
Expected: PASS (`render.js` imports `chart.js`, which only touches `document` inside functions, so Node can import it).

- [ ] **Step 9: Write the browser check.** Create `tests/browser/package.json`:

```json
{ "name": "slide-browser-tests", "private": true, "type": "module", "devDependencies": { "playwright": "1.58.2" } }
```

and `tests/browser/review.mjs`:

```js
/* Renders the v5 examples and the stress deck in both themes and fails on any issue.
   Needs: node docs/design/proposals/journey/server.mjs (port 8787). Screenshots go to ./shots/. */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:8787/v5/review.html";
mkdirSync("shots", { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
let failed = 0;
for (const q of ["", "stress=1&"]) for (const theme of ["ink", "paper"]) {
  await page.goto(`${BASE}?${q}theme=${theme}`);
  await page.waitForFunction(() => window.__fit, null, { timeout: 20000 });
  const fit = await page.evaluate(() => window.__fit);
  const issues = await page.$$eval("figure .issues > div:not(.w)", (els) => els.map((e) => `${e.closest("figure").querySelector("b").textContent}: ${e.textContent}`));
  console.log(`${q || "examples "}${theme}: ${fit.issues} issues, ${fit.warnings} warnings`);
  issues.forEach((i) => console.log(`  ${i}`));
  failed += fit.issues;
  const figs = await page.$$("figure");
  for (const [i, fig] of figs.entries()) await fig.screenshot({ path: `shots/${q ? "stress" : "examples"}-${theme}-${String(i + 1).padStart(2, "0")}.png` });
}
await browser.close();
process.exit(failed ? 1 : 0);
```

- [ ] **Step 10: Run it and look at every slide.**
Run (server running): `cd docs/design/proposals/tests/browser && npm i && node review.mjs`
Expected: `0 issues` for all four runs.
Then open every screenshot in `shots/` at full size and check each one:
  - table columns: data columns equal, numbers right-aligned, symbols centred
  - the body gap under the title is the same across templates
  - "Stress · chart stacked": segments stacked, totals above the stacks, the margin line on its own scale, no label collisions
  - no overflow anywhere

Fix what you find before committing. `shots/` is a scratch folder: add `docs/design/proposals/tests/browser/shots/` and `node_modules/` under it to `.gitignore`.

- [ ] **Step 11: Commit.**

```bash
git add .gitignore docs/design/proposals/v5 docs/design/proposals/tests
git commit -m "Renderer: mixed and stacked charts; table layout owned by code

chart.js holds the chart drawing: bars side by side or stacked (segment
values inside, totals above), line series over bars on the bars' scale or
their own when the unit differs. Tables use fixed layout: the label
column takes its natural width within 20-40%, data columns are equal;
alignment is derived from content (text left, numbers right with tabular
figures, symbols centred); a 2-column table is capped at 2/3 width; a
full table under 60% of the body grows up to 1.5x. One body gap per
style (56/72 px) replaces per-template margins. Browser check renders
examples and the stress deck in both themes.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Layout lints L1, L3, L5, L6

**Files:**
- Create: `v5/lints.js` (`fitIssues` moved from `render.js`, plus `layoutLints`)
- Modify: `v5/render.js` (remove `fitIssues`), `v5/review.html` (import from `lints.js`, add the lints), `journey/app.js` (import `fitIssues` from `lints.js`)
- Create: `tests/browser/fixture.html`, `tests/browser/lints.mjs`

**Interfaces:**
- Consumes: the rendered slide element, and the `al-*`, `narrow` and `--body-gap` markup from Task 2.
- Produces:
  - `fitIssues(slideEl, style) → string[]` (unchanged)
  - `layoutLints(slideEl, style) → string[]`: each message starts with a path-like word (`table`, `body`, `cards`, `steps`) and ends with the rule id in brackets, e.g. `(L5)`.

- [ ] **Step 1: Write the fixture page and the failing check.** `tests/browser/fixture.html` mounts slides passed in `window.__slides` and exposes the lints:

```html
<!doctype html>
<html><head><meta charset="utf-8"><link rel="stylesheet" href="../../v5/slides.css">
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@500;600;700&display=block" rel="stylesheet"></head>
<body><div id="frame" class="frame"></div>
<script type="module">
import { mountSlide } from "../../v5/render.js";
import { fitIssues, layoutLints } from "../../v5/lints.js";
window.lint = async (slide, style) => {
  await document.fonts.ready;
  const deck = { style, theme: "ink", footer: "Fixture", slides: [slide] };
  const el = mountSlide(document.getElementById("frame"), slide, { page: 1, section: 0, kicker: "", footer: "Fixture" }, deck);
  return { fit: fitIssues(el, style), layout: layoutLints(el, style) };
};
window.ready = true;
</script>
<style>.frame { width: 1920px; height: 1080px; }</style>
</body></html>
```

Copy the font `<link>` exactly from the `<head>` of `v5/review.html` if it differs from the one above.

`tests/browser/lints.mjs`:

```js
/* Layout lints on known-good and known-bad slides. Needs the journey server on 8787. */
import { chromium } from "playwright";
import assert from "node:assert/strict";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto("http://localhost:8787/tests/browser/fixture.html");
await page.waitForFunction(() => window.ready);
const lint = (slide, style = "consulting") => page.evaluate(([s, st]) => window.lint(s, st), [slide, style]);
const title = "Revolvers carry the margin while transactors earn theirs on interchange alone";

// A 2-row table with no notes leaves most of the body empty: L5 must flag it.
const sparse = await lint({ template: "table", title, table: { columns: [{ label: "Plan" }, { label: "Price" }, { label: "Margin" }], rows: [{ cells: ["Starter", "£0", "42%"] }, { cells: ["Growth", "£49", "61%"] }] } });
assert.ok(sparse.layout.some((m) => m.startsWith("body:") && m.endsWith("(L5)")), JSON.stringify(sparse));

// A full 7-row table: columns equal (L1), gap right (L3), fills the body (L5).
const rows = Array.from({ length: 7 }, (_, i) => ({ cells: [`Line item ${i + 1}`, "(1,234)", "12,345", "(34)"] }));
const full = await lint({ template: "table", title, table: { columns: [{ label: "£ per customer per month" }, { label: "Revolver" }, { label: "Transactor" }, { label: "Super" }], rows } });
assert.deepEqual(full.layout, [], JSON.stringify(full));

// Pitch gap is 72 px.
const pitch = await lint({ template: "steps", title: "The plan", subtitle: "Five million to a funded book.", steps: [
  { when: "0–6 mo", title: "Build", text: "First 100 cards." }, { when: "6–18 mo", title: "Prove", text: "£10m book." }, { when: "Year 2", title: "Scale", text: "£120m book." }] }, "pitch");
assert.ok(!pitch.layout.some((m) => m.endsWith("(L3)")), JSON.stringify(pitch));

console.log("lints ok");
await browser.close();
```

- [ ] **Step 2: Run it to verify it fails.**
Run: `cd docs/design/proposals/tests/browser && node lints.mjs`
Expected: FAIL: `lints.js` does not exist (module load error on the page; `window.ready` never set, so a timeout).

- [ ] **Step 3: Create `v5/lints.js`.** Move `fitIssues` (the whole function and its comment header) out of `render.js` into it, then add:

```js
/* Layout lints (spec 3.6), measured on the rendered slide in slide pixels. Messages start with the
   part of the slide they are about and end with the rule id. */
export function layoutLints(slide, style) {
  const R = slide.getBoundingClientRect(), k = R.width / 1920, out = [];
  const box = (el) => { const r = el.getBoundingClientRect(); return { t: (r.top - R.top) / k, b: (r.bottom - R.top) / k, w: r.width / k, h: r.height / k }; };
  const spread = (xs) => (xs.length > 1 ? Math.max(...xs) - Math.min(...xs) : 0);

  const tbl = slide.querySelector(".tbl");
  if (tbl) {
    const ths = [...tbl.querySelectorAll("thead th")].map((th) => box(th).w), d = spread(ths.slice(1));
    if (d > 1) out.push(`table: data columns differ by ${Math.round(d)}px; they must be equal (L1)`);
    const share = ths[0] / box(tbl).w;
    if (share < .195 || share > .405) out.push(`table: the label column is ${Math.round(share * 100)}% of the table; it must be 20–40% (L1)`);
  }

  const framed = !slide.matches(".t-cover, .t-section");
  const head = framed && (slide.querySelector(":scope > .subtitle") || slide.querySelector(":scope > h2.title"));
  const body = head?.nextElementSibling;
  if (body && !body.matches(".spacer, .rail")) {
    const gap = box(body).t - box(head).b, want = style === "pitch" ? 72 : 56;
    if (Math.abs(gap - want) > 2) out.push(`body: starts ${Math.round(gap)}px below the ${head.matches(".subtitle") ? "subtitle" : "title"}; it must be ${want}px (L3)`);
  }

  const main = slide.querySelector(".t-table.v-full > .tbl, :scope > .cards:not(.framed), :scope > .steps")
    || (slide.matches(".t-table.v-full") ? slide.querySelector(":scope > .tbl") : null);
  if (main) {
    const bottom = 1080 - parseFloat(getComputedStyle(slide).paddingBottom), tk = slide.querySelector(".takeaway");
    const end = tk ? box(tk).t - 40 : bottom, b = box(main), fill = b.h / (end - b.t);
    const what = main.matches(".tbl") ? "table" : main.matches(".steps") ? "steps" : "cards";
    if (fill < .6) out.push(`body: ${Math.round((1 - fill) * 100)}% empty below the ${what}; add notes or a takeaway, or use a number or cards slide (L5)`);
  }

  const cards = [...slide.querySelectorAll(".cards > .card")].map((c) => box(c).h);
  if (spread(cards) > 1) out.push(`cards: heights differ by ${Math.round(spread(cards))}px; parallel cards share one size (L6)`);
  const steps = [...slide.querySelectorAll(".steps > .d")].map((d) => box(d).h);
  if (spread(steps) > 1) out.push(`steps: row heights differ by ${Math.round(spread(steps))}px (L6)`);
  return out;
}
```

- [ ] **Step 4: Rewire the imports.**
  - `render.js`: remove `fitIssues`.
  - `review.html`:
    - import `fitIssues, layoutLints` from `./lints.js`; drop `fitIssues` from the `render.js` import
    - after the `fitIssues(...)` line inside the `styles.forEach`, add:

```js
      layoutLints(fig.querySelector(`.frame[data-style="${st}"] .slide`), st).forEach((e) => lines.push({ cls: "", text: `${pre}layout: ${e}` }));
```

  - `journey/app.js`:
    - import `fitIssues, layoutLints` from `../v5/lints.js`; remove `fitIssues` from the `render.js` import
    - in `measure()`, return `[...fitIssues(el, d.style), ...layoutLints(el, d.style)]`

- [ ] **Step 5: Run the lints check and the review check.**
Run: `node lints.mjs && node review.mjs` (in `tests/browser`)
Expected: `lints ok`, then `0 issues` on all four review runs.
**If an approved example or a stress slide is flagged by L5 or L6, stop and report the numbers to the user.** L5 and L6 are spec values, and the approved examples are the reference; do not change the threshold on your own. Fix L1 and L3 findings in CSS.

- [ ] **Step 6: Commit.**

```bash
git add docs/design/proposals/v5 docs/design/proposals/journey/app.js docs/design/proposals/tests/browser
git commit -m "Layout lints L1, L3, L5, L6 on every render

lints.js holds fitIssues (moved from render.js) and layoutLints: equal
data columns and a 20-40% label column, the body gap per style, the body
fill ratio (flagged under 60%), equal card and step sizes. Review page and
the journey measure include them. Browser fixture tests a sparse table
(flagged), a full table and the pitch gap.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

# Part B: the hybrid agent

### Task 4: Path patches

**Files:**
- Create: `journey/patch.js`, `tests/patch.test.js`

**Interfaces:**
- Produces:
  - `parsePath(path: string) → (string|number)[] | null`
  - `applyPatch(slide, set) → { slide, changed: string[] } | { errors: string[] }`
  - Paths refer to the slide **before** the patch: sets apply in the order given, and removals apply last, highest index first.

- [ ] **Step 1: Write the failing tests** `tests/patch.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyPatch, parsePath } from "../journey/patch.js";

const S = { template: "cards", title: "Three levers", cards: [{ icon: "zap", title: "A", text: "a" }, { icon: "zap", title: "B", text: "b" }, { icon: "zap", title: "C", text: "c" }], takeaway: "So what." };

test("parsePath", () => {
  assert.deepEqual(parsePath("chart.series[1].values[3]"), ["chart", "series", 1, "values", 3]);
  assert.deepEqual(parsePath("title"), ["title"]);
  assert.equal(parsePath("cards[x]"), null);
  assert.equal(parsePath(".title"), null);
  assert.equal(parsePath(""), null);
});

test("sets a nested value and keeps everything else byte for byte", () => {
  const r = applyPatch(S, { "cards[1].title": "Bee" });
  assert.equal(r.slide.cards[1].title, "Bee");
  assert.deepEqual({ ...r.slide, cards: null }, { ...S, cards: null });
  assert.deepEqual(r.slide.cards[0], S.cards[0]);
  assert.deepEqual(r.changed, ["cards[1].title"]);
  assert.equal(S.cards[1].title, "B", "input untouched");
});

test("null removes a field or a list item; removals run highest index first", () => {
  const r = applyPatch(S, { takeaway: null, "cards[0]": null, "cards[2]": null });
  assert.equal("takeaway" in r.slide, false);
  assert.deepEqual(r.slide.cards.map((c) => c.title), ["B"]);
});

test("paths refer to the slide before the patch", () => {
  const r = applyPatch(S, { "cards[0]": null, "cards[2].title": "See" });
  assert.deepEqual(r.slide.cards.map((c) => c.title), ["B", "See"]);
});

test("an index equal to the length appends", () => {
  const r = applyPatch(S, { "cards[3]": { icon: "auto", title: "D", text: "d" } });
  assert.equal(r.slide.cards.length, 4);
});

test("all or nothing: one bad path applies nothing", () => {
  const r = applyPatch(S, { title: "New", "cards[7].title": "x" });
  assert.ok(r.errors[0].startsWith("cards[7].title: index 7 is past the end; the list has 3 items"));
  assert.equal(r.slide, undefined);
});

test("errors: malformed path, template, empty patch, not a list, missing parent", () => {
  assert.ok(applyPatch(S, { "cards..x": 1 }).errors[0].includes("not a valid path"));
  assert.ok(applyPatch(S, { template: "table" }).errors[0].startsWith("template:"));
  assert.ok(applyPatch(S, {}).errors[0].startsWith("set:"));
  assert.ok(applyPatch(S, { "title[0]": "x" }).errors[0].includes("not a list"));
  assert.ok(applyPatch(S, { "cards[9].title.x": "x" }).errors[0].includes("does not exist"));
});

test("a missing optional object is created on the way", () => {
  const s = { template: "chart", chart: { series: [] }, notes: [{ title: "n" }] };
  assert.deepEqual(applyPatch(s, { "notes[0].point.series": 0 }).slide.notes[0].point, { series: 0 });
});
```

- [ ] **Step 2: Run to verify they fail.** `npm run test:proto`. Expected: FAIL, the module is not found.

- [ ] **Step 3: Implement `journey/patch.js`:**

```js
/* Path patches (spec 9.5): { "cards[2].title": "…", "notes[1]": null } applied to a slide, all or nothing.
   Paths refer to the slide before the patch; removals run last, highest index first. */
const VALID = /^[A-Za-z_]\w*(\.[A-Za-z_]\w*|\[\d+\])*$/;

/** "chart.series[1].values[3]" → ["chart", "series", 1, "values", 3]; null when malformed. */
export function parsePath(path) {
  if (typeof path !== "string" || !VALID.test(path)) return null;
  return [...path.matchAll(/([A-Za-z_]\w*)|\[(\d+)\]/g)].map((m) => (m[1] !== undefined ? m[1] : Number(m[2])));
}

export function applyPatch(slide, set) {
  if (!set || typeof set !== "object" || Array.isArray(set) || !Object.keys(set).length) return { errors: ["set: give at least one { path: value }."] };
  const out = structuredClone(slide), errors = [], removals = [];
  for (const [path, value] of Object.entries(set)) {
    const keys = parsePath(path);
    if (!keys) { errors.push(`${path}: not a valid path. Use dots and [index], e.g. cards[2].title.`); continue; }
    if (keys[0] === "template") { errors.push("template: change the template with create_slide and replace."); continue; }
    let parent = out;
    for (let i = 0; i < keys.length - 1 && parent; i++) {
      const k = keys[i];
      if (parent[k] === undefined && typeof k === "string" && !Array.isArray(parent)) parent[k] = typeof keys[i + 1] === "number" ? [] : {};
      parent = parent[k] !== null && typeof parent[k] === "object" ? parent[k] : null;
      if (!parent) errors.push(`${path}: ${keys.slice(0, i + 1).map((x) => (typeof x === "number" ? `[${x}]` : x)).join(".").replace(/\.\[/g, "[")} does not exist.`);
    }
    if (!parent) continue;
    const last = keys.at(-1);
    if (typeof last === "number") {
      if (!Array.isArray(parent)) { errors.push(`${path}: not a list.`); continue; }
      if (last > parent.length || (value === null && last === parent.length)) { errors.push(`${path}: index ${last} is past the end; the list has ${parent.length} items (0–${parent.length - 1}, or ${parent.length} to append).`); continue; }
      if (value === null) removals.push([parent, last]); else parent[last] = value;
    } else if (Array.isArray(parent)) errors.push(`${path}: a list is indexed with [n].`);
    else if (value === null) delete parent[last];
    else parent[last] = value;
  }
  if (errors.length) return { errors };
  removals.sort((a, b) => b[1] - a[1]).forEach(([list, i]) => list.splice(i, 1));
  return { slide: out, changed: Object.keys(set) };
}
```

- [ ] **Step 4: Run the tests.** `npm run test:proto`. Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add docs/design/proposals/journey/patch.js docs/design/proposals/tests/patch.test.js
git commit -m "Journey: path patches for surgical slide edits

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Autofix with dependent-field fixes

**Files:**
- Create: `journey/autofix.js`, `tests/autofix.test.js`
- Modify: `journey/pipeline.js` (delete its `autofix`; import it from `./autofix.js`, so the file keeps working until Task 11 deletes it), `journey/agent.js` (import `autofix` from `./autofix.js`)

**Interfaces:**
- Produces: `autofix(slide, style) → { slide, fixes: string[] }`. It is pure, idempotent, and safe to run before and after `resolveAuto`.

- [ ] **Step 1: Write the failing tests** `tests/autofix.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { autofix } from "../journey/autofix.js";

const chart = (c, extra = {}) => ({ template: "chart", title: "Revenue grew four times", chart: { categories: ["a", "b", "c"], format: "£{v}m", ...c }, ...extra });

test("trivia: Source prefix, consulting full stop, percent", () => {
  const { slide, fixes } = autofix({ template: "number", title: "Costs fell 20 percent.", source: "Source: ONS", number: { value: "20%", caption: "x" }, body: ["y"] }, "consulting");
  assert.equal(slide.title, "Costs fell 20%");
  assert.equal(slide.source, "ONS");
  assert.equal(fixes.length, 2);
});

test("bar series lose area and dashed", () => {
  const { slide, fixes } = autofix(chart({ series: [{ name: "A", mark: "bar", color: "focus", dashed: true, values: [1, 2, 3] }] }), "consulting");
  assert.equal(slide.chart.series[0].dashed, undefined);
  assert.ok(fixes[0].startsWith("chart.series[0]"));
});

test("stacking switches off without two bar series in one unit", () => {
  const { slide } = autofix(chart({ stacked: true, series: [{ name: "A", mark: "bar", color: "focus", values: [1, 2, 3] }, { name: "B", mark: "line", format: "{v}%", values: [1, 2, 3] }] }), "consulting");
  assert.equal(slide.chart.stacked, false);
});

test("stacked auto is left for Jev", () => {
  const { slide } = autofix(chart({ stacked: "auto", series: [{ name: "A", mark: "auto", values: [1, 2, 3] }] }), "consulting");
  assert.equal(slide.chart.stacked, "auto");
});

test("note points go when every series is a line, or when they point past the data", () => {
  const notes = { notes: [{ title: "x", point: { series: 1, index: 0 } }, { title: "y", point: { series: 0, index: 5 } }] };
  const mixed = autofix(chart({ series: [{ name: "A", mark: "bar", color: "focus", values: [1, 2, 3] }, { name: "B", mark: "line", format: "{v}%", values: [1, 2, 3] }] }, structuredClone(notes)), "consulting");
  assert.deepEqual(mixed.slide.notes[0].point, { series: 1, index: 0 }, "a line over bars keeps its point");
  assert.equal(mixed.slide.notes[1].point, undefined);
  const lines = autofix(chart({ series: [{ name: "A", mark: "line", color: "focus", values: [1, 2, 3] }, { name: "B", mark: "line", values: [1, 2, 3] }] }, structuredClone(notes)), "consulting");
  assert.equal(lines.slide.notes[0].point, undefined);
  assert.equal(lines.fixes.filter((f) => f.startsWith("notes[")).length, 2);
});

test("a second focus series goes back to neutral; missing colours default to neutral", () => {
  const { slide } = autofix(chart({ series: [{ name: "A", mark: "bar", color: "focus", values: [1, 2, 3] }, { name: "B", mark: "bar", color: "focus", values: [1, 2, 3] }, { name: "C", mark: "bar", values: [1, 2, 3] }] }), "consulting");
  assert.deepEqual(slide.chart.series.map((s) => s.color), ["focus", "neutral", "neutral"]);
});

test("focus auto leaves colours alone", () => {
  const { slide } = autofix(chart({ series: [{ name: "A", mark: "bar", values: [1, 2, 3] }] }, { focus: "auto" }), "consulting");
  assert.equal(slide.chart.series[0].color, undefined);
});

test("a Total row, or a row of column sums, becomes the total row", () => {
  const t = (rows) => ({ template: "table", title: "t", table: { columns: [{ label: "Item" }, { label: "£" }], rows } });
  assert.equal(autofix(t([{ cells: ["A", "10"] }, { cells: ["Total", "10"] }]), "consulting").slide.table.rows[1].style, "total");
  assert.equal(autofix(t([{ cells: ["A", "£1,000"] }, { cells: ["B", "(200)"] }, { cells: ["Net", "£800"] }]), "consulting").slide.table.rows[2].style, "total");
  assert.equal(autofix(t([{ cells: ["A", "10"] }, { cells: ["B", "7"] }]), "consulting").slide.table.rows[1].style, undefined);
});

test("legacy num flags are removed", () => {
  const { slide } = autofix({ template: "table", title: "t", table: { columns: [{ label: "A" }, { label: "B", num: true }], rows: [{ cells: ["x", "1"] }] } }, "consulting");
  assert.equal(slide.table.columns[1].num, undefined);
});

test("idempotent", () => {
  const once = autofix(chart({ stacked: true, series: [{ name: "A", mark: "bar", color: "focus", values: [1, 2, 3] }] }), "consulting").slide;
  const twice = autofix(once, "consulting");
  assert.deepEqual(twice.slide, once);
  assert.deepEqual(twice.fixes, []);
});
```

- [ ] **Step 2: Run to verify they fail.** `npm run test:proto`. Expected: FAIL, the module is not found.

- [ ] **Step 3: Implement `journey/autofix.js`.** The trivia part is the `autofix` body from `pipeline.js` (lines 255–269), unchanged:

```js
/* Code fixes what has one right answer and reports it (spec 9.4); it never shortens text or changes meaning.
   Idempotent: the write path runs it before and after `auto` choices are resolved. */
import { MENU } from "../v5/schema.js";

const cellText = (c) => String(c && typeof c === "object" ? c.value : c ?? "").trim();
/** "£1,000" → 1000, "(200)" → -200, "12%" → 12; null when the cell is not a number. */
const num = (c) => {
  const t = cellText(c), m = t.match(/^\(?[+−-]?[£$€]?(\d[\d,]*(?:\.\d+)?)\s?[%kmbn×x]*\)?$/i);
  return m ? (t.startsWith("(") || /^[−-]/.test(t) ? -1 : 1) * parseFloat(m[1].replace(/,/g, "")) : null;
};

export function autofix(slide, style) {
  const fixes = [];
  const walk = (v) => {
    if (typeof v === "string") return v.trim().replace(/\s+/g, " ").replace(/(\d)\s?percent\b/gi, "$1%").replace(/(^|[\s(])"(\S)/g, "$1“$2").replace(/(\S)"/g, "$1”").replace(/(\w)'(\w)/g, "$1’$2");
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== null && x !== undefined && x !== "").map(([k, x]) => [k, walk(x)]));
    return v;
  };
  const out = walk(slide);
  if (typeof out.source === "string" && /^source:\s*/i.test(out.source)) { out.source = out.source.replace(/^source:\s*/i, ""); fixes.push("removed 'Source:' prefix"); }
  if (style === "consulting" && MENU[out.template]?.frame !== false && /[^.]\.$/.test(out.title || "")) { out.title = out.title.slice(0, -1); fixes.push("removed title full stop"); }
  if (style === "pitch") delete out.kicker;
  if (out.template === "chart" && out.chart && Array.isArray(out.chart.series)) fixChart(out, fixes);
  if (out.template === "table" && out.table) fixTable(out.table, fixes);
  return { slide: out, fixes };
}

function fixChart(s, fixes) {
  const c = s.chart, series = c.series, fmt = (x) => x?.format || c.format || "{v}";
  series.forEach((x, i) => {
    if (x?.mark === "bar" && (x.area || x.dashed)) { delete x.area; delete x.dashed; fixes.push(`chart.series[${i}]: removed area/dashed (bar series)`); }
    if (x && !x.color && s.focus !== "auto") x.color = "neutral";
  });
  const bars = series.filter((x) => x?.mark === "bar");
  if (c.stacked === true && (bars.length < 2 || new Set(bars.map(fmt)).size > 1)) { c.stacked = false; fixes.push("chart.stacked: off (needs 2 or more bar series in one unit)"); }
  if (s.focus !== "auto") {
    const focus = series.map((x, i) => (x?.color === "focus" ? i : -1)).filter((i) => i >= 0);
    focus.slice(1).forEach((i) => { series[i].color = "neutral"; fixes.push(`chart.series[${i}].color: neutral (only one series is the focus)`); });
  }
  const allLines = series.length && series.every((x) => x?.mark === "line");
  (s.notes || []).forEach((n, i) => {
    if (!n?.point) return;
    if (allLines || !series[n.point.series] || !(n.point.index >= 0 && n.point.index < (c.categories || []).length)) { delete n.point; fixes.push(`notes[${i}].point: removed (${allLines ? "a chart of only lines has no points" : "it points past the data"})`); }
  });
}

function fixTable(t, fixes) {
  (t.columns || []).forEach((col, j) => { if (col && "num" in col) { delete col.num; fixes.push(`table.columns[${j}].num: removed (alignment is set by code)`); } });
  const rows = t.rows || [], last = rows.at(-1);
  if (rows.length < 2 || !last || last.style) return;
  const n = (t.columns || []).length;
  const sums = Array.from({ length: n }, (_, j) => j).slice(1).filter((j) => rows.every((r) => num(r.cells?.[j]) !== null));
  const isSum = sums.length > 0 && sums.every((j) => {
    const total = rows.slice(0, -1).reduce((sum, r) => sum + num(r.cells[j]), 0), v = num(last.cells[j]);
    return Math.abs(total - v) <= Math.max(1e-9, Math.abs(v) * 0.01);
  });
  if (/^\s*(total|sum|overall)\b/i.test(cellText(last.cells?.[0])) || isSum) { last.style = "total"; fixes.push(`table.rows[${rows.length - 1}].style: total`); }
}
```

- [ ] **Step 4: Point the other files at it.**
  - `pipeline.js`:
    - delete its `autofix` function (lines 255–269)
    - add `import { autofix } from "./autofix.js";`
    - add `export { autofix };` so the old import path still works
  - `agent.js`: change `import { autofix } from "./pipeline.js";` to `import { autofix } from "./autofix.js";`.

- [ ] **Step 5: Run the tests.** `npm run test:proto`. Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add docs/design/proposals/journey/autofix.js docs/design/proposals/journey/pipeline.js docs/design/proposals/journey/agent.js docs/design/proposals/tests/autofix.test.js
git commit -m "Journey: autofix owns dependent fields and table totals

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Resolve `auto` choices with one Jev call

**Files:**
- Create: `journey/resolve.js`, `tests/resolve.test.js`, `tests/fakes.js`

**Interfaces:**
- Consumes: `jev(state, questions) → { _ms, [id]: { choice, p, probabilities } }` (the signature of `llm.js`), and `CHART_GUIDE` and `ICONS` from `schema.js`.
- Produces:
  - `resolveAuto(slide, style, jev) → Promise<{ slide, resolved: { [path]: { value, p } }, ms }>`
  - `P_AUTO = 0.6`
  - No Jev call when the slide has no `auto`.
  - Comparable series (same format) that were all `auto` get one mark: the pick with the highest probability.

- [ ] **Step 1: Shared test fakes** `tests/fakes.js`:

```js
/* Test doubles for the model calls. */

/** A Jev double: answers[questionId] = [choice, p]; unanswered questions take their first option at p 0.9. */
export function fakeJev(answers = {}) {
  const calls = [];
  const jev = async (state, questions) => {
    calls.push({ state, questions });
    const out = { _ms: 0 };
    for (const [id, q] of Object.entries(questions)) {
      const [choice, p] = answers[id] || [Object.keys(q.options)[0], 0.9];
      out[id] = { choice, p, probabilities: { [choice]: p } };
    }
    return out;
  };
  jev.calls = calls;
  return jev;
}

/** A GLM agent-step double: each step is a message, or a function of the messages that returns one. */
export function fakeAgent(steps) {
  const calls = [];
  const agentStep = async ({ messages }) => {
    calls.push(messages);
    const step = steps.shift();
    if (!step) throw new Error("the agent was called more times than scripted");
    return { message: typeof step === "function" ? step(messages) : step, ms: 1 };
  };
  agentStep.calls = calls;
  return agentStep;
}

let n = 0;
export const toolCall = (name, args) => ({ role: "assistant", content: "", tool_calls: [{ id: `call_${++n}`, type: "function", function: { name, arguments: JSON.stringify(args) } }] });
export const say = (content) => ({ role: "assistant", content });
```

- [ ] **Step 2: Write the failing tests** `tests/resolve.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveAuto } from "../journey/resolve.js";
import { fakeJev } from "./fakes.js";

const cats = ["2021", "2022", "2023", "2024", "2025"];
const chart = (series, extra = {}) => ({ template: "chart", title: "Revenue [[doubled]] while margin rose", chart: { categories: cats, format: "£{v}m", series, ...extra.chart }, ...extra.slide });

test("no auto, no call", async () => {
  const jev = fakeJev();
  const r = await resolveAuto(chart([{ name: "Rev", mark: "bar", color: "focus", values: [1, 2, 3, 4, 5] }]), "consulting", jev);
  assert.equal(jev.calls.length, 0);
  assert.deepEqual(r.resolved, {});
});

test("marks, stacking, focus and icons in one call", async () => {
  const jev = fakeJev({ mark0: ["bar", 0.9], mark1: ["line", 0.8], stacked: ["side_by_side", 0.9], focus: ["item1", 0.8] });
  const s = chart([{ name: "Revenue", mark: "auto", values: [1, 2, 3, 4, 5] }, { name: "Margin", mark: "auto", format: "{v}%", values: [5, 6, 7, 8, 9] }],
    { chart: { stacked: "auto" }, slide: { focus: "auto" } });
  const r = await resolveAuto(s, "consulting", jev);
  assert.equal(jev.calls.length, 1);
  assert.deepEqual(r.slide.chart.series.map((x) => x.mark), ["bar", "line"]);
  assert.equal(r.slide.chart.stacked, false);
  assert.deepEqual(r.slide.chart.series.map((x) => x.color), ["neutral", "focus"]);
  assert.equal(r.slide.focus, undefined);
  assert.deepEqual(r.resolved["chart.series[1].mark"], { value: "line", p: 0.8 });
  assert.ok(jev.calls[0].questions.mark0.instructions.includes("Comparable series share one mark"));
});

test("a concrete value is never touched", async () => {
  const jev = fakeJev({ mark1: ["bar", 0.99] });
  const s = chart([{ name: "Revenue", mark: "line", color: "focus", values: [1, 2, 3, 4, 5] }, { name: "Cost", mark: "auto", color: "neutral", values: [1, 1, 1, 1, 1] }]);
  const r = await resolveAuto(s, "consulting", jev);
  assert.equal(r.slide.chart.series[0].mark, "line");
  assert.equal(Object.keys(jev.calls[0].questions).join(), "mark1");
});

test("below p 0.6 the default is used: bar for up to 6 categories, line for 7 or more", async () => {
  const jev = fakeJev({ mark0: ["line", 0.5] });
  const r = await resolveAuto(chart([{ name: "Rev", mark: "auto", color: "focus", values: [1, 2, 3, 4, 5] }]), "consulting", jev);
  assert.equal(r.slide.chart.series[0].mark, "bar");
});

test("comparable auto series end with one mark", async () => {
  const jev = fakeJev({ mark0: ["bar", 0.62], mark1: ["line", 0.91] });
  const s = chart([{ name: "Us", mark: "auto", color: "focus", values: [1, 2, 3, 4, 5] }, { name: "Them", mark: "auto", color: "neutral", values: [2, 2, 2, 2, 2] }]);
  const r = await resolveAuto(s, "consulting", jev);
  assert.deepEqual(r.slide.chart.series.map((x) => x.mark), ["line", "line"]);
});

test("cards: focus sets tone, icons take Jev's pick", async () => {
  const jev = fakeJev({ focus: ["item2", 0.7], icon0: ["rocket", 0.3], icon1: ["wallet", 0.2], icon2: ["scale", 0.4] });
  const s = { template: "cards", title: "Three levers", focus: "auto", cards: ["Launch", "Pay", "Grow"].map((t) => ({ icon: "auto", title: t, text: "x" })) };
  const r = await resolveAuto(s, "consulting", jev);
  assert.deepEqual(r.slide.cards.map((c) => c.icon), ["rocket", "wallet", "scale"]);
  assert.deepEqual(r.slide.cards.map((c) => c.tone), ["neutral", "neutral", "focus"]);
});

test("table and steps focus", async () => {
  const jev = fakeJev({ focus: ["item0", 0.9] });
  const t = await resolveAuto({ template: "table", title: "t", focus: "auto", table: { columns: [{ label: "Plan" }, { label: "Price" }, { label: "Margin" }], rows: [{ cells: ["a", "1", "2"] }] } }, "consulting", jev);
  assert.deepEqual(t.slide.table.columns.map((c) => !!c.focus), [false, true, false]);
  const st = await resolveAuto({ template: "steps", title: "t", focus: "auto", steps: [{ when: "1", title: "A", text: "a" }, { when: "2", title: "B", text: "b" }] }, "consulting", fakeJev({ focus: ["item1", 0.9] }));
  assert.deepEqual(st.slide.steps.map((x) => !!x.focus), [false, true]);
});
```

- [ ] **Step 3: Run to verify they fail.** `npm run test:proto`. Expected: FAIL, the module is not found.

- [ ] **Step 4: Implement `journey/resolve.js`:**

```js
/* Every "auto" choice on a slide, resolved with ONE Jev call (spec 9.1). A concrete value is never
   touched. Below P_AUTO the default stands; icons always take Jev's top pick. */
import { CHART_GUIDE, ICONS, plain } from "../v5/schema.js";

export const P_AUTO = 0.6;
const GUIDE = CHART_GUIDE.join("\n");
const fmtOf = (c, s) => s.format || c.format || "{v}";
const slideText = (s) => JSON.stringify(s, (k, v) => (typeof v === "string" ? plain(v) : v));

/** The items a focus can land on, with a function that sets it. */
function focusItems(s) {
  const one = (list, set) => (i) => list.forEach((x, j) => set(x, i === j));
  switch (s.template) {
    case "chart": return { names: s.chart.series.map((x) => x.name), apply: one(s.chart.series, (x, on) => { x.color = on ? "focus" : x.color === "contrast" ? "contrast" : "neutral"; }) };
    case "table": { const cols = s.table.columns.slice(1); return { names: cols.map((c) => c.label), apply: one(cols, (c, on) => { if (on) c.focus = true; else delete c.focus; }) }; }
    case "steps": return { names: s.steps.map((x) => x.title), apply: one(s.steps, (x, on) => { if (on) x.focus = true; else delete x.focus; }) };
    case "cards": return s.framed ? null : { names: s.cards.map((c) => plain(c.title)), apply: one(s.cards, (c, on) => { c.tone = on ? "focus" : c.tone === "neg" ? "neg" : "neutral"; }) };
    default: return null;
  }
}

/** Questions for every auto on the slide: { id, path, instructions, options, min, fallback, apply(choice) }. */
function collect(s) {
  const qs = [];
  if (s.template === "chart" && s.chart?.series) {
    const c = s.chart, others = (i) => c.series.filter((_, j) => j !== i).map((x) => `"${x.name}" (${fmtOf(c, x)}, ${x.mark})`).join(", ") || "none";
    c.series.forEach((x, i) => {
      if (x.mark !== "auto") return;
      qs.push({ id: `mark${i}`, path: `chart.series[${i}].mark`, min: P_AUTO, fallback: c.categories.length >= 7 ? "line" : "bar",
        instructions: `Should the series "${x.name}" (format ${fmtOf(c, x)}) be drawn as bars or as a line? The chart has ${c.categories.length} categories (${c.categories.join(", ")}). Other series: ${others(i)}.\nChart guide:\n${GUIDE}`,
        options: { bar: "Bars: sizes compared across categories or a few periods.", line: "A line: a trend over many periods, a forecast or scenario, a rate in another unit over bars, or a reference such as a target." },
        apply: (v) => { x.mark = v; } });
    });
    if (c.stacked === "auto") qs.push({ id: "stacked", path: "chart.stacked", min: P_AUTO, fallback: "side_by_side",
      instructions: `Should the bar series be stacked or side by side?\nChart guide:\n${GUIDE}`,
      options: { stacked: "Stacked: the series are parts of one whole whose total matters (revenue by segment).", side_by_side: "Side by side: the point is comparing the series with each other (us vs them), or they do not add up." },
      apply: (v) => { c.stacked = v === "stacked"; } });
  }
  if (s.focus === "auto") {
    const f = focusItems(s);
    if (f?.names.length) {
      const hl = (String(s.title || "").match(/\[\[(.+?)\]\]/) || [])[1]?.toLowerCase();
      const guess = Math.max(0, f.names.findIndex((n) => hl && String(n).toLowerCase().includes(hl)));
      qs.push({ id: "focus", path: "focus", min: P_AUTO, fallback: `item${guess}`,
        instructions: "Which one item is the slide's title (and subtitle) about? That item is highlighted.",
        options: Object.fromEntries(f.names.map((n, i) => [`item${i}`, String(n)])), apply: (v) => f.apply(Number(v.slice(4))) });
    }
  }
  if (s.template === "cards" && Array.isArray(s.cards)) s.cards.forEach((card, i) => {
    if (card.icon !== "auto") return;
    qs.push({ id: `icon${i}`, path: `cards[${i}].icon`, min: 0, fallback: "circle-check",
      instructions: `Which icon best represents this card? Title: "${plain(card.title)}". Text: "${plain(card.text || (card.bullets || []).join("; "))}"`,
      options: Object.fromEntries(ICONS.map((ic) => [ic, ic.replace(/-/g, " ")])), apply: (v) => { card.icon = v; } });
  });
  return qs;
}

export async function resolveAuto(slide, style, jev) {
  const out = structuredClone(slide), qs = collect(out);
  if (!qs.length) return { slide: out, resolved: {}, ms: 0 };
  const r = await jev(`Deck style: ${style}.\nSlide: ${slideText(out)}`, Object.fromEntries(qs.map((q) => [q.id, { instructions: q.instructions, options: q.options }])));
  const picks = Object.fromEntries(qs.map((q) => { const a = r[q.id]; return [q.id, a && a.p >= q.min ? { value: a.choice, p: a.p } : { value: q.fallback, p: a?.p ?? 0 }]; }));
  // Comparable series (same unit) that were all auto get one mark: the most confident pick.
  if (out.template === "chart") {
    const c = out.chart, groups = {};
    qs.filter((q) => q.id.startsWith("mark")).forEach((q) => { const x = c.series[Number(q.id.slice(4))]; (groups[fmtOf(c, x)] ||= []).push(q.id); });
    Object.values(groups).forEach((ids) => { const best = ids.reduce((a, b) => (picks[b].p > picks[a].p ? b : a)); ids.forEach((id) => { picks[id] = { ...picks[id], value: picks[best].value }; }); });
  }
  const resolved = {};
  for (const q of qs) { q.apply(picks[q.id].value); resolved[q.path] = { value: picks[q.id].value, p: Math.round(picks[q.id].p * 100) / 100 }; }
  delete out.focus;
  return { slide: out, resolved, ms: r._ms || 0 };
}
```

`resolved` for `stacked` stores the Jev option (`stacked` / `side_by_side`), and the slide gets the boolean. That is intended: the agent reads the option name.

- [ ] **Step 5: Run the tests.** `npm run test:proto`. Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add docs/design/proposals/journey/resolve.js docs/design/proposals/tests/resolve.test.js docs/design/proposals/tests/fakes.js
git commit -m "Journey: resolve auto choices (marks, stacking, focus, icons) in one Jev call

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Content checks R9–R14 and J8

**Files:**
- Modify: `journey/checks.js`
- Create: `tests/checks.test.js`

**Interfaces:**
- Produces:
  - `ruleChecks(slide, style, lines) → [{ id, ok, msg }]` now also returns R9–R14 where they apply.
  - `judgmentChecks` adds J8. `numbersIn(text) → number[]` is exported (used by R11, R12 and the harness).

- [ ] **Step 1: Write the failing tests** `tests/checks.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { numbersIn, ruleChecks } from "../journey/checks.js";

const get = (s, id, style = "consulting") => ruleChecks(s, style, 1).find((c) => c.id === id);
const chart = (series, extra = {}) => ({ template: "chart", title: "Revenue grew [[4.5×]] from £2.1m to £9.4m by 2025", source: "Accounts", chart: { categories: ["2022", "2023", "2024", "2025"], format: "£{v}m", series, ...extra } });
const REV = { name: "Revenue", mark: "bar", color: "focus", values: [2.1, 4.8, 7.2, 9.4] };

test("numbersIn ignores years", () => assert.deepEqual(numbersIn("£2.1m in 2022 to £9,400k, 4.5×"), [2.1, 9400, 4.5]));

test("R9: comparable series mixing marks, three units, bad stacking", () => {
  assert.equal(get(chart([REV, { ...REV, name: "Cost", color: "neutral", mark: "line" }]), "R9").ok, false);
  assert.equal(get(chart([REV, { ...REV, name: "Target", color: "neutral", mark: "line", dashed: true }]), "R9").ok, true);
  assert.equal(get(chart([REV, { name: "M", mark: "line", format: "{v}%", color: "contrast", values: [1, 2, 3, 4] }]), "R9").ok, true);
});

test("R10: four cards warn in consulting; framed and pitch exempt", () => {
  const cards = (n, extra = {}) => ({ template: "cards", title: "Four levers move the margin by a third", cards: Array.from({ length: n }, (_, i) => ({ icon: "zap", title: `L${i}`, text: "x" })), ...extra });
  assert.equal(get(cards(4), "R10").ok, false);
  assert.equal(get(cards(3), "R10").ok, true);
  assert.equal(get(cards(4), "R10", "pitch"), undefined);
});

test("R11: title figures on the slide or derived", () => {
  assert.equal(get(chart([REV]), "R11").ok, true); // 2.1 and 9.4 in the data; 4.5 ≈ 9.4 / 2.1
  const s = chart([REV]); s.title = "Revenue reached £12m by 2025";
  assert.equal(get(s, "R11").ok, false);
});

test("R12: consulting title with figures on the slide carries a figure", () => {
  const s = chart([REV]); s.title = "Revenue grew strongly as churn fell";
  assert.equal(get(s, "R12").ok, false);
});

test("R13: one unit and precision per column; no false precision", () => {
  const t = (cells) => ({ template: "table", title: "Plan A leads with 61% margin", source: "x", table: { columns: [{ label: "Plan" }, { label: "Margin" }], rows: cells.map((c, i) => ({ cells: [`P${i}`, c] })) } });
  assert.equal(get(t(["42%", "61%"]), "R13").ok, true);
  assert.equal(get(t(["42%", "61.5%"]), "R13").ok, false);
  assert.equal(get(t(["42%", "£61"]), "R13").ok, false);
  assert.equal(get(t(["9,837,221", "61"]), "R13").ok, false);
});

test("R14: time runs oldest first; single-series bars sorted by value", () => {
  const s = chart([REV]); s.chart.categories = ["2025", "2024", "2023", "2022"];
  assert.equal(get(s, "R14").ok, false);
  const bars = chart([{ ...REV, values: [3, 9, 5, 1] }]); bars.chart.categories = ["North", "South", "East", "West"];
  assert.equal(get(bars, "R14").ok, false);
  bars.chart.series[0].values = [9, 5, 3, 1];
  assert.equal(get(bars, "R14").ok, true);
});
```

- [ ] **Step 2: Run to verify they fail.** `npm run test:proto`. Expected: FAIL (`numbersIn` is not exported; R9–R14 are missing).

- [ ] **Step 3: Add the helpers and R9–R14 to `journey/checks.js`.** Insert the helpers after `hasFigures`:

```js
const YEAR = (n, raw) => Number.isInteger(n) && n >= 1900 && n <= 2100 && !/[,.]/.test(raw);
/** Figures in a text: "£9,400k" → 9400, "4.5×" → 4.5; four-digit years are left out. */
export const numbersIn = (text) => [...String(text).matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((m) => [parseFloat(m[0].replace(/,/g, "")), m[0]]).filter(([n, raw]) => !YEAR(n, raw)).map(([n]) => n);
const close = (a, b) => Math.abs(a - b) <= Math.max(0.051, Math.abs(b) * 0.02);

function bodyText(s) {
  const { title, subtitle, takeaway, kicker, footnote, source, ...body } = s;
  return JSON.stringify(body, (k, v) => (typeof v === "string" ? plain(v) : v));
}
/** A headline figure is on the slide, or is a difference, ratio or % change of two body figures. */
function derivable(h, nums) {
  if (nums.some((b) => close(b, h))) return true;
  for (const a of nums) for (const b of nums) {
    if (a === b || !b) continue;
    if (close(a - b, h) || close(a / b, h) || close((a / b - 1) * 100, h)) return true;
  }
  return false;
}
const unitOf = (v) => String(v).replace(/[\d,.\s()+−-]/g, "");
const decimals = (v) => (String(v).match(/\.(\d+)/) || ["", ""])[1].length;
const tooPrecise = (v) => numbersIn(v).some((n) => Math.abs(n) >= 10000 && String(Math.round(Math.abs(n))).replace(/0+$/, "").length > 3);
function timeKey(label) {
  const t = String(label).trim(), m = t.match(/^(?:FY\s?)?((?:19|20)\d{2})$/) || t.match(/^(?:Year|Y)\s?(\d+)$/i);
  if (m) return Number(m[1]);
  const mo = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(t.slice(0, 3).toLowerCase());
  return mo >= 0 && t.length <= 9 ? mo : null;
}
```

At the end of `ruleChecks`, before the R5 message fix-up, add:

```js
  if (s.template === "chart" && Array.isArray(s.chart?.series)) {
    const c = s.chart, fmt = (x) => x.format || c.format || "{v}", byFmt = {};
    c.series.forEach((x) => { if (!x.dashed) (byFmt[fmt(x)] ||= new Set()).add(x.mark); });
    const mixed = Object.entries(byFmt).find(([, marks]) => marks.size > 1), units = new Set(c.series.map(fmt)).size;
    const bars = c.series.filter((x) => x.mark === "bar"), badStack = c.stacked === true && (bars.length < 2 || new Set(bars.map(fmt)).size > 1);
    add("R9", !mixed && units <= 2 && !badStack, mixed ? `Series in ${mixed[0]} mix bars and lines; comparable series share one mark` : units > 2 ? `${units} units on one chart; at most 2` : badStack ? "Stacked bars need 2 or more bar series in one unit" : "Chart follows the chart guide");
  }
  if (style === "consulting") {
    const n = s.template === "cards" && !s.framed ? (s.cards || []).length : (s.notes || []).length || null;
    if (n) add("R10", n <= 3, n <= 3 ? `${n} parallel items` : `${n} parallel items; 3 reads best: merge or cut to 3`);
  }
  const heads = numbersIn([s.title, s.subtitle, s.takeaway].filter(Boolean).map(plain).join(" "));
  if (heads.length) {
    const nums = numbersIn(bodyText(s)), missing = heads.filter((h) => !derivable(h, nums));
    add("R11", !missing.length, missing.length ? `Headline figure ${missing.join(", ")} is not on the slide` : "Headline figures are on the slide");
  }
  if (style === "consulting" && hasFigures(s)) add("R12", numbersIn(plain(s.title)).length > 0, numbersIn(plain(s.title)).length ? "The title quantifies the so-what" : "The title has no figure; quantify the so-what");
  const groups = [];
  if (s.template === "table") (s.table?.columns || []).slice(1).forEach((_, j) => groups.push((s.table.rows || []).filter((r) => r.style !== "total").map((r) => { const c = r.cells?.[j + 1]; return String(c && typeof c === "object" ? c.value : c ?? ""); }).filter((v) => /\d/.test(v))));
  if (s.template === "cards" && (s.cards || []).some((c) => c.value)) groups.push(s.cards.map((c) => c.value || ""));
  if (groups.length) {
    const bad = groups.find((g) => g.length > 1 && (new Set(g.map(unitOf)).size > 1 || new Set(g.map(decimals)).size > 1));
    const precise = groups.flat().find(tooPrecise);
    add("R13", !bad && !precise, bad ? `Mixed units or decimals: ${bad.join(", ")}` : precise ? `False precision: ${precise}; round to 3 significant digits` : "Consistent units and precision");
  }
  if (s.template === "chart" && s.chart?.categories) {
    const keys = s.chart.categories.map(timeKey), series = s.chart.series || [];
    if (keys.every((k) => k !== null)) add("R14", keys.every((k, i) => !i || k > keys[i - 1]), keys.every((k, i) => !i || k > keys[i - 1]) ? "Time runs oldest to newest" : "Time must run oldest to newest, left to right");
    else if (series.length === 1 && series[0].mark === "bar") { const v = series[0].values; const sorted = v.every((x, i) => !i || x <= v[i - 1]);
      add("R14", sorted, sorted ? "Bars sorted largest first" : "Bars are not sorted by value; largest first unless the order means something"); }
  }
```

- [ ] **Step 4: Add J8** in `judgmentChecks`, after the J7 `add(...)`:

```js
  if (parallel) add("J8", ["consulting"], "Are the parallel items (card titles, step names or note titles) written in the same grammatical form?", { parallel: "All in one form: all noun phrases, all verbs, or all outcomes.", mixed: "The forms are mixed." }, "parallel", { parallel: "Parallel items share one form", mixed: "Parallel items mix forms" });
```

- [ ] **Step 5: Run the tests.** `npm run test:proto`. Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add docs/design/proposals/journey/checks.js docs/design/proposals/tests/checks.test.js
git commit -m "Checks: R9 chart guide, R10 rule of three, R11 headline figures, R12 quantified title, R13 precision, R14 order, J8 parallel form

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: The PRE step

**Files:**
- Create: `journey/pre.js`, `tests/pre.test.js`

**Interfaces:**
- Consumes: `jev`, and `GUIDE`, `MENU_OPTIONS` and `STYLE_STATE` from `prompts.js`.
- Produces:
  - `P_ACT = 0.7`, `P_LEAD = 0.6`
  - `LEADS`, `LEAD_Q`: the card-lead question, reused by `create_slide`
  - `preStep({ text, deck, selection, jev }) → Promise<{ intent, p, template, probabilities, lead: string|null, after, ms }>`
  - `firstCall(pre, selection, text, deck) → { name, args } | null`

- [ ] **Step 1: Write the failing tests** `tests/pre.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { firstCall, preStep } from "../journey/pre.js";
import { fakeJev } from "./fakes.js";

const deck = { style: "consulting", slides: [{ id: "s_ab12", slide: { template: "chart", title: "Revenue grew" } }] };
const sel = { slideId: "s_ab12" };

test("one Jev call with intent, template, lead and position", async () => {
  const jev = fakeJev({ intent: ["new_slide", 0.92], template: ["table", 0.8], lead: ["value", 0.5], after: ["s_ab12", 0.7] });
  const pre = await preStep({ text: "Add our pricing table", deck, selection: sel, jev });
  assert.equal(jev.calls.length, 1);
  assert.deepEqual(Object.keys(jev.calls[0].questions), ["intent", "template", "lead", "after"]);
  assert.equal(pre.intent, "new_slide"); assert.equal(pre.template, "table"); assert.equal(pre.lead, null); assert.equal(pre.after, "s_ab12");
});

test("empty deck: no position question", async () => {
  const jev = fakeJev();
  await preStep({ text: "x", deck: { style: "pitch", slides: [] }, selection: null, jev });
  assert.equal("after" in jev.calls[0].questions, false);
});

test("firstCall acts only when sure and when it can", () => {
  const base = { p: 0.9, template: "table", lead: null, after: "end", probabilities: {} };
  assert.deepEqual(firstCall({ ...base, intent: "new_slide" }, sel, "Add a table", deck), { name: "create_slide", args: { about: "Add a table", after: "end", template: "table" } });
  assert.deepEqual(firstCall({ ...base, intent: "edit_selected" }, sel, "x", deck), { name: "read_slide", args: { slideId: "s_ab12" } });
  assert.deepEqual(firstCall({ ...base, intent: "change_template" }, sel, "as a table", deck), { name: "create_slide", args: { about: "as a table", replace: "s_ab12", template: "table" } });
  assert.equal(firstCall({ ...base, intent: "change_template", template: "chart" }, sel, "x", deck), null, "same template: let the agent decide");
  assert.equal(firstCall({ ...base, intent: "edit_selected" }, null, "x", deck), null, "nothing selected");
  assert.equal(firstCall({ ...base, intent: "new_slide", p: 0.69 }, sel, "x", deck), null);
  for (const intent of ["several_slides", "ask", "other"]) assert.equal(firstCall({ ...base, intent }, sel, "x", deck), null);
});
```

- [ ] **Step 2: Run to verify they fail.** `npm run test:proto`. Expected: FAIL, the module is not found.

- [ ] **Step 3: Implement `journey/pre.js`:**

```js
/* PRE (spec 9.0): one Jev call before the agent runs: intent, template, card lead, position.
   When the intent is sure, code makes the agent's first tool call itself. */
import { GUIDE, MENU_OPTIONS, STYLE_STATE } from "./prompts.js";

export const P_ACT = 0.7, P_LEAD = 0.6;
const plainTitle = (s) => String(s || "").replace(/\[\[|\]\]|\*\*|\[-|-\]|\[\+|\+\]/g, "");

const INTENTS = {
  new_slide: "Add one new slide with this content.",
  edit_selected: "Change something on the selected slide: wording, numbers, a series, a choice such as bar or line, a card, the focus.",
  change_template: "Show the selected slide as another kind of slide (as a table, as a chart, as cards).",
  several_slides: "Add or change several slides in one request.",
  ask: "Too unclear to act on: the agent must ask one question first.",
  other: "A question, a comment, thanks, or anything that does not change the deck.",
};
export const LEADS = {
  icon: "Each card leads with an icon.",
  value: "Each card leads with a big number.",
  framed: "Two framed cards contrasting a losing case and a winning case.",
};
export const LEAD_Q = "If the slide were cards, how should they lead? Value when every card has a number worth showing; framed for a two-way contrast (them vs us, before vs after); otherwise icon.";

export async function preStep({ text, deck, selection, jev }) {
  const slides = deck.slides.filter((s) => s.slide);
  const list = slides.map((s, i) => `${i + 1}. ${s.id} [${s.slide.template}] ${plainTitle(s.slide.title)}`).join("\n");
  const state = [`Deck style: ${STYLE_STATE[deck.style]}.`, list ? `Slides:\n${list}` : "The deck is empty.",
    selection?.slideId ? `Selected slide: ${selection.slideId}.` : "No slide is selected.", `User message: ${text}`].join("\n");
  const qs = {
    intent: { instructions: "What does the user want done with this message?", options: INTENTS },
    template: { instructions: `If this message asks for a new slide or another kind of slide, which template fits its content?\n${GUIDE}`, options: MENU_OPTIONS },
    lead: { instructions: LEAD_Q, options: LEADS },
  };
  if (slides.length) qs.after = { instructions: "If a new slide is added, after which slide should it go? The end, unless the message says where or clearly continues a particular slide.",
    options: { end: "At the end of the deck.", ...Object.fromEntries(slides.map((s) => [s.id, `After ${s.id}: ${plainTitle(s.slide.title)}`])) } };
  const r = await jev(state, qs);
  return { intent: r.intent.choice, p: r.intent.p, template: r.template.choice, probabilities: r.template.probabilities,
    lead: r.lead.p >= P_LEAD ? r.lead.choice : null, after: r.after?.choice || "end", ms: r._ms };
}

export function firstCall(pre, selection, text, deck) {
  if (pre.p < P_ACT) return null;
  const current = deck.slides.find((s) => s.id === selection?.slideId)?.slide;
  if (pre.intent === "new_slide") return { name: "create_slide", args: { about: text, after: pre.after, template: pre.template } };
  if (pre.intent === "edit_selected" && current) return { name: "read_slide", args: { slideId: selection.slideId } };
  if (pre.intent === "change_template" && current && pre.template !== current.template) return { name: "create_slide", args: { about: text, replace: selection.slideId, template: pre.template } };
  return null;
}
```

- [ ] **Step 4: Run the tests.** `npm run test:proto`. Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add docs/design/proposals/journey/pre.js docs/design/proposals/tests/pre.test.js
git commit -m "Journey: PRE step: one Jev call for intent, template, card lead and position

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Agent prompt, four tools and the working-slides block

**Files:**
- Modify: `journey/agent-prompt.js` (rewrite `agentSystem` "How you work" and "Writing slide JSON", `TOOLS`; add `workingBlock`)
- Create: `tests/agent-prompt.test.js`

**Interfaces:**
- Produces:
  - `agentSystem(style) → string`
  - `TOOLS` (OpenAI function format), with names `create_slide`, `edit_slide`, `patch_slide`, `read_slide`
  - `stateBlock(...)`, unchanged
  - `workingBlock(items: [{ id, slide, issues, warnings, checks? }]) → string`, starting with `"Working slides"`

- [ ] **Step 1: Write the failing tests** `tests/agent-prompt.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { TOOLS, agentSystem, workingBlock } from "../journey/agent-prompt.js";

test("four tools; patch_slide takes a set and an optional reply", () => {
  assert.deepEqual(TOOLS.map((t) => t.function.name), ["create_slide", "edit_slide", "patch_slide", "read_slide"]);
  const p = TOOLS[2].function.parameters;
  assert.deepEqual(p.required, ["slideId", "set"]);
  assert.ok(p.properties.reply);
  assert.ok(TOOLS[1].function.parameters.properties.reply);
});

test("the system prompt states the patch rule, auto and the working block", () => {
  const s = agentSystem("consulting");
  for (const phrase of ["patch_slide", "never rewrite", "\"auto\"", "Working slides", "reply"]) assert.ok(s.includes(phrase), phrase);
});

test("working block: current JSON, open issues, failed checks", () => {
  const b = workingBlock([{ id: "s_ab12", slide: { template: "number", title: "T" }, issues: ["title: too long"], warnings: [], checks: [{ id: "J2", ok: false, msg: "Body supports the claim only partly" }, { id: "J1", ok: true, msg: "ok" }] }]);
  assert.ok(b.startsWith("Working slides"));
  assert.ok(b.includes('"title":"T"'));
  assert.ok(b.includes("title: too long"));
  assert.ok(b.includes("J2: Body supports the claim only partly"));
  assert.ok(!b.includes("J1"));
  assert.ok(workingBlock([]).includes("none yet"));
});
```

- [ ] **Step 2: Run to verify they fail.** `npm run test:proto`. Expected: FAIL (3 tools; no `workingBlock`).

- [ ] **Step 3: Update `agentSystem`.** Replace the `# How you work` section (lines 146–151) with:

```js
# How you work
- New slide: create_slide with the content in the user's own words (it picks the template and gives you its card, a good example and any values already decided), then write the whole slide with edit_slide. One slide per create_slide.
- Any change to an existing slide: patch_slide with only the paths that change, e.g. { "set": { "cards[1].title": "…", "chart.series[0].values[3]": 42 } }. You never rewrite an existing slide whole; edit_slide refuses it. To remove an item set it to null; to add one, use the next index. Reordering: patch the whole list.
- Template change ("show this as a table"): create_slide with replace set to the slide id, then edit_slide with the full slide, keeping the message and figures.
- The "Working slides" message at the end of the conversation holds the CURRENT JSON of every slide you work on, with its open issues and failed checks. Always read slides from it, never from older copies earlier in the conversation. read_slide adds a slide to it.
- Every write returns issues and warnings. Shape errors: NOT applied; fix and write again. issues: applied and visible; patch again to fix each one. elsewhere (patch_slide): problems outside your patch, often caused by it (a longer title now on 3 lines, a note pointing at a removed category); patch them too when your change caused them. Warnings are advice; act on them when cheap.
- Put your reply to the user in the write's \`reply\` when that write should finish the request. If the write comes back clean the turn ends there; otherwise fix the issues and reply after.
Finish every turn with a short reply: one or two plain sentences about what you did and anything left open. Never paste JSON into the reply. If the request is unclear, ask one question instead of guessing.
```

In `# Writing slide JSON`, replace the "Choices" bullet with:

```js
- Choices go to code unless the user named them: write "auto" for a chart series' \`mark\`, for \`chart.stacked\`, for a card \`icon\`, and set the slide's \`focus\` to "auto" instead of colouring a series, card, step or column yourself. Code picks with a classifier and returns what it picked in \`resolved\`. When the user names a value ("make margin a line", "stack them", "highlight 2025"), write that value. Values in create_slide's \`decided\` are written as given.
- Chart rules (bar or line, stacking, units) are in the chart card's rules; follow them when you write or patch a chart, including edits: switching one series of a comparable group switches the group.
```

- [ ] **Step 4: Replace `TOOLS` and add `workingBlock`:**

```js
const ID = { type: "string", description: "Slide id from the deck state, e.g. s_a1b2." };
const REPLY = { type: "string", description: "Your reply to the user, when this write should finish the request. Used only if the write comes back with no issues." };

/** Tool definitions (OpenAI function format), spec 9.5. */
export const TOOLS = [
  { name: "create_slide", description: "Start a new slide, or change a slide's template. Picks the template (unless you pass one) and returns the slide id, the template, its card, a good example and any values already decided. Writes nothing yet: follow with edit_slide.",
    parameters: { type: "object", required: ["about"], properties: {
      about: { type: "string", description: "The slide's content, keeping the user's words and every figure." },
      after: { type: "string", description: "Slide id to insert after, or \"end\". Not used with replace." },
      template: { type: "string", enum: Object.keys(MENU), description: "Only when the user named the kind of slide." },
      replace: { ...ID, description: "For a template change: the slide to re-template (it keeps its id)." } } } },
  { name: "edit_slide", description: "Write a WHOLE slide, only right after create_slide reserved it (a new slide or a template change). Existing slides change with patch_slide. Code fixes trivia, resolves \"auto\" choices, validates and measures it at 1920×1080.",
    parameters: { type: "object", required: ["slideId", "slide"], properties: { slideId: ID,
      slide: { type: "object", description: "Full slide JSON: { template, ...fields } per the template card. Objects and lists as JSON, not strings." }, reply: REPLY } } },
  { name: "patch_slide", description: "Change an existing slide at exact paths; everything else stays as it is. All or nothing: a bad path or a shape error applies nothing. The whole slide is re-checked after the patch.",
    parameters: { type: "object", required: ["slideId", "set"], properties: { slideId: ID,
      set: { type: "object", description: "{ path: new value }. Paths follow the slide JSON: title, chart.series[1].values, cards[2].title, notes[0]. null removes a field or item; the next index appends.", additionalProperties: true },
      reply: REPLY } } },
  { name: "read_slide", description: "Add a slide to the Working slides message (its current JSON and issues) and get its template card. Changes nothing.",
    parameters: { type: "object", required: ["slideId"], properties: { slideId: ID } } },
].map((f) => ({ type: "function", function: f }));

/** Working slides (spec 9.3): rebuilt before every model step, sent last, never stored in the history. */
export function workingBlock(items) {
  if (!items.length) return "Working slides (current JSON)\n(none yet)";
  return `Working slides (current JSON; this replaces any earlier copy in the conversation)\n\n${items.map((it) => {
    const failed = (it.checks || []).filter((c) => !c.ok && c.id.startsWith("J")).map((c) => `${c.id}: ${c.msg}`);
    return [`${it.id} [${it.slide.template}]`, JSON.stringify(it.slide),
      `Open issues: ${it.issues?.length ? it.issues.join(" | ") : "none"}`,
      it.warnings?.length ? `Warnings: ${it.warnings.join(" | ")}` : "",
      failed.length ? `Judgment checks failed: ${failed.join(" | ")}` : ""].filter(Boolean).join("\n");
  }).join("\n\n")}`;
}
```

Also update the file header comment to: `/* Agent context (spec 9.3): system prompt, the four tools, the per-turn state block and the working-slides block. */`

- [ ] **Step 5: Run the tests.** `npm run test:proto`. Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add docs/design/proposals/journey/agent-prompt.js docs/design/proposals/tests/agent-prompt.test.js
git commit -m "Agent prompt: patch_slide, auto choices, reply on writes, working-slides block

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: The hybrid turn (`agent.js`)

**Files:**
- Rewrite: `journey/agent.js`
- Create: `tests/agent.test.js`

**Interfaces:**
- Consumes: everything from Tasks 4–9.
- Produces: `runTurn({ text, deck, history, working, selection, measure, log, onChange, models? }) → Promise<{ reply, pre, written: string[], modelCalls, toolCalls, modelMs }>`
  - `deck = { style, theme, slides: [{ id, slide, pending?, issues, warnings, checks? }] }`, mutated in place
  - `history`: messages, mutated
  - `working: Set<slideId>`, mutated and owned by the caller
  - `measure(slide, index) → string[]` with `measure.lines`
  - `models = { agentStep, jev }` for tests

- [ ] **Step 1: Write the failing tests** `tests/agent.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { runTurn } from "../journey/agent.js";
import { fakeAgent, fakeJev, say, toolCall } from "./fakes.js";

const CHART = { template: "chart", title: "Revenue grew [[4.5×]] from £2.1m to £9.4m", source: "Company accounts",
  chart: { categories: ["2022", "2023", "2024", "2025"], format: "£{v}m", series: [{ name: "Revenue", mark: "bar", color: "focus", values: [2.1, 4.8, 7.2, 9.4] }] } };
const setup = (slides = []) => {
  const measure = () => []; measure.lines = 1;
  return { deck: { style: "consulting", theme: "ink", slides }, history: [], working: new Set(), measure, log: () => {} };
};
const reservedId = (messages) => JSON.parse(messages.findLast((m) => m.role === "tool").content).slideId;

test("new slide: PRE creates it, one GLM call writes it and ends the turn", async () => {
  const ctx = setup();
  const agentStep = fakeAgent([(m) => toolCall("edit_slide", { slideId: reservedId(m), slide: CHART, reply: "Added the revenue chart." })]);
  const r = await runTurn({ ...ctx, text: "Revenue £2.1m, 4.8, 7.2, 9.4 for 2022–25", selection: null,
    models: { agentStep, jev: fakeJev({ intent: ["new_slide", 0.95], template: ["chart", 0.9] }) } });
  assert.equal(r.modelCalls, 1);
  assert.equal(r.reply, "Added the revenue chart.");
  assert.equal(ctx.deck.slides.length, 1);
  assert.equal(ctx.deck.slides[0].slide.chart.series[0].mark, "bar");
  assert.equal(ctx.history.at(-1).content, "Added the revenue chart.");
});

test("edit: PRE reads the selected slide; one patch changes only the title", async () => {
  const ctx = setup([{ id: "s_ab12", slide: structuredClone(CHART), issues: [], warnings: [] }]);
  const agentStep = fakeAgent([(m) => {
    assert.ok(m.at(-1).content.startsWith("Working slides"), "working block is last");
    assert.ok(m.at(-1).content.includes("s_ab12"));
    return toolCall("patch_slide", { slideId: "s_ab12", set: { title: "Revenue grew [[4.5×]] in three years" }, reply: "Shortened the title." });
  }]);
  const r = await runTurn({ ...ctx, text: "Shorter title", selection: { slideId: "s_ab12" },
    models: { agentStep, jev: fakeJev({ intent: ["edit_selected", 0.9] }) } });
  assert.equal(r.modelCalls, 1);
  const after = ctx.deck.slides[0].slide;
  assert.equal(after.title, "Revenue grew [[4.5×]] in three years");
  assert.deepEqual({ ...after, title: null }, { ...CHART, title: null });
  assert.ok(ctx.working.has("s_ab12"));
});

test("edit_slide on an existing slide is refused", async () => {
  const ctx = setup([{ id: "s_ab12", slide: structuredClone(CHART), issues: [], warnings: [] }]);
  const agentStep = fakeAgent([toolCall("edit_slide", { slideId: "s_ab12", slide: CHART }), say("Done.")]);
  await runTurn({ ...ctx, text: "x", selection: null, models: { agentStep, jev: fakeJev({ intent: ["other", 0.9] }) } });
  const out = JSON.parse(ctx.history.find((m) => m.role === "tool").content);
  assert.equal(out.applied, false);
  assert.ok(out.error.includes("patch_slide"));
});

test("a patch with a shape error applies nothing; the next step sees the old slide", async () => {
  const ctx = setup([{ id: "s_ab12", slide: structuredClone(CHART), issues: [], warnings: [] }]);
  const agentStep = fakeAgent([toolCall("patch_slide", { slideId: "s_ab12", set: { "chart.series[0].mark": "pie" } }), say("Could not.")]);
  await runTurn({ ...ctx, text: "x", selection: { slideId: "s_ab12" }, models: { agentStep, jev: fakeJev({ intent: ["other", 0.9] }) } });
  assert.equal(ctx.deck.slides[0].slide.chart.series[0].mark, "bar");
  assert.equal(JSON.parse(ctx.history.find((m) => m.role === "tool").content).applied, false);
});

test("issues keep the loop going; the next step sees the current JSON and tool results carry no slide", async () => {
  const ctx = setup([{ id: "s_ab12", slide: structuredClone(CHART), issues: [], warnings: [] }]);
  let first = true;
  ctx.measure = (s) => (first ? ((first = false), ["title wraps to 3 lines (max 2); shorten it"]) : []); ctx.measure.lines = 1;
  const agentStep = fakeAgent([
    toolCall("patch_slide", { slideId: "s_ab12", set: { title: "A very long new title" }, reply: "Done." }),
    (m) => { assert.ok(m.at(-1).content.includes("A very long new title")); return toolCall("patch_slide", { slideId: "s_ab12", set: { title: "Short" } }); },
    say("Shortened."),
  ]);
  const r = await runTurn({ ...ctx, text: "x", selection: { slideId: "s_ab12" }, models: { agentStep, jev: fakeJev({ intent: ["edit_selected", 0.9] }) } });
  assert.equal(r.modelCalls, 3);
  assert.equal(r.reply, "Shortened.");
  ctx.history.filter((m) => m.role === "tool" && m.content.includes("\"applied\"")).forEach((m) => assert.ok(!m.content.includes("\"chart\"")));
});

test("auto choices are resolved by Jev in the write path", async () => {
  const ctx = setup();
  const slide = { ...CHART, focus: "auto", chart: { ...CHART.chart, series: [{ name: "Revenue", mark: "auto", values: [2.1, 4.8, 7.2, 9.4] }] } };
  const agentStep = fakeAgent([(m) => toolCall("edit_slide", { slideId: reservedId(m), slide, reply: "Done." })]);
  await runTurn({ ...ctx, text: "x", selection: null, models: { agentStep, jev: fakeJev({ intent: ["new_slide", 0.9], template: ["chart", 0.9], mark0: ["line", 0.8], focus: ["item0", 0.9] }) } });
  const s = ctx.deck.slides[0].slide;
  assert.equal(s.chart.series[0].mark, "line");
  assert.equal(s.chart.series[0].color, "focus");
  assert.equal(s.focus, undefined);
});

test("PRE unsure: the agent starts with no tool results", async () => {
  const ctx = setup();
  const agentStep = fakeAgent([(m) => { assert.equal(m.filter((x) => x.role === "tool").length, 0); return say("Which figures should I use?"); }]);
  const r = await runTurn({ ...ctx, text: "hmm", selection: null, models: { agentStep, jev: fakeJev({ intent: ["new_slide", 0.5] }) } });
  assert.equal(r.reply, "Which figures should I use?");
});
```

- [ ] **Step 2: Run to verify they fail.** `npm run test:proto`. Expected: FAIL (the old `runTurn` has no `working`, no PRE and no `patch_slide`).

- [ ] **Step 3: Rewrite `journey/agent.js`:**

```js
/* Hybrid agent (spec 9.0–9.5). PRE: one Jev call; when the intent is sure, code makes the first tool call.
   Then GLM 5.3 Flash in a tool loop. New slides are written whole right after create_slide; existing slides
   change only through path patches. Every write: autofix → validate → resolve auto (Jev) → autofix →
   measure → rule checks. The working-slides block goes last before every model step, never into history. */
import { MENU, describe, validate } from "../v5/schema.js";
import { agentStep as glmStep, jev as jevCall } from "./llm.js";
import { GUIDE, MENU_OPTIONS, STYLE_STATE, exampleFor } from "./prompts.js";
import { autofix } from "./autofix.js";
import { applyPatch } from "./patch.js";
import { resolveAuto } from "./resolve.js";
import { ruleChecks } from "./checks.js";
import { LEADS, LEAD_Q, P_ACT, P_LEAD, firstCall, preStep } from "./pre.js";
import { TOOLS, agentSystem, stateBlock, workingBlock } from "./agent-prompt.js";

const MAX_TOOL_CALLS = 10;
const plainTitle = (s) => String(s || "").replace(/\[\[|\]\]|\*\*|\[-|-\]|\[\+|\+\]/g, "");
const newId = (taken) => { let id; do id = `s_${Math.random().toString(36).slice(2, 6)}`; while (taken.has(id)); return id; };
// Models sometimes send objects as JSON strings; accept both.
const asValue = (v) => { if (typeof v === "string" && /^\s*[[{]/.test(v)) { try { return JSON.parse(v); } catch { /* keep the string */ } } return v; };
/* validate() lists limits with shape errors. Limits are fit issues: applied and returned (spec 9.4). */
const LIMIT = /characters|at most|budget|too many|Cut or merge|Shorten|with notes|with a takeaway/i;
/** An issue belongs to a patch when its leading path and a patched path share a prefix. */
const touches = (issue, paths) => { const r = String(issue).split(/[:\s]/)[0]; return paths.some((p) => r.startsWith(p) || p.startsWith(r)); };

export async function runTurn({ text, deck, history, working, selection, measure, log, onChange, models = {} }) {
  const agentStep = models.agentStep || glmStep, jev = models.jev || jevCall;
  const style = deck.style, reserved = new Map(), written = new Set();
  const trail = { modelCalls: 0, toolCalls: 0, modelMs: 0 };
  const find = (id) => deck.slides.find((s) => s.id === id);
  const unknown = (id) => ({ error: `unknown slideId ${id}; valid ids: ${deck.slides.filter((s) => !s.pending).map((s) => s.id).join(", ") || "none yet"}` });
  const visible = () => deck.slides.filter((s) => !s.pending);

  async function classify(about) {
    const titles = visible().map((s, i) => `${i + 1}. [${s.slide.template}] ${plainTitle(s.slide.title)}`).join("\n");
    const r = await jev(`Deck style: ${STYLE_STATE[style]}.\n${titles ? `Slides already in the deck:\n${titles}` : "The deck is empty."}\nContent for the slide: ${about}`,
      { template: { instructions: `Which slide template best fits this content?\n${GUIDE}`, options: MENU_OPTIONS }, lead: { instructions: LEAD_Q, options: LEADS } });
    log({ step: "Classify", model: "Jev", ms: r._ms, detail: `${r.template.choice} · p ${r.template.p.toFixed(2)}` });
    return { template: r.template.choice, probabilities: r.template.probabilities, lead: r.lead.p >= P_LEAD ? r.lead.choice : null };
  }

  async function write(item, input) {
    const first = autofix(input, style), v = validate(first.slide, style);
    const shape = v.errors.filter((e) => !LIMIT.test(e)), limits = v.errors.filter((e) => LIMIT.test(e));
    if (shape.length) return { applied: false, issues: shape, autofixes: first.fixes };
    const r = await resolveAuto(first.slide, style, jev);
    if (Object.keys(r.resolved).length) log({ step: "Resolve", model: "Jev", ms: r.ms, detail: Object.entries(r.resolved).map(([k, x]) => `${k} = ${x.value}`).join(" · ") });
    const done = autofix(r.slide, style), slide = done.slide;
    let measured;
    try { measured = measure(slide, deck.slides.indexOf(item)); } catch (e) { return { applied: false, issues: [`slide could not be rendered: ${e.message}`, ...limits], autofixes: first.fixes }; }
    const issues = [...limits, ...measured];
    const rules = ruleChecks(slide, style, measure.lines).filter((c) => !c.ok).map((c) => `${c.id}: ${c.msg}`);
    Object.assign(item, { slide, pending: false, issues, warnings: [...v.warnings, ...rules], checks: [] });
    working.add(item.id); written.add(item.id);
    onChange?.(deck, item.id);
    return { applied: true, issues, warnings: item.warnings, autofixes: [...first.fixes, ...done.fixes], resolved: r.resolved };
  }

  const tools = {
    async create_slide({ about = "", after = "end", template, replace }, pre) {
      if (replace && !find(replace)) return unknown(replace);
      let probabilities = pre?.probabilities || null, lead = pre?.lead || null;
      if (!MENU[template]) ({ template, probabilities, lead } = await classify(about));
      let slideId = replace;
      if (!slideId) {
        slideId = newId(new Set(deck.slides.map((s) => s.id)));
        const at = after === "end" || !find(after) ? deck.slides.length : deck.slides.findIndex((s) => s.id === after) + 1;
        deck.slides.splice(at, 0, { id: slideId, slide: null, pending: true, issues: [], warnings: [] });
      }
      reserved.set(slideId, template);
      const decided = template === "cards" && lead ? { "cards.lead": lead } : {};
      return { slideId, template, probabilities, decided, card: describe(template, style), example: JSON.parse(exampleFor(template, style, lead)) };
    },

    async edit_slide({ slideId, slide }) {
      const item = find(slideId);
      if (!item) return unknown(slideId);
      if (!reserved.has(slideId)) return { applied: false, error: `${slideId} already exists: change it with patch_slide, setting only the paths that change. edit_slide writes a whole slide only right after create_slide.` };
      slide = asValue(slide);
      if (!slide || typeof slide !== "object" || Array.isArray(slide)) return { applied: false, issues: ["slide: must be a JSON object { template, ...fields }."] };
      const allowed = reserved.get(slideId);
      slide = { template: slide.template || allowed, ...slide };
      if (slide.template !== allowed) return { applied: false, issues: [`template: this is a ${allowed} slide. To change the template, call create_slide with replace: "${slideId}" first.`] };
      return write(item, slide);
    },

    async patch_slide({ slideId, set }) {
      const item = find(slideId);
      if (!item) return unknown(slideId);
      if (item.pending) return { applied: false, error: `${slideId} has no content yet: write it whole with edit_slide first.` };
      set = asValue(set);
      if (set && typeof set === "object") set = Object.fromEntries(Object.entries(set).map(([k, v]) => [k, asValue(v)]));
      const p = applyPatch(item.slide, set);
      if (p.errors) return { applied: false, issues: p.errors };
      const res = await write(item, p.slide);
      if (!res.applied) return res;
      return { ...res, changed: p.changed, issues: res.issues.filter((i) => touches(i, p.changed)), elsewhere: res.issues.filter((i) => !touches(i, p.changed)) };
    },

    async read_slide({ slideId }) {
      const item = find(slideId);
      if (!item || item.pending) return unknown(slideId);
      working.add(slideId);
      return { slideId, template: item.slide.template, card: describe(item.slide.template, style), note: "The slide's current JSON is in the Working slides message." };
    },
  };

  /** Run one tool call and record it. Returns whether it was clean and the reply it carried. */
  async function callTool({ id, name, args, raw }, pre, byCode = false) {
    trail.toolCalls++;
    if (byCode) history.push({ role: "assistant", content: "", tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }] });
    if (raw !== undefined) { try { args = JSON.parse(raw || "{}"); } catch { args = null; } }
    const t0 = performance.now();
    let out;
    if (!args) out = { error: "arguments were not valid JSON" };
    else if (!tools[name]) out = { error: `unknown tool ${name}; tools: ${Object.keys(tools).join(", ")}` };
    else out = await tools[name](args, pre);
    history.push({ role: "tool", tool_call_id: id, content: JSON.stringify(out) });
    log({ step: name, model: byCode ? "code" : "tool", ms: Math.round(performance.now() - t0), detail: summary(name, out) });
    const wrote = name === "edit_slide" || name === "patch_slide";
    const clean = !out.error && (!wrote || (out.applied && !out.issues.length && !out.elsewhere?.length));
    return { clean, reply: wrote && out.applied && typeof args.reply === "string" && args.reply.trim() ? args.reply.trim() : null };
  }

  history.push({ role: "user", content: `${stateBlock({ style, theme: deck.theme, slides: visible(), selection })}\n\n${text}` });
  const pre = await preStep({ text, deck, selection, jev });
  log({ step: "Pre", model: "Jev", ms: pre.ms, detail: `${pre.intent} · p ${pre.p.toFixed(2)}${pre.p >= P_ACT ? "" : " · agent decides"}` });
  const first = firstCall(pre, selection, text, deck);
  if (first) await callTool({ id: "pre_1", name: first.name, args: first.args }, pre, true);

  let reply = null;
  while (reply === null) {
    const capped = trail.toolCalls >= MAX_TOOL_CALLS;
    const messages = [{ role: "system", content: agentSystem(style) }, ...history, { role: "user", content: workingBlock(deck.slides.filter((s) => working.has(s.id) && s.slide)) }];
    const { message, ms } = await agentStep({ messages, tools: TOOLS, toolChoice: capped ? "none" : "auto" });
    trail.modelCalls++; trail.modelMs += ms;
    history.push(message);
    const calls = message.tool_calls || [];
    log({ step: calls.length ? "Agent" : "Reply", model: "GLM Flash", ms, detail: calls.length ? calls.map((c) => c.function.name).join(", ") : `after ${trail.toolCalls} tool call${trail.toolCalls === 1 ? "" : "s"}` });
    if (!calls.length) { reply = message.content || ""; break; }
    let clean = true, carried = null;
    for (const c of calls) {
      const r = await callTool({ id: c.id, name: c.function.name, raw: c.function.arguments });
      clean &&= r.clean; carried = r.reply || carried;
    }
    if (clean && carried) { reply = carried; history.push({ role: "assistant", content: reply }); }
  }
  deck.slides = deck.slides.filter((s) => !s.pending);
  return { reply, pre, written: [...written], ...trail };
}

function summary(name, out) {
  if (out.error) return out.error;
  if (name === "create_slide") return `${out.slideId} · ${out.template}`;
  if (name === "read_slide") return `${out.slideId} · ${out.template}`;
  if (!out.applied) return `not applied · ${out.issues.length} shape error${out.issues.length === 1 ? "" : "s"}: ${out.issues.join(" | ")}`;
  const left = [...out.issues, ...(out.elsewhere || [])];
  return `applied${out.changed ? ` · ${out.changed.join(", ")}` : ""} · ${left.length ? `${left.length} issue${left.length === 1 ? "" : "s"}: ${left.join(" | ")}` : "fits"}`;
}
```

- [ ] **Step 4: Run the tests.** `npm run test:proto`. Expected: PASS (all suites).

- [ ] **Step 5: Commit.**

```bash
git add docs/design/proposals/journey/agent.js docs/design/proposals/tests/agent.test.js
git commit -m "Journey: hybrid agent turn

PRE (one Jev call) makes the first tool call when the intent is sure.
patch_slide changes existing slides at exact paths; edit_slide writes a
whole slide only after create_slide reserved it. Every write resolves
auto choices with Jev and re-checks the whole slide; patch results split
issues into issues and elsewhere. The working-slides block goes last
before every model step and never into history; write results carry no
slide JSON. A write's reply ends the turn when the write is clean.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: The journey page: agent only, working set, judgment checks after the turn

**Files:**
- Modify: `journey/app.js`, `journey/prompts.js`, `journey/README.md`
- Delete: `journey/pipeline.js`

**Interfaces:**
- Consumes: `runTurn` (Task 10), `judgmentChecks` and `ruleChecks` (Task 7), `upgrade` (Task 1), `layoutLints` (Task 3).
- Produces, on `window.__journey`, for the harness:
  - `send(text)`: resolves when the turn and its checks end
  - `setStyle(style)`
  - `load(slides, style)`: replaces the deck and selects slide 0
  - `turns[]`, where each turn records `{ request, reply, trace, modelCalls, toolCalls, ms, pre, written, items, current, before }`

- [ ] **Step 1: Remove the pipeline.**
  - Delete `journey/pipeline.js`.
  - In `prompts.js`:
    - delete `SYSTEM`, `deckState`, `fillPrompt`, `repairPrompt`, `editPrompt` and `pickPrompt`
    - delete the `catalogue` and `describe` names from the schema import if they are now unused
    - keep `exampleFor`, `styleBlock`, `STYLE_STATE`, `GUIDE` and `MENU_OPTIONS`
  - In `llm.js`, `glm`, `parseJSON` and `BIG` become unused. Delete them; keep `FLASH`, `post`, `agentStep` and `jev`.

- [ ] **Step 2: Rewrite the send path in `app.js`.**
  - Imports:
    - drop `createSlide, editSlide`
    - add `import { upgrade } from "../v5/schema.js";`
    - import `layoutLints` as in Task 3
  - Delete `ENGINE`, `NEXT`, `replyText` and the pipeline `send` body, so that `send(text)` is:

```js
async function send(text) {
  text = text.trim();
  if (!text || state.busy) return;
  return sendAgent(text);
}
```

  - `state`:
    - drop `engine`
    - add `working: new Set()`
  - The Clear chat handler also clears the working set: `state.history = []; state.working = new Set();`
  - In `boot()`:
    - the mode label is `state.live ? "Live · agent" : "Recorded run"`
    - the welcome text is the agent one

- [ ] **Step 3: Replace `sendAgent` and `runChecks`:**

```js
/* Agent turn: the agent works on its own copy of the deck; every applied write shows at once.
   Judgment checks run after the reply, on the slides written this turn (spec 9.4). */
async function sendAgent(text) {
  $("input").value = "";
  state.busy = true; render();
  addMessage("user", `<p>${esc(text)}</p>`);
  const bot = addMessage("bot", `<p class="sub"><i class="spinner"></i>Working…</p>`);
  const trace = [], t0 = performance.now(), before = structuredClone(state.items);
  const log = (step) => { trace.push(step); bot.innerHTML = traceHTML(trace, "Working"); $("thread").scrollTop = 1e9; };
  const adeck = { style: state.style, theme: state.theme, slides: state.items.map((it) => ({ id: it.id, slide: it.slide, issues: it.errors || [], warnings: it.warnings || [], checks: it.checks || [] })) };
  const cur = state.items[state.current];
  const sync = (d, focusId) => {
    state.items = d.slides.filter((s) => s.slide).map((s) => ({ id: s.id, slide: s.slide, status: s.issues.length ? "draft" : "ok", errors: s.issues, warnings: s.warnings, checks: s.checks || [], checksPending: false }));
    const i = state.items.findIndex((it) => it.id === focusId);
    if (i >= 0) state.current = i;
    render();
  };
  const measureAgent = (slide, index) => { const r = measureIn(adeck.slides, slide, index); measureAgent.lines = measureIn.lines; return r; };
  try {
    const r = await runTurn({ text, deck: adeck, history: state.history, working: state.working, selection: cur ? { slideId: cur.id } : null, measure: measureAgent, log, onChange: sync });
    sync(adeck, r.written.at(-1) || state.items[state.current]?.id);
    const secs = ((performance.now() - t0) / 1000).toFixed(1);
    bot.innerHTML = `${paragraphs(r.reply)}<p class="sub">${r.modelCalls} model call${r.modelCalls === 1 ? "" : "s"} · ${r.toolCalls} tool call${r.toolCalls === 1 ? "" : "s"} · ${secs}s</p>${traceHTML(trace)}`;
    state.items.forEach((it, i) => { measure(it.slide, deck(), i); it.checks = [...ruleChecks(it.slide, state.style, measure.lines), ...(it.checks || []).filter((c) => c.id.startsWith("J"))]; });
    state.busy = false; render();
    const turn = { request: text, reply: r.reply, trace, modelCalls: r.modelCalls, toolCalls: r.toolCalls, ms: Math.round(performance.now() - t0), pre: { intent: r.pre.intent, p: r.pre.p }, written: r.written, before, current: state.current };
    await Promise.all(r.written.map((id) => runChecks(state.items.find((it) => it.id === id))));
    turn.items = structuredClone(state.items);
    state.turns.push(turn);
  } catch (e) {
    bot.className = "msg bot error";
    bot.innerHTML = `<p>Something went wrong: ${esc(e.message || e)}</p>${traceHTML(trace)}`;
    state.busy = false; render();
    state.turns.push({ request: text, error: String(e.message || e), trace, ms: Math.round(performance.now() - t0), before, items: structuredClone(state.items) });
  }
}

async function runChecks(item) {
  if (!item) return;
  const i = state.items.indexOf(item);
  measure(item.slide, deck(), i);
  const rules = ruleChecks(item.slide, state.style, measure.lines);
  item.checks = rules; item.checksPending = true; render();
  try { item.checks = [...rules, ...(await judgmentChecks(item.slide, state.style)).checks]; }
  catch (e) { item.checks = [...rules, { id: "J", ok: false, msg: `judgment checks failed: ${e.message}` }]; }
  item.checksPending = false;
  render();
}
```

The J checks stored on each item flow into `adeck.slides[].checks` on the next turn, so failed ones appear in the working block.

- [ ] **Step 4: Replays and the harness hook.**
  - In `loadSnapshot`, upgrade old slides: `state.items = structuredClone(items).map((it) => ({ ...it, slide: upgrade(it.slide) }));`.
  - Add `load` next to `window.__journey.send`:

```js
window.__journey.load = (slides, style) => {
  state.style = style; state.history = []; state.working = new Set(); state.turns = [];
  state.items = slides.map((s, i) => ({ id: `s_t${i}`, slide: upgrade(s), status: "ok", errors: [], warnings: [], checks: [], checksPending: false }));
  state.current = 0; render();
};
```

  - `README.md`:
    - replace the Modes table and the Pipeline section with a short description of the hybrid agent: the PRE step, the four tools, patches, the working block, `auto` via Jev, reply on writes, and judgment checks after the turn
    - note that the pipeline was removed and its results live in `docs/research/2026-09-26-agent-single-slide/`
    - update the Files list: `patch.js`, `autofix.js`, `resolve.js` and `pre.js` added; `pipeline.js` removed

- [ ] **Step 5: Run the unit tests and a live smoke run.**
  - Run: `npm run test:proto`. Expected: PASS.
  - Then run `node docs/design/proposals/journey/server.mjs` and open http://localhost:8787/journey/ with keys in `.env`. Check each turn:

| Step | Expected |
|---|---|
| (a) consulting, "Our SaaS revenue grew from £2.1m in 2022 to £9.4m in 2025 while monthly churn fell from 8% to 3%" | a chart; the trace shows `Pre · new_slide`, `create_slide · code`, 1–2 GLM calls, `Resolve` |
| (b) "Make the title shorter" | the trace shows `read_slide · code` and one `patch_slide` touching only `title` |
| (c) "Show churn as bars" | a patch of `chart.series[1].mark`, and an R9 warning (two units, bars and bars) or the agent's own follow-up |
| (d) "Show this as a table instead" | `create_slide` with replace, then `edit_slide` |
| (e) Clear chat, then "Add a steps slide with our plan: pilot, certify, roll out" | lands after the current slide or at the end |

  After the reply, the Checks panel shows J checks appearing ("judging…" first). Note anything broken, fix it, re-run.

- [ ] **Step 6: Commit.**

```bash
git add -A docs/design/proposals/journey
git commit -m "Journey: hybrid agent only; judgment checks after the reply; harness hooks

The fixed pipeline is removed (its results stay in docs/research/
2026-09-26-agent-single-slide). The page keeps a working set across turns
(cleared with Clear chat), runs Jev judgment checks on the slides written
in a turn after the reply, upgrades recorded slides to the new chart and
table shape, and exposes load() for the evaluation harness.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

# Part C: the evaluation

### Task 12: The §9.7 test for the hybrid

**Files:**
- Create: `docs/research/2026-09-27-hybrid-agent/` containing `package.json`, `requests.json`, `edits.json`, `run.mjs`, `analyze.mjs`, `README.md` and `report.md` (generated)
- Modify: `docs/superpowers/specs/2026-09-26-slide-system-architecture-design.md` §14 (status) and §9.5 (`elsewhere` is a list), `docs/design/proposals/journey/README.md` (results)

**Interfaces:**
- Consumes: `window.__journey` (`send`, `setStyle`, `load`, `turns`) from Task 11; `EXAMPLES` from `v5/examples.js`; `numbersIn` from `journey/checks.js`.
- Produces: `report.md` with the §9.7 table (every pass bar filled in) plus PRE intent accuracy, the share of turns ended by a write's reply, and model calls per turn.

- [ ] **Step 1: Set up the folder.**
  - Create `docs/research/2026-09-27-hybrid-agent/package.json`, the same as the 2026-09-26 one, with the name `hybrid-agent-test`.
  - Build `requests.json`: copy `single` and `warmup` from `docs/research/2026-09-26-agent-single-slide/requests.json`, then add a `choices` label to every request whose `gold` is `chart`, following the chart guide:
    - `{ "marks": "line" }`: only lines
    - `{ "marks": "bar" }`: only bars
    - `{ "marks": "bar+line" }`: bars with a line in another unit
    - add `"stacked": true` only when the series are parts of a whole
    - labels for the three consulting chart requests: `c10` → `{ "marks": "line" }` (8 months); `c11` → `{ "marks": "line" }` (cohort curves); `c12` → `{ "marks": "line" }` (2019–2025, 7 years)
    - label each pitch chart request by reading its prompt, using the same rules

- [ ] **Step 2: Write `edits.json`.** Each case starts from an example in `v5/examples.js`. `allow` lists the path prefixes that may change; `expect` lists exact values after the turn.

```json
[
  { "id": "e01", "style": "consulting", "start": "Chart · with notes (split)", "prompt": "Make the title say interchange overtakes interest income in year 4", "allow": ["title"], "expect": [] },
  { "id": "e02", "style": "consulting", "start": "Chart · with notes (split)", "prompt": "Interchange in year 5 is 82, not 80", "allow": ["chart.series[1].values", "title", "takeaway", "notes"], "expect": [{ "path": "chart.series[1].values[4]", "equals": 82 }] },
  { "id": "e03", "style": "consulting", "start": "Chart · with notes (split)", "prompt": "Stack interest income and interchange", "allow": ["chart.stacked", "notes"], "expect": [{ "path": "chart.stacked", "equals": true }] },
  { "id": "e04", "style": "consulting", "start": "Chart · with notes (split)", "prompt": "Add cost of funds in £m: 0.2, 1.5, 7, 20, 41", "allow": ["chart.series", "notes", "title", "takeaway"], "expect": [{ "path": "chart.series[3].mark", "equals": "bar" }] },
  { "id": "e05", "style": "consulting", "start": "Chart · full width", "prompt": "Add the upside case: 1.2, 5, 13, 29, 52, 80, 112, 150", "allow": ["chart.series", "title", "takeaway", "footnote"], "expect": [{ "path": "chart.series[2].mark", "equals": "line" }] },
  { "id": "e06", "style": "consulting", "start": "Chart · full width", "prompt": "Remove the downside case", "allow": ["chart.series", "title", "takeaway", "footnote"], "expect": [{ "path": "chart.series.length", "equals": 1 }] },
  { "id": "e07", "style": "consulting", "start": "Table · full width", "prompt": "Bad debt for revolvers is (65), not (70)", "allow": ["table.rows[5]", "table.rows[6]", "title", "takeaway"], "expect": [{ "path": "table.rows[5].cells[1].value", "equals": "(65)" }] },
  { "id": "e08", "style": "consulting", "start": "Table · full width", "prompt": "Drop the share of customers row", "allow": ["table.rows"], "expect": [{ "path": "table.rows.length", "equals": 6 }] },
  { "id": "e09", "style": "consulting", "start": "Table · with notes (split)", "prompt": "Rename the Fee column to Annual fee", "allow": ["table.columns[2].label"], "expect": [{ "path": "table.columns[2].label", "equals": "Annual fee" }] },
  { "id": "e10", "style": "consulting", "start": "Table · with notes (split)", "prompt": "Cut the notes to the two strongest", "allow": ["notes"], "expect": [{ "path": "notes.length", "equals": 2 }] },
  { "id": "e11", "style": "consulting", "start": "Cards · icon lead", "prompt": "Make the second card the focus", "allow": ["cards", "title"], "expect": [{ "path": "cards[1].tone", "equals": "focus" }] },
  { "id": "e12", "style": "pitch", "start": "Cards · value lead", "prompt": "Change the first value to 25%", "allow": ["cards[0]", "subtitle"], "expect": [{ "path": "cards[0].value", "equals": "25%" }] },
  { "id": "e13", "style": "consulting", "start": "Steps", "prompt": "Add a final step: Year 5, Exit, IPO or a strategic sale", "allow": ["steps", "takeaway"], "expect": [{ "path": "steps.length", "equals": 5 }] },
  { "id": "e14", "style": "consulting", "start": "Number", "prompt": "Show the big number in red, it's the problem", "allow": ["number.tone"], "expect": [{ "path": "number.tone", "equals": "neg" }] },
  { "id": "e15", "style": "consulting", "start": "Chart · full width", "prompt": "Make the title shorter", "allow": ["title"], "expect": [] }
]
```

Before the first run, check that each `start` name exists in `EXAMPLES` and that `e04`'s new series index is right for its example (3 existing series). Fix the JSON, not the examples.

- [ ] **Step 3: Write `run.mjs`.** Start from `docs/research/2026-09-26-agent-single-slide/run.mjs`, then:
  - Drop the pipeline engine: `openPage(style)` loads `URL` with no query.
  - `turn()` also returns `pre`, `written` and `before` (the slide before, for edits), and `slide` is the item written last.
  - Keep the single-request loop (into `results.agent`) and the long sessions (into `results.long`).
  - Add the edit loop. This file needs `import { EXAMPLES } from "../../design/proposals/v5/examples.js";`.

```js
const edits = JSON.parse(readFileSync("edits.json", "utf8"));
const specFor = ({ consulting, pitch, name, ...shared }, style) => ({ ...shared, ...(style === "pitch" ? pitch : consulting) });
results.edits ||= {};
await pool(edits.filter((e) => !results.edits[e.id]), async (e) => {
  const ex = EXAMPLES.find((x) => x.name === e.start);
  const page = await openPage(e.style);
  try {
    await page.evaluate(([s, st]) => window.__journey.load([s], st), [specFor(ex, e.style), e.style]);
    const start = await page.evaluate(() => structuredClone(window.__journey.items[0].slide));
    results.edits[e.id] = { ...(await turn(page, e.prompt)), start };
  } catch (err) { results.edits[e.id] = { error: String(err.message || err) }; }
  await page.close(); save();
  console.log(`edit ${e.id} ${results.edits[e.id].error || `${(results.edits[e.id].ms / 1000).toFixed(1)}s`}`);
});
```

In `turn()`, read `s.items.find((it) => it.id === (t.written?.at(-1) ?? s.items[s.current]?.id))` for the slide, and add `pre: t.pre, written: t.written` to the returned object.

- [ ] **Step 4: Write `analyze.mjs`.** Copy `score()`, `numbersIn`, `slideNumbers`, `pct`, `q` and `secs` from the 2026-09-26 `analyze.mjs`, with these changes:
  - drop the pipeline column
  - count a first write as shape-valid when the first `edit_slide` **or** `patch_slide` trace line starts with `applied`
  - add these functions and sections:

```js
const edits = JSON.parse(readFileSync("edits.json", "utf8"));
const get = (obj, path) => path.split(/\.|\[|\]/).filter(Boolean).reduce((o, k) => (o == null ? undefined : k === "length" ? o.length : o[k]), obj);
/** Leaf paths of a slide: { "chart.series[0].values[1]": 4.8, … }. */
function leaves(v, path = "", out = {}) {
  if (Array.isArray(v)) { out[`${path}.length`] = v.length; v.forEach((x, i) => leaves(x, `${path}[${i}]`, out)); }
  else if (v && typeof v === "object") Object.entries(v).forEach(([k, x]) => leaves(x, path ? `${path}.${k}` : k, out));
  else out[path] = v;
  return out;
}
function drift(start, end, allow) {
  const a = leaves(start), b = leaves(end);
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((p) => a[p] !== b[p] && !allow.some((x) => p === x || p.startsWith(`${x}.`) || p.startsWith(`${x}[`)));
}
const E = edits.map((e) => ({ e, r: R.edits?.[e.id] })).filter((x) => x.r && !x.r.error && x.r.slide);
const drifted = E.map(({ e, r }) => ({ id: e.id, paths: drift(r.start, r.slide, e.allow) })).filter((x) => x.paths.length);
const expectsMet = E.filter(({ e, r }) => e.expect.every((x) => get(r.slide, x.path) === x.equals));
const editMs = E.map(({ r }) => r.ms);
/* Jev choices on chart requests, against the labels. */
const marksOf = (s) => { const m = new Set((s?.chart?.series || []).map((x) => x.mark)); return m.size > 1 ? "bar+line" : [...m][0]; };
const labelled = single.filter((r) => r.choices && R.agent?.[r.id]?.slide?.template === "chart");
const choiceOk = labelled.filter((r) => marksOf(R.agent[r.id].slide) === r.choices.marks && (!!R.agent[r.id].slide.chart.stacked === !!r.choices.stacked));
const allTurns = [...Object.values(R.agent || {}), ...Object.values(R.edits || {})].filter((r) => r && !r.error);
const endedByWrite = allTurns.filter((r) => !r.trace.some((t) => t.step === "Reply"));
const preActed = allTurns.filter((r) => r.trace.some((t) => t.model === "code"));
```

  - Report table (the pass bars from spec §9.7):

| Measure | Pass | Reported |
|---|---|---|
| Every request number on the slide | ≥ 95% | |
| First write shape-valid, long session | ≥ 90% | |
| Ends with no fit issues | ≥ 95% | |
| Drift on edits (paths outside `allow`) | 0 | the offending paths |
| Edits reaching their `expect` | | |
| Latency p50, new slide | ≤ 13 s | |
| Latency p50, small edit | ≤ 6 s | |
| Template agrees with gold | ≥ 90% | |
| Short reply, no JSON | ≥ 95% | |
| Layout lints clean on every final slide | 100% | |
| Jev choices vs labels | ≥ 90% | |

  Also report PRE-acted share, turns ended by a write, and model calls per turn (median). Mark each bar PASS or FAIL.

- [ ] **Step 5: Run the test.**

```bash
cd docs/research/2026-09-27-hybrid-agent && npm i
node run.mjs --workers=4 2>&1 | tee run.log
node analyze.mjs
```

Expected: `results.json` and `report.md` written. The server must be running with keys. A timeout or network error on a single request is re-run by rerunning `run.mjs`, which skips finished ids. Do not delete or edit results by hand.

- [ ] **Step 6: Read the report and write it up.**
  - `README.md` in the folder: question, setup, the results table and findings, in the style of the 2026-09-26 README. Numbers come from `report.md`; for each failed bar, name the cause from the traces.
  - In the spec:
    - §14 item 3: add "**Hybrid built (date):** …" with the headline numbers and what is open.
    - §9.5: change "Issues on paths the patch did not touch are marked `elsewhere: true`" to "come back in a separate `elsewhere` list".
  - `journey/README.md`: link to the results.
  - If a pass bar fails, say so plainly in both documents. Do not tune thresholds to pass.

- [ ] **Step 7: Commit and push.**

```bash
git add docs/research/2026-09-27-hybrid-agent docs/superpowers/specs/2026-09-26-slide-system-architecture-design.md docs/design/proposals/journey/README.md
git commit -m "Hybrid agent test: single slides, long sessions, surgical edits, Jev choices

<headline numbers from report.md: figures kept, first-write validity in
long sessions, drift, p50 new slide and small edit, Jev choice accuracy,
and each failed bar with its cause>

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
git push -u origin product/report-builder-concept
```

Replace the angle-bracket paragraph in the commit message with the real numbers before committing.

---

## Spec coverage

| Spec | Task |
|---|---|
| 3.6 L1 columns, L2 alignment, L3 gap, L4 grid | 2 (render and CSS), 3 (lints L1, L3) |
| 3.6 L5 grow then flag, L6 equal sizes | 2 (table growth, narrow cap, step rows), 3 (lints) |
| 4.2a stacked and mixed labels | 2 |
| 6 R9–R14, J8 | 7 |
| 9.0 PRE, firstCall, reply on write, POST judgment | 8, 10, 11 |
| 9.1 Jev for marks, stacking, focus, icons; guardrails; chart schema change; chart guide | 1, 6 |
| 9.1 table total by code | 5 |
| 9.3 working-slides block; no slide JSON in write results | 9, 10 |
| 9.4 whole-slide re-check, elsewhere, dependent-field autofix | 5, 10 |
| 9.5 four tools, paths, edit_slide only for reserved slides, schema single source (card) | 1, 4, 9, 10 |
| 9.7 test | 12 |

Not covered here, by design: the zod registry and generated tool JSON Schema (§9.5 "one schema source") belong to the product build (M1). The prototype keeps `schema.js` as its single source, and the card, validator and messages all come from it.

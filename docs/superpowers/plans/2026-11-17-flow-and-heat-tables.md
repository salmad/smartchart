# Flow, heat tables and nested components: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline, recommended: the owner's standing preference is inline execution, stopping at task boundaries) or superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

## Decisions for the owner (before Task 1)

**Settled 2026-11-17:**
- **Slot:** 1(a), side column only.
- **Nesting:** one level (2).
- **Divider:** 3(a), the default on every ½·½ and ⅔·⅓ slide.

The options as they were put:

1. **Where a flow may sit in v1.**
   - **(a) Side column only.** This is the plan as written. The flow as the main exhibit (FinBridge slides 1 and 5) comes next.
   - **(b) Any slot now.** Layout slots take any component from a registry: the side takes notes or a flow; the main takes a table, a chart or a flow. This first amends spec 3.4–3.5 and D16.

   Either way, Task 5 builds the side slot as a registry (`SIDE: { notes, flow }`), so the next component is one entry.
2. **Nesting depth in v1.** One level: a flow box holds text or a small grid. A table or chart inside a box is later.
3. **The column divider (Task 6).**
   - **(a) Default divider.** A thin vertical line between the columns of every ½·½ and ⅔·⅓ slide. This changes every existing split and pair slide.
   - **(b) Only beside a flow and in pairs.**

   The arrow on the line, pointing left to right, appears when the left column produces the right one. Code draws it when a flow is on the left. A pair asks for it with `halves.link: "arrow"`.

**Goal:** Occam can draw the FinBridge slides 3 and 4 (mocked in `docs/temp/new-templates/finbridge.html`) from slide JSON. That takes three table options (a target line on a bars column, heat shading with struck cells and an outlined column, 6 columns beside a side column) and one new component, the **flow**: tiers of boxes with arrows between them. A box holds a small nested component.

**Architecture:** The user's direction (2026-11-17) is *reusable components, fixed layouts that fit them, and nesting for variety*. So:
- **The flow is a component.** It lives in `src/engine/components/flow.ts`, like notes, a table or cards.
- **It goes in a fixed slot.** That slot is the side column of the existing `split` layout, where notes sit today, on the right (`split`) or the left (`split-flip`).
- **A flow box nests one inner component.** It comes from a closed registry (`text`, `grid` first), so code can measure and fit it. The registry is the extension point: later inner components (a value, an icon, a mini bar) are one entry each.

No new menu entry and no routing change (D16): `flow` is an optional field of `table` and `chart`, as `notes` is.

**Tech Stack:** TypeScript strict, the engine's string renderers, `components.css`, vitest, Playwright (`fixture.html` lint harness, review page).

**Spec:** `docs/superpowers/specs/2026-09-26-slide-system-architecture-design.md` (3.2 layouts, 3.3 blocks, 3.6 L1–L6, D16). Decisions and the visual target: `docs/temp/apple-bar-review.md` (2026-11-17 entry), `docs/temp/new-templates/finbridge.ts` / `.css`.

## Global Constraints

- No `any`, no inline styles in product code. The one exception follows existing practice: a CSS custom property set in markup (`style="--vc:…"` in `table.ts`), as the bars already do.
- Slides use `slides.css` and `components.css` unchanged in structure; new rules go in `components.css`. Doc CSS never reaches into a figure.
- Colours come only from tokens (`--focus`, `--on-focus`, `--surface`, `--line`, `--line-2`, `--fg`, `--fg-2`, `--muted`, `--bg`). No new hue. Heat steps are `color-mix` of `--focus`. Never red or green for "fails" (memory: red sparingly).
- Checks warn or error; they never silently rewrite (thin harness).
- Labels say what the content does; no "Key", "Main", "Important" (memory: no filler labels).
- The gallery comes only from `src/engine/starters/starters.json`. Adding FinBridge starters needs the user's yes (Task 7).
- Every fix is at engine level (render, CSS, fitters, validator), so agent-made slides get it too.

## Review Focus

1. **Pitch hides muted rows.** A target-line table whose rows past the target are muted loses them in pitch. Expect the line and bar colours to still read, and the validator to warn when the target sits beyond every visible row (Task 1 test `target beyond every visible row in pitch warns`).
2. **Long text in a flow box at the side column's width.** Expect an error naming the box and its limit, never a box that overflows (Task 4 test `a box over its characters is an error naming the path`).
3. **Heat on a column with a negative or missing figure.** Expect the cell drawn unshaded and the scale computed from the figures that exist, with no NaN class (Task 2 test `heat skips non-figures and negatives`).
4. **Flow plus notes on one slide.** Expect an error: one side column, one component (Task 5 test `flow and notes together is an error`).
5. **Doc figures inherit table fields.** `validateComponent` reuses the table's fields, but `drawTargets` runs only in `mountSlide`. Expect a doc table with `target`, `heat` or `key` to be refused with a message, never accepted and drawn without its line (Task 2 test `doc figures refuse target, heat and key`).
6. **Ink and paper contrast on dark heat steps.** Expect text on steps 4–5 and on the focus cell to use `--on-focus` and pass 4.5:1 in both palettes (Task 2 browser test `heat text contrast in both palettes`).

---

### Task 1: Target line on a bars column

**Files:**
- Modify: `src/engine/types.ts` (Table column type)
- Modify: `src/engine/slides/schema.ts` (`TABLE_COLUMN`, `checkGrid`)
- Modify: `src/engine/components/table.ts` (`tableHTML`)
- Modify: `src/engine/components/components.css` (bars section)
- Test: `tests/unit/table-render.test.ts`, `tests/unit/schema.test.ts`

**Interfaces:**
- Produces: `Table["columns"][number].target?: { value: number; label: string; better: "below" | "above" }`

- [ ] **Step 1: Write the failing tests**

```ts
// table-render.test.ts
test('a target on a bars column draws one dashed line at its share and focuses the bars on the better side', () => {
  const h = html({ columns: [{ label: 'Group' }, { label: 'Months', bars: true, target: { value: 20, label: '20-month hurdle', better: 'below' } }],
    rows: [{ cells: ['A', '5'] }, { cells: ['B', '19'] }, { cells: ['C', '48'] }] })
  expect(h).toContain('class="tbl-target" style="--at:41.7"')   // 20 / 48, one decimal
  expect(h).toContain('data-path="table.columns[1].target.label"')
  expect(h.match(/has-bar pass/g)?.length).toBe(2)
})
// schema.test.ts
test('target needs bars, a label of at most 20 characters, and a value inside the column range', () => { … three cases, each an error naming `table.columns[1].target…` })
test('target beyond every visible row in pitch warns', () => { /* rows past the target all muted, style pitch → warning */ })
```

- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run tests/unit/table-render.test.ts tests/unit/schema.test.ts`. Expected: FAIL (no `tbl-target`).
- [ ] **Step 3: Implement.**
  - **Field (`TABLE_COLUMN`):** `target: f("object", …, { fields: { value: number required, label: text required max 20, better: enum below|above default below } })`.
  - **Checks (`checkGrid`):**
    - error without `bars`
    - error if the value is outside 0…column max
    - at most one target per table
    - not in a half table
    - pitch warning when no visible row lies past the target
  - **Renderer:** the bars header cell carries `<span class="tbl-target" style="--at:{pct}">` plus a label span. The renderer only states where the line goes; a fitter draws it.
  - **Fitter:** add `drawTargets(root: HTMLElement, k: number): void` in `src/engine/components/fit.ts` and call it in `mountSlide` after `growTable`, because the line depends on the grown height. It places the line at the first bar track's left + track width × `--at`%, from the header's bottom to the last row's bottom. That's the mockup's `after3` logic; the label sits under the line. Style: 2px dashed `--fg-2`, mono 17px uppercase label. Add a browser assertion in `tests/browser/lints.spec.ts`: the line's x is within 2px of the bar edge for the target value.
  - **Bar colour:** a bar on the `better` side gets `pass`, filled `--focus`.
- [ ] **Step 4: Run the tests and see them pass.** Same command. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "Tables: a target line on a bars column"`

### Task 2: Heat shading, struck cells, an outlined column and the key

**Files:**
- Modify: `src/engine/types.ts`, `src/engine/slides/schema.ts`, `src/engine/components/table.ts`, `src/engine/components/components.css`
- Create: `src/engine/components/heat.ts` (the shared 5-step scale, also used by the flow's grid in Task 3)
- Test: `tests/unit/table-render.test.ts`, `tests/unit/schema.test.ts`, `tests/browser/lints.spec.ts`

**Interfaces:**
- Produces:
  - `heatSteps(values: (number | null)[]): (0 | 1 | 2 | 3 | 4 | 5)[]` in `heat.ts`. It returns 0 for null or negative, and 1–5 by value / max, with cut points at 0.1, 0.25, 0.4, 0.65 of the max. (The mockup used fixed £ thresholds; this is the same banding made scale-free.)
  - Column flags `heat?: boolean` and `outline?: boolean`
  - Cell flag `{ value, struck: true }`
  - `table.key?: { focus?: string; struck?: string; outline?: string }`, each at most 20 characters

- [ ] **Step 1: Write the failing tests**

```ts
test('heat columns share one scale; struck cells are muted with a cross and never shaded', () => { /* 3 heat columns, values 5…632, one struck: expect class h5 on 632's cell, h1 on 5's, "fail" + "✗" on the struck one, no h-class on it */ })
test('heat skips non-figures and negatives', () => { /* "—" and "−£61" cells → no h-class, no "NaN" in output */ })
test('a [[focus]] heat cell is drawn solid with a star', () => { /* expect class "heat best" */ })
test('the outlined column and the key render only when written', () => { /* outline → col class "outline"; key entries → <p class="heat-key"> with three spans in order focus, struck, outline */ })
// schema.test.ts
test('heat needs a column of figures, not with bars; outline on one column after the first; key labels need the thing they label', () => { … })
test('doc figures refuse target, heat and key', () => { /* validateComponent('table', …, DOC limits) → one error per field: "not in a doc figure yet" */ })
// lints.spec.ts (browser, fixture page)
test('heat text contrast in both palettes', async () => { /* mount a heat table in ink and paper; every td.h4, td.h5, td.best computed colour vs background ≥ 4.5 */ })
```

- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run tests/unit/table-render.test.ts tests/unit/schema.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **Renderer:** `tableHTML` adds `heat hN`, `fail` and `best` classes, plus the key paragraph after the table. Draw it where `ballKey()` goes and cost it 1 row in the table budget, like the ball key.
  - **CSS:** take it from `docs/temp/new-templates/finbridge.css` (the heat table, `heat-key` and outline sections), with these changes:
    - the outline is drawn on `col.outline` / `td` box-shadows as in the mockup
    - text on h5 and best uses `--on-focus`
  - **Pitch:** the key is drawn in pitch too, because the marks need it.
- [ ] **Step 4: Run the tests and see them pass.** Unit tests, then `npm run test:browser -- lints.spec.ts`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "Tables: heat shading, struck cells, an outlined column and their key"`

### Task 3: The flow component and its inner-component registry

**Files:**
- Create: `src/engine/components/flow.ts`
- Modify: `src/engine/types.ts`, `src/engine/components/components.css`
- Test: `tests/unit/flow.test.ts` (new)

**Interfaces:**
- Consumes: `heatSteps` (Task 2)
- Produces:

```ts
export type FlowTone = 'plain' | 'light' | 'strong' | 'outline'
/** What a box holds: one inner component from a closed registry. Text is the default; `grid` is a small heat grid. */
export type Inner = { text: string } | { label: string; grid: number[][] }
export interface FlowTier { boxes: Inner[]; tone?: FlowTone; label?: string; op?: '×' | '−' | '+' | '·' }
export interface Flow { tiers: FlowTier[] }
export const INNERS: Record<'text' | 'grid', { render: (x: Inner, path: string) => string; chars: number }>
export function flowHTML(f: Flow, base: string): string
```

Every text carries `data-path` (`flow.tiers[i].boxes[j].text`, `….label`, `flow.tiers[i].label`) so the editor and checks can address it, like the other components.

- [ ] **Step 1: Write the failing tests:**
  - `one arrow between tiers, none before the first`
  - `operators sit between boxes of a tier`
  - `six text boxes in a tier render as chips in three columns`
  - `a grid box renders 25 cells with heat classes from heatSteps`
  - `every text has its data-path`
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run tests/unit/flow.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement `flowHTML`, the CSS and the fit lint.**
  - **Renderer and CSS:** take the CSS from `finbridge.css` (the flow and objects-in-boxes sections). A tier of more than 3 text boxes is chips (`--n:3`). Arrows are the inline chevron SVG from the mockup.
  - **Fit lint:** today `fitIssuesAt` in `src/engine/slides/lints.ts` measures `.notes` but not a flow. Add `.flow` and `.fl-box` to its selector lists: content taller than the box, wider than its column, past its box. Chips are `nowrap`, so an overflowing chip shows only in `scrollWidth`. Add a browser test in `tests/browser/lints.spec.ts`: `a chip too wide for its box is a fit issue`.
- [ ] **Step 4: Run the tests and see them pass.** Same command. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "Components: the flow, tiers of boxes that hold a small component"`

### Task 4: Flow schema and fit limits

**Files:**
- Modify: `src/engine/slides/schema.ts` (a `FLOW` field def, `checkFlow`)
- Test: `tests/unit/schema.test.ts`

**Interfaces:**
- Consumes: `Flow`, `INNERS` (Task 3)
- Produces: `FLOW: FieldDef` and `checkFlow(f: Partial<Flow>, base: string, style: Style, out: Out): void`

The limits, measured from the mockup at the side column's width (≈ 560px). Re-measure them on the review page in Task 6 and correct them there.

| Limit | Value |
|---|---|
| tiers | 2–5 |
| boxes per tier | 1–3; chips up to 6 |
| text box | 40 characters; a chip 14 |
| tier label | 8 characters |
| grid label | 10 characters |
| grid | exactly 5×5 numbers |
| `strong` tiers | at most 1 |
| `op` | only in a tier of 2–3 boxes |
| height | each tier costs 1, each chip row 0.6, a grid tier 1.6; at most 6 consulting, 4.5 pitch (a pitch box sets text larger) |

By these costs, S3 is 5.2 and S4 is 4.6: both fit consulting and both exceed pitch.

- [ ] **Step 1: Write the failing tests:**
  - `the two FinBridge flows validate in consulting` (copy `S3_FLOW`, `S4_FLOW` from `finbridge.ts`)
  - `in pitch they are refused with their cost (5.2, 4.6) in the message`
  - `a box over its characters is an error naming the path`
  - `a sixth tier, a fourth box, two strong tiers, a 4×5 grid and an op on one box are each an error`
  - `the height budget names its cost`
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run tests/unit/schema.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `FLOW` and `checkFlow`.** Messages follow the existing style: path, what is wrong, what to do.
- [ ] **Step 4: Run the tests and see them pass.** Same command. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "Schema: the flow's fields and limits"`

### Task 5: The side slot: flow beside a table or chart, on either side

**Files:**
- Modify: `src/engine/slides/schema.ts` (the `table` and `chart` entries: fields, `variant`, rules)
- Modify: `src/engine/components/notes.ts` (`splitHTML` takes the side's HTML instead of building notes itself)
- Modify: `src/engine/slides/render.ts` (`BODY.table`, `BODY.chart`, `growTable`)
- Modify: `src/engine/slides/groups.ts` (`roomOf`: a flow is a side column like notes)
- Modify: `components.css` (`.split.flip`)
- Test: `tests/unit/render.test.ts`, `tests/unit/schema.test.ts`, `tests/unit/table-render.test.ts`

**Interfaces:**
- Consumes: `flowHTML`, `FLOW`, `checkFlow` (Tasks 3–4)
- Produces:
  - Slide fields `flow?: Flow` and `flowSide?: 'left' | 'right'` (default right) on `table` and `chart`
  - Variants `split` | `split-flip` | `full`
  - `splitHTML(f: Furniture, main: string, side: string, extra: string, base: string)`, where `side` is the notes or the flow HTML

`notesTitle` heads whichever side component is present; the field name stays. Its description changes to "what the side column does for the exhibit".

- [ ] **Step 1: Write the failing tests:**
  - `a table with a flow renders split with the flow in the side column`
  - `flowSide left renders split-flip`
  - `flow and notes together is an error`
  - `beside a flow or notes a table takes 6 columns when every cell after the first is at most 8 characters, else 4`. This replaces today's flat 4.
  - `the table budget beside a flow is unchanged`
  - `existing notes slides render byte-identical`: render every starter and compare with the current output before the change. Snapshot it first in this step.
  - **Prompt budget:** the table and chart cards grow by the `flow`, `flowSide` and column-flag descriptions. Run `npx vitest run tests/unit/budgets.test.ts tests/unit/agent-prompt.test.ts`. Expect the agent-prompt snapshot to change (update it), and the budgets to hold. If a budget fails, shorten the new descriptions; don't raise the budget.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run tests/unit/render.test.ts tests/unit/schema.test.ts tests/unit/table-render.test.ts`. Expected: FAIL, except the identity snapshot.
- [ ] **Step 3: Implement.**
  - **Variant:** `variant` returns `split-flip` when `flow` and `flowSide === "left"`.
  - **Renderer:** `BODY` passes `notesHTML(…)` or `flowHTML(…)` as `side`.
  - **Growing:** `growTable` also matches `.v-split-flip`.
  - **CSS:** `.split.flip` puts the grid columns in the order `.75fr 1.25fr`, with the column placement from the mockup.
- [ ] **Step 4: Run the tests and see them pass.** Same command, then `npm test`. Expected: all PASS, and starters identical.
- [ ] **Step 5: Commit.** `git commit -m "Slides: a flow beside a table or chart, on either side"`

### Task 6: The column divider and its arrow

The owner's direction: a ½·½ or ⅔·⅓ slide can have a thin vertical line between its columns. Where the left produces the right, an arrow on that line points from left to right. Which slides get the line is decision 3 above.

**Files:**
- Modify: `src/engine/components/notes.ts` (`splitHTML`), `src/engine/components/pair.ts` (`pairHTML`)
- Modify: `src/engine/slides/schema.ts` (pair: `link?: "arrow"`), `src/engine/types.ts`
- Modify: `components.css` (the divider section)
- Test: `tests/unit/render.test.ts`, `tests/unit/pair.test.ts`, `tests/browser/lints.spec.ts`

**Interfaces:**
- Consumes: the variants from Task 5
- Produces:
  - `<span class="divider">` (and `divider arrow`) as a grid child between the columns
  - `Slide.link?: "arrow"` on pair

- [ ] **Step 1: Write the failing tests:**
  - `a split with a flow on the left draws a divider with an arrow`
  - `a pair with link arrow draws one`
  - `without them, the divider follows decision 3`
  - **Browser:** `the divider sits centred in the column gap and spans the body from the header row to the exhibit's bottom; the arrow sits at the exhibit's middle and touches neither column`
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run tests/unit/render.test.ts tests/unit/pair.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **The line:** 1px `--line`, spanning grid row 2, centred in the existing gap (88px; no column moves, per the rule that nothing shifts).
  - **The arrow:** a 28px circle on `--bg` with a 1px `--line-2` border and a 14px chevron in `--fg-2`, centred on the line at the exhibit's vertical middle. No colour, so colour still means status.
  - **Pitch:** draws the same.
- [ ] **Step 4: Run the tests and see them pass.** Same command, then the browser test. Expected: PASS. If decision 3 is (a), re-lock `tests/fixtures/example-lines.json` and the starter snapshot from Task 5, and review the changed starters at full size.
- [ ] **Step 5: Commit.** `git commit -m "Slides: a divider between columns, with an arrow where left produces right"`

### Task 7: Guidance, stress and visual check

**Files:**
- Modify: `src/engine/slides/capabilities.ts`. Table already has 7 entries, at the cap that `capabilities.test.ts` checks. So:
  - rename the table's "Notes" entry to **"Side column: notes or a flow"**, with a sample using a flow
  - fold heat and struck cells into **"Scoring"** (marks for degree, shading for a grid of figures); its use and avoid stay one sentence each
  - the target line has no entry: its field description carries it
  - chart has 6 entries, so add **"Flow beside"** as its 7th
- Modify: `tests/fixtures/stress.ts` (a stressed flow at every limit, a heat table at 6 columns beside a flow)
- Modify: `docs/superpowers/specs/2026-09-26-slide-system-architecture-design.md` (3.2: `split-flip`; 3.3: the `flow` block and its inner registry; 3.4: flow is a field, not an entry; a 14 status line)
- Test: `tests/unit/capabilities.test.ts` (samples validate; the count stays ≤ 7 per template), `tests/browser/stress-fit.spec.ts`, `tests/browser/review.spec.ts`

Capability wording:
- **Flow beside — use:** "How the exhibit's numbers are produced: inputs, a model, its outputs."
- **Flow beside — avoid:** "Steps in time (steps template) or reasons (notes)."
- **Heat grid — use:** "Figures across two dimensions where the best region matters: price × limit."
- **Heat grid — avoid:** "A single column, which reads better as bars."

- [ ] **Step 1: Add the samples and stress entries.** Run `npx vitest run tests/unit/capabilities.test.ts`. Expected: PASS, with table still at 7 and chart at 7.
- [ ] **Step 2: Run the stress page.** Run `npm run test:browser -- stress-fit.spec.ts review.spec.ts`. Expected: 0 fit issues in both styles and both palettes. Where a limit from Task 4 overflows, lower it in `checkFlow` and its test, then re-run.
- [ ] **Step 3: Review at full size.** Open `/src/dev/review.html?stress=1&only=<i>&full=1` for each new entry in consulting, pitch, ink and paper. Check for gaps and overflow (memory: review slides individually), and log the result in `docs/temp/apple-bar-review.md`.
- [ ] **Step 4: Run `npm run lint`, `npm run build` and `npm test`.** Expected: clean.
- [ ] **Step 5: Commit.** `git commit -m "Guidance, stress cases and spec for flows and heat tables"`

### Task 8: The FinBridge slides end to end (needs the user's yes on starters)

**Files:**
- Modify (only with the user's yes): `src/engine/starters/starters.json`
- Modify: `src/dev/fixture.ts` is not needed; `window.lint` already mounts any slide JSON.

The smartchart MCP in this session talks to the deployed server (`.cursor/mcp.json` has no local server), so it can't see local schema changes. Check locally first, and through MCP only after a deploy.

- [ ] **Step 1: Ask the user** whether FinBridge slides 3 and 4 join the gallery. Memory: one gallery source; rewrite content, don't replace slides.
- [ ] **Step 2: Validate and lint both slides locally.** Write slides 3 and 4 as slide JSON (from `finbridge.ts`, slide 4 with `flowSide: "left"`). Run them through `validate()` in a unit test (`tests/unit/flow.test.ts`: `FinBridge slides 3 and 4 validate`) and through `window.lint` in `tests/browser/lints.spec.ts`. Expected: no errors and no fit issues, in consulting, in both palettes.
- [ ] **Step 2b: Check through MCP after the next deploy.** Use `create_slide` and `check_slide` in a scratch deck, and confirm the result matches the mockup.
- [ ] **Step 3: Delete the scratch mockup** (`docs/temp/new-templates/finbridge.*`) once the real slides render the same (memory: remove old code freely).
- [ ] **Step 4: Commit** if starters changed.

## Out of scope (recorded in `docs/product/FUTURE.md` in Task 7)

- **Editing by hand in the app:** menu items for target, heat, struck, outline and the flow's boxes. The fields work through chat and MCP first.
- **More inner components** (value, icon, mini bars) and **deeper nesting** (a table inside a box). Each is one `INNERS` entry plus limits.
- **Flows in docs figures,** and a horizontal full-width flow (slide 1 of the FinBridge deck).

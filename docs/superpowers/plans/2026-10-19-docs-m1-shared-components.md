# Docs M1: Shared Components Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move every slide body component (charts, tables, cards, notes, steps, summary, pair, pictures, scores) and its CSS out of the slide renderer into `src/engine/components/`, so a doc can render the same components into any root. Slides must look and behave exactly as before.

**Architecture:** `render.ts` keeps the slide frame: head, cover, section, agenda, number and quote frames, the rail, the takeaway, and the frame-fill fitters `growTable` and `growCards`. Everything that draws a body moves to `src/engine/components/`. Each component takes a base JSON path, and each post-mount fitter takes a root element and its scale `k` (rendered width ÷ design width), instead of assuming a `.slide` 1920 px wide. The component CSS moves to `components.css`, which `slides.css` imports first, then the frame rules.

The user chose the figure canvas (2026-10-19): in docs, a figure is laid out at a fixed design width with this exact CSS and scaled to the column. M1 makes the components independent of the root so that M2 can do this.

**Tech Stack:** TypeScript (strict), Vite, vitest (node), Playwright (Chromium).

**Spec:** `docs/superpowers/specs/2026-10-19-occam-docs-design.md` (§2 and M1); slide system: `docs/superpowers/specs/2026-09-26-slide-system-architecture-design.md`.

## Global Constraints

- **Zero change users can see:** for every starter and every stress slide, in both styles, `slideHTML` output is byte-identical before and after. Screenshots on Ink and Paper match the baseline pixel for pixel.
- No `any`. No new inline styles (the existing `style="--a:…"` and `--vc` custom properties in HTML strings stay as they are).
- No shims or re-exports for moved code: update every importer to the new path (memory: remove old code freely).
- Match the surrounding style: terse block comments that say why, the same naming, files under ~300 lines.
- Fix at engine level. `src/app` never styles component internals.

## Review Focus

1. **The CSS cascade order after the split.** A frame rule and a component rule with equal specificity can swap winners once they live in two files (for example `.head + :not(.spacer)` against `.cap + .chart`). Expected: the look lock passes in both styles and both themes, stress included. Task 1 adds the lock and Task 6 runs it.
2. **Hand-editing paths.** `data-path`, `data-item`, `data-grid` and `data-pic` must stay identical everywhere: `cards[i]`, `notes[i]`, `people[i]`, `halves[i].table.rows[r].cells[j]`. Expected: the render lock hashes cover them, and `edit.spec.ts` still passes (Tasks 1 and 4).
3. **Fitters run at a scale other than 0.5.** Thumbnails (`Tile`, `Strip`) and present mode mount at other widths. Expected: `sizeTable` and `alignHalves` give the same result at any `k`. Task 5 runs the look lock at two frame widths.
4. **`@import` in the built CSS.** Vite must inline `components.css` ahead of the frame rules in `npm run build` and in dev. Expected: the built CSS holds `.tbl` before `.rail`, and print (`PrintDeck`) still looks the same (Task 6).
5. **The field redraw while editing.** `src/app/edit/fields.ts` redraws one field with `FIELD_HTML` from its new home. Expected: typing in a caption, a cell or a note redraws with the same markup (Task 3, `edit.spec.ts`).

---

### Task 1: Lock the slides' HTML and look

Before any code moves, record what slides produce now, so every later task can prove it changed nothing.

**Files:**
- Create: `tests/unit/render-lock.test.ts`
- Create: `tests/fixtures/slide-html.json`, written by the test, holding `{ "<starterId|stress-n>/<style>": "<sha256 hex>" }`
- Create: `tests/browser/look-lock.spec.ts`
- Modify: `.gitignore` (add `docs/temp/look/` only if `docs/temp/` is not already ignored; check first)

**Interfaces:**
- Produces: `npm test` checks the render lock on every run. `LOOK=write npm run test:browser -- look-lock` records screenshots, and `LOOK=1 npm run test:browser -- look-lock` compares against them. Without `LOOK`, the spec is skipped.

- [ ] **Step 1: Write the render lock test.** For each entry of `STARTERS` (id, `consulting`, `pitch`) and each `stressFor(style)` slide (id `stress-<i+1>`): render `slideHTML(slide, contexts(deck)[i], { style, theme: 'ink' })` over the whole deck, where `deck = { style, theme: 'ink', accent: null, footer: FOOTER, slides }`, so page numbers, sections and the agenda match the review page. Hash each with `createHash('sha256')`.
  - With `WRITE_HTML=1`, write the map to `tests/fixtures/slide-html.json`, sorted by key.
  - Otherwise, assert `expect(got).toEqual(locked)`, so a failure names the slides that changed.
  - Header comment, in the style of `example-lines.spec.ts`: "Render lock: every starter and stress slide, in both styles, renders byte-identical HTML. WRITE_HTML=1 relocks after a deliberate change."
- [ ] **Step 2: Record and run it.** Run `WRITE_HTML=1 npx vitest run tests/unit/render-lock.test.ts`, then `npx vitest run tests/unit/render-lock.test.ts`. Expected: PASS, with 2 × (30 + stress count) keys.
- [ ] **Step 3: Write the look lock spec.** Viewport 1920×1080. For each starter index `i` and each style in `consulting` and `pitch`, and each theme in `ink` and `paper`: go to `/src/dev/review.html?style=${style}&theme=${theme}&full=1&only=${i}`, wait for `window.__fit`, wait for `document.fonts.ready`, then screenshot `.frame .slide`.
  - Do the same for `?stress=1` entries.
  - With `LOOK=write`, save each PNG to `docs/temp/look/<name>.png`.
  - With `LOOK=1`, compare with `Buffer.equals`. On a mismatch, write `docs/temp/look/<name>.after.png` and collect the name. The test ends with `expect(changed).toEqual([])`.
  - `test.skip(!process.env.LOOK)`.
  - If `review.html` does not accept `only` together with `stress`, read `src/dev/review.ts` and use the parameter it does accept for one stress slide.
- [ ] **Step 4: Record and run it.** Run `LOOK=write npx playwright test -c tests/browser/playwright.config.ts look-lock`, then the same command with `LOOK=1`. Expected: PASS twice. If two runs of the unchanged code differ, Chromium is not deterministic here: stop and report before going on.
- [ ] **Step 5: Commit.** `git add tests/unit/render-lock.test.ts tests/fixtures/slide-html.json tests/browser/look-lock.spec.ts`. Message: "Render and look locks: slides prove they did not change while the components move out".

### Task 2: Move charts into the components folder

**Files:**
- Move (`git mv`): `src/engine/slides/charts/` → `src/engine/components/charts/`
- Modify: the imports in `src/engine/slides/render.ts`, `src/engine/agent/checks.ts`, `src/engine/slides/colours.ts` (if it imports charts), the files inside `charts/` (relative paths to `../schema.js`, `../colours.js`, `../../types.js` and so on), and `tests/unit/{timeline-rows,chart-math,starters-content,render-timeline,gantt}.test.ts`

**Interfaces:**
- Produces: `drawChart(host: HTMLElement, spec: Chart, markers?: Marker[], colours?: SeriesColours): void` from `src/engine/components/charts/chart.ts`, with its signature unchanged. `render.ts` stops re-exporting `drawChart` (find every user of that re-export with `grep -rn "drawChart" src tests` and update it).

- [ ] **Step 1: Move the folder and fix the imports.** Run `git mv`, then fix every import that `npm run build` reports.
- [ ] **Step 2: Verify.** Run `npm run build && npm test`. Expected: the typecheck is clean and every test passes, the render lock included.
- [ ] **Step 3: Commit.** Message: "Charts move to engine/components: one chart implementation for slides and docs".

### Task 3: Text, scores and pictures as components

**Files:**
- Create: `src/engine/components/text.ts`
- Create: `src/engine/components/scores.ts`
- Create: `src/engine/components/pictures.ts`
- Modify: `src/engine/slides/render.ts` (delete the moved code and import it), `src/app/edit/fields.ts`, `src/dev/review.ts`, `tests/unit/markup.test.ts` (import paths)

**Interfaces (all exported; the bodies move as they are):**
- `text.ts`:
  - `esc(s: unknown): string`
  - `md(s: unknown): string` (with `EXT` and `linkWords` private to it)
  - `display(s: string): string`
  - `pad2(n: number): string`
  - `type FieldKind`, `FIELD_HTML`, `capInner(text: string): string`
  - `at(path: string, kind: FieldKind): string`, `item(path: string): string`
  - `list(items: string[], path: string): string`
  - `capHTML(text: string | undefined, cls?: string, path?: string): string`
  - New: `join(base: string, key: string): string`, which returns `base ? \`${base}.${key}\` : key`. Every component builds its paths with it, so `join("", "cards[0]") === "cards[0]"` and slide paths stay as they are.
- `scores.ts`: `ball(v: number): string`, `markHTML(m: Mark, raw: string): string`, `ballKey(): string`.
- `pictures.ts`:
  - `logoHTML(ref, name, path?)`, `named(ref, nameHTML, name, path)`, `imgHTML(ref, cls, path)`
  - `teamHTML(people: Person[], variant: string, base: string): string`, which wraps the current `team` body and `personHTML`, with paths `join(base, \`people[${i}]\`)`
  - `wallHTML(logos: LogoItem[], base: string): string`, which wraps the current `logos` body without the caption, with paths `join(base, \`logos[${i}]\`)`
- `pageRefs` stays in `render.ts`: page numbers belong to the frame.

- [ ] **Step 1: Write the failing test** in `tests/unit/components-text.test.ts`:
  - `join('', 'cards[0]')` is `'cards[0]'`.
  - `join('halves[1]', 'table')` is `'halves[1].table'`.
  - `teamHTML([{ name: 'Ana Ruiz', role: 'CEO' }], 'row', 'blocks[2]')` contains `data-item="blocks[2].people[0]"` and `data-path="blocks[2].people[0].name"`.
- [ ] **Step 2: Run it.** `npx vitest run tests/unit/components-text.test.ts`. Expected: FAIL, because the module does not exist yet.
- [ ] **Step 3: Move the code.** Create the three files from the code in `render.ts` (lines 13–106 today) and replace it in `render.ts` with imports. The `team` and `logos` entries of `BODY` call `teamHTML(s.people ?? [], v, "")` and `${capHTML…}${wallHTML(s.logos ?? [], "")}`. Update the importers listed under Files.
- [ ] **Step 4: Verify.** Run `npm run build && npm test`. Expected: PASS, the render lock unchanged.
- [ ] **Step 5: Commit.** Message: "Text, scores and pictures are components: base paths so a doc block can host them".

### Task 4: Table, cards, notes, steps, summary and pair as components

**Files:**
- Create: `src/engine/components/table.ts`, holding `tableHTML`
- Create: `src/engine/components/cards.ts`, holding `cardHTML` and `cardsHTML`
- Create: `src/engine/components/notes.ts`, holding `notesHTML` and `splitHTML`
- Create: `src/engine/components/rows.ts`, holding `stepsHTML` and `summaryHTML`
- Create: `src/engine/components/pair.ts`, holding `pairHTML`
- Modify: `src/engine/slides/render.ts`. `BODY` becomes one-line calls into these components, with `base = ""`.
- Test: `tests/unit/components-paths.test.ts`

**Interfaces:**
- `tableHTML(t: Table, base: string, key?: boolean, room?: TableRoom): string`. The signature is unchanged; `base` is already the table's own path (`"table"` and `"halves[i].table"` today).
- `cardHTML(c: Card, variant: string, i: number, base: string): string` and `cardsHTML(cards: Card[], variant: string, arrange: Slide["arrange"], base: string): string`, the current `cards` body. Paths are `join(base, \`cards[${i}]\`)`.
- `type Furniture = Pick<Slide, "caption" | "notesTitle" | "notes">`
- `notesHTML(notes: Note[], base: string): string`
- `splitHTML(f: Furniture, main: string, extra: string, base: string): string`, with the caption and notesTitle paths through `join(base, …)`
- `stepsHTML(steps: Step[], base: string): string` and `summaryHTML(points: Point[], base: string): string`
- `pairHTML(halves: Half[], base: string): string`. Half paths are `join(base, \`halves[${i}]\`)`, and `data-chart="${i}"` and `data-grid="${i}"` stay as they are.

- [ ] **Step 1: Write the failing test.** For each component, rendered with `base = "blocks[3]"`, assert one representative attribute:
  - `cardsHTML`: `data-item="blocks[3].cards[0]"`
  - `notesHTML`: `data-path="blocks[3].notes[0].title"`
  - `stepsHTML`: `data-path="blocks[3].steps[0].when"`
  - `summaryHTML`: `data-path="blocks[3].points[0].title"`
  - `pairHTML` with a table half: `data-path="blocks[3].halves[0].table.rows[0].cells[0]"`
  - `splitHTML` with a caption: `data-path="blocks[3].caption"`
- [ ] **Step 2: Run it.** Expected: FAIL, because the modules are missing.
- [ ] **Step 3: Move the code.** Move each body out of `render.ts` (lines 51–65 and 108–219 today), replacing each hard-coded path with `join(base, …)`. `render.ts` keeps `BODY`, which only routes by template and variant.
- [ ] **Step 4: Verify.** Run `npm run build && npm test`. Expected: PASS, the render lock unchanged. Then run `npx playwright test -c tests/browser/playwright.config.ts edit cards pair` (the specs that exist from that list). Expected: PASS.
- [ ] **Step 5: Commit.** Message: "Table, cards, notes, steps, summary and pair render as components with a base path".

### Task 5: Fitters take a root and a scale

**Files:**
- Create: `src/engine/components/fit.ts`
- Modify: `src/engine/slides/render.ts`, where `mountSlide` computes `const k = frame.clientWidth / 1920` once and passes it (or the slide) to each fitter

**Interfaces:**
- `drawIcons(root: HTMLElement): void`
- `fitValues(root: HTMLElement): void`
- `sizeTable(root: HTMLElement, k: number): void`. The pitch rule reads `root.classList.contains("style-pitch")`, so a doc canvas carries the style class.
- `stackIcons(root: HTMLElement, k: number): void`
- `fitPictures(root: HTMLElement, k: number): void`
- `alignHalves(root: HTMLElement, k: number): void`. It measures `y` against `root.getBoundingClientRect().top`, as it does against the slide today.
- `growTable` and `growCards` stay in `render.ts`: they fill toward the slide's 1080 bottom, which is frame logic.
- Call order in `mountSlide` is unchanged: fitValues → sizeTable → stackIcons → growTable → charts → drawIcons → growCards → fitPictures → alignHalves.

- [ ] **Step 1: Move the code.** Move the six functions and replace each `slide.getBoundingClientRect().width / 1920` with the `k` argument.
- [ ] **Step 2: Verify.** Run `npm run build && npm test`, then `LOOK=1 npx playwright test -c tests/browser/playwright.config.ts look-lock lints layout example-lines`. Expected: PASS. The fitters only change the DOM, so the render lock can't see them; the look lock is the proof.
- [ ] **Step 3: Add a scale-independence test** to `look-lock.spec.ts`: `'a table fits the same at half and full size'`. Mount one fitted table starter in the fixture page at frame widths 960 and 1920 and read each `col` width as a percentage. Assert that both lists are equal. The fixture is `/src/dev/fixture.html`; if it can't set a frame width, add a `width` argument to its `window.lint`-style hook. Run it (it isn't gated by `LOOK`). Expected: PASS.
- [ ] **Step 4: Commit.** Message: "Component fitters take a root and its scale, not a 1920px slide".

### Task 6: Split the CSS into components and frame

**Files:**
- Create: `src/engine/components/components.css`
- Modify: `src/engine/slides/slides.css` (first line `@import "../components/components.css";`, then only the frame), `tests/unit/colours.test.ts` (read the palettes from `components.css`), and the comment in `src/app/edit/edit.css`

**What goes where** (the section headers of `slides.css` today):
- **`components.css`**, in this order:
  - Palettes (`.theme-ink`, `.theme-paper`) and the font and style tokens (`.slide { --display… }`, `.style-consulting/.style-pitch` vars)
  - Text bits: `.shout`, `.nw`, `.hl-*`, `.slide strong`, the `.slide a` link rules, `:where(.slide) :is(p, h4, li)`, `.bullets`
  - Split and notes and `.cap`
  - Cards, Table and marks, Steps, Pair, Summary, Charts, Pictures, Team, Wall
  - The root rules stay written against `.slide` for now. M2 adds the figure canvas class beside `.slide` in those selectors.
- **`slides.css` keeps:**
  - The `.slide, .slide *` reset and the `.slide` box (it must stay ahead of the components: move the reset into `components.css` first if the look lock shows that the order matters)
  - The L3 head rules, `.rail`, `.label`, `.title`, `.subtitle`, `.spacer`, `.grow`, `.takeaway`
  - Cover and section, the number and quote frames (`.t-number`, `.t-quote`, `.big-v`, `.big-c`, `.q-*`), and the agenda
- `.big-v` is also used by the pair's `.half-num`, so it goes to `components.css`. Wherever a rule's home isn't clear, put it in `components.css`: it's harmless there, and docs may need it.

- [ ] **Step 1: Split the file.** Cut and paste whole rules; don't edit any declaration.
- [ ] **Step 2: Verify the cascade.** Run `LOOK=1 npx playwright test -c tests/browser/playwright.config.ts look-lock`. Expected: PASS. If a screenshot differs, open `docs/temp/look/<name>.after.png` beside the baseline, find the pair of rules that swapped, and restore their order. Prefer moving a rule over raising its specificity.
- [ ] **Step 3: Verify the build.** Run `npm run build`, then `grep -o '\.tbl{\|\.rail{' dist/assets/*.css | head -2`. Expected: `.tbl{` is listed before `.rail{`. Then run `npm test` (colours test included), `npm run lint` and `npm run test:browser`. Expected: all pass.
- [ ] **Step 4: Commit.** Message: "Component styles live in components.css; slides.css imports them and keeps the frame".

### Task 7: Record the decision and close M1

**Files:**
- Modify: `docs/superpowers/specs/2026-10-19-occam-docs-design.md`
- Modify: `CLAUDE.md`
- Append: `docs/temp/apple-bar-review.md`

- [ ] **Step 1: Update the spec.**
  - In §2, replace "Docs give the host a doc-sized box and the doc type scale. Labels are never a scaled-down slide." with the figure canvas decision of 2026-10-19: each figure is laid out at a fixed design width (about 1200 px, its own height) with `components.css` unchanged and scaled to the column, and wide tables get a tap-to-expand view on phones.
  - Make the same change in "My calls".
  - Mark M1 built, with the commit range.
- [ ] **Step 2: Update CLAUDE.md.** In Structure, add `components/` (charts, tables, cards, notes, pictures, fitters, `components.css`, shared by slides and docs) to the `src/engine` line. In Rules, change "Slides use `slides.css` unchanged" to "Slides use `slides.css` and `components.css` unchanged".
- [ ] **Step 3: Final check.** Run `npm run build && npm run lint && npm test && LOOK=1 npm run test:browser`. Open `/src/dev/review.html`, `?stress=1` and `?theme=paper` in the preview, and confirm 0 issues in the summary line. Note "M1: no visual change, verified by the look lock" in the review log.
- [ ] **Step 4: Commit.** Message: "Docs M1 done: slides and docs share one component library".

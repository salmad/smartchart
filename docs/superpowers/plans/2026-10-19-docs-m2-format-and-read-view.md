# Docs M2: Doc Format and Read View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A doc is one Markdown file with front matter and `occam:<kind>` component blocks. Occam parses it, validates it with the slide schema, and draws it as a readable page: title, a side table of contents, sections that fold, and figures drawn by the shared components on a scaled canvas.

**Architecture:** `src/engine/docs/` is framework-free, like `slides/`:
- `parse.ts` and `serialize.ts` turn text into a `Doc` and back.
- `validate.ts` checks the doc rules and runs every figure through the slide schema.
- `render.ts` (`docHTML`) produces the page as a string, so it can be tested in node.
- `mount.ts` (`mountDoc`) mounts it in a browser: it draws the charts, runs the fitters, scales each canvas to the column, and wires the TOC, folding and links.

A figure is laid out on a `.fig` canvas as wide as a slide's body (1664 design px), with `components.css` unchanged, then scaled to its frame. Figures run wider than the text, about 1040 px on a desktop, so they read at the body text's size, and notes sit beside a figure as they do on a slide. These are the user's decisions of 2026-10-19. `doc.css` is the doc's frame, as `slides.css` is the slide's.

**Tech Stack:** TypeScript (strict), Vite, vitest (node), Playwright (Chromium). No new dependencies: the Markdown subset is small enough to parse by hand.

**Spec:** `docs/superpowers/specs/2026-10-19-occam-docs-design.md` (§1–3, M2). The slide schema is in `src/engine/slides/schema.ts`.

## Global Constraints

- **Slides don't change:** the render lock (`tests/unit/render-lock.test.ts`) and `LOOK=1` look lock pass after every task that touches `components/`, `components.css` or `render.ts`.
- **One implementation:** doc figures use the `components/` renderers and fitters and `components.css`. `doc.css` lays out the page and the canvas box, and never restyles a component's internals.
- **Content and look stay separate.** The file holds content only: front matter keys are `title`, `subtitle`, `theme` and `accent`, and no styling keys exist.
- The rules apply as before:
  - No `any` and no inline styles in JSX. Setting CSS custom properties from engine code is allowed, as `mountSlide` does.
  - Files stay under about 300 lines.
  - No shims.
  - One `starters.json`.
  - Scratch notes go in `docs/temp/`.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## My calls (for the user to check)

1. **Ids:** headings and figures have ids, written as `{#id}`. When one is missing, code gives it one: a slug for a heading, `<kind>-<n>` for a figure. Paragraphs and lists have no ids in M2; M5 addresses them by section id and position.
2. **Quotes:** `occam:quote` is dropped. A quote is Markdown `>`, and the slide quote frame stays a slide.
3. **Figure width and notes (the user chose this, 2026-10-19):**
   - The canvas is the slide body's width, 1664 px, and figures span up to 1040 px, wider than the 720 px text. At that size, table text is about 17.5 px and note text about 15.6 px.
   - Notes sit beside the figure through the slide's own `splitHTML`.
   - In a frame under 600 px (phones), the canvas drops the notes, and they follow the figure as a plain numbered list in the doc's text.
4. **Style:** doc figures use the consulting style. A new doc's theme defaults to **paper**, which suits long reading; M3 swaps the default for the workspace's brand.
5. **Doc limits:** a doc table takes up to **20** data rows (regulation by country needs more than a slide's 8). Every other limit is the slide's.
6. **Byline:** none in M2. It needs users, which come in M3.
7. **Starters:** `starters.json` becomes `{ "slides": [...], "docs": [...] }`. A doc starter holds its Markdown as an array of lines, so it reads well in the JSON.
8. **Canvas heights:** a chart, pair or image canvas is 640 design px tall, the height a slide body gives a chart. Every other kind takes the height of its content.

## Review Focus

1. **Text that looks like Markdown syntax.** A paragraph beginning `- `, `1. `, `## `, `> `, ```` ``` ```` or `---` must come back as a paragraph after serialize and then parse. Code containing ```` ``` ```` must come back whole. Task 1 tests both.
2. **Broken JSON in a component block.** The block's text is kept verbatim, as a `raw` block, and an error names its line. Content is never lost on a round trip. Task 1 tests this.
3. **Windows line endings and a missing front matter.** `\r\n` files parse the same. A doc with no front matter parses, and validation reports `title: required`. Tasks 1 and 2 test these.
4. **Figures in a folded section.** A section folded from a stored state, or unfolded after a resize, shows its figures at the right size (frame height = canvas height × scale), never at 0. Task 6 tests this.
5. **Links to ids.** A `#id` link to a heading inside a folded section unfolds that section and scrolls to it. A link to an id that doesn't exist is a validation warning. Tasks 2 and 6 test these.

---

### Task 1: The doc model, parser and serializer

**Files:**
- Create: `src/engine/docs/types.ts`, `src/engine/docs/parse.ts`, `src/engine/docs/serialize.ts`
- Modify: `src/engine/types.ts` (adds `CalloutTone` and `Callout`: the callout is a shared component, so its type lives with the slide types)
- Test: `tests/unit/docs-format.test.ts`

**Interfaces (Produces):**
```ts
// types.ts
// src/engine/types.ts
export type CalloutTone = 'note' | 'decision' | 'risk'
export interface Callout { tone: CalloutTone; label?: string; text: string }
// src/engine/docs/types.ts
export type FigureKind = 'chart' | 'table' | 'number' | 'cards' | 'steps' | 'summary' | 'pair' | 'image' | 'team' | 'logos' | 'callout'
/** A figure's JSON: the slide fields of its template (no title, subtitle, kicker or talk) plus the furniture, or a callout. */
export type FigureBody = Omit<Partial<Slide>, 'template' | 'title' | 'subtitle' | 'kicker' | 'talk'> & Partial<Callout>
export type Block =
  | { type: 'heading'; level: 2 | 3; id: string; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'bullets' | 'numbered'; items: string[] }
  | { type: 'quote'; text: string }
  | { type: 'divider' }
  | { type: 'code'; lang: string; text: string }
  | { type: 'figure'; kind: FigureKind; id: string; body: FigureBody }
  | { type: 'raw'; text: string }            // a component block that did not parse, kept verbatim
export type FigureBlock = Extract<Block, { type: 'figure' }>
export type CodeBlock = Extract<Block, { type: 'code' }>
export interface Doc { title: string; subtitle?: string; theme?: Theme; accent?: string; blocks: Block[] }
export interface Parsed { doc: Doc; errors: string[] }   // errors read "line 12: …"
// parse.ts
export function parseDoc(text: string): Parsed
export function slug(text: string): string                // plain text → [a-z0-9-], max 40 chars
export function outline(doc: Doc): { id: string; level: 2 | 3; text: string }[]   // text is plain()
// serialize.ts
export function serializeDoc(doc: Doc): string
```

**Grammar (line-based; blank lines separate blocks):**

| Element | Syntax |
|---|---|
| Front matter | A leading `---` … `---` of `key: value` lines (split at the first `: `). Unknown keys are an error. |
| Headings | `## text {#id}` and `### text {#id}`. `#` and `####`+ are errors (the title lives in the front matter), and the line is kept as a paragraph. |
| Component | ```` ```occam:<kind> {#id} ```` + JSON + ```` ``` ````. An unknown kind or bad JSON gives a `raw` block plus an error. |
| Code | ```` ```lang ```` … ```` ``` ````. A fence closes on a run of backticks at least as long as the one that opened it. The serializer uses a fence one longer than the longest run inside. |
| Lists | `- item` and `1. item`. An indented line continues the item, joined with a space. |
| Quote | `> ` lines, joined with a space. |
| Divider | `---` outside the front matter. |
| Paragraph | Anything else; its lines are joined with a space. A leading `\` is stripped. |

When a paragraph's text would read as another block, `serializeDoc` writes it with a leading `\`.

Ids:
- Heading ids default to `slug(plain(text))`.
- Figure ids default to `<kind>-<n>`.
- Defaults get `-2`, `-3` and so on when an id is already taken. Explicit ids are kept as written, duplicates included (validation reports them).

- [ ] **Step 1: Write the failing tests** in `tests/unit/docs-format.test.ts`:
  - `'a doc round-trips'`: build a `Doc` with every block type (two figures, one a chart, and a `callout`). `parseDoc(serializeDoc(doc)).doc` toEqual `doc`, and `errors` is `[]`.
  - `'text that looks like syntax stays text'`: paragraphs `'- not a list'`, `'1. not a list'`, `'## not a heading'`, `'> not a quote'`, `'---'` and `'```js'` each round-trip as `{ type: 'paragraph' }`.
  - `'code with a fence inside comes back whole'`: a code block with text ```` 'a\n```\nb' ```` round-trips.
  - `'missing ids are given'`: parsing `'---\ntitle: T\n---\n\n## Revenue growth\n\n## Revenue growth\n\n```occam:chart\n{}\n```'` gives heading ids `revenue-growth` and `revenue-growth-2`, and figure id `chart-1`.
  - `'broken JSON is kept'`: ```` '```occam:table {#t}\n{ nope\n```' ```` gives one `raw` block whose text equals the input lines, and one error matching `/^line 1: /`. `serializeDoc` writes the raw text back unchanged.
  - `'CRLF parses like LF'`: the same doc with `\r\n` line endings parses to an equal `doc`.
  - `'no front matter'`: `parseDoc('Hello')` gives `doc.title === ''` and one paragraph.
- [ ] **Step 2: Run them.** `npx vitest run tests/unit/docs-format.test.ts`. Expected: FAIL, because the modules are missing.
- [ ] **Step 3: Implement** `types.ts`, `parse.ts` and `serialize.ts` to the grammar above. `slug` and `outline` use `plain` from `slides/schema.ts`.
- [ ] **Step 4: Run them.** Expected: PASS. Then run `npm run build && npm test`. Expected: PASS.
- [ ] **Step 5: Commit.** Message: "Docs are Markdown files: parse and serialize round-trip, ids given where missing".

### Task 2: Validation by the slide schema

**Files:**
- Modify: `src/engine/slides/schema.ts`: export `validateComponent`, and thread a row limit through `checkRules` and `checkGrid`.
- Create: `src/engine/docs/validate.ts`
- Test: `tests/unit/docs-validate.test.ts`

**Interfaces:**
- Consumes: `Doc`, `Block`, `outline` (Task 1).
- Produces:
  - `schema.ts`: `export interface Limits { tableRows: number }`, `export const SLIDE_LIMITS: Limits = { tableRows: 8 }`, and `export function validateComponent(template: TemplateId, body: unknown, style: Style, limits?: Limits): Validation`.
    - It checks the template's fields minus `title`, `subtitle`, `kicker` and `talk`, plus the figure furniture: `caption`, `notes`, `notesTitle`, `source`, `footnote` and `takeaway`, taken from the chart template's `FieldDef`s.
    - It reports unknown fields as `validate` does, and runs `checkRules` on `{ template, title: '', ...body }`.
    - With `limits.tableRows`, both the `rows` item maximum and `checkGrid`'s data-row cap use it.
    - `validate()` behaves exactly as before.
  - `docs/validate.ts`: `export const DOC_LIMITS: Limits = { tableRows: 20 }`, `export const CALLOUT_FIELDS: Record<string, FieldDef>` (`tone` required, an enum of note, decision and risk; `label` text, max 24; `text` markup, required, max 240), and `export function validateDoc(doc: Doc): Validation`.

**Doc rules:**

| Kind | Rule | Message |
|---|---|---|
| Error | Missing title | `title: required.` |
| Error | `theme` outside ink and paper | `theme: …` |
| Error | `accent` rejected by `resolveAccent` | `accent: …` |
| Error | Duplicate id among headings and figures | `#<id>: used by more than one heading or figure.` |
| Error | Each figure body | `validateComponent(kind, body, 'consulting', DOC_LIMITS)`, every message prefixed `#<id>.` |
| Error | Each callout | checked against `CALLOUT_FIELDS` with the same field checker (export `checkFields(fields, obj, style): Validation` from `schema.ts` for it) |
| Warning | `[words](#x)` anywhere (text and figure bodies) where `x` matches no id | `link #x: no heading or figure has this id.` |

- [ ] **Step 1: Write the failing tests:**
  - `'a valid doc has no errors'`: a doc with a chart figure (the `chart` starter's chart, caption and notes) and a callout gives `errors` `[]`.
  - `'figure errors carry the figure id'`: a table with 6 columns gives an error starting `#cmp.table.columns`.
  - `'a doc table takes 20 rows, a slide table 8'`: a 12-row table has no row error in `validateDoc`, and `validate()` of the same table on a slide still errors with `at most 8`.
  - `'caption is allowed on any figure'`: `cards` with a `caption` gives no `not a field` error.
  - `'title, duplicate ids and dead links'`: the expected three messages.
  - `'callouts are checked'`: `{ tone: 'urgent', text: 'x' }` errors on `tone`.
- [ ] **Step 2: Run them.** `npx vitest run tests/unit/docs-validate.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `validateComponent`, `checkFields` and `validateDoc`.
- [ ] **Step 4: Verify.** Run `npx vitest run tests/unit/docs-validate.test.ts`, then `npm run build && npm test`. Expected: PASS. `schema.test.ts` and the render lock are unchanged.
- [ ] **Step 5: Commit.** Message: "Doc figures are validated by the slide schema, with doc limits and doc rules".

### Task 3: The components docs need: chart hosts, number, callout and code

**Files:**
- Create: `src/engine/components/charts/hosts.ts`, `src/engine/components/number.ts`, `src/engine/components/callout.ts`, `src/engine/components/code.ts`
- Modify:
  - `src/engine/slides/render.ts`: `mountSlide` calls `drawCharts`.
  - `src/engine/components/pair.ts`: the number half calls `numberHTML`.
  - `src/engine/components/components.css`: the `.fig` root beside `.slide`, plus callout and code.
- Test: `tests/unit/components-docs.test.ts`

**Interfaces (Produces):**
- `drawCharts(root: HTMLElement, s: Slide, theme: Theme, accent: string | null | undefined, colours: Allocation): void`. This is the chart-host loop moved from `mountSlide` unchanged: a host with no index draws `s.chart`, and a host `data-chart="i"` draws `s.halves[i].chart` with its own allocation.
- `numberHTML(n: { value: string; caption: string; tone?: Tone }, base: string): string`. This is the pair's `.half-num` markup, with paths `join(base, 'number.value')` and `join(base, 'number.caption')`. The pair passes its half's path as the base, so its paths stay `halves[i].number.value`.
- `calloutHTML(c: Callout, base: string): string` gives `<div class="callout t-<tone>"><span class="co-l">LABEL</span><p data-path=… data-kind="md">md(text)</p></div>`. The default labels are Note, Decision and Risk.
- `codeHTML(text: string, lang: string): string` gives `<pre class="code" data-lang="…"><code>esc(text)</code></pre>`.

**`components.css`:**
- Every root rule written against `.slide` also names `.fig`: the font tokens, the reset, links, `strong` and `:where()`. Use selector lists (`.slide, .fig`), not `:is()`, so specificity is unchanged.
- **Callout:** a 6 px left rule and 6 px 0 6 px 36 px padding, as the takeaway has. The label is set like `.label`: mono, 20 px, letter-spacing .16em, uppercase. The text is `var(--body)`. The rule and label are `--line-2`/`--muted` for a note, `--focus` for a decision and `--neg` for a risk; the text stays `--fg`.
- **Code:** mono 22 px/1.5, `background: var(--surface)`, padding 28 px 32 px, `white-space: pre-wrap`, `--fg-2`.

Steps:
- [ ] **Step 1: Write the failing tests:**
  - `calloutHTML({ tone: 'risk', text: 'FCA **approval**' }, '')` contains `class="callout t-risk"`, `>Risk<` and `<strong>approval</strong>`.
  - `codeHTML('a < b', 'ts')` contains `a &lt; b`.
  - `numberHTML({ value: '£2.5bn', caption: 'x' }, 'halves[1]')` contains `data-path="halves[1].number.value"`.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement** the files and the CSS. Move the loop and the half-number markup; don't copy them.
- [ ] **Step 4: Verify.** Run `npm run build && npm test` (the render lock is unchanged), then `LOOK=1 npx playwright test -c tests/browser/playwright.config.ts look-lock`. Expected: PASS, 344 of 344 unchanged.
- [ ] **Step 5: Commit.** Message: "Number, callout and code are components; chart hosts draw for any root".

### Task 4: The page as HTML

**Files:**
- Create: `src/engine/docs/render.ts`, `src/engine/docs/figure.ts`
- Test: `tests/unit/docs-render.test.ts`

**Interfaces:**
- Consumes: Tasks 1 and 3, and the `components/` renderers.
- Produces:
  - `figure.ts`:
    - `export const FIG_WIDTH = 1664`, the slide body's width (1920 − 2 × 128).
    - `export const FIXED_HEIGHT: Partial<Record<FigureKind, number>> = { chart: 640, pair: 640, image: 640 }`
    - `export function asSlide(f: FigureBlock): Slide`, which gives `{ template: kind, title: '', ...body }` for every kind except callout.
    - `export function figureHTML(f: FigureBlock, theme: Theme, beside = true): string`. With `beside` and notes, the canvas holds `splitHTML(body, component, extra, "")`, as the slide `BODY` does: the extra class is `grow` for a chart, `with-table` for a table, `grow with-pic` for an image, and `grow` for a pair. Without notes, or with `beside = false`, it holds the caption and then the component.
    - `export function figureCanvasHTML(f: FigureBlock, theme: Theme, beside: boolean): string`, the inner canvas alone, which `mountFigure` uses to re-render a figure that crosses the 600 px line.
    - `export function codeFigureHTML(b: CodeBlock, theme: Theme): string`
  - `render.ts`: `export function docHTML(doc: Doc): string`.

**Figure markup** (base `""` inside the canvas, because paths are relative to the figure body; the block is named by `data-block`):
```html
<figure class="doc-fig" id="{id}" data-block="{id}" data-kind="{kind}">
  <div class="fig-frame"><div class="fig style-consulting theme-{theme} k-{kind}">
    {figureCanvasHTML(f, theme, true)}
  </div></div>
  {notes ? <ol class="fig-notes"> one <li><b>md(title)</b> md(text)</li> per note : ""}  (shown only on a narrow frame)
  {takeaway ? <p class="fig-take" data-path="takeaway" …>md</p>}{source/footnote ? <p class="fig-src">…</p>}
</figure>
```

Component per kind:

| Kind | Markup |
|---|---|
| chart | `<div class="chart full grow" data-chart></div>` |
| table | `tableHTML(t, "table", true, roomOf(t, false))` |
| number | `numberHTML(n, "")` |
| cards | `cardsHTML(cards, MENU.cards.variant(asSlide(f)), arrange, "")` |
| steps | `stepsHTML(…, "")` |
| summary | `summaryHTML(…, "")` |
| pair | `pairHTML(halves, "")` |
| image | `imgHTML(image, "pic grow", "image")` |
| team | `teamHTML(people, MENU.team.variant(asSlide(f)), "")` |
| logos | `wallHTML(logos, "")` |
| callout | `calloutHTML(body, "")` |

A code block is a figure without an id: a `fig k-code` canvas holding `codeHTML`.

**Page markup:**
- Text blocks use `md()`: `<p>`, `<ul class="doc-list">`, `<ol class="doc-list">`, `<blockquote>`, `<hr>`.
- A raw block is `<pre class="doc-raw">` (escaped).
- **Head:** `<header class="doc-head"><h1 class="doc-title">md(title)</h1><p class="doc-sub">md(subtitle)</p></header>`.
- **TOC:** `<nav class="doc-toc" aria-label="Contents"><p class="toc-h">Contents</p><ol>` with one `<li class="l2|l3"><a href="#id">plain</a></li>` per `outline()` entry. The same `<ol>` also sits in `<details class="doc-toc-mini"><summary>Contents</summary>…</details>` at the top of the body, for narrow screens (`doc.css` shows one or the other).
- **Sections:** each `##` opens `<section class="doc-sec" id="{id}"><h2><button class="fold" aria-expanded="true" aria-controls="{id}-body" aria-label="Fold section"><i data-lucide="chevron-down"></i></button><a href="#{id}">md(text)</a></h2><div class="sec-body" id="{id}-body">`, which runs to the next `##`. Blocks before the first `##` sit outside any section.
- **`###`:** `<h3 id>`.
- **Root:** `<article class="doc theme-{theme}" data-links>` holding the head, the TOC and `<div class="doc-body">`. The theme defaults to `paper`.

Steps:
- [ ] **Step 1: Write the failing tests** (node, string asserts):
  - `'sections wrap their blocks'`: a doc with `## A`, a paragraph, then `## B`. The paragraph sits inside `id="a-body"`, before `id="b"`.
  - `'the TOC lists headings in order'`: the TOC contains `href="#a"` before `href="#b"`, and the `###` gets `class="l3"`.
  - `'a figure is a canvas with its furniture'`: a chart with caption, notes, source and takeaway contains `class="fig style-consulting theme-paper k-chart"`, `data-chart`, `class="split grow`, `class="notes"`, `class="fig-notes"`, `class="fig-take"` and `Source:`. The same figure with `beside = false` has no `class="split`.
  - `'figure paths are the slide paths'`: a table figure contains `data-path="table.rows[0].cells[0]"`.
  - `'a doc theme reaches the canvas'`: `theme: ink` gives `theme-ink` on the article and every `.fig`.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement** `figure.ts` and `render.ts`.
- [ ] **Step 4: Verify.** Run the tests, then `npm run build && npm test`. Expected: PASS.
- [ ] **Step 5: Commit.** Message: "A doc renders as one page: head, contents, folding sections, figures on a canvas".

### Task 5: Doc starters in the one gallery

**Files:**
- Modify:
  - `src/engine/starters/starters.json`: becomes `{ "slides": [...today's array...], "docs": [...] }`.
  - `src/engine/starters/index.ts`
  - Every direct reader of the JSON: `tests/agent-harness/run.mjs`, `tests/unit/mcp-eval/{judge,checks,scores}.test.ts`, and `tests/browser/{presenter,share,storyline,rehearse,brand}.spec.ts`. They read `.slides`.
- Test: `tests/unit/starters-docs.test.ts`

**Interfaces (Produces):**
- `export interface DocStarter { id: string; label: string; blurb: string; markdown: string[] }`
- `export const DOC_STARTERS: readonly DocStarter[]`
- `export function starterDoc(s: DocStarter): Doc`, which parses `markdown.join('\n')`.
- At import, every doc starter must parse with no errors and pass `validateDoc` with no errors, or `index.ts` throws, as it does for slides.

**The three starters** (all figures with a caption; real-looking but illustrative numbers, sources marked "illustrative"; Finbridge is the user's company and sells SME credit cards):
- **`competitor-teardown`**, "Finbridge competitor research". Sections:
  - Summary: a paragraph, plus a decision callout.
  - Revenue growth: a bars chart, 3 issuers × 5 years, with a CAGR annotation and notes.
  - Where each one wins: a table with Harvey balls, 5 issuers × 4 criteria, Finbridge as the focus row.
  - Strengths and weaknesses: framed cards for the main rival.
  - The number that matters: a number figure.
  - Next steps: a numbered list.
- **`prd`**, "Card controls PRD". Sections:
  - Problem: paragraphs.
  - Goals: bullets, plus a decision callout.
  - Requirements: a table with status pills, 6 rows.
  - Flow: steps.
  - API: a code block in `ts`.
  - Risks: a risk callout.
  - Open questions: a numbered list.
- **`legal-memo`**, "Credit card regulation by market". Sections:
  - Summary: a note callout.
  - Regulation by country: a table, **12** country rows grouped by region, with status pills and notes. This exercises the doc limit.
  - Licensing path: steps.
  - Risks: two risk callouts.
  - Sources: a paragraph of links.

Each starter has at least one `###` and one `[words](#id)` link to a figure.

- [ ] **Step 1: Write the failing test:**
  - `'every doc starter parses, validates and round-trips'`: for each starter, `parseDoc` errors are `[]`, `validateDoc` errors are `[]`, and `parseDoc(serializeDoc(doc)).doc` toEqual `doc`.
  - `'the three doc starters exist'`: the ids are `competitor-teardown`, `prd` and `legal-memo`.
- [ ] **Step 2: Run it.** Expected: FAIL.
- [ ] **Step 3: Implement** the JSON shape change and its readers, then write the three starters.
- [ ] **Step 4: Verify.** Run `npm run build && npm test` (the render lock is unchanged), then `npx playwright test -c tests/browser/playwright.config.ts presenter share storyline rehearse brand`. Expected: PASS.
- [ ] **Step 5: Commit.** Message: "Doc starters join the one gallery: a competitor teardown, a PRD and a legal memo".

### Task 6: The read view in the browser: canvas, contents, folding

**Files:**
- Create: `src/engine/docs/doc.css`, `src/engine/docs/mount.ts`, `src/dev/docs.html`, `src/dev/docs.ts`
- Test: `tests/browser/docs.spec.ts`

**Interfaces:**
- Consumes: `docHTML`, `figureHTML`, `FIG_WIDTH`, `asSlide`, `DOC_STARTERS`, and the fitters and `drawCharts` from `components/`.
- Produces:
  - `mountDoc(root: HTMLElement, doc: Doc, key: string): { destroy(): void }`
  - `mountFigure(frame: HTMLElement, f: FigureBlock | null, theme: Theme, accent: string | undefined): void`, where `null` is a code canvas.

**`mountFigure`, in order:**
1. `k = frame.clientWidth / FIG_WIDTH`. Return if `k === 0`. If the frame's beside mode (width ≥ 600) differs from what the canvas holds, re-render the canvas with `figureCanvasHTML`, and toggle `.narrow` on the `.doc-fig`, which shows `.fig-notes`.
2. Set `--s` on the `.fig`.
3. Set the colour vars from `allocate(asSlide(f) or null, theme, accent)`.
4. `fitValues`.
5. `sizeTable(k)`.
6. `stackIcons(k)`.
7. `drawCharts`.
8. `drawIcons`.
9. `fitPictures(k)`.
10. `alignHalves(k)`.
11. Set the frame height: `fig.offsetHeight * k` in px.

A `ResizeObserver` on each frame re-runs only steps 1, 2 and 11 after the first mount. It runs the full mount when a frame first gets a width (a figure that mounted folded) or crosses the 600 px line.

**`mountDoc`:**
- Sets `innerHTML = docHTML(doc)`, mounts every figure, and runs `drawIcons(root)` for the chevrons.
- **Folding:** clicking `.fold` toggles `.folded` on its section and `aria-expanded`, and saves the folded ids in `localStorage['occam.doc.fold.' + key]` (inside try/catch). It applies the stored folds after the figures mount.
- **Links:** a delegated click on `a[href^="#"]` unfolds the section holding the target, scrolls to it (`scrollIntoView({ block: 'start' })`) and sets the hash with `history.replaceState`.
- **Contents:** an `IntersectionObserver` marks the current section's TOC link `aria-current="true"`.
- **Expand:** under 600 px of column, each `.doc-fig` gets an expand button (`<button class="fig-expand" aria-label="Expand figure">` with `maximize-2`). It opens a `<dialog class="fig-dialog">` holding a new frame 1040 px wide (scale .625, notes beside) in a horizontally scrolling box, mounted with `mountFigure`. Escape and a close button close it.

**`doc.css`** (the doc frame; it styles only the page, the `.fig` box and the frame vocabulary):
- **Page:** `.doc` defines the fonts (via `components.css`'s token rule: add `.doc` to it in this task) with `background: var(--bg)` and `color: var(--fg)`.
  - At 1180 px and wider, the grid is `minmax(32px,1fr) minmax(0, var(--doc-wide, 1040px)) 220px minmax(32px,1fr)` with a 64 px column gap. The TOC sits sticky in the 220 px column.
  - The main column holds the body. Text blocks are at most 720 px, centred in it. `.doc-fig` takes the main column's full width, so a figure overhangs the text by up to 160 px on each side.
  - On a 1280 px laptop, the main column shrinks to about 900 px and figures with it.
  - Below 1180 px, it's one column of `minmax(0, var(--doc-wide, 1040px))` with 16 px gutters.
  - Below 1180 px, `.doc-toc` is hidden and `.doc-toc-mini` shows: a collapsed block above the body. At 1180 px and wider it's the other way round.
- **Type scale:**

  | Element | Setting |
  |---|---|
  | Title | Archivo 800, stretch 78%, 48px/1.05, letter-spacing -.012em |
  | Subtitle | 20px/1.4, `--fg-2`, 12px above |
  | h2 | Archivo 800, stretch 78%, 30px/1.1, 64px above |
  | h3 | Geist 600, 19px, 32px above |
  | Body | Geist 17px/1.6 |
  | Lists | Dash markers in `--muted`, as `.bullets` |
  | Quote | A 3px `--focus` rule, 19px |
  | `hr` | A `--line` hairline, 48px of space |
  | `.fig-src` | Mono 12px, `--muted` |
  | `.fig-take` | 18px 600, with a 4px `--focus` rule |
  | Links | Underlined with currentColor at 45% |

- **Fold control:** the button hangs in the gutter, 28px left of the heading, so headings align with the text. It's `--muted`, and turns -90° when folded.
- **Folding and print:** `.doc-sec.folded > .sec-body { display: none }`. `@media print` shows folded bodies and hides `.doc-toc`, `.fold` and `.fig-expand`.
- **The figure box:** `.doc-fig { margin: 40px 0 }`, and `.fig-frame { position: relative; overflow: hidden }`.
- **The canvas:** `.fig { position: absolute; top: 0; left: 0; width: 1664px; transform-origin: 0 0; transform: scale(var(--s, .625)); display: flex; flex-direction: column; background: var(--bg); color: var(--fg); font-family: var(--text); font-size: var(--body); line-height: 1.38; text-align: left; -webkit-font-smoothing: antialiased; font-kerning: normal; font-variant-ligatures: none; font-synthesis: none }`.
- **Fixed-height canvases:** `.fig.k-chart, .fig.k-pair, .fig.k-image { height: 640px }`, and `.fig:is(.k-chart, .k-pair, .k-image) > .grow { flex: 1; min-height: 0 }`.
- **Notes on a narrow frame:** `.fig-notes` is hidden unless `.doc-fig.narrow`. It's a numbered list in the doc type: 15px, the title in 600 and the text in `--fg-2`, with the numbers in mono `--focus`, echoing the slide notes.

**Dev page** (`src/dev/docs.html` with `docs.ts`, imports `components.css` and `doc.css`):
- Query parameters: `doc=<id>` (default: the first), `theme=ink|paper` (it overrides the doc's theme), and `width=<px>`, which sets `--doc-wide`. A picker row links the three starters and both themes.
- After mounting, it runs `chartLabelLints(fig, FIG_WIDTH)` and `colourLints(fig)` on every `.fig` and writes a summary line: `{n} figures · {m} issues`, listing the issues, with `window.__docs = { issues }`.
- `chartLabelLints` gains a `width = 1920` parameter (`slides/lints.ts`, `hostLabelLints` uses it instead of 1920). The slide callers are unchanged.

Steps:
- [ ] **Step 1: Write the failing browser tests** in `tests/browser/docs.spec.ts`:
  - **`'a doc opens readable, with contents'`:** the `prd` doc at 1440×900 shows its title, a `.doc-toc` with one link per heading, and no `.folded` section.
  - **`'a figure is scaled to the column'`:** in `competitor-teardown`, the chart's `.fig-frame` height equals `fig.offsetHeight × (frame width / 1664)`, within 1px. Its `.fig` has a drawn `svg`.
  - **`'a section folds, stays folded, and prints open'`:**
    - Click the second section's `.fold`, and its `.sec-body` is hidden.
    - Reload, and it's still hidden.
    - `page.emulateMedia({ media: 'print' })`, and it's visible.
  - **`'a link unfolds its section and scrolls to it'`:** fold the section holding the link's target, then click a `[words](#id)` link. The target's section is unfolded, and the target's top is within 80px of the viewport top.
  - **`'a figure folded at load sizes when unfolded'`:**
    - Store a fold for the chart's section, then reload.
    - Unfold it, and the chart's frame height is greater than 100 and equals `fig.offsetHeight × scale` within 1px.
  - **`'notes sit beside on a desktop and below on a phone'`:** the teardown's chart (it has notes) at 1440 px has a `.split` in its canvas and a hidden `.fig-notes`. At 375 px it has no `.split` and a visible `.fig-notes`. Resizing from 375 back to 1440 restores the split.
  - **`'on a phone, a figure expands'`:** at 375×812, click `.fig-expand` on the legal memo's table. A `dialog[open] .fig-frame` is 1040px wide.
- [ ] **Step 2: Run them.** `npx playwright test -c tests/browser/playwright.config.ts docs`. Expected: FAIL (no page yet).
- [ ] **Step 3: Implement** `mount.ts`, `doc.css`, the dev page and the lints parameter.
- [ ] **Step 4: Verify.**
  - Run `npx playwright test -c tests/browser/playwright.config.ts docs`. Expected: PASS.
  - Run `npm run build && npm run lint && npm test`. Expected: PASS.
  - Run `LOOK=1 npx playwright test -c tests/browser/playwright.config.ts look-lock lints`, since the lints and the token rule changed. Expected: PASS.
- [ ] **Step 5: Commit.** Message: "The doc read view: figures on a scaled canvas, side contents, sections that fold and print open".

### Task 7: Every starter clean at three widths, reviewed, and recorded

**Files:**
- Modify:
  - `tests/browser/docs.spec.ts`
  - `docs/superpowers/specs/2026-10-19-occam-docs-design.md`: M2 built, the calls above, and the figure canvas line in §2 and in "My calls" (1664 px, the slide body's width, figures wider than the text, notes beside and below on phones).
  - `CLAUDE.md`: Structure gains `docs/` (the doc format, validation, renderer and `doc.css`, framework-free) under `src/engine`, and Commands gains the dev page `/src/dev/docs.html`.
- Append: `docs/temp/apple-bar-review.md`

Steps:
- [ ] **Step 1: Write the test** `'every doc starter is clean at three widths'`: for each starter, both themes, and widths 343, 720 and 1040, open `/src/dev/docs.html?doc=…&theme=…&width=…`, wait for `window.__docs`, and expect `issues` toEqual `[]`.
- [ ] **Step 2: Run it.** Expected: PASS. Any C1 or R15 issue is a real flaw: fix it at engine level (component CSS or the chart code at the canvas size) or in the starter's content, never by loosening the lint. Re-run the look lock after any component fix.
- [ ] **Step 3: Review it by eye.** Screenshot each starter at 1440 px in both themes, section by section (memory: review individually). Then screenshot the phone width with one figure expanded. Judge it against the Apple bar: type rhythm, figure scale against the body text, the contents rail, the fold control. Write the critique in `docs/temp/apple-bar-review.md`, and fix what's below the bar in `doc.css` or the starters.
- [ ] **Step 4: Final check.** Run `npm run build && npm run lint && npm test && LOOK=1 npm run test:browser`. Expected: PASS, apart from the known `edit.spec` hover flakes if they haven't been fixed yet (name them in the report).
- [ ] **Step 5: Commit.** Message: "Docs M2 done: doc starters read cleanly at every width, in both themes". Then show the user the dev page for review, which is M2's done-when.

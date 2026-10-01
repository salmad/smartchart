# Slide system: product scope and architecture

> Status: **approved direction, 2026-09-26**; next step is the M0/M1 implementation plan (see 14). Builds on [PRODUCT_INPUT.md](../../product/PRODUCT_INPUT.md) and the approved visual design `docs/design/proposals/slides-v4.html` ("Ink").
> Reviewed twice with a second model (Fable): the composition model and the fit engine. Its recommendations are folded in.

## 1. Goal

A user types a prompt and gets a slide (later: a deck) that is beautiful by construction. The agent **configures**; it never designs. The v4 visual design is the standard; this spec defines how to build it so it is reusable, deterministic and easy for a cheap model to drive.

**Non-goals for now:** export (reports live in the app), canvases other than 16:9, free text blocks, images beyond icons, server persistence, auth.

## 2. Decisions

| # | Decision |
|---|---|
| D1 | The system is built from **1 frame + 3 layouts + ~6 blocks**. There is no per-template code. |
| D2 | Layouts have **typed areas**. The **menu is the registry**: each entry names a layout and the block kind for each area. Area whitelists are derived from the menu, so no unlisted combination exists. Free composition is not allowed. |
| D3 | The agent chooses from **one flat menu** of allowed combinations (7 entries) and writes content-named fields (3.5). It never sees layouts, areas or block kinds. One decision, not layout-then-area. The menu is the same for both styles; style changes copy rules and limits, never the menu. |
| D4 | **Fit is deterministic arithmetic**, not a render-time check: text is shaped with HarfBuzz (Chrome's shaper) against the self-hosted font files, with variable-font advances taken unrounded from HVAR (as Chrome does), line-broken with Blink's rules (its pair table for U+0021–U+00FF, UAX #14 elsewhere), and summed against slot geometry constants. Titles are balanced by the calculator (it returns the balanced width), not by CSS `text-wrap: balance`. *(Revised 2026-09-27 by the M0 fit spike: plain HarfBuzz + UAX #14 let overflows through; see `docs/research/2026-09-27-fit-spike/`.)* |
| D5 | Three lines of defence for fit: schema guardrails → fit calculator (the guarantee) → CI calibration against Chrome. |
| D6 | Every allowed configuration passes a **quality matrix** (geometry lints on all, approved visual baselines on a representative set) before it ships. |
| D7 | **Dependency direction: geometry → limits → schema.** Geometry constants (slot sizes, fonts) are the root. Guardrail limits are computed from them. The zod schema consumes the limits and is the source of truth for types, agent docs, validation and generated test content. |
| D8 | The agent loop runs **in the browser**; a thin Vercel function proxies model calls and holds the keys. |
| D9 | Style (consulting / pitch) is the user's choice per report and changes the **frame** as well as the copy rules (see 3.1). Palette (ink / paper) is visual only. The user may also pick an **accent**, which replaces the palette's `focus` colour; code moves it towards white or black until it has 4.5:1 contrast with the slide background and picks the text colour on accent fills. It changes no geometry. |
| D10 | One chart engine (custom SVG shapes + HTML labels) serves slides and the standalone chart block. Recharts is retired (it renders SVG `<text>`, which Chrome misplaces in scaled frames). |
| D11 | **Chromium only for the MVP** (Chrome, Edge, Arc). Safari/Firefox shape and break text differently; they come later with their own calibration. |
| D12 | **Fixed format, not responsive.** A slide is always laid out at 1920×1080, and a standalone chart on its own fixed canvas (the same geometry as the `chart` entry without notes). On screen the whole canvas is scaled uniformly (`transform: scale`), like PowerPoint or Keynote: fit-to-panel, zoom, thumbnails. Layout never reflows with the viewport: no breakpoints, container queries or viewport units inside a slide. This is what makes fit computable: there is exactly one geometry to calculate against. Only the app around the slide (chat, panels) is responsive. |
| D13 | **Model routing.** GLM 5.3 Flash through its subscription endpoint is the main model (free; first priority). OpenRouter is used **only** for Jev (later also cheap image models), never for other text models. Jev makes every closed-set decision that needs no writing (menu entry, edit intent, card lead, bar or line per series, stacking, focus element, icons; see 9.1) and runs the cheap judgment checks. GLM writes text and data. |
| D14 | **Design checks** run after every save: deterministic rule checks (free) plus Jev judgment checks (cheap). They are shown as a checks list on the slide, and the turn's reply names up to two failed ones so the user can ask for a fix (revised 2026-09-27). The agent never fixes them unasked. They never block saving; fit does. |
| D15 | **Presentation mode** like Slidev: keyboard navigation, full screen, overview grid, deep links per slide. |
| D16 | **Routing picks the key component only; optional components are never a routing decision.** The router chooses what the slide is built around (chart, table, number, steps, cards, cover, section). Everything optional is decided while filling, inside the chosen template: notes, takeaway, footnote, source, kicker, card facts, card lead (icon or value). Where an optional component changes the layout (notes on a chart or table), code picks the layout variant deterministically. A new optional component never adds a menu entry. (Evidence: M0 bake-off, 13.) |

## 3. Composition model

### 3.1 Frame

Every content slide shares one frame. Cover and section are frame variants with no areas. The frame differs by style, because consulting and pitch decks title slides differently:

| Frame field | Consulting | Pitch |
|---|---|---|
| `kicker` | optional small label; defaults to the current section name | **not used** (the title already names the topic) |
| `title` | required; markup; the **action title**: a full sentence stating the so-what; ≤ 2 lines | required; the **topic**: "Business model", "Unit economics", "The problem"; **exactly 1 line** |
| `subtitle` | not used | **required**; markup; the claim in a few more words, smaller type; **exactly 1 line** (≤ 60 characters) |
| `takeaway` | optional; markup; exactly 1 line | optional; markup; exactly 1 line |
| `footnote` | optional; ≤ 2 lines together with `source` | optional, rare |
| `source` | optional; renderer adds "Source:" | optional, rare |
| `caption` (chart, table) | written by default: what is shown, plainly (measure, scope, period, then " · " and the unit); exactly 1 line, ≤ 48 characters; a table counts it as 1 row of its budget | optional, only when asked |
| `notesTitle` (with notes) | optional, only when asked or offered as a suggestion: "Notes", "What drives it"; exactly 1 line, ≤ 20 characters; not with a takeaway | same |

**Exhibit heads (2026-09-28).** The caption sits over the chart or table on a hairline; the unit after the last " · " is set quieter. With notes and a notes heading, both columns get one header row on one line (a missing caption leaves its side blank). With a caption alone, the notes keep the full column height from the body line.

Derived, never written by the agent: page number, section number, note numbers, default kicker, footer (deck setting).

**Fixed head.** The frame's head (kicker, title, subtitle) reserves the height of its longest form: consulting keeps the kicker line (even when empty) and 2 title lines; pitch keeps 1 title line and 1 subtitle line (2026-09-28: the second line was reserved on every slide and never used). A shorter title or subtitle leaves room below it; it never moves the body (L3). Section dividers follow the same idea: the section title is exactly 1 line and the subtitle keeps 2 lines, so the section number and title sit in the same place on every divider.

> Design change from v4: pitch content slides move from a 2-line claim title to a 1-line topic title plus a 1–2 line subtitle. The v4 prototype and its stress deck are updated to match before the quality matrix baseline is approved. Section dividers stay available in both styles but are rarely useful in pitch.

### 3.2 Layouts

| Layout | Areas | Geometry |
|---|---|---|
| `split` | `main` (⅔ left), `side` (⅓ right) | fixed column widths on the 12-col grid |
| `full` | `main` | full body width |
| `row` | `items` (2–4 cards) | equal columns |
| `cover` | none (title, subtitle) | frame variant |
| `section` | none (title, subtitle; number derived) | frame variant |

### 3.3 Blocks

| Block `kind` | Fields (summary) | v4 origin |
|---|---|---|
| `chart` | bars/lines, categories, series (color focus/neutral/contrast, line, area, dashed), format | split, chart |
| `table` | columns (num, focus), rows (cells, cell notes, muted/total) | table |
| `notes` | 2–4 items: title, text, `point` → a data point in `main` chart | split |
| `text` | 1–2 paragraphs of markup | hero body |
| `number` | value, caption, tone | hero number |
| `steps` | 2–5 steps: when, title, text, focus | timeline |
| `card` | lead (icon **or** value), title, bullets **or** text, tone, facts; row-level options `framed` | columns, stats, cases |

A block owns its default limits. A layout area may **override** them (a chart in `split.main` allows fewer categories than in `full.main`). Limits are resolved per (style, area, item count): a big value that fits a 2-card row may not fit a 4-card row.

`card` covers three looks (icon-led columns, value-led stats, framed 2-card contrast). Its variants × 2–4 cards are enumerated explicitly in the quality matrix; they are the real size of `cards`.

### 3.4 The menu (allowed combinations)

Generated from the registry; this is everything the agent can choose. Each entry is a **key component**: what the slide is built around (D16). Ids name the content, not the layout, because the agent never sees layouts. Some entries have two layout variants chosen by code from the content.

| Menu id | Layout (internal) | Use when |
|---|---|---|
| `chart` | `full` (chart); **`split`** (chart + notes) when `notes` are present | data over categories or time |
| `table` | `full` (table); **`split`** (table ≤ 4 columns + notes) when `notes` are present | exact figures to compare |
| `number` | `split`: text / big number | one number proves the argument |
| `steps` | `full`: steps | a plan, roadmap, process or history |
| `cards` | `row`: 2–4 cards | parallel options, pillars, several independent numbers, or a 2-card contrast |
| `cover` | frame variant | first slide, once |
| `section` | frame variant | dividers in decks of 8+ slides |

**Why notes are a field, not a separate entry:** in the M0 routing bake-off, "chart with notes or without" was the largest source of routing errors. Whether a chart needs explaining is a writing decision, so it belongs to the model that writes the content (GLM), guided by the template card: "add notes only if each one says something the chart does not already show; in pitch, prefer none". With notes as a field, every router scored 90–94% (13).

Adding an entry or a variant (e.g. an `image` entry later) = one registry line + its quality-matrix pass. Every new entry is a design decision, not a free extension.

### 3.5 Slide JSON: the agent sees templates, never layouts

Layouts and areas are **internal**. The agent writes the menu id plus fields **named after the content**; the registry maps each menu entry to its layout and areas. There is no `layout`, `main`, `side` or `kind` for the agent to get wrong, and a field that does not belong to the chosen entry does not exist in its schema.

```json
{
  "template": "chart",
  "kicker": "Unit economics",
  "title": "[[Interchange]] catches up with interest by year 4",
  "chart": { "format": "£{v}m",
             "categories": ["Y1", "Y2", "Y3", "Y4"],
             "series": [{ "name": "Interchange", "mark": "bar", "color": "focus", "values": [0.3, 2.2, 11, 36] }] },
  "notes": [ { "title": "Interchange compounds", "text": "Spend grows **3×**.", "point": { "series": 0, "index": 3 } } ],
  "takeaway": "Spend, not lending, makes the book profitable.",
  "source": "FinBridge model, base case."
}
```

Registry entry (internal): `chart: { variants: [ { when: "no notes", layout: "full", areas: { main: "chart" } }, { when: "notes", layout: "split", areas: { main: "chart", side: "notes" } } ] }`. The variant is chosen by code, deterministically, from the content; fit limits are resolved for the chosen variant (a chart with notes allows fewer categories). Cross-area references go notes → chart only; the validator resolves them and errors with ranges.

Lego inside, templates outside: blocks and layouts are reused across entries in code, while the agent chooses among a small closed set of finished templates.

### 3.6 Layout rules (code-owned)

Spacing, sizing and alignment follow consulting formatting practice and are **never in the slide JSON**: the agent cannot set a width, an alignment or a gap, and a patch to such a path is a shape error. Found in the v5 prototype: table columns sized by their content (auto layout), right-alignment only when the agent remembered `num`, a body gap of 36, 56 or 72 px depending on the template, and holes under short tables.

| # | Rule |
|---|---|
| L1 | **Table columns.** The first (label) column is sized to its longest label, within 20–40% of the table width; every other column has exactly the same width (fixed table layout). |
| L2 | **Alignment is derived from content, not written.** Label and text columns align left; numeric columns align right with tabular figures, so the digits line up; a header aligns like its column; short symbol columns (✓, –, ratings, 3 characters or fewer) are centred. Cells are top-aligned, so wrapped text reads from the top and single-line values share a baseline. The `num` flag is removed from the schema. |
| L3 | **One body line.** The body starts at the same y on every content slide of a style, whatever the title, kicker or subtitle length: top padding + the head's reserved height (3.1) + one gap token (consulting 56 px, pitch 72 px), which is y ≈ 349 in consulting and y ≈ 384 in pitch. A fixed gap under a variable head is not enough: it moves the body by a line whenever the title or subtitle wraps. |
| L4 | **Grid, not centring.** Body blocks start at the left edge of the 12-column grid and at the body offset (L3), so content starts at the same place on every slide. Only `cover`, `section` and the big number of `number` are centred. |
| L5 | **Small content grows first, then is flagged.** When the body fills under 60% of its area, code first grows it within limits: table rows gain padding up to a maximum, cards stretch to the body height, charts always fill their area. A narrow table (2 columns, or short cells) is capped at 2/3 of the content width, not stretched across the slide. If the body is still under 60% of its area, the write returns a fit issue: `body: 45% empty below the table; add notes or a takeaway, or use a number or cards slide`. |
| L6 | **Parallel items share a size.** Cards in a row have equal width and equal height; steps have equal row height; notes share one width. |

## 4. Fit engine (deterministic)

### 4.1 Inputs

1. **Fonts**, self-hosted (the exact files the renderer loads): Archivo variable (the `wdth` and `wght` axes v4 uses: condensed 800/900), Geist 400/500/600/700, Geist Mono. A build script records each font's character coverage (cmap).
2. **Slot geometry**, declared as constants in TypeScript: for every text slot `{ width, font, weight, stretch, size, lineHeight, letterSpacing, wordSpacing, transform, maxLines }`, per style. For every area: a height budget in px and, for growing blocks (charts), a minimum height.
3. **A feature lock**: one list of OpenType features (kerning on, ligatures off, tabular numbers) used by both the generated CSS and the shaper.
4. **The slide JSON.**

The CSS for slots is **generated from the geometry constants and the feature lock** (CSS variables plus pinned `font-kerning`, `font-variant-ligatures`, `font-variant-numeric`, `hyphens: none`, `overflow-wrap: normal`), never hand-written, so the renderer cannot drift from the maths.

### 4.2 Calculator

A pure function `fit(slide, style) → { ok, issues[], computed }`:

- **Text preparation:** one shared markup parser (also used by the renderer) splits text into runs; bold runs use the bold face. Uppercase transforms are applied before measuring (`ß` → `SS`). Any character outside the fonts' coverage (emoji, unsupported scripts) is rejected with a clear message, because fallback fonts differ per machine.
- **Shaping:** each run is shaped with HarfBuzz (WASM, `harfbuzzjs`) at the slot's exact axis values, features and letter/word spacing. HarfBuzz is the shaper Chrome uses, so widths match to sub-pixel precision. This replaces hand-built width and kerning tables, which would be wrong for a variable font.
- **Line breaking:** greedy, at UAX #14 break opportunities (`linebreak` package): spaces, after hyphens and dashes, after `/`; never inside a no-break space. A single word wider than the slot is a hard error (long URLs, very long numbers).
- `text-wrap: balance` is allowed on titles (it never increases line count in Chrome). `text-wrap: pretty` is allowed in body text only where the calibration test shows it does not change line count; otherwise it is off.
- **Heights:** sums per area (lines × line height + fixed paddings and gaps) and compares with the area budget. The head has a fixed height (3.1), so the budget depends only on the takeaway being present or not; title and subtitle are checked only against their line limits. The footnote/source rail lives inside the bottom padding and does **not** reduce the body budget; it has its own 2-line limit. Growing blocks (charts) must keep their minimum height.
- **Auto-sizes:** e.g. a row of big values shrinks together, to 75% at most. These are computed here and returned in `computed`; the renderer receives them as props and never measures.
- **Tolerance:** an absolute tolerance (about 1 px, set by calibration) absorbs Chrome's 1/64 px layout rounding. Not a percentage.
- **Messages** are written for the model, with the fix: `title: 3 lines, max 2 (about 14 characters too long)`, `side: 38px over budget; drop one note's text or the takeaway`.

It runs in milliseconds, in the browser, in Node and in tests.

### 4.2a Charts

Chart text uses the same calculator. The collision rules are design decisions settled in M1, before the chart block ships:
- category labels: a maximum count and length per area, and what happens when labels don't fit (fewer labels, or an error);
- value labels: hidden when the bar is narrower than its label;
- end labels on line charts: stacked when two series end at similar values;
- stacked bars: segment labels hidden when a segment is shorter than its label, total shown above the stack;
- mixed bars and lines: the line scale and its labels must not collide with bar value labels.

### 4.3 Three lines of defence

| Layer | Runs | Role |
|---|---|---|
| 1. Guardrails | in `get_schema` output and zod | Character and item limits so the first attempt usually fits. **Computed from the geometry**: characters per line = slot width ÷ the letter-frequency-weighted average character width, times max lines. Shown to the agent as "≈52 characters per line × 2 lines". Item counts come from area budgets. The guardrail is a hint; the calculator decides |
| 2. Fit calculator | on every `create_slide` / `update_slide` | Deterministic pass/fail. **This is the guarantee.** A slide is saved only when layers 1 and 2 pass |
| 3. Calibration | CI only | Playwright renders the stress set plus a seeded set of ~1,000 random slides and compares Chrome's actual line counts and area heights (via `Range.getClientRects()`) with the calculator's prediction. **Any case where the calculator says "fits" but Chrome overflows fails the build.** Cases where the calculator is stricter than Chrome are counted against a small false-reject budget. A model-based visual review can be added here later |

## 5. Quality matrix

Layouts and blocks must look right across every configuration they allow, not only fit.

- **Axes:** menu entry and layout variant (`chart` and `table` with and without notes; `cards` expanded into its card variants × 2–4 cards) × frame options (kicker / takeaway / footnote+source on or off = 8) × content amount (min / typical / max) × style (2). Generated from the registry and a seeded content generator per block. Palette is not an axis: it changes no geometry. It is covered by the visual baseline only.
- **Automatic geometry lints on every render:** no overlap or area escape; alignment to the 12-col grid; gaps within min/max (no large empty holes on sparse slides); centred content within 1 px; no single-word last line in multi-line body text. Also L1–L6 (3.6): equal data column widths within 1 px, body offset within 2 px of its token, the body fill ratio. These are checked by rendering, not by the calculator.
- **Visual baseline:** about 100 representative renders (every entry at min and max, both styles, both palettes) on a contact-sheet page. The product owner approves them once; later changes show as screenshot diffs to approve.
- **Rule:** a layout, block or menu entry ships only when its whole matrix passes.

## 6. Design checks

Fit guarantees a slide renders correctly; design checks judge whether it is **good**. They run after every save and appear as a checks list on the slide (✓ / ⚠ with a one-line reason). For now they are shown to the user only; a later **Get advice** action sends failing checks to the agent to revise. They never block saving.

Two kinds, both cheap:

**Rule checks** (deterministic, free, in `src/slides/checks/rules`):

| Id | Check | Styles |
|---|---|---|
| R1 | Title within its line limit (consulting ≤ 2, pitch 1); from the fit calculator | both |
| R2 | Action title has at least 5 words | consulting |
| R3 | Pitch title is a topic of at most 3 words; the claim lives in the subtitle | pitch |
| R4 | Exactly one focus element (series, card, step, column); if there is one, the title highlights a word with `[[…]]` | both |
| R5 | Numbers carry units (%, currency, ×, k/m/bn), except years and counts in labels; chart `format` has a unit | both |
| R6 | Takeaway does not restate the title (word overlap < 60%) | both |
| R7 | Parallel items are balanced: longest ÷ shortest text in a row of cards, notes or steps ≤ 2.5 | both |
| R8 | A slide with figures has a `source` | consulting |
| R9 | Chart guide: series with the same format share one mark unless one is dashed (a reference); at most two formats; `stacked` only with 2+ bar series of one format | both |
| R10 | Rule of three: 3 parallel items (cards, notes, bullets in a card) is the default; 2 cards are fine for a contrast; 4 warns ("merge or cut to 3"). Notes are 3 or none in both styles (2026-09-28): 2 notes fail with "delete the notes, or add a third", since the title and takeaway already carry a pair. Steps are a sequence and are exempt | consulting (notes: both) |
| R11 | Every figure in the title, subtitle or takeaway appears in the body, or is derived from two body values within rounding (a difference, ratio or growth rate) | both |
| R12 | A consulting slide with figures has a figure in its title (the so-what is quantified) | consulting |
| R13 | Consistent precision: within a series, a table column or a row of value cards, one unit and one number of decimals; no false precision (at most 3 significant digits on a slide, e.g. £9.8m, not £9,837,221) | both |
| R14 | Order: time runs oldest to newest, left to right and top to bottom; bars and table rows that are not time are sorted by value, largest first, with a total row last (a warning: the user may have given the order on purpose) | both |

**Judgment checks** (Jev, one typed decision each, ~100 ms; a check fails only when Jev's probability for a failing value is ≥ 0.7, to keep noise down):

| Id | Question to Jev | Values | Styles |
|---|---|---|---|
| J1 | Is the title an action title (states a so-what) or a topic label? | `action` · `topic` | consulting |
| J2 | Does the body support the title's claim? | `supported` · `partly` · `unsupported` | both |
| J3 | Are the parallel items (cards, notes, steps) MECE with respect to the title? | `mece` · `overlap` · `gap` | consulting |
| J4 | Does the focus element (highlighted series/card/step) match what the title claims? | `matches` · `mismatch` | both |
| J5 | Does the takeaway add an implication, or restate the slide? | `adds` · `restates` | both |
| J6 | Does the slide carry one idea, or several? | `one` · `several` | pitch |
| J7 | Is the chosen menu entry right for this content? | `right` · `better:<menu id>` | both |
| J8 | Are the parallel items written in the same form (all noun phrases, all verbs, all outcomes)? | `parallel` · `mixed` | consulting |

**Deck checks** (M3): D1 the titles read in order tell one argument (`flows` · `gaps`); D2 the first content slide states the answer (Pyramid Principle, consulting).

Checks live in a registry like the menu: id, styles, kind (rule/judgment), function or Jev prompt + values, message. Adding a check is one entry. Each Jev check is calibrated on a small labelled set (about 30 good and bad examples) before it is switched on.

## 7. Runtime

```
Browser                                                     Vercel
Chat UI → Agent loop ── model call ──────────────────────→  /api/llm (proxy, holds keys,
            │  tool calls                                   │        spend cap, model allowlist)
            ▼                                               │        ├→ GLM 5.3 Flash (subscription endpoint)
          Tools: validate (zod) → fit (calculator)          │        └→ OpenRouter: Jev only
                 → save (IndexedDB) → design checks ────────┘            (later: image models)
            │
          Deck store → <Slide> components (thumbnails, editor, full view, presentation)
```

- One model interface: OpenAI-compatible chat with tool calls, behind the proxy. Replaces the current Gemini/Claude factory and the exposed `VITE_*` keys.
- **The proxy enforces routing** with an allowlist: GLM goes to the GLM subscription endpoint; OpenRouter accepts only Jev model ids (later: named image models). Any other model id is rejected.
- **Jev** makes every closed-set decision: the intent, template and choices before the agent runs, icons in the write path (9.1), and the judgment checks before the reply shows (6).
- Because fit needs no DOM, the loop can move server-side later without changing the fit engine.
- Stored slides carry a `fitVersion`. When geometry or fonts change, slides saved under an older version are re-checked on load, and any that fail are flagged.
- Fonts use `font-display: block` so thumbnails never render with fallback metrics.

## 8. Presentation mode

The slide canvas is fixed (D12), so presenting is the same components scaled to the screen with letterboxing. Modelled on Slidev:

| Action | Keys / control |
|---|---|
| Next / previous slide | → ↓ Space PgDn / ← ↑ PgUp; click the right or left half |
| First / last | Home / End |
| Go to slide | type the number, then Enter |
| Full screen on / off | F (Fullscreen API) / Esc |
| Overview grid | O: all slides as thumbnails; click or arrows + Enter to jump |
| Deep link | URL `#/7` opens slide 7; the hash updates as you move |

- **Present** button in the deck view opens it; Esc returns to the same slide in the editor.
- No transitions (restraint), except a 150 ms fade when leaving the overview grid.
- The next slide is pre-rendered so switching is instant.
- Later: presenter view (current + next slide, speaker notes, timer) in a second window.

## 9. Agent architecture

**Revised 2026-09-26: hybrid agent.** The MVP agent (one GLM loop, whole-slide writes) kept every figure and held a conversation, but was slow (p50 17.4 s vs the fixed pipeline's 11.8 s) and rewrote the whole slide for every change. The hybrid optimises for **speed and reliable changes**. It keeps the agent loop, history and replies from the MVP, and brings back from the fixed pipeline the cheap steps that worked: a Jev step before the agent, Jev for every closed-set choice, and Jev judgment checks after the turn. Existing slides change only through **path patches**: code applies them exactly where the agent points and keeps everything else byte for byte. MVP results: `docs/research/2026-09-26-agent-single-slide/`. Design page: https://claude.ai/artifact/5yap5PKhXADV2T2xQYpgRA

### 9.0 The turn

```
User message
  → PRE (code + Jev, one call): intent · template · card lead · position of a new slide
      intent sure (p ≥ 0.7, or new_slide into an empty deck) → code makes the first tool call itself:
        new_slide        → create_slide (template, card lead and position already decided)
        edit_selected    → the selected slide joins the working set
        change_template  → create_slide with replace = selected slide
        ask              → nothing; the agent asks one question
      otherwise → nothing; the agent starts from the request
  → agent (GLM 5.3 Flash) with: system · tools · history · working-slides block (last)
  → loop: call a tool → read its result → repeat
      text over its limit → shortened inside the write by small GLM calls (9.4), not by another agent step
      a write that comes back clean (applied, no issues) ends the turn:
        with its `reply`, or, when PRE was sure and the step only wrote, with a short reply written by code
  → reply to the user
  → POST (Jev, one call, before the reply shows): judgment checks J1–J8 on each slide written this turn; up to two failed checks join the reply
```

Target model calls: clean new slide = 1 Jev + 1 GLM; clean small edit = 1 Jev + 1 GLM; an over-long field adds one small GLM call (2 in parallel, hedged); other issues add 1 GLM per fix round.

**Revised 2026-09-27 (speed):** the reply call, over-long text and a growing context were most of the time in a turn (`docs/research/2026-09-27-hybrid-agent-2/`). Code now ends a sure turn on a clean write with a factual reply ("Added a chart slide. Showing Revenue as bars; ask if you want it the other way."); text over its limit is shortened by a small, context-free GLM call per field, kept only if it fits and every figure it drops still appears elsewhere on the slide; and the history and working set are kept small (9.3).

Calls made by code in PRE go into the history as ordinary assistant tool calls and tool results, so the agent reads them exactly as if it had made them. The agent can overrule PRE: call `create_slide` again with another template, or work on a different slide.

### 9.1 Who decides what

| Decision | Decided by | How |
|---|---|---|
| intent of the message | Jev, in PRE | options below; acted on only at p ≥ 0.7 |
| template of a new slide or a template change | Jev, in PRE (or inside `create_slide` when the agent calls it) | picking guide (9.2); skipped when the user named the kind of slide |
| card lead (icon, value, framed) | Jev, in PRE, together with the template | sent to the agent as `decided` in the `create_slide` result; the agent writes it as given |
| where a new slide goes | Jev, in PRE | options: the deck's slide ids and `end`; sent as `after` |
| **per series: bar or line** (`chart.series[i].mark`) | Jev, in the write path | each series decides separately: a chart can mix bars and lines. The agent writes `"mark": "auto"`; Jev answers one question per series ("a size compared across categories → bar; a trend, rate or ratio over time → line") |
| **stacked bars** (`chart.stacked`) | Jev, in the write path | `"stacked": "auto"`: stacked when the bar series are parts of one whole (revenue by segment), side by side when they are compared (us vs a competitor) |
| icons | Jev, in the write path | `"icon": "auto"` |
| **focus element** (which series, card, step or column stands out) | Jev, in the write path | `"focus": "auto"` on the slide; Jev answers "which item is the title's claim about?" with the actual items as options; code sets `color`/`tone`/`focus` on the one picked and neutral on the rest |
| any choice the user names ("make revenue bars and margin a line", "stack them", "use a rocket icon", "highlight 2025") | agent | writes the concrete value; code never overrides a concrete value, and a later `auto` elsewhere does not touch it |
| tone `neg`, table row `muted` | agent | rare, and they depend on the message |
| table row `total` | code | a row labelled Total, or whose values are the column sums, gets `style: "total"` |
| all text, numbers, data, the highlighted words in the title | agent | against the template card |
| all text, numbers, data | agent | against the template card |
| trivia (quotes, `Source:` prefix, `percent`, full stop on a consulting title) | code | autofix; reported, never changes meaning |
| whether a write is applied | code | shape errors: not applied; fit and quality issues: applied and reported |

PRE intents: `new_slide` (one new slide) · `edit_selected` (change the selected slide) · `change_template` (show the selected slide as another kind) · `several_slides` · `ask` (too unclear to act on: the agent asks one question) · `other` (a question, chat, a deck operation). Only the first three trigger a code call; `edit_selected` and `change_template` need a selected slide.

**Rule of thumb.** Code when the answer follows from structure or data; Jev when it is a closed set that depends on meaning; the agent when the user named the value or the value is open text. A value the user named always beats `auto`.

**Jev guardrails.** At most one Jev call per write: every `auto` on the slide is one question in the same call (~0.1–0.3 s). Below p 0.6 the style default is used (consulting: bars side by side, icon lead; pitch: value lead). What Jev picked and its probability come back in `resolved`, so the agent can overrule a pick with a concrete value.

**Chart schema change (required before the build).** `chart.type` and the one-series `line` flag are replaced by a mark per series and a stacking flag:

```json
"chart": { "stacked": false, "categories": ["2022", "2023", "2024"], "format": "£{v}m",
  "series": [ { "name": "Revenue", "mark": "bar",  "values": [2.1, 4.8, 9.8] },
              { "name": "Margin",  "mark": "line", "values": [12, 19, 27], "format": "{v}%" } ] }
```

- `mark`: `bar` · `line` · `auto`. All bars = a bar chart; all lines = a line chart (end labels, `area`, `dashed`); mixed = bars on the main scale and lines on their own scale when their format differs.
- `stacked`: `true` · `false` · `auto`; applies to the bar series only, needs 2+ bar series with one format.
- Series `color` is set by the focus decision; `area` and `dashed` stay line-only.
- The v5 renderer, the fit limits and the quality matrix (5) gain the mixed and stacked cases.

**Chart guide** (one text in the registry: part of the `chart` template card, so the agent has it when it writes or edits a chart, and the instructions of Jev's mark and stacking questions):
1. **Comparable series share one mark.** Series that measure the same thing in the same unit (our revenue vs a competitor's, revenue by segment, three scenarios) are all bars or all lines.
2. **Bars for sizes, lines for trends.** Bars compare sizes across categories or a few periods (up to about 6); lines show a trend over many periods (7 or more), forecasts and scenarios.
3. **A different unit can be a line over bars.** A series in another unit (a margin % or a growth rate over £m revenue) is drawn as a line on its own scale over the bars. At most two units per chart; a third unit needs another slide.
4. **A reference series can differ.** A target, benchmark or average in the same unit may be a dashed line over bars: it is a reference, not a comparable.
5. **Stack only parts of a whole.** Stack bar series when they add up to a total that matters (revenue by segment); keep them side by side when the point is comparing them (us vs them). Never stack rates or percentages that do not sum to a whole; lines never stack.
6. **Pitch: fewer series.** One series, two at most.
7. **Edits keep the rules.** When the user switches one series of a comparable group ("make revenue a line"), switch the whole group and say so in the reply, unless the user said only that series. When a new series in another unit is added to a bar chart, make it a line.

### 9.2 Picking a menu entry

1. **Classification.** Jev scores the 7 ids with the picking guide in its instructions; the top one is used. In PRE this is one question in the same call as intent, card lead and position (card lead is used only for `cards`). The probabilities are returned to the agent; when they are close, the agent may call `create_slide` again with the other template. Later: two variants for the user to pick (14).
2. **Picking guide** (in the agent's system prompt and in Jev's instructions). Answer in order and stop at the first match:

| # | If the content is… | Use |
|---|---|---|
| 1 | a title, cover or opening slide the user asked for | `cover` |
| 2 | a divider the user asked for, or the start of a new part in a deck of 8+ slides | `section` |
| 3 | one number that proves the argument (a size, a cost, a gap) | `number` |
| 4 | data over categories or time (a series): a trend, a comparison of sizes, a crossover | `chart` |
| 5 | exact figures the reader needs to compare | `table` |
| 6 | a sequence in time: plan, roadmap, process, history (2–5 steps) | `steps` |
| 7 | 2–4 parallel things: options, pillars, features, several independent numbers, or a two-way contrast | `cards` |

Tie-breakers, stated to the agent and to Jev:
- **Chart or table?** Chart when the point is a trend, a comparison of sizes or a crossover; table when the reader needs the exact values.
- **Notes** are not a routing decision; the agent adds them when writing (template card rule: only if each note adds something; in pitch, prefer none).
- **Cards: icon or value lead?** Value when every card has a number worth showing; otherwise icon. Consulting defaults to icons, pitch to values. Framed for a two-way contrast (them vs us, before vs after): 2 cards, one tone `neg` and one `focus`.
- When in doubt, pick the entry with **fewer words**.

### 9.3 Agent context

| Layer | Contents | Changes |
|---|---|---|
| System | role; hard rules; markup; style rules; the 7 templates, one line each; tool rules (patch existing slides, full JSON only for a reserved slide, `auto` for series marks, stacking, focus and icons unless the user named the value; `reply` on the write) | never within a deck |
| Tools | the 4 tool definitions (9.5) | never |
| History | user messages (each prefixed with the deck state: style, theme, `1. s_a1 [number] The problem` per slide, selection), agent messages, tool calls and results. Template cards arrive here through `create_slide` / `read_slide`. **Write results carry no slide JSON**, only what changed and the issues. | grows; Clear chat empties it |
| **Working slides** | the current JSON of every slide in the working set, each with its template, open issues, warnings and last judgment checks | rebuilt by code before **every** model step and sent as the last message; never stored in history |

**Working set:** starts each turn with the selected slide only; slides created, read or patched in the turn join it. When the turn creates a slide, slides not read or written in this turn leave it, so an earlier slide's data and open checks cannot leak into the new one. Clear chat empties it (the deck stays). **History:** after each turn, template cards and examples are removed from `create_slide` results and whole-slide JSON from `edit_slide` calls; the working-slides block has the current JSON. Because the block is rebuilt in place and always last, the agent always sees exactly one, current copy of each slide it works on; there are no stale versions in history to confuse it in long sessions, and the history prefix stays cacheable.

### 9.4 Problems and fixes

- **One problem format everywhere:** field path · what was measured · the limit · a concrete fix. `cards[2].text: 3 lines, max 2, about 22 characters too long.`
- **Shape errors** (unknown or missing field, wrong type, a bad path, 4 values for 5 categories) cannot render: the write is **not applied** (a patch is all or nothing); the agent gets the errors.
- **Fit issues** (measured at 1920×1080) **are applied**, so the user sees the change, and returned as `issues`.
- **Over-long text is shortened in the write path.** Issues that name a text field over its limit (a character limit, a total over notes or bullets, a title, subtitle or takeaway on too many lines) go to one small GLM call per field with no deck context, two in parallel with the first valid answer kept. A rewrite is kept only if it fits and every figure it drops still appears elsewhere on the slide; otherwise the issue goes to the agent as before. At most 2 rounds.
- **Chart choices stay with code.** On a new slide, series marks and stacking the user did not name are set to `auto` whatever the agent wrote; Jev resolves them with the user's request in its state. A series a patch adds takes the mark of an existing series in the same unit.
- **Every write re-checks the whole slide**, not only the patched paths: autofix → validate → resolve `auto` (Jev) → measure → rules R1–R14. Issues on paths the patch did not touch come back in a separate `elsewhere` list, so the agent sees knock-on effects (a longer title that now takes 3 lines, a removed category that a note still points at) and decides whether to patch them too.
- **Rule checks R1–R14** come back as `warnings`: the agent sees them, it is not required to act.
- **Judgment checks J1–J8** (spec 6) run in POST, once per turn, before the reply shows (one Jev call, about 0.5 s of wait). Code adds up to two failed checks (judgment first, then rules) to the reply as a "Worth a look" line before its closing question; the history keeps the reply as shown. They are also shown on the slide and appear in the working-slides block on the next turn. Advisory: the agent does not fix them unless the user asks. (Revised 2026-09-27; before, they ran after the reply.)
- **Code fixes trivia and reports it** (never meaning). Also misplaced fields with one right place: `focus` written inside `chart` or `table` moves to the slide; a card row with no lead gets `icon: "auto"`. The first table column's header is optional.
- **Code fixes dependent fields instead of reporting them.** When a rule spanning several fields has one right answer, code applies it in autofix and lists it in `autofixes`: a chart whose series are all lines loses its note points; `stacked` goes off when fewer than 2 bar series remain; `area`/`dashed` are dropped from bar series; a removed category drops the note points that referred to it; a second focus the user did not name is set back to neutral. Only rules with a choice left in them come back as issues. This is the main lever for first-write validity: what the model cannot get wrong it is not asked to get right.
- Measurement is deterministic (fixed 1920×1080 canvas, fixed fonts): the prototype uses the browser as its ruler; the product uses the fit engine (4).

### 9.5 Tools

| Tool | Input | Inside | Output |
|---|---|---|---|
| `create_slide` | `about` (the content, the user's words kept) · `after`: slide id or `"end"` · `template?` (only when the user named the kind) · `replace?`: slide id, for a template change | Jev classification (skipped when PRE already decided or `template` is given); reserves the slide id (or keeps it, for `replace`) | `slideId` · `template` · `probabilities` · `decided` (`{ "cards.lead": "value" }`) · `card` · `example` |
| `edit_slide` | `slideId` · `slide`: the full slide JSON · `reply?` | **only for a slide `create_slide` reserved this turn** (new, or `replace`); anything else is refused with a pointer to `patch_slide`. Write path (9.4). | `applied` · `issues[]` · `warnings[]` · `autofixes[]` · `resolved` (the `auto` values Jev picked) |
| `patch_slide` | `slideId` · `set`: `{ path: value }` · `reply?` | apply every path to the stored slide (all or nothing), then the write path (9.4) on the whole slide | `applied` · `changed[]` (paths) · `issues[]` · `elsewhere[]` · `warnings[]` · `autofixes[]` · `resolved` |
| `read_slide` | `slideId` | adds the slide to the working set | `template` · `card` |

**Paths** follow the slide JSON: `title`, `takeaway`, `chart.stacked`, `chart.series[0].mark`, `chart.categories`, `chart.series[1].values`, `chart.series[1].values[3]`, `cards[2]`, `cards[2].title`, `notes[0].point.index`.
- A value replaces what is at the path (a whole object or list when the path names one).
- `null` removes a field, or removes an item from a list (later items shift down; several removals in one patch apply from the highest index down).
- An index equal to the list's length appends an item.
- A path must exist in the template card; an unknown path or an index past the end is a shape error naming the valid paths or range.
- Reordering items or restructuring the whole slide is a patch of the whole list (`"cards": [...]`), not a full rewrite.

**`reply`:** a write may carry the reply to the user. If the write is applied with no `issues` (warnings allowed), the turn ends there with that reply and no further model call. Otherwise the reply is dropped and the loop continues. When PRE was sure (new slide, edit of the selected slide, template change) and a model step only wrote and came back clean, code ends the turn even without `reply`, with a short factual reply of its own.

**Schema enforcement.** The GLM endpoint does not enforce schemas: `response_format: json_schema` and `strict` tools are accepted and ignored, and `tool_choice: "required"` is not enforced (probe, 2026-09-27). GLM does follow tool schemas well in practice. So:
- **One schema source**: the zod registry generates the template cards, the validator, the error messages and the JSON Schema of every tool parameter (enums, required, `additionalProperties: false`), so they cannot disagree.
- The tool list stays fixed for the whole conversation (a per-template tool would break the prompt cache); the template's exact schema reaches the agent through its card.
- Enforcement is the write path: validate → precise error (path, value, limit, valid values, fix) → the agent retries. Fewer fields to write (patches, `auto`, code-owned dependent fields) is what raises first-write validity.

- A slide reserved by `create_slide` appears on the canvas with its first applied `edit_slide`; a reservation never written in the turn is dropped.
- **Ids:** slides get stable ids (`s_` + 4 characters) that survive template changes. The user's component selection is passed as a path (`cards[2]`), which the agent can use directly in `patch_slide`.
- **Guards:** unknown slide id → an error listing the valid ones; objects sent as JSON strings are parsed; at most 10 tool calls per user turn, then the agent replies with what is left; the turn must end with a reply.
- The agent never sets style, page or section numbers, footer text on slides, or layout geometry.

### 9.6 Evaluation harness (built first)

Built at the start of M1, before the UI, and run on every change to a prompt, template, limit or model:
- ~50 prompts per style through the whole agent (the routing bake-off set plus fill and edit cases).
- Tracks: routing accuracy · valid on first write · fix rounds (p95) · drift on patches · rule checks passed · Jev judgment scores · latency · cost.
- A change that lowers any of these beyond a set tolerance fails CI.

### 9.7 Dropped, and the test for the hybrid

**Still dropped.** Add back from this list, with the evidence that called for it:

| Dropped | What it did | Add back if |
|---|---|---|
| Component metadata | per-component area (full, 2/3, 1/3), limits, usage ("93 of 72"), allowed options | the agent keeps overfilling small areas |
| GLM 5.3 retry ladder | retried a malformed step on the larger model | Flash tool calls often fail twice |
| Parallel slide creation (`create_slides` from an outline) | several slides at once | multi-slide requests are too slow |
| Two variants when classification is unsure (14) | both top templates for the user to pick | routing below 0.7 is common and often wrong |
| Fresh-context writer (the pipeline's filler) | one card, one example, short prompt | first writes degrade in long conversations even with the working-slides block |
| History trimming | smaller context | cost or latency require it |
| `delete_slide`, `move_slide`, `set_deck`, undo snapshots | deck operations | users ask for them |

**Brought back from the pipeline** (were dropped for the MVP): Jev before the agent (intent, template, card lead, position), Jev for closed sets in the write path (series marks, stacking, focus, icons), the convert step (now code fixing dependent fields, 9.4), Jev judgment checks per turn, component path addressing (`patch_slide`).

Considered and rejected: all 7 template cards in the system prompt with no classification step; whole-slide rewrites for edits (slower, and they let unrelated parts drift).

**Test for the hybrid** (against the recorded MVP and pipeline runs in `docs/research/2026-09-26-agent-single-slide/`):
- The same 30 single-slide requests and the two long sessions (10 warm-up turns, then 5 measured).
- **15 surgical edits** on existing slides (one word, one value, one series, a card added or removed, a choice named by the user such as one series switched to a line or bars stacked, an edit whose knock-on effect needs a second patch).
- **Jev choices** against labelled answers: series mark, stacking and focus on the chart requests; accuracy ≥ 90%.

| Measure | Pass |
|---|---|
| Every request number on the slide | ≥ 95% |
| First write shape-valid, long session | ≥ 90% (MVP 70%) |
| Ends with no fit issues | ≥ 95% |
| Paths changed outside the ask (drift), edits | 0 |
| Latency p50, new slide | ≤ 13 s (MVP 17.4 s, pipeline 11.8 s) |
| Latency p50, small edit | ≤ 6 s |
| Template agrees with gold | ≥ 90% |
| Short reply, no JSON | ≥ 95% |
| Layout lints L1–L6 on every final slide | 100% |

Reported: PRE intent accuracy and how often it acted, model calls per turn, turns ended by a write's `reply`.

## 10. Code structure

```
src/slides/
  geometry/      no React. slot and area constants per style, feature lock, CSS variable generator
  markup/        the one markup parser (runs), shared by fit and render
  schema/        no React. zod blocks (factory per area/style), frame, menu registry,
                 limits (computed from geometry), validate (cross-area rules),
                 describe (→ agent docs + JSON Schema)
  fit/           HarfBuzz shaping, UAX #14 line breaker, calculator, coverage check
  render/        Slide (frame + rail), layouts/{Split,Full,Row,Cover,Section},
                 blocks/{Chart,Table,Notes,Text,Number,Steps,Card}, Block dispatch, theme tokens
  chart/         shared chart engine (scales, SVG shapes, HTML labels)
  checks/        rules (deterministic), judgment (Jev prompts + values), registry
  present/       presentation mode (navigation, full screen, overview, deep links)
  agent/         agent loop, context (system, state block, history), tools (9.5),
                 classification (Jev), write path (autofix, validate, measure), template cards + examples,
                 Jev client, GLM client
  eval/          labelled prompts, harness, reports
  deck/          store (IndexedDB), derived numbering
  quality/       content generators, stress set, matrix page
public/fonts/    self-hosted font files (the same files the shaper loads)
scripts/         build-font-coverage
api/llm.ts       Vercel proxy (GLM endpoint + OpenRouter for Jev only, model allowlist)
tests/           unit (schema, fit), browser (calibration, matrix lints, visual baseline)
```

Types come from `z.infer` only. Geometry constants feed both the calculator and generated CSS variables.

## 11. Milestones

| Milestone | User outcome | Build |
|---|---|---|
| **M0: spikes** | — | **Routing bake-off:** Jev vs GLM 5.3 Flash picking the menu entry on 100 labelled prompts; sets the router threshold (13). **Fit spike:** HarfBuzz shaping + UAX #14 breaking for the title slot (Archivo variable, both styles) and one Geist body slot; compare with Chrome on ~1,000 seeded strings, including hyphens, dashes, bold runs and uppercase. Go/no-go on D4 |
| **M1: one slide** | Prompt → one `chart` slide (with and without notes); edit it by prompt; see its checks; view it full screen | Geometry, markup parser, schema core, fit calculator, frame (both styles), split layout, chart engine (with label collision rules), notes, proxy with routing, agent loop, rule checks + first Jev checks (J1, J2, J4), full-screen view, quality matrix for this entry (both variants), Jev router + GLM fallback, model evaluation |
| **M2: all entries** | Any menu entry, picked automatically | Remaining layouts/blocks, one entry at a time, each with its matrix; Jev router + picking guide; remaining checks; standalone chart block moves to the new engine |
| **M3: decks** | Prompt → storyline → deck; reorder; style and palette; present it | Deck tools, IndexedDB, numbering, style switch (re-validates all slides), deck checks, presentation mode (navigation, overview, deep links) |
| **M4: hand editing + advice** | Edit text on the slide with live fit feedback; "Get advice" on failing checks | Inline editing using the same calculator; checks sent to the agent for revision |

## 12. Risks

| Risk | Mitigation |
|---|---|
| Calculator and Chrome disagree on line breaks | HarfBuzz (Chrome's shaper) + UAX #14; M0 spike; CI calibration; absolute tolerance set by calibration |
| Font loading changes metrics | Self-host exact font files; the shaper loads the same files; `font-display: block`; render waits for `document.fonts.ready` |
| Characters the fonts don't cover | Rejected by the validator with a clear message |
| HarfBuzz WASM size (~500 KB) | Load it lazily on the first slide check; it is cached afterwards |
| Chart labels (category axis, values) overflow | Chart labels measured by the same calculator; category count and label length limits per area |
| Cheap model picks poorly or loops | Jev router + picking guide over a closed menu, resolved schemas, precise errors, 3-retry cap; model evaluation in M1 |
| Judgment checks are noisy | Advisory only; fail threshold 0.7; each check calibrated on labelled examples before it is switched on |
| Style switch invalidates slides | Re-run fit on switch; list failing slides; offer an agent rewrite |

## 13. Model evaluation

**M0 routing bake-off** (Jev vs GLM picking the menu entry; `docs/temp/routing-test/`):
- 100 labelled prompts, 50 per style, written like real requests; ~40% sit on a boundary between two entries (chart with or without notes, table with or without notes, one number vs cards, cards vs steps, chart vs table). Each has a gold entry and, where fair, acceptable alternatives.
- Contestants: Jev with the bare menu; Jev with the picking guide; GLM 5.3 Flash with menu + guide (thinking off); the same with thinking on.
- Measured: strict and lenient accuracy, by style and boundary; confusion pairs; Jev calibration (does its probability predict correctness) and the hybrid curve (Jev above threshold, GLM below); latency; cost.
- Decision rule (set before the run): Jev routes alone if it is within 2 points of GLM; hybrid if it is worse but well calibrated; GLM routes and Jev keeps only closed-set fields and checks if neither holds.
- The labelled set joins the evaluation harness (9.6).

**M1 fill evaluation:**
- **Main model:** GLM 5.3 Flash (subscription, free), the default unless it fails the bar. GLM 5.3 (larger, same subscription) is the escalation model.
- **Jev:** each closed-set field (9.1) and each judgment check is measured for agreement with labelled examples before it is switched on.
- **Test set:** 50 seeded prompts × 2 styles.
- **Pass bar:** first fill passes validation and fit ≥ 80%; p95 fix rounds ≤ 2; zero invented fields; rule checks R1–R14 pass ≥ 90%.
- **Also scored:** judgment checks J1–J5 as quality metrics; latency per slide.

**M0 routing bake-off: results (2026-09-26)** (full report: `docs/temp/routing-test/report.md`)

| Contestant | Strict accuracy | Boundary items | p50 latency | p95 latency |
|---|---|---|---|---|
| Jev + picking guide | 90% | 88% | 0.5 s | 0.6 s |
| Jev, bare menu | 88% | 83% | 0.5 s | 0.7 s |
| GLM 5.3 Flash, thinking off | 88% | 80% | 1.9 s | 3.4 s |
| GLM 5.3 Flash, thinking on | 92% | 88% | 4.7 s | 13.3 s |

- Jev is within 2 points of GLM with thinking, about 10× faster, and costs about $0.00004 per pick. Under the decision rule, **Jev routes**.
- Jev's probability is well calibrated: picks at ≥ 0.9 (about 60% of requests) are 97–98% correct. Jev at ≥ 0.7, with GLM thinking below that (about 20% of requests), reaches 90–94%.
- Most errors are "with notes or without" (chart or table). If that stops being a routing decision, every contestant scores 90–94%. Several remaining "errors" are defensible picks (e.g. a 4-competitor fee comparison as cards rather than a chart).
- Caveats: 100 items labelled by one model and run once, so differences of 1–3 points are noise.
- **Decided (2026-09-26):** notes become an optional field of `chart` and `table`; code picks the split or full layout (3.4). The menu is 7 entries.
- **Decided (2026-09-26):** Jev routes when its top probability is ≥ 0.7 (about 80% of requests); below that, GLM 5.3 Flash with thinking picks. Re-measure the threshold on the 7-entry menu before M2.

## 14. Status and next steps (handoff)

Everything needed to continue is in the repo:

| What | Where |
|---|---|
| Product intent and decisions | `docs/product/PRODUCT_INPUT.md` |
| This spec (architecture, agent pipeline, fit engine, checks, milestones) | `docs/superpowers/specs/2026-09-26-slide-system-architecture-design.md` |
| Approved visual design (prototype renderer, stress mode, two palettes) | `docs/design/proposals/v5/review.html` (v4 reference: `slides-v4.html`; serve the folder: `python3 -m http.server 8765`) |
| Journey prototype (chat → slide → edit → checks → present, real models) | `docs/design/proposals/journey/` (`node docs/design/proposals/journey/server.mjs`) |
| Prototype schema and agent prompt (to be ported to zod; menu to be updated to the 7 entries) | `docs/design/proposals/slides-v4-schema.js`, `slides-v4-agent-prompt.md` |
| Routing bake-off: prompts, menu, scripts, results, report | `docs/research/2026-09-26-routing-bakeoff/` |
| Reference decks | `example_template/` |

**API access (verified 2026-09-26)** (keys in `.env`, names in `.env.example`):
- GLM: `https://api.z.ai/api/coding/paas/v4/chat/completions` (subscription endpoint), models `glm-5.3-flash` and `glm-5.3`, OpenAI-compatible. Thinking is on by default; `"thinking": {"type": "disabled"}` turns it off. Even with thinking off it can emit a few reasoning tokens, so do not cap `max_tokens` below ~400.
- Jev: `POST https://openrouter.ai/api/alpha/decisions`, model `~typesafe/jev-latest`, body `{ model, state, questions: { <id>: { type: "choice", instructions, criteria: { <key>: <description> } } } }`; answer `{ choice, probabilities, confidence }`. Option keys must be plain identifiers.

**Open items before or during planning:**
1. ~~Update the v4 prototype to the pitch frame change and to the 7-entry menu.~~ **Done (2026-09-26):** `docs/design/proposals/v5/` (schema, renderer, examples, gallery). Pitch titles keep the v4 size (150px, max 20 characters); `?stress=1` has 0 issues in both palettes. Deployed at `/proto/v5/review.html`.
   **Journey prototype built (2026-09-26):** `docs/design/proposals/journey/` runs the earlier fixed pipeline (route → decide → fill → gate → repair, before the 9.0 revision) against GLM 5.3 Flash and Jev (live through a local proxy; the deployed `/proto/journey/` replays recorded runs). See its README for results and what they changed.
2. ~~Re-run the routing bake-off on the 7-entry menu to confirm the 0.7 threshold.~~ **Done (2026-09-27):** `docs/research/2026-09-27-routing-7-entry/`. The same 100 prompts were mapped to the 7 entries and run against the journey PRE call as it is (menu and guide imported from `v5/schema.js` and `journey/prompts.js`). Strict accuracy: Jev + guide 91% and 93% (two runs), Jev bare 89% and 90%, GLM 5.3 Flash 92% with thinking off and 93% with it on. Jev took 0.4 s; GLM with thinking had a p50 of 3.0 s. The 16 former "notes or not" items are all correct. Jev is well calibrated: about 80% of requests come back at p ≥ 0.9 and are 99% correct, while the 0.5–0.7 band is right only 50–60% of the time. "Jev at p ≥ 0.7, else GLM with thinking" scores 94% and 93%, the best of the thresholds tested (0.5–0.9). It sends 12–14% of requests to GLM, with a mean latency of 1.2–1.3 s against 4.0 s for GLM alone. **The 0.7 threshold stands.** The weak spot is chart vs table (Jev 57% on those 7 items); the only confident Jev misroutes are p29 (an 8-month KPI snapshot sent to chart at 0.85) and p36 ("what the raise unlocks" as cards, which is acceptable).
3. ~~Build the MVP agent loop (9.0–9.5) in the journey prototype and run the single-slide test (9.7).~~ **Done (2026-09-26):** `docs/design/proposals/journey/agent.js` (default engine; the pipeline stays at `?engine=pipeline`); results in `docs/research/2026-09-26-agent-single-slide/`. Agent vs pipeline: every request number kept 100% vs 93%; first write shape-valid 93%; all slides end fitting; template agrees with the pipeline 28/30; p50 17.4 s vs 11.8 s. Open: latency (model time is ~95% of a turn), schema knowledge in the cards (note points on lines charts, table column labels, bullets vs text), unmarked illustrative figures (two prompt rules added, not yet re-tested).
   **Hybrid designed (2026-09-26):** 9.0–9.7 rewritten for speed and reliable changes: Jev PRE step, Jev for closed-set choices, `patch_slide` with path addressing (existing slides are never rewritten whole), the working-slides block, `reply` on writes, judgment checks after the turn. Next: build it in the journey prototype and run the 9.7 test.
   **Hybrid built (2026-09-27):** `docs/design/proposals/journey/` now runs only the hybrid (the pipeline is removed); results in `docs/research/2026-09-27-hybrid-agent/`. Passes: request numbers kept 97%, first write shape-valid in long sessions 100%, every slide ends fitting, template agrees with gold 97%, layout lints clean 100%, Jev chart choices 6/6; all 15 edits used `patch_slide` only. Fails: latency p50 22.9 s for a new slide (bar 13 s) and 10.1 s for an edit (bar 6 s), with GLM at 97% of a turn: fit rounds after the first write, and a separate reply call in half the turns; drift on 1 of 15 edits (a wrong card index). Open: reliable `reply` on writes, first-write shape errors in single requests (76%; `focus` written inside `chart`), and content from earlier turns bleeding into a new slide in a long session (1 of 10).
   **Speed and quality rounds (2026-09-27):** `docs/research/2026-09-27-hybrid-agent-2/`. Both latency bars now pass: new slide p50 12.5 s (was 22.9 s), edit p50 3.1 s (was 10.1 s). The slide is first on screen at p50 8.0 s, and 96% of turns end without a reply call. Request numbers are kept 98%, edits show no drift (15 of 15 reach their values), and slides always end fitting. The changes are code replies on clean writes, in-write shortening, a smaller working set and history, and more autofixes (9.0, 9.3, 9.4). Open: first-write shape in long sessions 80% (n = 10, content mistakes); p95 about 43 s; tables cannot focus a row.
4. Write the implementation plan for M0 (fit spike) and M1 (one `chart` slide end to end), starting with the evaluation harness (9.6).
   **Fit spike done (2026-09-27): go on D4, with conditions.** Results in `docs/research/2026-09-27-fit-spike/README.md`. The Node predictor matched Chrome's line count on 100% of 6,000 boundary-weighted strings (both title styles, pitch subtitle, note and card text) at DPR 1, DPR 2 and under `scale(.5)`, and never predicted fewer lines than Chrome. D4 as first written (HarfBuzz's own advances + plain UAX #14) matched only 97.2–100% and let up to 22 in 1,000 overflows through, so D4 is revised. The conditions: fractional HVAR advances (harfbuzzjs rounds them, up to 1.6px error on a long title); Blink's break rules (no break after `/`; `-` before a digit only after a letter or digit); a line ending after a hyphen or dash must fit with and without the kerning pair across the break; a 0.1px guard band instead of the "about 1 px" tolerance in 4.2; self-host the exact TTFs; re-run the harness on Windows and Linux Chrome before M1 ships (only macOS Chrome 145 was tested). Two statements in 4.2 are wrong and need fixing in the plan: CSS `text-wrap: balance` **can** change the line count in Chrome (3 in 1,000 titles, both directions), so the calculator computes the balanced width and the renderer wraps normally at that width (1,000/1,000 counts); `text-wrap: pretty` kept the count in 3,000/3,000 and stays allowed in body text.

5. **Consulting gaps closed (2026-10-02):** the gallery had no executive summary, horizontal ranking, 2×2 or next steps. Added: a `summary` template (the answer in the title, 2–4 numbered points of a claim of up to 40 characters and a sentence of up to 100; at most 3 with a takeaway); two chart kinds, `ranked` (`ranking: [{ label, value, focus }]`, 2–8 items, largest first, 'Other' last; with notes 7 items of 24 characters; pitch with a takeaway 6) and `matrix` (`axes { x, y }`, optional four `quadrants`, `points: [{ label, x, y, focus }]` on judged 0–100 positions, 2–8; with notes 6, and notes or a takeaway, not both). Charts and tables use one design in both deck types: pitch differs only in the head and the type scale, and the notes column and footnote/takeaway lines are the same settings everywhere. Matrix labels are placed by code (the side of each dot that clears the dots, quadrant names, other labels and edges, refined in rounds); what still collides is reported by the C1 lint. Next steps is the existing table (action with a cell note, owner, date), added as a starter. Not done: summary page references (slides have no stable id in the engine), a table row focus, and the next-steps table at the mockup's polish (bolder actions, rows that fill the body).

**Future features (recorded, not scheduled):**
- **Number and story consistency checks.** Decompose the deck into a **claims registry**: every figure and claim on every slide (e.g. `ARR £9.8m, 2025`, `churn 3%`), each traced back to the slide, component and field it came from. New and edited slides are checked against the registry, so contradictions (two ARR figures, a plan that misses its own target) are easy to find and point at. Also covers the deck-level rule that the titles, read in order, tell the whole story, which no check covers today (checks see one slide at a time).
- **Two variants when routing is unsure.** When Jev's top template probability is below the threshold (9.2), `create_slide` returns both top templates, the agent builds both, and the user picks. Costs one extra write; turns a hidden guess into a visible choice.

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
| D4 | **Fit is deterministic arithmetic**, not a render-time check: text is shaped with HarfBuzz (Chrome's shaper) against the self-hosted font files, line-broken with UAX #14 rules, and summed against slot geometry constants. |
| D5 | Three lines of defence for fit: schema guardrails → fit calculator (the guarantee) → CI calibration against Chrome. |
| D6 | Every allowed configuration passes a **quality matrix** (geometry lints on all, approved visual baselines on a representative set) before it ships. |
| D7 | **Dependency direction: geometry → limits → schema.** Geometry constants (slot sizes, fonts) are the root. Guardrail limits are computed from them. The zod schema consumes the limits and is the source of truth for types, agent docs, validation and generated test content. |
| D8 | The agent loop runs **in the browser**; a thin Vercel function proxies model calls and holds the keys. |
| D9 | Style (consulting / pitch) is the user's choice per report and changes the **frame** as well as the copy rules (see 3.1). Palette (ink / paper) is visual only. |
| D10 | One chart engine (custom SVG shapes + HTML labels) serves slides and the standalone chart block. Recharts is retired (it renders SVG `<text>`, which Chrome misplaces in scaled frames). |
| D11 | **Chromium only for the MVP** (Chrome, Edge, Arc). Safari/Firefox shape and break text differently; they come later with their own calibration. |
| D12 | **Fixed format, not responsive.** A slide is always laid out at 1920×1080, and a standalone chart on its own fixed canvas (the same geometry as the `chart` entry without notes). On screen the whole canvas is scaled uniformly (`transform: scale`), like PowerPoint or Keynote: fit-to-panel, zoom, thumbnails. Layout never reflows with the viewport: no breakpoints, container queries or viewport units inside a slide. This is what makes fit computable: there is exactly one geometry to calculate against. Only the app around the slide (chat, panels) is responsive. |
| D13 | **Model routing.** GLM 5.3 Flash through its subscription endpoint is the main model (free; first priority). OpenRouter is used **only** for Jev (later also cheap image models), never for other text models. Jev makes every closed-set decision that needs no writing (menu entry, edit intent, chart type, card lead, icons, tones; see 9.1) and runs the cheap judgment checks. GLM writes text and data. |
| D14 | **Design checks** run after every save: deterministic rule checks (free) plus Jev judgment checks (cheap). For now they are **shown to the user only**, as a checks list on the slide. A later "Get advice" action sends them to the agent to revise. They never block saving; fit does. |
| D15 | **Presentation mode** like Slidev: keyboard navigation, full screen, overview grid, deep links per slide. |
| D16 | **Routing picks the key component only; optional components are never a routing decision.** The router chooses what the slide is built around (chart, table, number, steps, cards, cover, section). Everything optional is decided while filling, inside the chosen template: notes, takeaway, footnote, source, kicker, pitch subtitle, card facts, card lead (icon or value). Where an optional component changes the layout (notes on a chart or table), code picks the layout variant deterministically. A new optional component never adds a menu entry. (Evidence: M0 bake-off, 13.) |

## 3. Composition model

### 3.1 Frame

Every content slide shares one frame. Cover and section are frame variants with no areas. The frame differs by style, because consulting and pitch decks title slides differently:

| Frame field | Consulting | Pitch |
|---|---|---|
| `kicker` | optional small label; defaults to the current section name | **not used** (the title already names the topic) |
| `title` | required; markup; the **action title**: a full sentence stating the so-what; ≤ 2 lines | required; the **topic**: "Business model", "Unit economics", "The problem"; **exactly 1 line** |
| `subtitle` | not used | optional; markup; the claim in a few more words, smaller type; ≤ 2 lines |
| `takeaway` | optional; markup; exactly 1 line | optional; markup; exactly 1 line |
| `footnote` | optional; ≤ 2 lines together with `source` | optional, rare |
| `source` | optional; renderer adds "Source:" | optional, rare |

Derived, never written by the agent: page number, section number, note numbers, default kicker, footer (deck setting).

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
  "chart": { "type": "bars", "format": "£{v}m",
             "categories": ["Y1", "Y2", "Y3", "Y4"],
             "series": [{ "name": "Interchange", "color": "focus", "values": [0.3, 2.2, 11, 36] }] },
  "notes": [ { "title": "Interchange compounds", "text": "Spend grows **3×**.", "point": { "series": 0, "index": 3 } } ],
  "takeaway": "Spend, not lending, makes the book profitable.",
  "source": "FinBridge model, base case."
}
```

Registry entry (internal): `chart: { variants: [ { when: "no notes", layout: "full", areas: { main: "chart" } }, { when: "notes", layout: "split", areas: { main: "chart", side: "notes" } } ] }`. The variant is chosen by code, deterministically, from the content; fit limits are resolved for the chosen variant (a chart with notes allows fewer categories). Cross-area references go notes → chart only; the validator resolves them and errors with ranges.

Lego inside, templates outside: blocks and layouts are reused across entries in code, while the agent chooses among a small closed set of finished templates.

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
- **Heights:** sums per area (lines × line height + fixed paddings and gaps) and compares with the area budget. The budget depends on frame state: title on 1 or 2 lines, kicker present or not, and takeaway present or not. The footnote/source rail lives inside the bottom padding and does **not** reduce the body budget; it has its own 2-line limit. Growing blocks (charts) must keep their minimum height.
- **Auto-sizes:** e.g. a row of big values shrinks together, to 75% at most. These are computed here and returned in `computed`; the renderer receives them as props and never measures.
- **Tolerance:** an absolute tolerance (about 1 px, set by calibration) absorbs Chrome's 1/64 px layout rounding. Not a percentage.
- **Messages** are written for the model, with the fix: `title: 3 lines, max 2 (about 14 characters too long)`, `side: 38px over budget; drop one note's text or the takeaway`.

It runs in milliseconds, in the browser, in Node and in tests.

### 4.2a Charts

Chart text uses the same calculator. The collision rules are design decisions settled in M1, before the chart block ships:
- category labels: a maximum count and length per area, and what happens when labels don't fit (fewer labels, or an error);
- value labels: hidden when the bar is narrower than its label;
- end labels on line charts: stacked when two series end at similar values.

### 4.3 Three lines of defence

| Layer | Runs | Role |
|---|---|---|
| 1. Guardrails | in `get_schema` output and zod | Character and item limits so the first attempt usually fits. **Computed from the geometry**: characters per line = slot width ÷ the letter-frequency-weighted average character width, times max lines. Shown to the agent as "≈52 characters per line × 2 lines". Item counts come from area budgets. The guardrail is a hint; the calculator decides |
| 2. Fit calculator | on every `create_slide` / `update_slide` | Deterministic pass/fail. **This is the guarantee.** A slide is saved only when layers 1 and 2 pass |
| 3. Calibration | CI only | Playwright renders the stress set plus a seeded set of ~1,000 random slides and compares Chrome's actual line counts and area heights (via `Range.getClientRects()`) with the calculator's prediction. **Any case where the calculator says "fits" but Chrome overflows fails the build.** Cases where the calculator is stricter than Chrome are counted against a small false-reject budget. A model-based visual review can be added here later |

## 5. Quality matrix

Layouts and blocks must look right across every configuration they allow, not only fit.

- **Axes:** menu entry and layout variant (`chart` and `table` with and without notes; `cards` expanded into its card variants × 2–4 cards) × frame options (kicker / takeaway / footnote+source on or off = 8) × title on 1 or 2 lines × content amount (min / typical / max) × style (2). Generated from the registry and a seeded content generator per block. Palette is not an axis: it changes no geometry. It is covered by the visual baseline only.
- **Automatic geometry lints on every render:** no overlap or area escape; alignment to the 12-col grid; gaps within min/max (no large empty holes on sparse slides); centred content within 1 px; no single-word last line in multi-line body text. These are checked by rendering, not by the calculator.
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
- **Jev** does two jobs: picks the menu entry from the prompt (see 9.1) and answers the judgment checks (6).
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

The agent is not one long conversation. It is a pipeline of short, focused calls, each with only the context it needs. Code sits between every model call.

### 9.0 Pipeline (one slide)

```
User request
  1. ROUTE   Jev: request → menu id (+ probability); edits: request → intent      ~0.3 s, closed set
  2. FILL    GLM 5.3 Flash, fresh short context (9.3) → text and data fields      strict JSON schema of ONE entry
  3. DECIDE  Jev: closed-set fields that depend on the written text (9.1)          parallel, ~0.3 s
  4. GATE    code: auto-fix trivia → validate → fit                               no model
  5. REPAIR  GLM, fresh context: slide + ONLY failing fields + exact fixes → patch  ≤ 2 rounds, then escalate (9.4)
  6. CHECK   rule + Jev design checks → shown to the user                          advisory
```

- **Decks:** a planning call writes the storyline first (one title + menu id per slide), shown to the user as an outline. Then each slide runs steps 2–6 independently and in parallel, seeing only its own planned title and its neighbours' titles.
- **Edits:** Jev classifies the request (`text` · `data` · `template` · `style-of-copy` · `new-slide`). Text and data edits send only the affected fields to GLM as a patch; a template change re-runs from step 2 with the old content as input.

### 9.1 Who decides what

Jev is a decision model: it picks one of a few defined options and returns probabilities. So every **closed-set choice** that does not require writing goes to Jev, and GLM only writes **text and data**. GLM's JSON gets smaller and has fewer ways to be wrong.

| Field / decision | Decided by | When | Why |
|---|---|---|---|
| menu entry | Jev (GLM 5.3 Flash below threshold) | before fill | classic routing; closed set of 7 |
| notes on a chart or table | GLM | during fill | a writing decision: does each note add something? |
| edit intent | Jev | before fill | closed set |
| chart `type` (bars / lines) | Jev | before fill | depends on the request and data, not on copy |
| card lead (icon / value) | Jev | before fill | depends on whether the content has numbers |
| icon per card | Jev | after fill | depends on each card's written title; ~50-icon closed set |
| tone per card / case (`neg` · `focus` · `neutral`) | Jev | after fill | depends on the written text |
| focus element (which series / card / step) | GLM | during fill | must match the title GLM writes; J4 checks it |
| all text, numbers, data | GLM | fill | writing |

Rule for adding a field to Jev: its value is from a closed set **and** it can be decided from the request or from text already written. Every Jev decision has a fallback: if its top probability is below the field's threshold, GLM's own value (it fills all fields in its schema anyway) is kept. Thresholds are set from measured calibration, like the router's (13).

### 9.2 Picking a menu entry

Two steps, cheap first:

1. **Jev router (decided).** Jev picks one menu id from the request (a typed decision over the 7 ids, with the picking guide in its instructions). If its top probability is **≥ 0.7**, that entry is used; in the bake-off this covered about 80% of requests. Otherwise **GLM 5.3 Flash (thinking on)** picks, with the picking guide and Jev's top two as candidates. The threshold is re-measured on the 7-entry menu with the evaluation set (9.6) before M2.
2. **Picking guide** (in the system prompt; the main model uses it when Jev is unsure, and it is the text Jev's prompt is built from). Answer in order and stop at the first match:

| # | If the content is… | Use |
|---|---|---|
| 1 | the first slide of a deck | `cover` |
| 2 | the start of a new part in a deck of 8+ slides | `section` |
| 3 | one number that proves the argument (a size, a cost, a gap) | `number` |
| 4 | data over categories or time (a series): a trend, a comparison of sizes, a crossover | `chart` |
| 5 | exact figures the reader needs to compare | `table` |
| 6 | a sequence in time: plan, roadmap, process, history (2–5 steps) | `steps` |
| 7 | 2–4 parallel things: options, pillars, features, several independent numbers, or a two-way contrast | `cards` |

Tie-breakers, stated to the model:
- **Chart or table?** Chart when the point is a trend, a comparison of sizes or a crossover; table when the reader needs the exact values.
- **Notes** are not a routing decision; the filling model adds them (template card rule: only if each note adds something; in pitch, prefer none).
- **Cards: icon or value lead?** Value when every card has a number worth showing; otherwise icon. Consulting defaults to icons, pitch to values.
- **Contrast** (them vs us, before vs after): `cards` with 2 framed cards, one tone `neg` and one `focus`.
- When in doubt, pick the entry with **fewer words**.

### 9.3 What goes into each prompt

| Layer | Contents | Size | Used in |
|---|---|---|---|
| Fixed system prompt (cached) | role ("you fill templates; you never design"), markup syntax, universal rules | ~600 tokens | fill, repair |
| Style rules | consulting or pitch copy rules, with good and bad title examples | ~300 | fill, repair |
| Template card | the ONE entry's resolved fields and limits ("≈52 characters per line × 2 lines"), its rules, and **one good example per style** | ~500 | fill, repair |
| Task | the request; for decks, this slide's planned title and its neighbours' titles; for edits, the current slide | small | fill |
| Repair brief | the failing fields only, each with measured value, limit and fix | small | repair |

The full menu and picking guide appear only in the planning call and when Jev is unsure. The worked example in each template card is the strongest nudge for a mid-size model and is maintained with the template (it must pass the gate itself; CI checks this).

Where the provider supports it, the fill call uses the entry's **strict JSON Schema** (generated from zod) as structured output, so shape errors cannot happen and only fit and content errors remain.

### 9.4 Nudges: how the agent is told to fix things

- **One error format everywhere:** field path · what was measured · the limit · a concrete fix · scope.
  `notes[1].text: 3 lines, max 2 — about 22 characters too long. Shorten this field only.`
  `chart.series[2].values: 4 values, but there are 5 categories. Add one value.`
- **Code fixes trivia and reports it** (never meaning): strips a "Source:" prefix, trailing full stop on a consulting title, straight → typographic quotes, `40 percent` → `40%`, whitespace. It never shortens or cuts text; that is the agent's job.
- **Locked fields:** a repair patch may only touch the failing fields; any other change is rejected.
- **Escalation ladder:** repair round 1 (errors) → round 2 (errors + the current text shown next to its limit, e.g. "93 of 72 characters") → one attempt with GLM 5.3 (the larger model, same subscription) → saved as a draft with the issue listed for the user. No endless loops.
- **Design checks** (6) do not go back to the agent yet; a later "Get advice" action sends them as a repair brief.

### 9.5 Tools

In the pipeline, most "tools" are code steps, not model-called tools. Model-facing calls are fixed per step: fill returns one slide JSON; repair returns one patch; planning returns a storyline. The deck operations below are exposed to the chat model for multi-turn conversations (M3):

| Tool | Purpose |
|---|---|
| `get_deck()` | titles, menu ids and slide ids only |
| `get_slide(id)` | full JSON |
| `edit_slide(id, request)` | runs the edit pipeline (9.0) for one slide |
| `add_slide(request, after?)` | runs the pipeline for a new slide |
| `delete_slide`, `move_slide`, `set_deck(footer, theme)` | deck edits |

- The agent never sets style, page or section numbers, footer text on slides, or layout geometry.

### 9.6 Evaluation harness (built first)

Built at the start of M1, before the UI, and run on every change to a prompt, template, limit or model:
- ~50 prompts per style through the whole pipeline (the routing bake-off set plus fill cases).
- Tracks: routing accuracy · valid on first fill · valid after repair · repair rounds (p95) · rule checks passed · Jev judgment scores · latency · cost.
- A change that lowers any of these beyond a set tolerance fails CI.

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
  agent/         pipeline steps (route, fill, decide, gate, repair), prompt layers,
                 template cards + examples, Jev client, GLM client, deck tools
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
- **Pass bar:** first fill passes validation and fit ≥ 80%; p95 repair rounds ≤ 2; zero invented fields; rule checks R1–R8 pass ≥ 90%.
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
| Approved visual design (prototype renderer, stress mode, two palettes) | `docs/design/proposals/slides-v4.html` (serve the folder: `python3 -m http.server 8765`) |
| Prototype schema and agent prompt (to be ported to zod; menu to be updated to the 7 entries) | `docs/design/proposals/slides-v4-schema.js`, `slides-v4-agent-prompt.md` |
| Routing bake-off: prompts, menu, scripts, results, report | `docs/research/2026-09-26-routing-bakeoff/` |
| Reference decks | `example_template/` |

**API access (verified 2026-09-26)** (keys in `.env`, names in `.env.example`):
- GLM: `https://api.z.ai/api/coding/paas/v4/chat/completions` (subscription endpoint), models `glm-5.3-flash` and `glm-5.3`, OpenAI-compatible. Thinking is on by default; `"thinking": {"type": "disabled"}` turns it off. Even with thinking off it can emit a few reasoning tokens, so do not cap `max_tokens` below ~400.
- Jev: `POST https://openrouter.ai/api/alpha/decisions`, model `~typesafe/jev-latest`, body `{ model, state, questions: { <id>: { type: "choice", instructions, criteria: { <key>: <description> } } } }`; answer `{ choice, probabilities, confidence }`. Option keys must be plain identifiers.

**Open items before or during planning:**
1. Update the v4 prototype to the pitch frame change (1-line topic title + subtitle, no kicker) and to the 7-entry menu (notes as a field of chart and table); keep `?stress=1` at 0 issues.
2. Re-run the routing bake-off on the 7-entry menu to confirm the 0.7 threshold.
3. Write the implementation plan for M0 (fit spike) and M1 (one `chart` slide end to end), starting with the evaluation harness (9.6).

# SmartChart v1: the journey becomes the app, plus a showcase empty state

Date: 2026-09-27 · Branch: `v1/journey-app` (from `main` at 788f4d7) · Status: design approved in chat, spec awaiting review

## 1. Intent

- **v1 is the journey.** The chat → slide → edit → checks → present flow, now at `/proto/journey/`, becomes the app at `/`. The legacy React chart app goes.
- **Code in its proper place:** the journey and the v5 slide system move out of `docs/design/proposals/` into `src/` as strict TypeScript. The engine stays framework-free; the UI shell is React + Tailwind + shadcn (the CLAUDE.md stack).
- **Nothing breaks:** the same behaviour, the same saved decks, the same agent quality, proven by the verification bar in section 5.
- **The empty state shows what SmartChart can make.** Today every capability is hidden until a slide exists. v1 opens on a gallery of real, finished slides; picking one creates a deck, and the user edits it by chat.

**Relation to M1.** The spec's M1 ("rebuild fresh") becomes incremental hardening of v1 (server-side agent, HarfBuzz fit when export or server layout needs it). That rewrite of section 11 of the slide-system spec is a separate, later change; this spec does not touch the engine's behaviour.

## 2. Target structure

```
src/
  engine/                  framework-free strict TS, a file-by-file port
    slides/                schema, render, lints, colours, charts/ (chart, math, parts, waterfall, timeline), slides.css
    agent/                 agent, agent-prompt, pre, patch, autofix, resolve, shorten, suggest, checks, llm, prompts
    starters/              starters.json + typed loader (section 4)
  app/                     React shell
    Landing (gallery), AddSlide (featured + filmstrip), Chat, Stage, Strip, Checks,
    Present, AccentPicker, deck store
  dev/review               the gallery rendered full size, both styles and palettes (+ ?stress=1); dev build only
api/                       glm.ts, jev.ts, health.ts, unchanged
tests/
  unit/                    vitest, ported from docs/design/proposals/tests/*.test.js
  browser/                 Playwright, against `vite dev`
```

- **Port rule:** the engine port is mechanical. Same functions, same names, same behaviour, types added. No `any`. Any behaviour change needs its own reason and its own commit.
- **Slides mount via refs:** React owns the chrome and never re-renders inside a slide. `mountSlide(el, …)` keeps owning the slide DOM, as it does today.
- **Deck store:** same localStorage key and format as `journey/decks.js`, so decks saved by the prototype load in v1.
- **Local dev:** `npm run dev` serves the app plus `/api/*` through a small Vite plugin that mounts the `api/` handlers and reads `.env`. `journey/server.mjs` is removed, so dev and production share one API code path. The plugin keeps the local call cap `server.mjs` had.
- **Routes:** the app at `/`. `/proto/journey/` and `/proto/v5/review.html` redirect to `/` (`vercel.json`).
- **Styles:** `slides.css` is imported unchanged, since slides are the calibrated v4/v5 look. The page chrome in `journey.css` becomes Tailwind classes on the same tokens (`--app-bg`, `--panel`, `--ink`…), and the result must look the same as the journey.

## 3. Removals

| Remove | Why |
|---|---|
| `src/features`, `src/services/ai`, `src/shared`, `src/components`, `src/lib`, `src/types`, `src/utils`, `src/app/providers`, `src/App.tsx`, old `index.css` | the legacy chart app |
| `@anthropic-ai/sdk`, `@google/generative-ai`, `recharts`, `framer-motion`, `canvas-confetti`, `react-markdown`, `next-themes`, `cmdk`, the Radix packages | used only by the legacy app. shadcn primitives the shell needs are re-added with `npx shadcn@latest add` |
| Replay mode (`replays.json`, the replay picker, `tests/browser/record-replays.mjs`) | production has keys; replays hold the removed pipeline |
| `docs/design/proposals/{v5,journey,tests}` | moved to `src/` and `tests/` |
| `slides-v1.html`, `slides-v2.html`, `slides-v3.html`, `slides-v4-schema.js`, `slides-v4-agent-prompt.md` | superseded by v5 |
| `v5/examples.js` as a separate set | becomes `starters.json` (section 4). Its slides are kept and rewritten, not deleted |
| `docs/design/proposals/mockups/` | brainstorm mockup |
| `publish-prototypes` plugin in `vite.config.ts` | nothing left to publish |
| `docs/AI_SERVICE.md`, `docs/DESIGN_SYSTEM.md`, `docs/adr/ARCHITECTURE.md`, `deploy.sh`, `requirements.txt` | legacy app docs and a Python/Reflex leftover |

**Kept:** `slides-v4.html` (the visual reference in CLAUDE.md), `example_template/`, the specs, and `docs/research/`. Research `run.mjs` scripts import prototype paths. They stay as frozen records, and each README gets one line: "Ran at commit 788f4d7; paths refer to that tree."

**Updated:** CLAUDE.md is rewritten for v1 (structure, commands, stack, no legacy notes), along with the `smartchart-slide-system` memory. `package.json` scripts: `dev`, `build`, `lint`, `test` (vitest), `test:browser`.

## 4. The gallery: one set, `starters.json`

**One source.** `src/engine/starters/starters.json` is the only example set. Every consumer reads it:
- the landing gallery
- Add slide
- the agent's worked examples (`prompts.js`, which today reads `examples.js`)
- the unit and browser tests
- the dev review page

No other gallery or example data exists.

**Format:** the slide JSON the app stores and the agent writes, so picking a starter inserts it into a deck with no conversion.
```jsonc
{ "id": "chart-notes", "group": "charts", "label": "Bars and a line, with notes", "blurb": "Mixed chart with numbered call-outs",
  "consulting": { /* Slide */ }, "pitch": { /* Slide */ } }
```
Groups, in display order: `charts`, `tables`, `cards`, `numbers` (big number, steps), `structure` (cover, section). The typed loader validates every slide with `validateDeck` and throws on errors, in tests and in dev.

**Content:** the existing 17 example slides, kept as calibrated. Only their content is rewritten:
- FinBridge becomes **Acme**, one coherent fictional company, so a deck built from the gallery reads as one story.
- Real brands and people (Amex, Barclaycard, Lloyds, NatWest, HSBC, Shopify…) become generic competitors ("Incumbent bank", "Card issuer A") or are dropped from the text.
- Figures stay internally consistent: shares sum to 100%, CAGR and differences match the values, table totals add up.
- Chart structure, templates, variants and colour roles do not change.
- "Cards · value lead" gets its content fixed so it passes L5 (today: 41% empty below the cards).

**Gate: a starter ships only if**
1. it passes the existing checks in both styles × both palettes: schema, fit issues, layout lints (L1–L5) and rule checks R1–R14 (a unit + browser test fails the build otherwise);
2. a denylist test finds no real brand names in any string;
3. every slide is reviewed at full size (1920×1080) in both styles and palettes, one at a time;
4. **the user approves the set on the dev review page.** That page renders `starters.json` exactly as the app does, so what gets approved is what users see.

Colour problems are fixed in the engine (colour allocator), never by hand-picking colours in starter content.

## 5. Empty state

### 5.1 Landing: no deck open (first visit, or **New deck**)
- **Layout (mockup A):** the bar (brand, Consulting/Pitch, Ink/Paper, Accent, deck picker, New deck, Present disabled), the chat panel on the left, the gallery in the stage.
- **Chat panel:** a short welcome ("Pick a ready-made slide, or describe your own. Paste numbers, a table or notes and say what the slide should argue.") and the composer, which works as today (a prompt creates the deck and the agent builds the first slide).
- **Gallery:**
  - heading "Start from a slide", a one-line lede, then the groups from `starters.json`;
  - tiles are real slides rendered live in the selected style, palette and accent, so switching Consulting/Pitch or Ink/Paper updates them all;
  - each tile shows its label and blurb and is a `button` (keyboard: Tab, Enter);
  - thumbnails 2–3 per row, never under 420px wide.
- **Picking a tile:**
  - a new deck is created in the current style, palette and accent, with that slide, and saved;
  - the view becomes the editor with the slide selected, and the chat says "Here's your slide. Tell me what to change: your numbers, your words, a different chart.";
  - the next-step pills come from `suggest.js` as for any slide.
- **Returning users** open their last deck, as today. The landing appears on **New deck** or when there are no decks.

### 5.2 Add slide: inside a deck
- **Opens from** an **Add slide** button in the bar and a **+** tile at the end of the slide strip.
- **Layout (mockup C):**
  - the stage shows one featured slide at full quality in the deck's style, palette and accent;
  - below it, a filmstrip of every starter with group tabs;
  - under the featured slide, its blurb and **Use this slide**.
- **Using a slide:** **Use this slide** inserts it after the current slide, selects it, saves the deck and returns to the editor. Section numbering and kickers follow from position (`contexts`).
- **Leaving:** **Esc** or **Cancel** returns without changes.
- **The composer stays live:** sending a prompt from Add slide closes it and builds a new slide by chat.

### 5.3 Small screens
The journey's existing narrow layout applies: the landing gallery is one column, and the Add slide filmstrip scrolls horizontally.

## 6. Order of work
1. Move and port the engine to TS; unit tests green on vitest.
2. Build the React shell to parity with the journey (no new features); `/api` through the Vite plugin.
3. Remove the legacy code and dependencies; update CLAUDE.md.
4. Verify (section 7).
5. `starters.json`: rewrite to Acme, fix L5, gate tests, full-size review, **user approval**.
6. Landing (5.1) and Add slide (5.2).
7. Verify again; preview deploy.

## 7. Verification bar ("without breaking")
1. `npm run build` (strict tsc, no `any`) and `npm run lint` are clean.
2. Every ported unit test passes: the same cases as today's `test:proto`.
3. Browser review and lint checks: 0 issues on every starter, in both styles and palettes, and on `?stress=1`.
4. Live run in the browser, both styles: new slide → edit → checks → pills → accent → present. A deck saved by the prototype loads.
5. The hybrid-agent research harness, re-run on the TS engine with the Acme worked examples: request numbers kept, first-write shape, fit and latency within noise of `docs/research/2026-09-27-hybrid-agent-2/`.
6. New browser tests: the landing renders every starter with 0 issues; picking one gives a deck with 1 slide; Add slide → Use this slide gives 2 slides in order; a reload keeps both.
7. A Vercel preview deploy works end to end before anything reaches production.

## 8. Out of scope (follow-ups)
- **Lock down `/api/glm` and `/api/jev`** (origin check, per-IP rate limit). Today they relay any request on an allowed model, and v1 at `/` makes them more exposed. Recommended right after v1.
- Rewriting M1–M4 in the slide-system spec as hardening steps.
- Server-side agent, HarfBuzz fit, export.

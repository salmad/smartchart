# Journey prototype

A throwaway page to validate the customer journey before M1: chat → slide appears → edit by prompt → checks list → full screen. It runs the agent pipeline from the spec (section 9) against the real models and renders with the v5 slide system (`../v5/`).

## Two modes

| Mode | Where | What it does |
|---|---|---|
| **Live** | local: `node docs/design/proposals/journey/server.mjs`, then open http://localhost:8787/journey/ | Calls GLM 5.3 Flash and Jev through the local proxy, which reads the keys from the repo `.env` (`GLM_API_KEY`, `OPENROUTER_API_KEY`). |
| **Live (deployed)** | `/proto/journey/` on Vercel | Same pipeline through the Vercel functions `api/glm.ts`, `api/jev.ts` and `api/health.ts`, which read `GLM_API_KEY` and `OPENROUTER_API_KEY` from the project env. |
| **Replay** | any host without the keys | `/api/health` reports not live, so the page replays recorded runs of the real pipeline (`replays.json`). Click a request in the chat to see the deck at that point. |

The v5 gallery is deployed next to it at `/proto/v5/review.html`. The Vite build copies both folders into `dist/proto/` (see `vite.config.ts`).

## Pipeline (spec 9.0)

| Step | Who | Notes |
|---|---|---|
| Route | Jev | Picks one of the 7 menu entries with the picking guide. Below p 0.7, GLM (thinking on) picks from Jev's top two. |
| Decide | Jev | Before fill: chart type, card lead (icon, value or framed). After fill: the icon of each card. Kept when p ≥ 0.6 (icons 0.35); otherwise GLM's value stands. |
| Fill | GLM 5.3 Flash | One template card (`describe()`), style rules and one worked example; JSON mode. |
| Gate | code | Auto-fixes trivia, then `validate()` and a 1920×1080 measurement (`fitIssues()`). |
| Repair | GLM Flash, then GLM 5.3 | Patch of the failing fields only: 2 rounds with Flash, 1 with the larger model, then saved as a draft. |
| Check | code + Jev | Rule checks R1–R8 and judgment checks J1–J7 in one Jev call (spec 6). Advisory only. |

Edits: Jev classifies the request as `text`, `data`, `template` or `new_slide`. Text and data edits send the slide to GLM for a patch; `template` rebuilds the slide from its old content; `new_slide` runs the full pipeline and inserts after the current slide.

Presentation: **Present** or `F`. Arrows, Space, PgUp/PgDn, Home/End, a number then Enter; click the left or right half; Esc (or leaving full screen) returns to the same slide.

## Files

- `server.mjs`: local static server plus `/api/glm` and `/api/jev` proxies with a model allowlist and a call cap. Not deployed; the repo-root `api/` functions are its deployed twin (spend limits are set on the provider accounts).
- `llm.js`: model client. `prompts.js`: prompt layers. `pipeline.js`: create and edit. `checks.js`: design checks.
- `app.js`: UI. `present.js`: presentation mode. `journey.css`: page chrome (slides use `../v5/slides.css`).
- `replays.json`: two recorded runs (consulting and pitch, 4 turns each), recorded 2026-09-26.

## Recorded results (2026-09-26)

| Run | Turn | Result | Time |
|---|---|---|---|
| Consulting | "Our SaaS revenue grew from £2.1m … churn fell from 8% to 3%" | chart (bars + churn line); 1 repair: GLM first mixed £ and % on one lines axis | 11.9 s |
| | "Make the title punchier and add a source line" | text edit: title and source changed | 4.5 s |
| | "Show this as a table instead" | template change: rebuilt as a table | 9.5 s |
| | "Add a slide with our 3-step plan to reach £25m ARR by 2028" | new steps slide; 1 repair | 20.8 s |
| Pitch | "The problem: independent cafés lose 11 hours a week …" | number slide, valid first time | 4.6 s |
| | "Add a slide on our traction: 40 paying cafés, £38k MRR …" | value cards, valid first time | 6.9 s |
| | "Make the subtitle more confident" | text edit | 4.9 s |
| | "Add a slide contrasting how cafés order today vs with us" | framed contrast cards; 1 repair | 9.3 s |

All 8 turns ended valid and fitting (no drafts). Routing was right on every turn (Jev p 0.89–1.00). What the run taught us:

- GLM plotted churn % on a £m lines axis; a validation rule now rejects mixed formats in lines charts, and the repair loop fixes it.
- With an empty deck, the picking guide's "first slide of a deck → cover" rule sent a content request to `cover`. The router now uses cover or section only when asked.
- GLM sometimes highlights two phrases in a title; this is now a warning.

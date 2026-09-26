# Journey prototype

A throwaway page to validate the customer journey before M1: chat → slide appears → edit by prompt → checks list → full screen. It runs the hybrid agent from the spec (section 9) against the real models and renders with the v5 slide system (`../v5/`).

## Modes

| Mode | Where | What it does |
|---|---|---|
| **Live** | local: `node docs/design/proposals/journey/server.mjs`, then http://localhost:8787/journey/ · deployed: `/proto/journey/` | The hybrid agent below. Several decks, saved in this browser (localStorage): pick one in the bar, **New deck** starts another, **Delete** removes the open one. Each deck keeps its slides, style, palette, the agent's conversation and the chat thread, so a reload continues where it stopped. **Clear chat** resets the conversation; the deck stays. |
| **Replay** | any host without the keys | `/api/health` reports not live, so the page replays recorded runs (`replays.json`). Older recordings are upgraded to the current chart and table shape on load. |

Keys: `GLM_API_KEY` and `OPENROUTER_API_KEY`, from the repo `.env` locally and from the Vercel project env when deployed (`api/glm.ts`, `api/jev.ts`, `api/health.ts`).

## The hybrid agent (spec 9.0–9.5)

1. **PRE** (Jev, one call): intent, template, card lead and position. At p ≥ 0.7, code makes the agent's first tool call: `create_slide` for a new slide or a template change, `read_slide` for an edit of the selected slide.
2. **Agent** (GLM 5.3 Flash, at most 10 tool calls a turn) with four tools:
   - `create_slide`: reserves a slide and returns its template card, a worked example and values already decided.
   - `edit_slide`: writes a whole slide, only right after `create_slide` reserved it.
   - `patch_slide`: changes an existing slide at exact paths (`cards[2].title`, `chart.series[1].values[3]`); all or nothing.
   - `read_slide`: adds a slide to the working set.
3. **Write path**, on every write: autofix → validate → resolve `auto` choices (series marks, stacking, focus, icons: one Jev call) → autofix → measure at 1920×1080 → rule checks. Shape errors are not applied; fit issues are applied and returned (for patches, split into `issues` and `elsewhere`).
4. **Working slides**: before every model step, the current JSON of each slide in the working set, with its open issues and failed judgment checks, goes last in the context. It is never stored in the history, and write results carry no slide JSON.
5. **Reply on write**: a write may carry the reply; when that write comes back clean, the turn ends without another model call.
6. **Judgment checks** (Jev, J1–J8) run after the reply, on the slides written this turn; failed ones reach the agent through the working block next turn.

The earlier fixed pipeline was removed; its results are in `docs/research/2026-09-26-agent-single-slide/`.

Presentation: **Present** or `F`. Arrows, Space, PgUp/PgDn, Home/End, a number then Enter; click the left or right half; Esc (or leaving full screen) returns to the same slide.

## Files

- `agent.js`: the turn and its four tools. `agent-prompt.js`: system prompt, tool definitions, state block and working block.
- `pre.js`: the PRE step. `patch.js`: path patches. `autofix.js`: code fixes. `resolve.js`: `auto` choices. `checks.js`: rule checks R1–R14 and judgment checks J1–J8.
- `server.mjs`: local static server plus `/api/glm` and `/api/jev` proxies with a model allowlist and a call cap. Not deployed; the repo-root `api/` functions are its deployed twin (spend limits are set on the provider accounts).
- `llm.js`: model client. `prompts.js`: style block, worked examples, picking guide.
- `accent-picker.js`: the Accent popover (curated swatches, custom colour, hex). The colour is saved per deck and applied by `../v5/accent.js`, which keeps it legible on each palette and flags hues close to the problem red or gain green.
- `decks.js`: the deck store in localStorage (one key, newest first; empty decks are not kept).
- `app.js`: UI; `window.__journey` exposes `send`, `setStyle`, `load` and `turns` for test harnesses. `present.js`: presentation mode. `journey.css`: page chrome (slides use `../v5/slides.css`).
- `replays.json`: two recorded runs of the earlier pipeline (consulting and pitch, 4 turns each), recorded 2026-09-26.

Tests: `npm run test:proto` (unit tests in `../tests/`), and the browser checks in `../tests/browser/` (`node review.mjs`, `node lints.mjs`, with the server running).

Results of the 9.7 test for the hybrid agent (2026-09-27): `docs/research/2026-09-27-hybrid-agent/`.

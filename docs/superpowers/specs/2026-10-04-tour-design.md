# First-run tour, ending at Connect an agent

FUTURE.md #2. Status: design, 2026-10-04 (decided overnight within the agreed brief).

## Brief (agreed in FUTURE.md)
For everyone, with MCP as the finale; explains in plain words what an agent is. A classic step tour (Next / Done). It starts only from "Take the tour" in the account menu, plus one nudge for new users, never automatically. An empty deck opens a sample from `starters.json`.

## Decisions
- **Build: our own component**, not driver.js. It's about 150 lines, needs no new dependency, and matches the app's look. A spotlight is a fixed box over the target's rect with a page-dimming shadow; the card sits below the target (or above, when there's no room), kept inside the viewport. Positions are set through CSS variables from a layout effect (no inline styles, as `SlideView` already does). It follows resize and scroll.
- **Targets** are `data-tour="<step>"` attributes on existing elements. A step whose target is missing (the chat hidden, a phone layout) shows its card in the centre without a spotlight.
- **Steps (8):** chat → slide (E edit, F present) → checks ("checked like a partner") → comments ("notes any agent can address") → deck and views (strip, Grid, Storyline) → deck menu (Look, Versions) → Share → **Connect an agent**, which explains agents ("an AI assistant like Claude Code or Cursor that works for you…") and offers Make a key, opening `AgentKey`.
- **Keys:** → / Enter next, ← back, Esc closes. Focus moves to the card; the card has `role="dialog"`, a label, and "Step n of 8".
- **Nudge:** once per browser (`smartchart.tour` in localStorage): a small pill at the bottom, "New here? Take the 1-minute tour", with Start and ✕. It shows only in the editor, once the deck is loaded, and never while a turn runs. Finishing or dismissing the tour, or dismissing the nudge, records it.
- **Empty deck:** starting the tour on an empty deck inserts the first three gallery starters in the deck's style (a real deck the user can keep or delete).

## Tests
Unit: placement math (below / above / clamped). Browser: start from the account menu, step through all 8 with Next, Back works, Esc closes, the final step opens Connect an agent; the nudge shows once and Start runs the tour.

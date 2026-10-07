# MCP slide eval

Claude Code (Sonnet), run headless on the Claude subscription, makes one slide per case through the app's own `/mcp/v1`, exactly as a user's agent would. Each run is scored by exact code checks and an Opus judge, and the report compares it with a baseline. Rerun it after any prompt, card, guide or tool change. Spec: `docs/superpowers/specs/2026-10-03-mcp-slide-eval-design.md`.

## Setup (once)

1. Sign up one or two test accounts in the app, used only by the eval. Under Agent keys, make a key for each.
2. Put the keys in `.env` as `SMARTCHART_EVAL_KEYS=<key1>,<key2>` (one worker per key). The eval reads `.env` from the folder you run it in, so a worktree needs its own copy.
3. Log `claude` in with the subscription. The eval never uses an API key: it strips them, and stops if Claude Code reports anything but the subscription.

## Run

```bash
npm run dev                                    # the app: /mcp/v1, /api/decks, the lint fixture
npm run eval:mcp                               # all 25 cases × 3, then judge, then report
npm run eval:mcp -- --group=criteria --n=1     # a quick read after a prompt change
npm run eval:mcp -- --against=<label>          # deltas against a baseline
npm run eval:mcp -- --label=<label> --report-only --against=<other>
```

| Flag | Meaning |
|---|---|
| `--n=3` | Runs per case |
| `--only=t01,f02` / `--group=near-miss` | Pick cases |
| `--label=` | Output folder (`out/<label>`); default `<sha>[-dirty]-<date>`. Rerunning a label resumes it |
| `--against=<label>` | Compare with `baselines/<label>.json` or `out/<label>/summary.json` |
| `--save-baseline` | Copy this run's summary and report to `baselines/` (commit them) |
| `--judge-model=opus` | `sonnet` when usage limits are tight; the report names it |
| `--no-judge`, `--report-only` | Skip judging, or only rewrite the report |
| `--model=sonnet` | The agent's model |
| `--url=`, `--app=` | The MCP endpoint (any deployment) and the app serving the lint fixture |

Output, in `out/<label>/`: `report.md` (headline, by group, per check, for review), `gallery.html` (every slide at full size with its failures: review slides one by one), `results.json`, `summary.json`, `shots/`.

## Reading it

- **Magic rate:** every gating check passed (right template, one slide, facts kept, nothing invented, fits, validates, a so-what title that the body proves, the case's `must` questions).
- **What confused the agent:** the judge's diagnoses grouped by where to fix them (server instructions, tool descriptions, template cards, the guide), each with the exact text quoted. This is the fix list.
- **Fatal rate:** a figure dropped or invented, or the slide overflows.
- **`P` checks** show whether the server's instructions landed (guide and card read first, issues fixed, `check_slide` run, request passed, look left alone, short reply with the link).
- **Compare like with like:** the same cases and `--n`, and the same Claude Code version (the report flags a version change).

## Adding a case

Add it to `cases.json`. `facts` lists only figures and names the request states exactly. Anything about the slide's details (what is highlighted, which marks, a total row) is a yes/no question for the judge, with `must: true` when the slide fails the user without it. `npx vitest run tests/unit/mcp-eval` checks that the case is honest.

The eval changes no product code. Occam's own verdicts (write issues, `check_slide`'s J-checks) reach the judge through the transcript.

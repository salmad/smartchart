# MCP slide eval: Sonnet makes a slide, judged on what was asked (2026-10-03)

## 1. Goal

A standing eval, rerun after every prompt, card, guide or tool change: does an outside agent (Claude Sonnet over the SmartChart MCP) give an inexperienced user the magic moment? The moment is one request in their own words, and one slide back that is the right kind, keeps every fact, invents nothing, renders clean and argues well. Tables first, because they are the most generic template.

Each rerun answers two questions:
- **Did it do what was expected?** Per case, checked by code where the answer is exact and by a judge where it isn't.
- **Did the change help?** Every run is labelled with the commit it ran on, and the report compares it against a baseline.

Design rules, because this is maintained, not run once:
- **Test the existing code, build no copies, change no product code.** The agent talks to the app's own dev server with a test account. Rendering and lints come from the existing lint fixture. SmartChart's own verdicts (write issues and warnings, `check_slide`'s J-checks) reach the judge through the transcript.
- **Code checks only what is exact and stable** (template, figures, fit, validation, tool use). Anything that depends on the slide schema's details (which row is focused, which marks, a total row) is a plain-English case question for the judge. A schema change then breaks no eval code.
- **One command.** It runs, judges, reports and resumes.

Non-goals: edits and storylines (later case sets on the same runner), latency targets, scoring Jev.

## 2. How a run works

```
cases.json ─► eval.ts ─► claude -p (Sonnet, the user's Claude Code) ──HTTP──► npm run dev: /mcp/v1 (real api/mcp.ts)
                 │                                                               ├─ Neon (DATABASE_URL), test account
                 │                                                               └─ Jev (real)
                 ├─ final deck: GET /api/decks?id= ─► docFromData()
                 ├─ measure: src/dev/fixture.html lint() at 1920×1080 + PNG
                 ├─ judge: claude -p (Opus): screenshot + JSON + request + transcript + questions
                 └─ out/<label>/results.json, report.md, gallery.html
```

**The endpoint is the app.** `npm run dev` already serves the real `/mcp/v1` (through `vite/api-dev.ts`), with real key auth, the deck service, the database, Jev, the rate limit and the quota. The agent connects with a test account's agent key, as a user's Claude Code connects to production. `--url=` points the same run at any deployment.

**Test accounts.** Accounts made in the app only for the eval (sign up, then Agent keys → new key). Their keys go in `.env` as `SMARTCHART_EVAL_KEYS` (comma-separated); one worker per key. Before each run the worker empties its account through the app's decks API (`GET /api/decks`, `DELETE /api/decks?id=`, both of which accept the key), so every run starts as a new user. The final deck is read with `GET /api/decks?id=` and the existing `docFromData()`.

**The agent: the user's experience, unchanged.** The real Claude Code CLI, headless:

```bash
claude -p --model sonnet --mcp-config <run>/mcp.json --strict-mcp-config --allowedTools "mcp__smartchart__*" \
  --setting-sources local --no-session-persistence --output-format stream-json --verbose --max-turns 40   # prompt on stdin
```

- **Kept as a user has them:** the default system prompt and the full default tool set (including ToolSearch, which loads MCP tools on demand), the server's instructions, tool descriptions, guide and cards, and Claude Code's MCP output limits.
- **Isolated from this machine:**
  - An empty temp working folder holding only the case's `files`.
  - `--setting-sources local`: none of this machine's hooks or plugins.
  - `--strict-mcp-config`: only `smartchart`, never the production connector configured here.
- `--allowedTools "mcp__smartchart__*"` is the user who clicked "always allow" on the connector. Any other tool that would prompt is denied in headless mode and recorded.
- One user message, the case prompt, with nothing added by the eval.
- If the agent asks a question, the run ends there: the eval never answers back.

**No paid model keys.** The agent and the judge both run on this machine's Claude subscription.
- The runner removes `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN` and the Bedrock and Vertex switches from the child's environment.
- It stops the whole eval unless the CLI's `system/init` event reports `apiKeySource: "none"` (the subscription; checked with CLI 2.1.283) and the expected MCP servers.
- `--bare` is never used: it reads keys only.
- The CLI's `total_cost_usd` is its estimate of the API price. It is recorded, not billed.
- Jev runs on the app's own OpenRouter key, as it does for users.

**Judge.** For each finished run with a slide, `claude -p --model opus --json-schema <schema> --tools Read --allowedTools Read`, with the same isolation, in a temp folder holding only `slide.png`. It returns structured output (§4). The judge is Opus, not Jev: the agent already saw Jev's verdicts through `check_slide`, so scoring with the same judge would reward passing a test it was shown. `--judge-model=sonnet` is there when usage limits are tight; the report names the judge model.

**Repeats, resuming, limits.**
- Each case runs `--n` times (default 3).
- Results are keyed `caseId#n`, and a rerun with the same label skips finished runs.
- A run cut off by a usage limit, or by SmartChart's `rate` or `quota` errors, is `limited`. It is retried next time and never scored.

**Labels and comparison.** A run's label defaults to `<git short sha>[-dirty]-<yyyy-mm-dd>`, with output in `tests/mcp-eval/out/<label>/` (gitignored). `--against=<label>` adds a delta column to the report: magic rate, fatal rate and each check's pass rate, then against the baseline. A baseline worth keeping is committed as `tests/mcp-eval/baselines/<label>.md` (the report only).

## 3. Cases

`cases.json`, 25 cases. Requests are written the way an inexperienced user writes them: no template names, sometimes messy pasted data, sometimes too much of it, British English.

| Group | Count | Covers |
|---|---|---|
| criteria | 4 | options against criteria: has/lacks, degree, "we're the one that…", both styles |
| figures | 4 | P&L with a total, unit economics, store comparison, mixed £k/£m |
| positions | 2 | competitors and how each plays |
| actions | 2 | owner, date, status |
| stress | 5 | pasted 12-column CSV, 15 rows, Yes/No/Partly in words, a table and a trend in one request, data in a file in the folder |
| near-miss | 6 | sounds like a table but isn't: trend → chart, one figure → number, plan → steps, two-way contrast → cards, ranking → chart, market and share → pair |
| ask | 2 | too vague to act on |

```jsonc
{
  "id": "t01", "group": "criteria", "style": "consulting",
  "prompt": "Board wants to see how our SME card stacks up…",
  "gold": "table", "acceptable": [],          // ask cases: gold null
  "ask": false,
  "files": [],                                 // copied into the run's folder, e.g. ["pilot-stores.csv"]
  "facts": { "numbers": ["£250k", "£550"], "names": ["Acme", "Amex"] },   // stated in the request; must be on the slide
  "questions": [                               // yes/no for the judge; must: gates the magic rate
    { "q": "Is Acme the one highlighted row or column?", "must": true },
    { "q": "Are has/lacks judgements shown as ✓ / ✗ rather than words?", "must": true },
    { "q": "Does the title make Acme's big limit with no fee the so-what?", "must": true }
  ]
}
```

A unit test keeps the cases honest: ids are unique; every fact appears in the request (prompt plus files); gold and acceptable are offered templates; non-ask cases have questions; files exist.

## 4. Checks

● marks a **fatal** check: one whose failure hurts a user who trusts the slide without reading it closely.

**Code (exact and stable):**
- **Choice:**
  - `S1` The template is `gold` or acceptable.
  - `S2` Exactly one new slide (none for ask cases).
  - `S3` Ask cases: the reply is a question and nothing was written. Other cases: it didn't ask instead of writing.
  - `S4` The deck's style is the case's `style`. Reported only: the agent chooses it, and the slide is judged in the style chosen.
- **Faithful:**
  - `F1` ● Every `facts.numbers` value is on the slide.
  - `F2` ● Every `facts.names` value is on the slide.
  - Matching drops separators and currency, applies scale (k, m, bn, so `£1,200k` = `£1.2m`), keeps % as a unit, ignores sign and brackets, and reads chart values through their `format`. It never rounds.
  - Figures on the slide that aren't in the request go to the judge for F3.
- **Renders** (the existing fixture lints):
  - `R1` ● No fit issues: overflow, overlap, text wider than its column, line limits.
  - `R2` No layout lints (L1, L3, L6, C1, R15).
  - `R3` `validate()` has no errors.
  - Warnings are listed, not failed.
- **Wiring** (did the server instructions land?):
  - `P1` The guide and the written template's card were read before the first write.
  - `P2` The last write returned no issues.
  - `P3` `check_slide` ran after the last write.
  - `P4` Every write passed `request`.
  - `P5` The agent never set style, theme, accent, layout, colours, page numbers or the footer.
  - `P6` The reply is short (≤ 120 words), has no JSON, and contains the editor link.
  - `P7` No tool call was denied.

**Judge:**
- `F3` ● Each figure on the slide that isn't in the request is either *derived* (a sum, share, difference, or a count or year the request implies) or *invented*. One invented figure fails F3.
- `G1` (consulting) The title states a so-what. `G2` The body proves the title. Jev's own J-check verdicts are in the transcript as `check_slide` results, so the judge reads them as evidence instead of asking them again.
- `Q1…` The case's questions. `must` ones gate the magic rate.
- `M1` "A first-time user sees this slide. Would they present it unchanged? If not, the one thing they'd fix." Reported, never gated.
- **What confused the agent:** for every "no", every invented figure and every SmartChart issue left unfixed, the judge finds in the transcript the text that led the agent there. It quotes it exactly, names its source (server instructions, tool description, template card, guide, tool result, or none when the agent simply erred against clear guidance) and proposes the smallest fix. The report groups these by source: the fix list.
- Every answer carries a `why`, kept for the report.

## 5. Scores

- **Magic rate (headline):** the share of finished runs where S1–S3, F1–F3, R1, R3, G1 (consulting), G2 and every `must` question pass. A slide the judge hasn't seen is not magic yet.
- **Fatal rate:** the share of runs with any ● failure.
- Per-check pass rates; magic rate by group; for each case, how many of its runs reached magic (a 1/3 case is a prompt or card problem, not luck).
- With `--against`: each of these numbers beside the baseline's.

There are no pass bars in v1. The first full run is the baseline, and bars are agreed after it.

## 6. Files and commands

`tests/mcp-eval/`, in TypeScript, run with `vite-node` (already a dependency, and it resolves `@/`), typechecked by `npm run build`, linted with the repo. It has no `package.json` of its own and no model SDKs:
- `cases.json`, `files/`
- `types.ts`: case and result shapes.
- `claude.ts`: spawn the CLI with the scrubbed environment, the arguments, stream-json parsing, the init guard, limit detection.
- `account.ts`: empty, list and read decks through `/api/decks`.
- `checks.ts`: the code checks (S, F1–F2, R, P).
- `measure.ts`: the fixture lint and screenshot.
- `judge.ts`: the judge's prompt (with the transcript) and schema.
- `scores.ts`: all checks for a run, magic, summary and comparison.
- `report.ts`: `report.md` and `gallery.html` as strings.
- `eval.ts`: the command.
- `README.md`

```bash
npm run dev                                         # the app; .env: DATABASE_URL, OPENROUTER_API_KEY, SMARTCHART_EVAL_KEYS
npm run eval:mcp -- [--n=3] [--only=t01,t02] [--group=near-miss] [--label=…] [--against=<label>]
                    [--judge-model=opus] [--no-judge] [--report-only] [--url=…]
```

`gallery.html` shows every final slide's PNG at full size, with its request, failed checks and the M1 answer, and can be filtered to failures. It's for reviewing slides one by one.

## 7. Testing the eval itself

Unit tests (vitest, `tests/unit/mcp-eval/`):
- **Figures:** `£1,200k` matches `£1.2m`; `(53)` matches `-53`; `42%` does not match `42`; `FY25` is not a figure; chart values are read through their format.
- **Cases:** the honesty test in §3.
- **`claude.ts`:**
  - Arguments: no `--bare`; `--strict-mcp-config` and `--setting-sources local` present.
  - Environment: key variables removed.
  - Parsing: a stream-json transcript.
  - Guard: refuses an API key or an extra MCP server.
- **`checks.ts`:** S, P and R on small hand-built transcripts and decks.
- **`scores.ts`:** magic gating (a failed `must` question blocks magic; a non-`must` one doesn't; an unjudged run isn't magic) and comparison deltas.
- **Judge:** the schema's counts and sources; the prompt carries the transcript, lints and every question.

`measure.ts` gets one Playwright test (`tests/browser/`): a gallery table measures clean, and an overlong title is flagged.

The first real run, one case with `--n=1`, is the end-to-end check.

## 8. Cost and time

There are no paid Anthropic or OpenAI keys. A full run (25 cases × 3) is 75 Sonnet runs and about 70 Opus judge calls on the subscription's usage limits, plus a few cents of Jev. Expect one to two hours with 2 keys. A run after a prompt change can use `--only` or `--group`, plus `--n=1`, for a quick read before a full run.

## 9. Risks

- **The judge's taste is not the user's.** Questions are concrete yes/no, the `why` is kept, and the gallery lets a human overrule it. A question the judge answers differently across runs of the same slide gets rewritten.
- **Facts lists that are too strict.** Only figures the request states exactly are listed, and the matcher never rounds.
- **Claude Code changes between CLI versions.** The report records the CLI version and model. Comparisons across versions are flagged in the report.
- **Leaking into a real account or a paid key.** The isolation flags and environment scrubbing live in one place (`claude.ts`), are unit-tested, and the init guard stops the eval when they fail.
- **Eval decks in a shared database.** They live only in the test accounts and are emptied before each run. A Neon dev branch is preferred over production.

# MCP slide eval: Sonnet makes a slide, judged on what was asked (2026-10-03)

## 1. Goal

Measure whether an outside agent (Claude Sonnet over the SmartChart MCP) gives an inexperienced user the magic moment: one request in their own words, one slide back that is the right kind, keeps every fact, invents nothing, renders clean, and argues well. Tables first, because they are the most generic template and the easiest to get half right.

The eval answers two questions on every run:
- **Did it do what was expected?** Per-case expectations, checked by code where exact and by an independent judge where not.
- **Would a first-time user present it unchanged?** Reported, not gated.

It fills the "Agent harness: Claude Code over MCP" line of the MCP spec (`2026-10-01-agent-mcp-design.md` §11). It does not replace the in-app harness (`tests/agent-harness`), which tests GLM through `window.__journey`.

Non-goals: edits and storylines (later case sets on the same runner), latency targets, and scoring Jev.

## 2. Architecture

```
cases.json ──► run.ts ──► claude -p (Sonnet) ──HTTP──► npm run dev: /mcp/v1 (the app's own api/mcp.ts, real)
                               │                                     │
                               │ transcript                          ├─ Neon (DATABASE_URL), test account, agent key
                               ▼                                     └─ Jev (real, OpenRouter)
                       results.json ◄── final deck (GET /api/decks?id=) ── measure (Playwright: fixture.html lint + screenshot)
                               │
                               ├── judge.ts (claude -p, Opus: slide JSON + screenshot + request + reply + case questions)
                               └── report.ts ──► report.md, gallery.html
```

**The endpoint: the app itself, nothing rebuilt.** The eval tests existing code, so it reuses it and builds no copies. `npm run dev` already serves the real `/mcp/v1` through `vite/api-dev.ts`: `api/mcp.ts`, real key auth, the real deck service and database, real Jev, the real rate limit and quota. The agent connects there with a test account's agent key, exactly as a user's Claude Code connects to production. There is no eval server and no fake database. `--url=<mcp url>` points the same run at any deployment (default `http://localhost:5173/mcp/v1`; production as a smoke test). Measuring and judging don't change.

**Test accounts.** One or more test accounts made in the app (sign up, then Agent keys → new key), each used only by the eval. Their keys go in `.env` as `SMARTCHART_EVAL_KEYS` (comma-separated). Each worker owns one key, so the number of keys is the number of workers. Decks are user-scoped, so runs never see each other's decks.

**Reading and cleaning up, through the app's API.** The final deck is read with `GET /api/decks?id=` and the existing `docFromData()` (`src/engine/tools/doc.ts`). Decks are deleted with `DELETE /api/decks?id=`. Both accept the agent key. Before each run, the runner lists the account's decks (`GET /api/decks`) and deletes any that are left, so every run starts from an empty account. Every request the eval makes goes through code that users' requests also go through.

**No paid model keys.** The agent and the judge both run on this machine's Claude subscription, through the `claude` CLI in headless mode. Nothing calls the Anthropic or OpenAI API with a key. The runner deletes `ANTHROPIC_API_KEY` (and `ANTHROPIC_AUTH_TOKEN`) from the child process's environment, so the CLI always falls back to the subscription login. It reads the CLI's `system/init` event and aborts the run unless `apiKeySource` is `"none"` (the subscription login; checked with CLI 2.1.283) and `mcp_servers` is exactly `smartchart`. The `total_cost_usd` in the `result` event is the CLI's estimate of the API price; it is recorded for comparison, not billed. Do not use `--bare`: it reads keys only, never the subscription.

**Agent: the user's experience, unchanged.** Sonnet must get exactly what a user gets who installed Claude Code, added the SmartChart connector and asked for a slide. The rule for every flag: isolate the run from *this machine* (its settings, plugins, projects and accounts), never change what Claude Code or the connector does. So the eval keeps:
- Claude Code's default system prompt and **full default tool set**, including ToolSearch. Claude Code loads MCP tools through it when deferring them, so removing tools would change how Sonnet finds SmartChart at all.
- The server's `initialize` instructions, the tool descriptions, the guide and card resources, and Claude Code's own MCP output limits (no env overrides).
- An **empty account**: no decks (§2, Start).
- One user message, in the user's words, with nothing added by the eval.

One subprocess per run:

```bash
claude -p "<case prompt>" --model sonnet \
  --mcp-config <run>/mcp.json --strict-mcp-config \
  --allowedTools "mcp__smartchart__*" \
  --setting-sources local --no-session-persistence \
  --output-format stream-json --verbose --max-turns 40
```

- `cwd` is a fresh temp folder for the run: a user's working folder with no `CLAUDE.md`, project settings, skills or memory from this repo. It holds only the case's `files` (§3), if any.
- `--setting-sources local` drops this machine's user settings (hooks, plugins, other MCP servers). The run is a clean install of Claude Code.
- `--strict-mcp-config` loads only `smartchart`, so the run cannot write to the production connector configured on this machine.
- `--allowedTools "mcp__smartchart__*"` is the user who clicked "always allow" on the connector. Other tools keep Claude Code's defaults: those that run without asking (reading files in the folder) work as for a user, and those that would prompt are denied in headless mode and recorded (`P7`).
- `mcp.json` is the connector setup the app tells users to run: `smartchart` at `--url`, `type: "http"`, `Authorization: Bearer <the worker's eval key>`.
- The `stream-json` output is the transcript: every tool call, tool result and assistant message, plus `usage` and `duration_ms` from the final `result` event.
- Timeout: 10 minutes per run.
- The model alias (`sonnet`) and the CLI version are recorded in the report (`claude --version`, and the model from `system/init`).

**Start.** Each run starts from its worker's test account with no decks: a new user. Following the server instructions, the agent calls `list_decks`, finds nothing and calls `create_deck`, choosing the style from the request (or asking). The case's `style` is the style a good agent would pick. It is checked (`S4`), and every style-dependent check (caption, budget, J-checks) uses the style the agent actually chose.

**Should-ask cases.** When the agent's final message is a question and nothing was written, the run ends there and is scored. The eval never answers questions back: a follow-up turn would measure the eval's answers, not the agent.

**Measuring.** For each run, the final deck's slides are measured in Playwright at 1920×1080 on `src/dev/fixture.html` (`npm run dev` must be running):
- `window.lint(slide, style)` returns the fit issues, the layout lints and the warnings.
- A full-size PNG is taken of the slide.
- `validate()` (`src/engine/slides/schema.ts`) runs on the final JSON.

**Judging.** `judge.ts` runs `claude -p --model opus --json-schema <judge schema> --tools Read --allowedTools Read --setting-sources local --strict-mcp-config --no-session-persistence --output-format json` once per run, with the same environment scrubbing and an empty temp `cwd` that holds only the run's PNG. The prompt carries the request, the final slide JSON and the case's questions, and tells the judge to Read `slide.png`. The answer arrives as structured output in the fixed schema (§4.5). Opus judges, not Jev, because the agent already saw Jev's verdicts through `check_slide`, and scoring with the same judge rewards passing a test it was shown. Jev's own `check_slide` results are still recorded, so the two judges' agreement can be compared.

**Repeats.** Each case runs 3 times (`--n=3`) to see variance. Workers default to 2: the runs share one subscription's usage limits. A run that ends with a usage-limit error is recorded as `limited`, not failed. It is left out of the scores and retried on the next invocation. `results.json` is keyed `caseId#n`, and finished runs are skipped on a rerun, as in the in-app harness.

## 3. Cases

`cases.json`, about 25 cases. Requests are written the way an inexperienced user writes them: no template names, sometimes messy pasted data, sometimes too much of it, and British English, as in `requests.json`.

| Group | Count | Covers |
|---|---|---|
| Options against criteria | 4 | providers × features, "we're the one that…", has/lacks and degree, both styles |
| Exact figures | 4 | P&L with a total row, unit economics, store comparison, mixed £k/£m |
| Explaining positions | 2 | competitors with a "how they play" column |
| Actions | 2 | owner, date, status |
| Stress | 5 | pasted 12-column CSV, 15 rows (cut or group, and say so), Yes/No/Partly in words, a request mixing a table and a trend, data in a file in the folder ("the numbers are in pilot-stores.csv") |
| Near-miss | 6 | sounds like a table but isn't: trend over time → chart, one figure → number, plan → steps, two-way contrast → cards, ranking → chart, market and share → pair |
| Should ask | 2 | too vague to act on ("make a slide comparing us to competitors", with no data or names) |

Case shape:

```jsonc
{
  "id": "t03",
  "group": "criteria",
  "style": "consulting",
  "prompt": "We're pitching Acme's card to the board vs Amex, Barclaycard and Revolut…",
  "gold": "table",
  "acceptable": [],
  "ask": false,                       // true: the pass is a question and no slide
  "files": [],                        // fixtures copied into the run's cwd, e.g. ["pilot-stores.csv"]
  "facts": {                          // must appear on the slide (normalised text match)
    "numbers": ["£250k", "1%", "£0"],
    "names": ["Amex", "Barclaycard", "Revolut", "Acme"]
  },
  "expect": {                         // code-checked; only what this case needs
    "entities": "rows",               // things compared are rows | columns
    "focus": "Acme",                  // the focused row or column label contains this
    "marks": "ticks",                 // ticks | harvey | any (one kind, either) | none
    "total": false,                   // a row with style "total"
    "status": false,                  // status labels used
    "groups": false,                  // group headings used
    "bullets": false,                 // bullets in a cell used
    "iconsOnlyOverMarks": true,
    "caption": true,
    "maxColumns": 5,
    "notes": "optional"               // required | none | optional
  },
  "questions": [                      // case-specific yes/no for the judge; "must" ones gate the magic rate
    { "q": "Does the title make Acme's limit advantage the so-what?", "must": true },
    { "q": "Do the notes give a cause or implication not visible in the table?", "must": false }
  ]
}
```

Writing the facts lists is part of writing each case: they are what the request states, not what a good slide might add.

## 4. Checks

Each check produces `{ id, ok, msg }`. **Fatal** checks are marked ●. A fatal failure means the slide hurts a user who trusts it without reading it closely.

### 4.1 Slide choice (code)
- `S1` The template is `gold` or in `acceptable`. A near-miss written as a table fails.
- `S2` Exactly one new slide (zero for should-ask).
- `S3` Should-ask: the final message is a question and nothing was written. Clear cases: no question asked before writing.
- `S4` The deck's style is the case's `style`. A board or client request goes to consulting; an investor or fundraising request goes to pitch. Reported, not in the magic rate: a user can switch style in one click, and the slide is judged in the style that was chosen.

### 4.2 Faithful to the request (code + judge)
- `F1` ● Every `facts.numbers` value is on the slide. Matching is normalised: thousands separators, £/€/$ dropped, scale applied (k, m, bn), % kept as a unit, sign and brackets ignored. Chart values are read through their `format` (`18` with `£{v}m` is `£18m`).
- `F2` ● Every `facts.names` value is on the slide.
- `F3` ● Nothing invented. Code lists every number on the slide that is not in the request. The judge marks each one *derived* (a sum, a share, a difference of request figures, a year or count in the request's words) or *invented*. Any invented number fails.

### 4.3 Renders clean (code, measured)
- `R1` ● No fit issues: overflow, overlap, text wider than its column, a title, subtitle or takeaway over its line limit.
- `R2` No layout lints: L1 equal columns, L3 body start, L6 equal heights, C1 chart labels, R15 colours.
- `R3` `validate()` returns no errors.
- Warnings (L5 empty body, validation warnings) are counted and listed. They never fail a run.

### 4.4 Table components (code, from `expect`)
Only the keys a case sets are checked, and only when the slide is a table.
- `T1` Orientation: the `facts.names` sit in the first column (rows) or in the headers (columns).
- `T2` Focus is on the row or column whose label contains `expect.focus`, and only there.
- `T3` Marks: ticks only, Harvey balls only, or no marks, as expected.
- `T4` Total row present or absent.
- `T5` Status labels, group headings and bullets in cells used as expected.
- `T6` Header icons only over columns whose body cells are mostly marks.
- `T7` Caption present (consulting).
- `T8` At most `maxColumns` columns; notes required, absent or optional as expected.
- `T9` Rule check R13 (consistent units and precision) passes. This reuses `ruleChecks` from `src/engine/agent/checks.ts`.

### 4.5 Logic (Opus judge)
The generic questions are the J-checks' questions, reused word for word from `checks.ts` so the two judges answer the same thing, and applied where `judgmentChecks` applies them:
J1 action title, J2 body proves the claim, J3 MECE, J4 highlight matches, J5 takeaway adds, J6 one idea (pitch), J7 right template, J8 parallel form, J9 words that should be marks, J10 decorative icons.

On top of those come the case's `questions` and one holistic question:
- `M1` "A first-time user sees this slide. Would they present it unchanged? If not, the one thing they'd fix." Reported, never gated.

The judge returns JSON:

```json
{ "generic": { "J1": { "answer": "action", "why": "..." } },
  "case": [ { "q": "...", "yes": true, "why": "..." } ],
  "numbers": [ { "value": "£1.2m", "kind": "derived", "why": "sum of rows" } ],
  "magic": { "presentAsIs": false, "fix": "..." } }
```

The judge's `why` is kept for the report, so every failure can be audited.

### 4.6 Process (code, from the transcript)
- `P1` `get_guide` and `get_template` (for the template written) were called before the first write.
- `P2` Every issue a write returned was followed by a change at that path, or by a reply that explains why not.
- `P3` `check_slide` was called after the last write.
- `P4` Every write passed `request`, and it contains words from the user's prompt.
- `P5` No write set style, layout, colours, page numbers or the footer.
- `P6` The final reply is short (at most 120 words), has no JSON, and contains the deck's `links.edit`.
- `P7` No tool call was denied. A denied call (a shell command, a web fetch) is one a real user would have been asked to approve: friction in the magic moment, and listed in the report.
- Recorded, not checked: tool calls by name, turns, wall time, input and output tokens, cost.

## 5. Scores

- **Magic rate (headline):** the share of runs where S1–S3, F1–F3, R1, R3, every T-check set by the case, J1, J2 and J7, and every `must` case question all pass.
- **Fatal rate:** the share of runs with any ● failure. Reported next to the magic rate: a slide that drops a figure or overflows is worse than a weak title.
- **Per-check pass rate,** across runs and broken down by group.
- **Consistency:** for each case, how many of its 3 runs reached the magic bar (3/3, 2/3…). A case that passes only sometimes is a prompt or card problem, not luck.
- **Judge agreement:** Opus against Jev on J1–J10 for every run, as % agreement for each check.

No pass bars in v1: the first run sets the baseline, and bars are agreed after it, as with the in-app harness.

## 6. Output

`tests/mcp-eval/`:
- TypeScript, run with `vite-node` (already a dependency; it resolves the `@/` alias), typechecked by `npm run build`, using the repo's own Playwright and MCP SDK. No `package.json` of its own and no model SDKs. Scripts: `npm run eval:mcp`, `eval:judge`, `eval:report`.
- `cases.json`, `files/` (fixtures for cases that point at a file), `types.ts`, `account.ts` (list, read and delete decks through `/api/decks`), `claude.ts` (spawns `claude -p` with the scrubbed environment and parses stream-json), `stub.ts` (the scripted agent for the smoke run), `facts.ts`, `table-checks.ts`, `run-checks.ts`, `measure.ts`, `run.ts`, `judge.ts`, `scores.ts`, `report.ts`, `README.md`
- Written per run, gitignored except a dated baseline:
  - `results.json`: the transcript summary, final slide, lints, checks and judge output for every run
  - `report.md`: in the in-app harness's format; the headline table, then "For review" listing each failure with its check, message and judge `why`
  - `gallery.html`: every final slide's PNG at full size, with the request, failed checks and the M1 answer beside it, filterable to failures. This is for reviewing slides one by one.
  - `shots/`: the PNGs

```bash
npm run dev                                   # the app: /mcp/v1 and fixture.html; .env with DATABASE_URL, OPENROUTER_API_KEY, SMARTCHART_EVAL_KEYS
claude                                        # once, if not logged in: sign in with the subscription
npm run eval:mcp -- --n=3 --workers=2 [--only=t01,t02] [--group=near-miss] [--url=https://www.occamslides.com/mcp/v1]
npm run eval:judge && npm run eval:report
```

## 7. Testing the eval itself

- **Unit (vitest, in `tests/unit`):**
  - The fact matcher's normalisation (`£1,200k` against `£1.2m` is *not* a match; `(53)` against `-53` is).
  - The T-checks on the four gallery tables in `starters.json` with hand-written `expect`s: all pass, and each fails when its `expect` is flipped.
- `claude.ts`: the spawn arguments and the scrubbed environment (no `ANTHROPIC_API_KEY`, no `--bare`), and stream-json parsing on a recorded transcript.
- **Smoke:** one scripted run with a stub "agent" that sends a fixed `create_slide` from a gallery table. It must reach the magic bar end to end: server, measure, judge and report. This proves the pipe before spending tokens on Sonnet.

## 8. Cost and time

No paid Anthropic or OpenAI keys: 75 Sonnet runs (about 25 cases × 3) and 75 Opus judge calls come out of the subscription's usage limits. Opus is the heavier draw, so `judge.ts` can run later and separately, and `--judge-model=sonnet` is available when limits are tight. That choice is recorded in the report, because the judge's results are then not comparable with Opus runs. Jev (OpenRouter, the app's own model and key, as the in-app harness uses) is called once per `check_slide`, cents per full run. Expect one to two hours with 2 workers. Reruns skip finished and `limited` runs and retry the rest.

## 9. Risks

- **The judge's taste is not the user's.** Mitigations: case questions are concrete yes/no, `why` is kept, and the gallery lets a human overrule the judge. Run-to-run disagreement on the same slide is a sign to rewrite the question.
- **Facts lists that are too strict** (the request says "about £11k", the slide says "£11.4k"). The case author lists only figures the request states exactly. The normaliser handles format and scale only (`£1,200k` = `£1.2m`, `(53)` = `−53` = `53`: sign is ignored, since a cost written as a positive figure under a "Cost" label is fine), never rounding.
- **Claude Code changes between CLI versions** (system prompt, tool handling). The report records the CLI version and the model, and results are compared only across runs on the same version, or with that change noted.
- **Leaking into the real account or a paid key.** `--strict-mcp-config`, `--setting-sources local`, an empty `cwd` and the scrubbed environment are set in one place (`claude.ts`) and unit-tested: the spawn arguments and environment are asserted, and a run aborts when `system/init` reports any MCP server other than `smartchart` or any auth source other than the subscription.
- **Subscription limits mid-run.** Runs are marked `limited` and retried, never scored as failures.
- **Eval decks in a shared database.** They live only in the test accounts and are deleted before each run. If `DATABASE_URL` is the production database, the accounts are ordinary users there. A dev branch is preferred.
- **Rate limit and quota.** Real limits apply: 60 calls a minute per key, and the daily model-call quota per user (Jev). A run sits well under both. A `rate` or `quota` error is recorded as `limited`, like a subscription limit.

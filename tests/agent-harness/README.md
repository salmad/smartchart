# Agent harness

Reproduces the hybrid-agent test in `docs/research/2026-09-27-hybrid-agent-2/` (report.md there is the baseline) against the v1 app: 30 single requests, 15 surgical edits and one long session per style, driven through `window.__journey`.

```bash
npm run dev                      # in the repo root, with the model keys in .env
cd tests/agent-harness && npm i
node run.mjs --workers=4 && node analyze.mjs   # writes results.json, then report.md
```

## Parity run on the TS engine (2026-09-27)

`report.md` is this run; the baseline is `docs/research/2026-09-27-hybrid-agent-2/report.md` (prototype at 788f4d7). Same pipeline, same number of model calls per turn (66 GLM calls each), prompts 4% longer, outputs 5% longer. Every slide ends fitting, no edit drift, first-write shape 90% in long sessions (baseline 80%).

Three plan bars missed, none from the port:
- **Latency** (new slide p50 18.6 s vs 12.5 s; edit 7.7 s vs 3.1 s): turn time minus model time is ~0 s (new) and ~0.5 s (edit); GLM itself generated 23 tokens/s vs 35 in the baseline, and returned rate-limit errors (19 turns, rerun with 2 workers).
- **Numbers kept 95% vs 98%**: one pitch request (p24) routed to framed cards and dropped its figures; three reruns of p24 and p25 kept every number (Jev picked cards twice, table once).

## Docs over MCP (M5)

`docs-mcp.ts` gives a model only the MCP instructions and tools and has it write three docs (competitor research, a PRD, a legal memo, from `docs.json`) through the real MCP handler, in this process on the in-memory Db: no account, no database. The model is OpenRouter's (`OPENROUTER_API_KEY` in `.env`; `OPENROUTER_MODEL`, default Haiku 5.5, is metered). Judgment checks answer as passes; the run is about the doc tools and the code checks.

```bash
npx vite-node tests/agent-harness/docs-mcp.ts [--only=<id>] [--steps=60]   # from the repo root; writes results-docs.json
```

First run (2026-10-19, Haiku 5.5): all three docs parse and validate with no errors and meet their briefs; 13, 26 and 13 tool calls, 2, 7 and 4 refused writes (character limits and a misplaced `source`, each named by path and fixed on the next call; one `read_slide` on a doc id); `check_doc` returned warnings only and left each doc's text and rev unchanged. The competitor doc was read at full size in the app: summary, revenue chart, scorecard, every figure with its caption and the given source.

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

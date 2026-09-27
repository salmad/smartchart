# Single-slide test: MVP agent vs the fixed pipeline (2026-09-26)

**Question:** does the MVP agent (spec 9.0–9.5: GLM 5.3 Flash in a tool loop with `create_slide`, `edit_slide`, `read_slide`) make single slides as well and as fast as the journey prototype's fixed pipeline?

**Setup:**
- `requests.json`: 30 requests from the routing bake-off set (`../2026-09-26-routing-bakeoff/prompts.json`), 15 consulting and 15 pitch, 3 per content template (chart, table, number, steps, cards); plus 10 warm-up requests per style for the long sessions.
- `run.mjs`: drives the journey page in headless Chromium, so fit is measured by the real renderer at 1920×1080. Each request runs in its own style from an empty deck, once with `?engine=pipeline` and once with the agent. Long sessions: one agent session per style, 10 warm-up turns, then 5 measured requests.
- `analyze.mjs` writes `report.md`. Run: start `node docs/design/proposals/journey/server.mjs`, then here `npm i && node run.mjs && node analyze.mjs`.

**Results** (run 2, `report.md`):

| | Pipeline | Agent | Agent after 10 turns | Bar |
|---|---|---|---|---|
| Gold template | 97% | 93% | 100% | |
| Every request number on the slide | 93% | 100% | 100%¹ | ≥ 95% |
| First write shape-valid | – | 93% | 70% (n = 10) | ≥ 90% |
| Ends with no fit issues | 100% | 100% | 100% | ≥ 95% |
| Short reply, no JSON | – | 100% | 100% | ≥ 95% |
| Model calls per turn (median) | 4 | 4 | 5 | |
| Latency p50 / p95 | 11.8 / 37.5 s | 17.4 / 52.2 s | 21.2 / 36.7 s | |

¹ The analyser reports 90%: in p24 the agent wrote £6k as 6000 in table cells; all figures are present.

Same template as the pipeline: 28 of 30. Both differences are comparisons the agent put in cards instead of a table (c26, p24).

**Findings:**
1. **The agent keeps the user's figures better** (100% vs 93%). Where requests give no figures (c11, c12, c27, p14), it uses illustrative ones and marks them, as the rules say.
2. **Run 1 had a bug in the write path:** `validate()` lists limits (characters, item counts, table budget) together with shape errors, and every one blocked the write. First writes passed 33% and p50 was 28.3 s (`report-run1.md`). Treating limits as fit issues (applied and returned, spec 9.4) fixed it: 93% and 17.4 s.
3. **Latency is the gap:** about 5.5 s behind the pipeline at the median. Model time is ~95% of a turn (agent steps median 4.6 s each, the reply 3.0 s; tools 0.6 s per turn). Runs used 4 parallel sessions, which slows GLM. Options, in order: stream the reply; let the agent end on its last write without a separate reply call when there are no issues; thinking off stays.
4. **Remaining first-write errors are schema knowledge the cards do not make obvious:** `notes[].point` on a lines chart (5), table columns without `label` (4), cards with both `bullets` and `text` (3). Fix in the template cards and examples, not in the agent.
5. **A long conversation does not hurt the result** (all 10 end valid with every figure), but first writes were valid less often (7 of 10).
6. **Invented figures when the user gave none.** No invented values in any series the user gave (the hard rule works). But where a request has no figures, the agent sometimes writes specific ones without marking them, and once cited a source that does not exist: c26 (competitor prices, a £100k credit line, "FinBridge pricing sheet; provider websites, June 2024"), p25 (hires and milestones such as "10 engineers", "£1.5m ARR"). Derived figures are fine (c06 £11.4k, p15 +138%); c11, c12, c27, p26 are marked illustrative. The pipeline does the same (c26: 50, 150, 100). After this run the prompt gained two hard rules (never cite a source the user did not give; mark illustrative figures in both styles); not yet re-tested.

> Ran at commit 788f4d7; paths refer to that tree (the prototype has since moved to src/).

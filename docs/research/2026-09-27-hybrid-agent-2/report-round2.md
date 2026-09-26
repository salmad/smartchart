# Hybrid agent test (2026-09-27)

Single: 30 requests from the routing bake-off set, each in its own style from an empty deck. Long: one session per style, 10 warm-up turns, then 5 measured requests. Edits: 15 requests on approved example slides. Fit and layout lints are measured by the journey page's renderer at 1920×1080. Models: GLM 5.3 Flash (thinking off), Jev. Latency is time to the reply; judgment checks run after it.

| Measure | Pass | Result | |
|---|---|---|---|
| Every request number on the slide (single + long) | ≥ 95% | 92% | FAIL |
| First write shape-valid, long session | ≥ 90% | 80% | FAIL |
| First write shape-valid, single |  | 86% |  |
| Ends with no fit issues (single / long / edits) | ≥ 95% | 100% / 100% / 100% | PASS |
| Drift on edits (paths outside `allow`) | 0 | 1 of 15 edits | FAIL |
| Edits reaching their `expect` |  | 93% |  |
| Edits done only with patch_slide |  | 100% |  |
| Latency p50, new slide | ≤ 13 s | 11.4 s | PASS |
| Latency p50, small edit | ≤ 6 s | 3.3 s | PASS |
| Template agrees with gold (single + long) | ≥ 90% | 92% | PASS |
| Short reply, no JSON (single + long) | ≥ 95% | 100% | PASS |
| Layout lints clean on every final slide | 100% | 100% | PASS |
| Jev choices vs labels (chart requests routed to chart) | ≥ 90% | 50% (3 of 6) | FAIL |

| Also measured | Result |
|---|---|
| PRE made the first tool call | 85% of 55 turns |
| PRE intent right (single: new_slide, edits: edit_selected) | 91% |
| Turns ended by a write's reply (no extra model call) | 93% |
| Model calls per turn, median (single / long / edits) | 2 / 3 / 1 |
| Latency p95 (new slide / small edit) | 32.8 s / 9.6 s |

## For review

### Single

- Errors or no slide: 
  - p26: no slide (reply: Happy to build that as a comparison table — one question first: do you have the actual figures (credit line, price per u)
- Request numbers missing from the slide: none
- Fit issues left: none

### Long

- Errors or no slide: none
- Request numbers missing from the slide: 
  - c10: 18, 19, 22, 21, 26, 31, 30, 36
  - c06: 11400
  - c40: 18
- Fit issues left: none

### Edits

- Errors: none
- Drift: 
  - e04: footnote
- Expected values not reached: 
  - e04: chart.series[3].mark = "line" (want "bar")
- Fit issues left: none
- Not only patch_slide: none

### Jev chart choices

- c10: got line, label line ✓
- c11: got bar, label line ✗
- c12: got line, label line ✓
- p13: got bar, label bar ✓
- p14: got bar, label line ✗
- p15: got bar, label line ✗

- Layout lint issues on final slides: none

# Hybrid agent test (2026-09-27)

Single: 30 requests from the routing bake-off set, each in its own style from an empty deck. Long: one session per style, 10 warm-up turns, then 5 measured requests. Edits: 15 requests on approved example slides. Fit and layout lints are measured by the journey page's renderer at 1920×1080. Models: GLM 5.3 Flash (thinking off), Jev. Latency is time to the reply; judgment checks run after it.

| Measure | Pass | Result | |
|---|---|---|---|
| Every request number on the slide (single + long) | ≥ 95% | 95% | FAIL |
| First write shape-valid, long session | ≥ 90% | 90% | PASS |
| First write shape-valid, single |  | 97% |  |
| Ends with no fit issues (single / long / edits) | ≥ 95% | 100% / 100% / 100% | PASS |
| Drift on edits (paths outside `allow`) | 0 | 0 of 14 edits | PASS |
| Edits reaching their `expect` |  | 100% |  |
| Edits done only with patch_slide |  | 100% |  |
| Latency p50, new slide | ≤ 13 s | 18.6 s | FAIL |
| Latency p50, small edit | ≤ 6 s | 7.7 s | FAIL |
| Template agrees with gold (single + long) | ≥ 90% | 95% | PASS |
| Short reply, no JSON (single + long) | ≥ 95% | 100% | PASS |
| Layout lints clean on every final slide | 100% | 100% | PASS |
| Jev choices vs labels (chart requests routed to chart) | ≥ 90% | 83% (5 of 6) | FAIL |

| Also measured | Result |
|---|---|
| PRE made the first tool call | 83% of 54 turns |
| PRE intent right (single: new_slide, edits: edit_selected) | 91% |
| Turns ended by a write's reply (no extra model call) | 94% |
| Model calls per turn, median (single / long / edits) | 2 / 3 / 1 |
| Latency p95 (new slide / small edit) | 56.8 s / 15.4 s |

## For review

### Single

- Errors or no slide: 
  - c27: no slide (reply: Happy to build that table — but I don't want to invent your store numbers. Can you share the actual figures for each pil)
- Request numbers missing from the slide: 
  - p24: 6, 28, 78, 81, 4.5, 14, 11, 7
  - p25: 4
- Fit issues left: none

### Long

- Errors or no slide: none
- Request numbers missing from the slide: none
- Fit issues left: none

### Edits

- Errors: 
  - e12: {"code":"1302","message":"Rate limit reached for requests"}
- Drift: none
- Expected values not reached: none
- Fit issues left: none
- Not only patch_slide: none

### Jev chart choices

- c10: got line, label line ✓
- c11: got line, label line ✓
- c12: got line, label line ✓
- p13: got bar, label bar ✓
- p14: got bar, label line ✗
- p15: got line, label line ✓

- Layout lint issues on final slides: none

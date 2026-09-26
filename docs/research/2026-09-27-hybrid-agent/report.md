# Hybrid agent test (2026-09-27)

Single: 30 requests from the routing bake-off set, each in its own style from an empty deck. Long: one session per style, 10 warm-up turns, then 5 measured requests. Edits: 15 requests on approved example slides. Fit and layout lints are measured by the journey page's renderer at 1920×1080. Models: GLM 5.3 Flash (thinking off), Jev. Latency is time to the reply; judgment checks run after it.

| Measure | Pass | Result | |
|---|---|---|---|
| Every request number on the slide (single + long) | ≥ 95% | 97% | PASS |
| First write shape-valid, long session | ≥ 90% | 100% | PASS |
| First write shape-valid, single |  | 76% |  |
| Ends with no fit issues (single / long / edits) | ≥ 95% | 100% / 100% / 100% | PASS |
| Drift on edits (paths outside `allow`) | 0 | 1 of 15 edits | FAIL |
| Edits reaching their `expect` |  | 93% |  |
| Edits done only with patch_slide |  | 100% |  |
| Latency p50, new slide | ≤ 13 s | 22.9 s | FAIL |
| Latency p50, small edit | ≤ 6 s | 10.1 s | FAIL |
| Template agrees with gold (single + long) | ≥ 90% | 97% | PASS |
| Short reply, no JSON (single + long) | ≥ 95% | 97% | PASS |
| Layout lints clean on every final slide | 100% | 100% | PASS |
| Jev choices vs labels (chart requests routed to chart) | ≥ 90% | 100% (6 of 6) | PASS |

| Also measured | Result |
|---|---|
| PRE made the first tool call | 80% of 55 turns |
| PRE intent right (single: new_slide, edits: edit_selected) | 91% |
| Turns ended by a write's reply (no extra model call) | 49% |
| Model calls per turn, median (single / long / edits) | 3 / 3 / 2 |
| Latency p95 (new slide / small edit) | 44.6 s / 21.3 s |

## For review

### Single

- Errors or no slide: 
  - c26: no slide (reply: Happy to build this — do you have the actual figures (FX fee %, monthly fee per user, credit line for FinBridge and each)
- Request numbers missing from the slide: none
- Fit issues left: none

### Long

- Errors or no slide: none
- Request numbers missing from the slide: 
  - c10: 18, 19, 22, 21, 26, 31, 30, 36
- Fit issues left: none

### Edits

- Errors: none
- Drift: 
  - e12: cards[1].value
- Expected values not reached: 
  - e12: cards[0].value = "5.7M" (want "25%")
- Fit issues left: none
- Not only patch_slide: none

### Jev chart choices

- c10: got line, label line ✓
- c11: got line, label line ✓
- c12: got line, label line ✓
- p13: got bar, label bar ✓
- p14: got line, label line ✓
- p15: got line, label line ✓

- Layout lint issues on final slides: none

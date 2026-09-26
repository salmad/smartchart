# Single-slide test: pipeline vs MVP agent (2026-09-26)

Requests: 30 from the routing bake-off set (15 consulting, 15 pitch; 3 per content template), each run in its own style from an empty deck. Long: one agent session per style, 10 warm-up turns, then 5 measured requests. Fit is measured by the journey page's renderer at 1920×1080. Models: GLM 5.3 Flash (thinking off), Jev.

| Measure | Pipeline | Agent | Agent, after 10 turns | Agent pass bar |
|---|---|---|---|---|
| Requests | 30 | 30 | 10 | |
| Produced a slide | 100% | 100% | 100% | |
| Gold template (or acceptable) | 97% | 90% | 100% | |
| Every request number on the slide | 93% | 100% | 100% | ≥ 95% |
| First edit_slide shape-valid | – | 33% | 30% | ≥ 90% |
| Ends with no fit issues | 100% | 100% | 100% | ≥ 95% |
| Short reply, no JSON | – | 100% | 100% | ≥ 95% |
| Model calls per turn, median | 4 | 5 | 4 | |
| Tool calls per turn, median | – | 4 | 3 | |
| Latency p50 | 11.8 s | 28.3 s | 23.7 s | |
| Latency p95 | 37.5 s | 59.1 s | 45.4 s | |

Same template as the pipeline: 28 of 30 (93%; pass bar ≥ 90%).
Pipeline latency includes its Jev judgment checks after the slide; the agent runs none (dropped for the MVP).

## For review

### Pipeline

- Errors or no slide: none
- Request numbers missing from the slide: 
  - c10: 21
  - c06: 11400
- Numbers on the slide not in the request (above 10, not years; may be derived, e.g. a growth multiple): 
  - c11: 15, 12, 100, 78, 62, 54, 50, 47
  - c06: 11.4, 120, 50, 32
  - c12: 50, 13.1, 14.2, 15.2, 16.9, 18.2, 19.4, 57.6
  - c26: 50, 150, 100
  - c27: 182, 11.2, 165, 11.8, 195, 14.6, 158, 12.1
  - c40: 11, 15, 12
  - c45: 12, 25, 35, 15
  - c46: 40, 50
  - c47: 12
  - p14: 19, 56, 117, 204
  - p15: 138
  - p26: 12
  - p25: 18, 30
  - p40: 12

### Agent

- Errors or no slide: none
- Request numbers missing from the slide: none
- Numbers on the slide not in the request (above 10, not years; may be derived, e.g. a growth multiple): 
  - c11: 100, 82, 70, 64, 60, 57, 86, 79
  - c12: 13.5, 14.6, 15.8, 17.8, 19.6, 20.9, 22.1, 67.8
  - c06: 11.4
  - c26: 50
  - c27: 182, 14.8, 165, 12.4, 151, 12.1, 10.3, 143
  - c40: 11, 15
  - p15: 49
  - p14: 12, 20, 28, 36, 44, 15, 24, 38
  - p42: 25

### Agent, after 10 turns

- Errors or no slide: none
- Request numbers missing from the slide: none
- Numbers on the slide not in the request (above 10, not years; may be derived, e.g. a growth multiple): 
  - c06: 11.4
  - c40: 12, 13, 16, 17

### Template differences (agent vs pipeline vs gold)

- c26 (consulting): agent cards, pipeline table, gold table. "FinBridge vs Pleo, Soldo and Spendesk on FX fee, monthly fee per user and credit line. Then what it means for …"
- p24 (pitch): agent cards, pipeline table, gold table. "Unit economics, SMB vs mid-market: ACV £6k vs £28k, gross margin 78% vs 81%, CAC £4.5k vs £14k, payback 11 vs …"

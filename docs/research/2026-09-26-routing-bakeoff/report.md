# Routing bake-off: Jev vs GLM 5.3 Flash

100 labelled prompts (50 consulting, 50 pitch), 41 on a boundary between two templates.

| Contestant | Strict | Lenient | Consulting | Pitch | Boundary items | Errors | p50 ms | p95 ms | Cost |
|---|---|---|---|---|---|---|---|---|---|
| jev-bare | 88% | 89% | 90% | 86% | 83% | 0 | 498 | 701 | $0.0028 |
| jev-guide | 90% | 92% | 88% | 92% | 88% | 0 | 511 | 636 | $0.0040 |
| glm-flash | 88% | 91% | 94% | 82% | 80% | 0 | 1894 | 3377 | subscription |
| glm-flash-think | 92% | 96% | 98% | 86% | 88% | 0 | 4695 | 13250 | subscription |

## Accuracy by boundary (strict)

| Boundary | n | jev-bare | jev-guide | glm-flash | glm-flash-think |
|---|---|---|---|---|---|
| cover-section | 3 | 100% | 100% | 100% | 100% |
| number-vs-cards | 10 | 100% | 100% | 90% | 90% |
| chart-notes | 12 | 83% | 83% | 83% | 100% |
| chart-vs-table | 7 | 57% | 71% | 71% | 71% |
| table-notes | 4 | 75% | 100% | 50% | 75% |
| cards-vs-steps | 5 | 80% | 80% | 80% | 80% |

## Most common mistakes (gold → picked)

**jev-bare:** full/table → row/cards (4) · split/chart+notes → split/table+notes (2) · full/chart → split/chart+notes (2) · full/chart → full/table (1) · full/chart → row/cards (1) · split/table+notes → row/cards (1)

**jev-guide:** full/chart → split/chart+notes (3) · split/chart+notes → split/table+notes (2) · full/chart → full/table (1) · split/table+notes → full/table (1) · full/chart → row/cards (1) · full/table → row/cards (1)

**glm-flash:** split/table+notes → row/cards (4) · full/chart → split/chart+notes (3) · split/table+notes → split/chart+notes (1) · split/text+number → cover (1) · full/chart → row/cards (1) · full/table → row/cards (1)

**glm-flash-think:** split/table+notes → split/chart+notes (1) · split/text+number → full/chart (1) · split/text+number → row/cards (1) · full/chart → row/cards (1) · split/table+notes → full/table (1) · split/table+notes → row/cards (1)

## Calibration: jev-bare

| Top-choice probability | n | Accuracy |
|---|---|---|
| 0.0–0.5 | 7 | 57% |
| 0.5–0.6 | 6 | 50% |
| 0.6–0.7 | 9 | 67% |
| 0.7–0.8 | 2 | 100% |
| 0.8–0.9 | 10 | 90% |
| 0.9–1.0 | 66 | 97% |

| Threshold | Jev decides | Jev accuracy there | Hybrid accuracy (below threshold → glm-flash) |
|---|---|---|---|
| 0.5 | 93% | 90% | 89% |
| 0.6 | 87% | 93% | 91% |
| 0.7 | 78% | 96% | 90% |
| 0.8 | 76% | 96% | 89% |
| 0.9 | 66% | 97% | 89% |

## Calibration: jev-guide

| Top-choice probability | n | Accuracy |
|---|---|---|
| 0.0–0.5 | 5 | 60% |
| 0.5–0.6 | 6 | 83% |
| 0.6–0.7 | 9 | 78% |
| 0.7–0.8 | 8 | 63% |
| 0.8–0.9 | 10 | 90% |
| 0.9–1.0 | 62 | 98% |

| Threshold | Jev decides | Jev accuracy there | Hybrid accuracy (below threshold → glm-flash) |
|---|---|---|---|
| 0.5 | 95% | 92% | 91% |
| 0.6 | 89% | 92% | 88% |
| 0.7 | 80% | 94% | 89% |
| 0.8 | 72% | 97% | 90% |
| 0.9 | 62% | 98% | 88% |

## Items every contestant got wrong

- **p19** (pitch, gold full/chart): Us vs competitors on FX fees: us 0%, Amex 2.99%, high-street banks 2.75%, Pleo 1.5%. Make it obvious we're cheapest. → row/cards, row/cards, row/cards, row/cards
- **p36** (pitch, gold full/steps): What this raise unlocks over 18 months: £5m ARR, 3 enterprise logos, break-even. → row/cards, row/cards, row/cards, row/cards

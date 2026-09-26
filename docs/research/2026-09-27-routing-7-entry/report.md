# Routing bake-off on the 7-entry menu

100 labelled prompts (50 consulting, 50 pitch). 25 sit on a boundary between two entries; 16 more were "notes or not" boundaries on the 9-entry menu and are now plain chart or table items.

| Contestant | Strict | Lenient | Consulting | Pitch | Boundary items | Former notes items | Errors | p50 | p95 | Cost |
|---|---|---|---|---|---|---|---|---|---|---|
| jev-guide | 91% | 93% | 96% | 86% | 80% | 100% | 0 | 0.4 s | 0.5 s | $0.0052 |
| jev-guide-2 | 93% | 95% | 96% | 90% | 80% | 100% | 0 | 0.4 s | 0.4 s | $0.0052 |
| jev-bare | 89% | 90% | 96% | 82% | 84% | 94% | 0 | 0.4 s | 1.0 s | $0.0028 |
| jev-bare-2 | 90% | 91% | 96% | 84% | 84% | 94% | 0 | 0.4 s | 0.4 s | $0.0028 |
| glm-flash | 92% | 94% | 94% | 90% | 88% | 94% | 0 | 1.7 s | 2.6 s | subscription |
| glm-flash-think | 93% | 96% | 98% | 88% | 88% | 100% | 0 | 3.0 s | 7.7 s | subscription |

## Accuracy by boundary (strict)

| Boundary | n | jev-guide | jev-guide-2 | jev-bare | jev-bare-2 | glm-flash | glm-flash-think |
|---|---|---|---|---|---|---|---|
| cover-section | 3 | 100% | 100% | 100% | 100% | 100% | 100% |
| number-vs-cards | 10 | 90% | 90% | 100% | 100% | 100% | 90% |
| chart-vs-table | 7 | 57% | 57% | 57% | 57% | 71% | 86% |
| cards-vs-steps | 5 | 80% | 80% | 80% | 80% | 80% | 80% |
| (former) chart-notes | 12 | 100% | 100% | 100% | 100% | 100% | 100% |
| (former) table-notes | 4 | 100% | 100% | 75% | 75% | 75% | 100% |
| no boundary | 59 | 93% | 97% | 90% | 92% | 93% | 93% |

## Accuracy by gold entry (strict)

| Gold | n | jev-guide | jev-guide-2 | jev-bare | jev-bare-2 | glm-flash | glm-flash-think |
|---|---|---|---|---|---|---|---|
| cover | 5 | 100% | 100% | 100% | 100% | 100% | 100% |
| section | 4 | 100% | 100% | 100% | 100% | 100% | 100% |
| number | 12 | 83% | 92% | 92% | 100% | 92% | 83% |
| chart | 26 | 88% | 88% | 88% | 88% | 96% | 100% |
| table | 23 | 87% | 91% | 74% | 74% | 78% | 83% |
| steps | 13 | 92% | 92% | 92% | 92% | 92% | 92% |
| cards | 17 | 100% | 100% | 100% | 100% | 100% | 100% |

## Most common mistakes (gold → picked)

**jev-guide:** chart → cards (2) · table → chart (2) · chart → table (1) · number → chart (1) · number → cards (1) · table → cards (1)

**jev-guide-2:** chart → cards (2) · table → chart (2) · chart → table (1) · number → cards (1) · steps → cards (1)

**jev-bare:** table → cards (4) · chart → cards (2) · table → chart (2) · chart → table (1) · number → chart (1) · steps → cards (1)

**jev-bare-2:** table → cards (4) · chart → cards (2) · table → chart (2) · chart → table (1) · steps → cards (1)

**glm-flash:** table → cards (3) · table → chart (2) · chart → table (1) · number → chart (1) · steps → cards (1)

**glm-flash-think:** table → chart (2) · table → cards (2) · number → chart (1) · number → cards (1) · steps → cards (1)

## Jev run-to-run noise

| Pair | Same pick | Accuracy run 1 / run 2 | Mean abs. change in top p | Items that cross 0.7 |
|---|---|---|---|---|
| jev-guide vs jev-guide-2 | 98/100 | 91% / 93% | 0.010 | 2 |
| jev-bare vs jev-bare-2 | 99/100 | 89% / 90% | 0.008 | 0 |

## Calibration and combined policy: jev-guide

| Top probability | n | Accuracy |
|---|---|---|
| ≥ 0.9 | 79 | 99% |
| 0.7–0.9 | 7 | 86% |
| 0.5–0.7 | 12 | 50% |
| < 0.5 | 2 | 50% |

Policy: jev-guide picks if its top p ≥ T, otherwise GLM 5.3 Flash with thinking picks (Jev always runs first, so a GLM pick costs Jev + GLM time).

| T | Accuracy | Lenient | Sent to GLM | Jev accuracy where it decides | Mean latency | p95 latency |
|---|---|---|---|---|---|---|
| Jev alone | 91% | 93% | 0% | 91% | 0.4 s | 0.5 s |
| 0.5 | 91% | 93% | 2% | 92% | 0.6 s | 0.5 s |
| 0.6 | 92% | 94% | 10% | 96% | 1.2 s | 7.8 s |
| 0.7 | 94% | 96% | 14% | 98% | 1.3 s | 7.8 s |
| 0.8 | 92% | 95% | 17% | 98% | 1.4 s | 7.8 s |
| 0.9 | 93% | 96% | 21% | 99% | 1.6 s | 7.8 s |
| GLM alone | 93% | 96% | 100% | – | 4.1 s | 8.1 s |

## Calibration and combined policy: jev-guide-2

| Top probability | n | Accuracy |
|---|---|---|
| ≥ 0.9 | 80 | 99% |
| 0.7–0.9 | 8 | 75% |
| 0.5–0.7 | 10 | 60% |
| < 0.5 | 2 | 100% |

Policy: jev-guide-2 picks if its top p ≥ T, otherwise GLM 5.3 Flash with thinking picks (Jev always runs first, so a GLM pick costs Jev + GLM time).

| T | Accuracy | Lenient | Sent to GLM | Jev accuracy where it decides | Mean latency | p95 latency |
|---|---|---|---|---|---|---|
| Jev alone | 93% | 95% | 0% | 93% | 0.4 s | 0.4 s |
| 0.5 | 92% | 94% | 2% | 93% | 0.6 s | 0.5 s |
| 0.6 | 92% | 94% | 8% | 95% | 1.0 s | 7.4 s |
| 0.7 | 93% | 95% | 12% | 97% | 1.2 s | 7.8 s |
| 0.8 | 92% | 95% | 17% | 98% | 1.4 s | 7.8 s |
| 0.9 | 93% | 96% | 20% | 99% | 1.5 s | 7.8 s |
| GLM alone | 93% | 96% | 100% | – | 4.0 s | 8.1 s |

## Calibration and combined policy: jev-bare

| Top probability | n | Accuracy |
|---|---|---|
| ≥ 0.9 | 79 | 97% |
| 0.7–0.9 | 11 | 73% |
| 0.5–0.7 | 9 | 44% |
| < 0.5 | 1 | 0% |

Policy: jev-bare picks if its top p ≥ T, otherwise GLM 5.3 Flash with thinking picks (Jev always runs first, so a GLM pick costs Jev + GLM time).

| T | Accuracy | Lenient | Sent to GLM | Jev accuracy where it decides | Mean latency | p95 latency |
|---|---|---|---|---|---|---|
| Jev alone | 89% | 90% | 0% | 89% | 0.4 s | 1.0 s |
| 0.5 | 90% | 91% | 1% | 90% | 0.5 s | 1.1 s |
| 0.6 | 92% | 93% | 6% | 94% | 0.8 s | 4.1 s |
| 0.7 | 91% | 93% | 10% | 94% | 1.1 s | 6.0 s |
| 0.8 | 91% | 94% | 15% | 96% | 1.4 s | 7.4 s |
| 0.9 | 92% | 95% | 21% | 97% | 1.6 s | 7.9 s |
| GLM alone | 93% | 96% | 100% | – | 4.1 s | 8.1 s |

## Calibration and combined policy: jev-bare-2

| Top probability | n | Accuracy |
|---|---|---|
| ≥ 0.9 | 76 | 97% |
| 0.7–0.9 | 14 | 79% |
| 0.5–0.7 | 9 | 56% |
| < 0.5 | 1 | 0% |

Policy: jev-bare-2 picks if its top p ≥ T, otherwise GLM 5.3 Flash with thinking picks (Jev always runs first, so a GLM pick costs Jev + GLM time).

| T | Accuracy | Lenient | Sent to GLM | Jev accuracy where it decides | Mean latency | p95 latency |
|---|---|---|---|---|---|---|
| Jev alone | 90% | 91% | 0% | 90% | 0.4 s | 0.4 s |
| 0.5 | 91% | 92% | 1% | 91% | 0.4 s | 0.4 s |
| 0.6 | 91% | 92% | 5% | 93% | 0.7 s | 3.8 s |
| 0.7 | 91% | 93% | 10% | 94% | 1.0 s | 5.9 s |
| 0.8 | 91% | 94% | 16% | 96% | 1.3 s | 7.4 s |
| 0.9 | 92% | 95% | 24% | 97% | 1.7 s | 7.8 s |
| GLM alone | 93% | 96% | 100% | – | 4.0 s | 8.1 s |

## Side note: PRE intent (jev-guide)

new_slide: 84 · new_slide (p < 0.7): 10 · several_slides: 4 · several_slides (p < 0.7): 2

Every prompt asks for one new slide. PRE acts only on `new_slide` at p ≥ 0.7; any other answer leaves the template to the agent.

## Items most contestants got wrong

- **c14** (consulting, gold chart; wrong 4/6): How gross margin went from 38% to 31%: interchange cut -3pts, fraud losses -2, FX mix -1.5, pricing +0.5, other -1. Explain each of the big drivers briefly. → jev-guide cards (0.51), jev-guide-2 cards (0.54), jev-bare cards (0.56), jev-bare-2 cards (0.60), glm-flash chart, glm-flash-think chart
- **c23** (consulting, gold chart; wrong 4/6): Compare cost per delivery across our carriers: DPD £4.10, Evri £2.90, Royal Mail £3.40, UPS £5.20, in-house £3.80. The point is simply who's cheapest. → jev-guide table (0.67), jev-guide-2 table (0.65), jev-bare table (0.47), jev-bare-2 table (0.49), glm-flash chart, glm-flash-think chart
- **p09** (pitch, gold number; wrong 4/6): Why now: open banking API calls in the UK grew 10x in three years. → jev-guide chart (0.54), jev-guide-2 number (0.53), jev-bare chart (0.55), jev-bare-2 number (0.52), glm-flash chart, glm-flash-think chart
- **p11** (pitch, gold number, also ok cards; wrong 3/6): Hiring pain in logistics: warehouse roles take 47 days to fill on average, and each empty shift costs £380. Make the problem land. → jev-guide cards (0.54), jev-guide-2 cards (0.50), jev-bare number (0.69), jev-bare-2 number (0.68), glm-flash number, glm-flash-think cards
- **p19** (pitch, gold chart; wrong 4/6): Us vs competitors on FX fees: us 0%, Amex 2.99%, high-street banks 2.75%, Pleo 1.5%. Make it obvious we're cheapest. → jev-guide cards (0.65), jev-guide-2 cards (0.75), jev-bare cards (0.93), jev-bare-2 cards (0.95), glm-flash chart, glm-flash-think chart
- **p24** (pitch, gold table; wrong 3/6): Unit economics, SMB vs mid-market: ACV £6k vs £28k, gross margin 78% vs 81%, CAC £4.5k vs £14k, payback 11 vs 7 months. Investors need to see why we're doubling down on m → jev-guide table (0.50), jev-guide-2 table (0.52), jev-bare cards (0.89), jev-bare-2 cards (0.84), glm-flash cards, glm-flash-think table
- **p25** (pitch, gold table; wrong 4/6): Use of funds for the £4m raise: engineering £1.8m, sales £1.2m, marketing £0.6m, G&A £0.4m, with the hires and milestone each unlocks. Add a line on why engineering is th → jev-guide cards (0.37), jev-guide-2 table (0.42), jev-bare cards (0.69), jev-bare-2 cards (0.67), glm-flash table, glm-flash-think cards
- **p27** (pitch, gold table; wrong 4/6): Pricing: Starter free, Team £8/user, Business £15/user, Enterprise custom, with seats, integrations and support level for each. → jev-guide table (0.70), jev-guide-2 table (0.73), jev-bare cards (0.71), jev-bare-2 cards (0.76), glm-flash cards, glm-flash-think cards
- **p29** (pitch, gold table; wrong 4/6): KPI snapshot for the appendix, last 8 months: MRR, customers, churn %, CAC per month. → jev-guide chart (0.84), jev-guide-2 chart (0.86), jev-bare chart (0.53), jev-bare-2 chart (0.59), glm-flash table, glm-flash-think table
- **p30** (pitch, gold table; wrong 6/6): Pilot results for 7 warehouses: pick rate before and after, error rate before and after. → jev-guide chart (0.58), jev-guide-2 chart (0.61), jev-bare chart (0.53), jev-bare-2 chart (0.54), glm-flash chart, glm-flash-think chart
- **p36** (pitch, gold steps, also ok cards; wrong 6/6): What this raise unlocks over 18 months: £5m ARR, 3 enterprise logos, break-even. → jev-guide cards (0.98), jev-guide-2 cards (0.98), jev-bare cards (0.95), jev-bare-2 cards (0.96), glm-flash cards, glm-flash-think cards

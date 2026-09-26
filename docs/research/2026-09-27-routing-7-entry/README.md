# Routing bake-off on the 7-entry menu (2026-09-27)

**Question:** on the 7-entry menu, is "Jev routes at top probability ≥ 0.7, otherwise GLM 5.3 Flash with thinking picks" still the right policy?

**Setup:**
- `prompts.json`: the 100 labelled requests from the first bake-off (`../2026-09-26-routing-bakeoff/`), mapped to the 7 entries by `map.mjs`. Each item keeps its old label in `gold9` and `boundary9`.
- Mapping:
  - `split/chart+notes`, `full/chart` → `chart`
  - `split/table+notes`, `full/table` → `table`
  - `split/text+number` → `number`, `full/steps` → `steps`, `row/cards` → `cards`
  - `cover` and `section` are unchanged.
  - Acceptable alternatives are mapped the same way. An alternative that now equals the gold is dropped, which leaves 4 items with one: c32, p11, p36, p42.
  - The `chart-notes` (12) and `table-notes` (4) boundaries no longer exist, so those 16 items are plain chart or table items now. 25 boundary items remain.
- The menu and guide are imported from the journey prototype (`v5/schema.js` MENU, `journey/prompts.js` GUIDE and MENU_OPTIONS), so the test uses exactly what the prototype runs. `menu.json` is a snapshot of that text.
- `run.mjs` runs six contestants:
  - **jev-guide:** the journey PRE step itself (`journey/pre.js` `preStep`), with the same instructions and all three of its questions (intent, template, card lead) in one call. The deck is empty and no slide is selected.
  - **jev-bare:** one template question, the menu options, and no guide.
  - **glm-flash** and **glm-flash-think:** GLM 5.3 Flash with the menu and guide, thinking off and on. They use `temperature` 0 and a `max_tokens` of 400 or 4000.
  - Both Jev contestants ran twice (the `-2` runs) to measure run-to-run noise.
- `analyze.mjs` writes `report.md`.

Re-run with `node --env-file=../../../.env run.mjs`, then `node analyze.mjs`. To remap the labels, run `node map.mjs` first.

**Results** (`report.md` has the full breakdown):

| Contestant | Strict | Boundary items (25) | p50 | p95 |
|---|---|---|---|---|
| Jev + guide (PRE), run 1 / run 2 | 91% / 93% | 80% / 80% | 0.4 s | 0.5 s |
| Jev, bare, run 1 / run 2 | 89% / 90% | 84% / 84% | 0.4 s | 1.0 s / 0.4 s |
| GLM 5.3 Flash, thinking off | 92% | 88% | 1.7 s | 2.6 s |
| GLM 5.3 Flash, thinking on | 93% | 88% | 3.0 s | 7.7 s |

**Calibration and policy** (Jev + guide, run 1 / run 2):

| Top probability | Share of requests | Jev accuracy |
|---|---|---|
| ≥ 0.9 | 79–80% | 99% / 99% |
| 0.7–0.9 | 7–8% | 86% / 75% |
| 0.5–0.7 | 10–12% | 50% / 60% |
| < 0.5 | 2% | 50% / 100% |

| Policy: Jev if p ≥ T, else GLM thinking | Accuracy | Sent to GLM | Mean latency |
|---|---|---|---|
| Jev alone | 91% / 93% | 0% | 0.4 s |
| T = 0.5 | 91% / 92% | 2% | 0.6 s |
| T = 0.6 | 92% / 92% | 8–10% | 1.0–1.2 s |
| **T = 0.7** | **94% / 93%** | **12–14%** | **1.2–1.3 s** |
| T = 0.8 | 92% / 92% | 17% | 1.4 s |
| T = 0.9 | 93% / 93% | 20–21% | 1.5–1.6 s |
| GLM thinking alone | 93% | 100% | 4.0 s |

**Findings:**
1. **The 7-entry menu removed the "notes or not" errors.** All 16 former notes items are correct for Jev + guide, compared with 83–100% on the 9-entry menu. Every contestant now scores 89–93%.
2. **Jev is better calibrated than before.** About 80% of requests come back at p ≥ 0.9, and those picks are 99% correct (97–98% before).
3. **T = 0.7 is still the best threshold.**
   - It gives the best or joint-best accuracy in both runs (94% and 93%), which matches GLM thinking alone at about a third of its mean latency.
   - A higher threshold sends more requests to GLM without gaining accuracy. On the items between 0.7 and 0.9, GLM is not more accurate than Jev.
   - A lower threshold loses the 0.5–0.7 band, where Jev is right only about half the time.
4. **Jev is stable across runs.** It made the same pick on 98–99 of 100 items, with a mean change of 0.01 in top probability. 2 items crossed 0.7 between runs: p19 at 0.65 and 0.75, and p29 on the table/chart boundary.
5. **The guide helps Jev on tables.** Jev bare sends 4 tables to cards (pricing tiers, unit economics, use of funds); with the guide, it sends 0–1. Jev bare is also less well calibrated: 73–79% correct in the 0.7–0.9 band.
6. **Chart vs table is the weak boundary**, at 57% for Jev and 86% for GLM thinking. Most misroutes sit there:
   - **p30:** "pilot results for 7 warehouses, before and after", gold table. All six contestants picked chart. It is arguably a chart.
   - **p29:** "KPI snapshot for the appendix, last 8 months, 4 metrics", gold table. Jev picked chart at 0.84–0.86, the only confident Jev misroute that GLM gets right.
   - **c23:** "cost per delivery across 5 carriers, who's cheapest", gold chart. Jev picked table at 0.65–0.67, so it goes to GLM, which is right.
7. **Some misroutes are defensible or taste calls.**
   - **p36:** "what this raise unlocks over 18 months", gold steps, cards acceptable. All contestants picked cards, and Jev did so at 0.98.
   - **p19:** "our FX fee vs 4 competitors", gold chart. Jev picked cards and GLM picked chart. This item and p36 were the two misses shared by every contestant in the first bake-off too.
   - **p09:** "API calls grew 10x in three years", gold number. Chart is a fair reading.
8. **PRE intent:** Jev answered `new_slide` for 94 of the 100 prompts and `several_slides` for 6. 84 were `new_slide` at p ≥ 0.7, so PRE would act on 84%. The other 16 leave the template to the agent. This is outside the routing question, but it is worth knowing.
9. **Latency:** Jev took 0.4 s. GLM with thinking had a p50 of 3.0 s and a p95 of 7.7 s, down from 4.7 s and 13.3 s in the first run. Thinking stays short on this task (about 70 extra tokens at the median). The combined policy's p95 of about 7.8 s is set by the GLM tail on the requests it routes there.

**Caveats:**
- There was one labeller (a model), and the labels were mapped rather than relabelled. Differences of 1–3 points are noise: a single run of Jev + guide moves by 2 points.
- The PRE state says the deck is empty, even for prompts that say "12 slides in". Section items were still 100%.
- Jev ran with 8 requests in parallel and GLM with 4. Latency is measured client-side with direct API calls, without the journey proxy.

**Decision:** keep the threshold at 0.7. Jev routes when its top template probability is ≥ 0.7, which covers about 87% of requests. Below that, GLM 5.3 Flash with thinking picks. No change to §9.2 or §13.

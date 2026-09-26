# Routing bake-off: Jev vs GLM 5.3 Flash (2026-09-26)

**Question:** which model should pick the slide template from a user's request?

**Setup:**
- `prompts.json`: 100 labelled requests (50 consulting, 50 pitch), 41 of them on a boundary between two templates. Each has a gold template and sometimes acceptable alternatives. A model wrote them and I spot-checked them.
- `menu.json`: the 9-entry menu and picking guide that were tested.
- `run.mjs`: runs four contestants:
  - Jev, bare menu
  - Jev with the guide
  - GLM 5.3 Flash, thinking off
  - GLM 5.3 Flash, thinking on
- `analyze.mjs`: writes `report.md`.

Re-run with `node --env-file=../../../.env run.mjs`, then `node analyze.mjs`.

**Results** (`report.md` has the full breakdown):

| Contestant | Strict | Boundary items | p50 | p95 |
|---|---|---|---|---|
| Jev + guide | 90% | 88% | 0.5 s | 0.6 s |
| Jev, bare | 88% | 83% | 0.5 s | 0.7 s |
| GLM 5.3 Flash, thinking off | 88% | 80% | 1.9 s | 3.4 s |
| GLM 5.3 Flash, thinking on | 92% | 88% | 4.7 s | 13.3 s |

**Findings:**
1. **Jev is as good as GLM with thinking.** It is within 2 points, about 10× faster, and costs about $0.00004 per pick.
2. **Jev is well calibrated.**
   - Top probability ≥ 0.9 (about 60% of requests): 97–98% correct.
   - Jev at ≥ 0.7 with GLM with thinking below that (about 20% of requests): 90–94%.
3. **Most errors were "with notes or without."**
   - Merging the notes variants (chart with/without notes, table with/without notes) lifts every contestant to 90–94%.
   - This led to the 7-entry menu, where notes are an optional field that the filling model decides.
4. **Some remaining "errors" are defensible picks.**
   - A fee comparison against 4 competitors was shown as cards, not a chart.
   - "What the raise unlocks" was shown as cards, not steps.
5. **Setup lesson:** GLM with thinking off can still spend tokens reasoning. A 30-token cap produced empty answers in the first run, which was fixed and re-run.

**Caveats:** there was one labeller and one run, so differences of 1–3 points are noise.

**Decision:**
- Jev routes when its probability is ≥ 0.7; otherwise GLM 5.3 Flash with thinking picks.
- The menu becomes 7 entries.
- Re-run on the 7-entry menu before M2.

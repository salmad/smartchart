# Hybrid agent, speed and quality rounds (2026-09-27)

**Question:** the first hybrid test (`../2026-09-27-hybrid-agent/`) passed on quality but failed both latency bars. Can the turn get under 13 s for a new slide and 6 s for an edit without losing quality?

**Setup:** the same harness, requests and edits as the first test (`run.mjs`, `analyze.mjs`, `requests.json`, `edits.json`), run in four rounds. Each round's report is kept: `report-round1.md` … `report-round3.md`, and `report.md` for the last. Run: start `CALL_CAP=100000 node docs/design/proposals/journey/server.mjs`, then here `node run.mjs && node analyze.mjs`. The server's default call cap (2,000) is too low for a full run.

**What changed, by round:**
1. **Speed.**
   - Code ends a sure turn on a clean write with a short factual reply, instead of a separate reply call.
   - Text over its limit is shortened inside the write by a small, context-free GLM call per field (`journey/shorten.js`), instead of another agent step. A rewrite is kept only if it fits and every figure it drops is still on the slide.
   - The working set starts each turn with the selected slide only.
   - After a turn, template cards, examples and whole-slide JSON leave the history.
   - Autofix moves `focus` out of `chart`, and gives card rows with no lead `icon: "auto"`.
   - `patch_slide` falls back to the one working slide when `slideId` is missing.
   - The prompt says indexes start at 0.
2. **Coverage.**
   - Shortening also reads totals across notes and bullets, and per-cell limits.
   - Any clean write ends a sure turn.
   - PRE counts as sure for a new slide into an empty deck.
   - New slides leave chart marks the user did not name to Jev.
   - `focus` also moves out of `table`.
   - The first table column's header is optional.
   - Shortening is hedged.
3. **Quality.**
   - Jev sees the user's request when it resolves `auto` choices.
   - Building a new slide drops slides not read or written this turn from the working set.
   - A series added by a patch takes the mark of a series in the same unit.
4. **Last.**
   - A patch path missing its object prefix (`rows[0]` → `table.rows[0]`) is completed when unambiguous.
   - The second shortening call starts only after 2.5 s.
   - Autofix: unknown icons become `auto`, stray `label`s on unframed cards go, and pitch card bullets become text.
   - `.subtitle` really gets `text-wrap: balance` (a cascade bug found by the fit spike).
   - Hyphenated compounds in titles no longer break at the hyphen.

**Results** (last round; the long sessions and e09 were re-run after the card autofixes):

| Measure | Pass | First test | Last round | |
|---|---|---|---|---|
| Every request number on the slide (single + long) | ≥ 95% | 97% | 98% | PASS |
| First write shape-valid, long session | ≥ 90% | 100% | 80% | FAIL (n = 10) |
| First write shape-valid, single | | 76% | 93% | |
| Ends with no fit issues (single / long / edits) | ≥ 95% | 100% | 100% | PASS |
| Drift on edits | 0 | 1 of 15 | 0 of 15 | PASS |
| Edits reaching their expected values | | 14 of 15 | 15 of 15 | |
| Latency p50, new slide | ≤ 13 s | 22.9 s | 12.5 s | PASS |
| Latency p50, small edit | ≤ 6 s | 10.1 s | 3.1 s | PASS |
| Template agrees with gold | ≥ 90% | 97% | 98% | PASS |
| Short reply, no JSON | ≥ 95% | 97% | 100% | PASS |
| Layout lints clean on every final slide | 100% | 100% | 100% | PASS |
| Jev chart marks vs labels | ≥ 90% | 6 of 6 | 5 of 6 | FAIL (see 5) |
| Turns ended without a reply call | | 49% | 96% | |
| Slide first on screen, p50 (new slide) | | 12.3 s | 8.0 s | |

**Findings:**
1. **Most of the time went to the reply call and fit-fix rounds.** Code replies and in-write shortening cut the extra agent steps per new slide from 1.3 to 0.7. 96% of turns now end without a reply call, and edits dropped to 3.1 s.
2. **New-slide latency now mostly tracks GLM's speed on the day.**
   - The first write, one GLM call that writes the whole slide, took a median of 6.4–8.0 s across rounds with nearly the same code.
   - The p50 for a new slide was 11.4, 18.4 and 12.5 s in rounds 2–4.
   - The bar is met on a normal day. The p95 is still about 43 s, driven by rewrites after shape errors and by the provider's slow tail.
3. **The slide appears well before the reply.** Writes are applied before shortening and fixes, so the p50 time to the first slide on screen is 8.0 s.
4. **Old slides leaked into new ones through the working set, not the history.**
   - In long sessions the selected earlier slide stayed in the working-slides block while the agent built a new one.
   - Once, the agent copied that slide's data. Another time it "fixed" that slide's title.
   - Dropping slides not involved in the turn fixed both. No leaks in the last two rounds.
5. **Jev picks marks better when it sees the request.**
   - Without the request, Jev went 3 of 6: "cohort curves" and "weekly since launch" became bars.
   - With the request, 5 of 6. The remaining miss (p15, CAC over 4 quarters) was labelled `line` only because the prompt says "each line". The chart guide alone says bars, so it is a defensible pick.
6. **The remaining first-write shape errors are content mistakes with no single right fix.** One table had rows a cell short, and one plan had a single step. The agent fixes them on its next step, so every slide still ends fitting. At n = 10 this measure moves 10 points per request.
7. **Rate limits.** Hedging every shortening call twice, with 4 sessions in parallel, hit a GLM rate limit once. Starting the second call only after 2.5 s removed that.

**Open:**
- p95 latency.
- Streaming the first write, so the slide builds as it is written.
- Tables can only focus a column, so "highlight the Growth plan" highlights the title word and a column, not the row. Seen while recording the replays.

> Ran at commit 788f4d7; paths refer to that tree (the prototype has since moved to src/).

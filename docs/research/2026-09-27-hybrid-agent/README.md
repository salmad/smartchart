# Hybrid agent test (2026-09-27)

**Question:** does the hybrid agent (spec 9.0–9.5: Jev PRE step, `patch_slide` for existing slides, `auto` choices resolved by Jev, the working-slides block, `reply` on writes, judgment checks after the turn) meet the 9.7 pass bars, and does it edit slides surgically?

**Setup:**
- `requests.json`: the 30 single requests and the warm-up requests of the 2026-09-26 test, plus a `choices` label on each chart request, following the chart guide: c10, c11, c12, p14 and p15 are `line`, p13 is `bar`. p15 ("CAC by channel over 4 quarters") is labelled `line` because the prompt names "each line"; the guide alone would say bars.
- `edits.json`: 15 edit requests, each on an approved example slide from `v5/examples.js`, with the paths each may change (`allow`) and the values it must reach (`expect`).
- `run.mjs`: drives the journey page in headless Chromium, 4 sessions in parallel. Single requests start from an empty deck. Edits load the example through `window.__journey.load()` and send one request. Long sessions: one per style, 10 warm-up turns, then 5 measured requests. Latency is the page's time to the reply; judgment checks run after it.
- `analyze.mjs` writes `report.md`. Run: start `node docs/design/proposals/journey/server.mjs`, then here `npm i && node run.mjs && node analyze.mjs`.

**Results** (`report.md`):

| Measure | Pass | Result | |
|---|---|---|---|
| Every request number on the slide (single + long) | ≥ 95% | 97% | PASS |
| First write shape-valid, long session | ≥ 90% | 100% (n = 10) | PASS |
| First write shape-valid, single | | 76% | |
| Ends with no fit issues (single / long / edits) | ≥ 95% | 100% / 100% / 100% | PASS |
| Drift on edits | 0 | 1 of 15 (e12) | FAIL |
| Edits reaching their expected values | | 14 of 15 | |
| Edits done only with `patch_slide` | | 15 of 15 | |
| Latency p50, new slide | ≤ 13 s | 22.9 s | FAIL |
| Latency p50, small edit | ≤ 6 s | 10.1 s | FAIL |
| Template agrees with gold | ≥ 90% | 97% | PASS |
| Short reply, no JSON | ≥ 95% | 97% | PASS |
| Layout lints clean on every final slide | 100% | 100% | PASS |
| Jev chart choices vs labels | ≥ 90% | 6 of 6 | PASS |

Also: PRE made the first tool call in 80% of 55 turns, and its intent was right in 91%. 49% of turns ended on a write's reply, with no extra model call. Median model calls per turn: 3 (single), 3 (long), 2 (edits).

**Findings:**
1. **Edits are surgical.** Every edit used `patch_slide` only, and 14 of 15 changed nothing outside their allowed paths; the MVP agent rewrote whole slides. The one drift, e12 ("Change the first value to 25%", pitch value cards), patched `cards[1]` instead of `cards[0]`: a wrong index, not a rewrite.
2. **Latency fails both bars, and it is GLM time.** GLM is 97% of a turn and Jev 3% (PRE, `auto` choices). New slides are slow for two reasons:
   - Fit-fix rounds after the first write. Most are character limits (takeaways 10–60 characters over, titles 2–25 over, step text), each costing one more GLM step of 4–10 s.
   - A separate reply call in about half of all turns. It also sets the edit median: 5 of 15 edits ended on a write's reply (5.6–6.7 s), and the other 10 made the extra call (10–21 s).

   Next levers, in order: make `reply` on writes reliable (a prompt example, or code that ends the turn on a clean write and writes a short reply itself); show limits in the example and card, so the first write fits more often; stream the reply.
3. **First writes in single requests are 76% shape-valid**, below the 93% the MVP agent reached on the same set. The errors are schema knowledge:
   - `focus` written inside `chart` instead of at the top of the slide
   - a consulting number slide without `body`
   - table rows with fewer cells than columns, and an empty first-column label
   - cards with no icon or value

   `focus: "auto"` is new, and its card description does not say that it is a slide-level field. That is the likely first fix.
4. **A long session bled old content into a new slide.** After 10 warm-up turns, the measured c10 request (monthly card spend, Jan–Aug) produced a chart of an earlier warm-up's data (UK SME card spend 2019–2024), so all 8 of its figures are missing. The other 9 long-session requests were right.
5. **Three `patch_slide` calls left out `slideId`**, costing one step each. `edit_slide` now falls back to the one reserved slide; `patch_slide` could use the one slide in the working set the same way.
6. **The auto choices worked**: all 6 chart requests got the labelled marks, and no `auto` value was left on a final slide.
7. c26 (a comparison with no figures) got a question back instead of a slide ("do you have the actual figures…"). This is allowed when a request is unclear, but the rules prefer marked illustrative figures, so it is counted as no slide.

Against the MVP agent (2026-09-26, same single requests and setup): the median fell from 4 model calls per turn to 3, but p50 for a new slide rose from 17.4 s to 22.9 s. The hybrid makes fewer GLM steps per turn (2.5 vs 3.3) and half as many separate replies. Each step, however, is slower: median agent step 6.3 s vs 4.6 s, and median reply 5.4 s vs 3.0 s. The prompt, the chart card (with the chart guide) and the working block are all longer. This run did not separate those causes; running the same requests with a shorter card would.

> Ran at commit 788f4d7; paths refer to that tree (the prototype has since moved to src/).

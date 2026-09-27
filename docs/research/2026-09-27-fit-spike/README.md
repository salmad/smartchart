# M0 fit spike: can Node predict Chrome's line count? (D4)

**Date:** 2026-09-27 · **Spec:** `docs/superpowers/specs/2026-09-26-slide-system-architecture-design.md` (D4, §4, §11 M0)

## Question

D4 says fit is arithmetic, not a render-time check: shape with HarfBuzz, break with UAX #14, sum against the slot width. Does that predict Chrome's line count exactly enough to be the save gate?

## Answer: go, with six conditions

The predictor agrees with Chrome on **100% of line counts** in every slot, at DPR 1, DPR 2 and under `transform: scale(.5)`. That covers 6 slots × 1,000 boundary-weighted strings × 3 configs. It never predicted fewer lines than Chrome. The one exception is CSS `text-wrap: balance` on titles, which Chrome itself gets wrong; condition 4 below replaces it.

D4 **as written** is a no-go. Plain HarfBuzz plus plain UAX #14 agrees on 97.2–100% of counts. It also predicts fewer lines than Chrome in up to 22 of 1,000 strings, which is an overflow the gate would let through. Four corrections close the gap:

1. **Fractional advances.** harfbuzzjs rounds variable-font advances to whole font units. Chrome does not. Supply the advances from HVAR (`hvar.mjs`) and add them after shaping.
2. **Blink's break rules, not plain UAX #14.** Chrome uses its own pair table for U+0021–U+00FF (no break after `/`, and a break after `-` before a digit only when a letter or digit comes first). It uses ICU for everything else (`breaksChrome` in `fit.mjs`).
3. **Line-end reshaping.** A line that ends after a hyphen or dash must fit both with and without the kerning pair across the break. Chrome checks both.
4. **No CSS `text-wrap: balance`.** The calculator computes the balanced width (bisection, plus 1px of slack) and returns it in `computed`. The renderer sets that width and wraps normally. Result: 1,000/1,000 counts.
5. **Guard band of 0.1px**, not 2px. The residual noise is at most 0.08px per line. A 0.1px margin removes it at a cost of 0.1–0.3% false rejects on this boundary-heavy set (2.6% on the pitch-title set, which is packed at the edge). A 2px margin would cost 1.3–30%.
6. **Scope.** The six slots were tested on macOS Chrome 145 with the exact TTFs listed below. Before M1 ships, re-run this harness on Windows and on Linux (the CI). Their font back ends (DirectWrite, FreeType) compute variable advances themselves, and finding 1 shows that this matters. Self-host the same TTFs the calculator reads. The prototype loads Google Fonts CSS today, which may serve different files.

## Setup

- **Fonts:** `fonts/Archivo-VF.ttf` (`ofl/archivo/Archivo[wdth,wght].ttf`) and `fonts/Geist-VF.ttf` (`ofl/geist/Geist[wght].ttf`) from google/fonts `main`, with their OFL files. Chrome loads the same files through `@font-face` with `font-weight: 100 900`, `font-stretch: 62% 125%` and `font-synthesis: none`.
- **Chrome:** Playwright 1.58.2 headless shell, Chrome 145.0.7632.6, macOS 15 (Darwin 24.5).
- **Slots:** taken from `docs/design/proposals/v5/slides.css`. Widths were measured from the rendered review page.

| Slot | Font | Size / line height | Letter / word spacing | Width | Wrap | Lines |
|---|---|---|---|---|---|---|
| `consulting-title` | Archivo 800, stretch 78% | 74 / 75.48px | −.012em / 0 | 1620 | balance | ≤2 |
| `pitch-title` | Archivo 900, stretch 62%, uppercase | 150 / 129px | −.005em / .05em | 1664 | nowrap | 1 |
| `pitch-title-wrap` | as above, wrapping (cover/section) | 150 / 129px | −.005em / .05em | 1664 | wrap | ≤2 |
| `pitch-subtitle` | Geist 500 | 48 / 57.6px | −.012em / 0 | 1480 | pretty (see finding 8) | ≤2 |
| `note-p` | Geist 400, bold 700 | 25 / 35px | 0 | 475.59375 | pretty | — |
| `card-p` (consulting, 4 cards) | Geist 400, bold 700 | 26 / 35.88px | 0 | 380 | pretty | — |

- **Feature lock:** kerning on; `liga`, `clig`, `dlig`, `hlig` and `calt` off (= `font-variant-ligatures: none`).
- **Strings:** `gen.mjs` with seed 20260927 makes 1,000 per slot. 60% have a wrap decision within 2px of the width, 20% within 2–10px, and 20% are any length. They include hyphenated words, en/em dashes (spaced and unspaced), slashes, £/€/$/%, ×, −, nbsp inside numbers, ß/é/ü, `**bold**` (Geist slots) and `[[focus]]` spans, plus lowercase input for the uppercase slots.
- **Ground truth:** `chrome.mjs` renders each string in its slot and reads the lines from per-character `Range` rects. It also checks the count against the element height.
- **Run:** `npm install && npm run all` takes about 40 seconds.

## Results

Count agreement was identical at DPR 1, DPR 2 and DPR 2 with `scale(.5)`. Chrome's own layout was also identical across the three configs: 3,000 of 3,000 per slot, and pitch-title widths matched to the bit.

| Slot | Count agrees | Fit decision agrees | Predicted fewer lines than Chrome | Break positions = Chrome `wrap` | D4 as written: count / fewer lines |
|---|---|---|---|---|---|
| consulting-title, CSS `balance` | 99.7% | 99.9% | 3 | 999/1000 | 98.3% / 16 |
| consulting-title, computed balance width | **100%** | **100%** | **0** | 999/1000 | — |
| pitch-title (nowrap: width ≤ 1664) | **100%** | **100%** | **0** | width error ≤ 0.031px | 100% / 0 |
| pitch-title-wrap | **100%** | **100%** | **0** | 999/1000 | 98.8% / 6 |
| pitch-subtitle | **100%** | **100%** | **0** | 997/1000 | 99.1% / 3 |
| note-p | **100%** | **100%** | **0** | 1000/1000 | 98.2% / 12 |
| card-p | **100%** | **100%** | **0** | 999/1000 | 97.2% / 22 |

The remaining break-position differences (at most 3 per 1,000) are exact ties. The line is within 0.01px of the width, and Chrome's float sum and ours round to different sides. None changes a count.

**Shaping precision.** This is the whole string on one line, predicted minus Chrome, in px.

| Slot | Final (max abs) | HarfBuzz's own advances (min / max) |
|---|---|---|
| consulting-title (800/78) | 0.047 | −1.56 / −0.05 |
| pitch-title (900/62) | 0.031 | ±0.03 |
| pitch-subtitle (Geist 500) | 0.078 | −0.42 / +0.58 |
| note-p, card-p (Geist 400) | 0.078 | −0.13 / +0.05 |

**Which fix matters where.** Count agreement for the variants in `analyze.mjs` (DPR 1):

| Variant | Title | Pitch wrap | Subtitle | Note | Card |
|---|---|---|---|---|---|
| final | 99.7%* | 100% | 100% | 100% | 100% |
| HarfBuzz advances | 98.6% | 100% | 99.6% | 100% | 100% |
| UAX #14 break rules | 99.4% | 98.8% | 99.4% | 98.2% | 97.2% |
| both (D4 as written) | 98.3% | 98.8% | 99.1% | 98.2% | 97.2% |

\* This is CSS balance. With the computed width it is 100%.

With plain UAX #14, break positions match Chrome in only 82–93% of strings.

**Safety margin sweep.** The calculator predicts against width − m. The table gives false rejects per 1,000 (fits in Chrome, rejected by the calculator). Under-predictions are 0 at every margin in every row except the title. The title row is measured against Chrome's CSS balance, whose 3 count changes only vanish at m = 2px. With the computed balance width there are none to remove.

| m (px) | 0 | 0.05 | 0.1 | 0.25 | 0.5 | 1 | 2 |
|---|---|---|---|---|---|---|---|
| consulting-title (vs CSS balance) | 0 | 2 | 2 | 7 | 8 | 18 | 31 |
| pitch-title | 0 | 26 | 26 | 53 | 72 | 156 | 295 |
| pitch-title-wrap | 0 | 1 | 1 | 5 | 9 | 29 | 43 |
| pitch-subtitle | 0 | 2 | 3 | 5 | 9 | 12 | 27 |
| note-p | 0 | 1 | 2 | 2 | 2 | 9 | 13 |
| card-p | 0 | 1 | 2 | 3 | 6 | 11 | 22 |

The pitch-title row is high because the generator packed 600 of its strings within 2px of 1664. Real titles (max 20 characters) sit far below the edge.

**Timing.** Per string, after warm-up:

| | Node predictor | Chrome layout (set `innerHTML`, read height) |
|---|---|---|
| range over slots | 0.006–0.031 ms | 0.007–0.023 ms |

Both are fast. The gain is that the predictor needs no DOM, so it runs in Node, workers and tests.

## Findings

1. **harfbuzzjs rounds variable advances; Chrome does not.** At 800/78, Chrome's `e` is 500.332 units and HarfBuzz's is 500. The error is zero at axis ends and defaults (Archivo 900/62, Geist 400) and grows with length elsewhere: up to 1.56px on a long 74px title and 0.58px on the subtitle. Letter-spacing is exact, so it is not the cause. `hvar.mjs` reads hmtx + HVAR (+ avar, F2Dot14 normalisation) and matches Chrome to 0.001 units at both instances we use. At an untested instance (850/70) it was 0.016 units off, so check any new instance before use. A FontFuncs advance callback works too, but it leaks about 18KB per call in harfbuzzjs 1.6.2. Correcting after shaping does not leak.
2. **Chrome does not break by plain UAX #14.** Blink's `LazyLineBreakIterator` (`text_break_iterator.cc`) uses a pair table generated by `character_property_data_generator.cc` (`LineBreakData`) for U+0021–U+00FF. The table starts from ICU pairwise results, then applies ASCII overrides. The overrides include no break after `/`, letters, digits or `$` (except before `(<[{`), a break after `-` and `?`, and `-` + digit breaks only after a letter or digit (`2023-|2027` yes, ` -5%` no). Breaks after spaces are always allowed. nbsp never breaks. Everything else goes to ICU. I rebuilt the table from that source (`breaksChrome`). It matched Chrome on every probe: dashes before digits, currency, ×, −, ellipsis, quotes and accented letters. `linebreak` 1.1.0 stands in for ICU and was right on every probe too. Unicode-version drift in ICU is a small risk for rarer characters.
3. **Line ends at non-space breaks.** When a line ends after `-`, `–` or `—`, Chrome first measures with the paragraph's shaping (pair kerning included), then reshapes the line end without the pair, and requires both to fit. Archivo kerns `-Y` and `-V` negatively and `–2` positively (+3px at 74px, +6px at 150px), so either direction can push a line over. A space break keeps the hanging space on the line, so kerning with the space stays. Using only one of the two widths broke 17 title positions in one run.
4. **Rounding.** Chrome snaps a run's width to the nearest 1/64px (layout unit) before comparing it with the available width. Rounding up moved 4 note-line breaks one word early.
5. **DPR and scale have no effect** on layout: 3,000/3,000 identical per slot, and widths identical. The on-screen `transform: scale()` of D12 is safe.
6. **CSS `text-wrap: balance` can change the line count.** Across two seed sets Chrome went 2→3, 3→4 and 4→3 lines against its own `wrap` layout (3 in 1,000 each time). Every case had a wrap decision within 0.7px of the width and a hyphen or dash break. Chrome balances with its score-based breaker (`score_line_breaker.cc`), which measures break candidates its own way. Its check against the greedy count uses that same measurement, so the count can differ from the real greedy layout. Spec §4.2 says balance "never increases line count"; that is not true. Computing the width in the calculator and rendering with plain wrap gives 1,000/1,000 counts and 999/1,000 positions at DPR 1 and 2 (`balance.mjs`). Slack of 0.25–2px all work; without slack it drops to 967/1,000, because the minimal width puts a line exactly on the edge.
7. **`text-wrap: pretty` kept the count in 3,000 of 3,000** body and subtitle strings. It moved breaks in 6–20% of them. Chrome's code falls back to greedy when the optimised count differs, so predicting the greedy count is right. The calculator should predict counts only, never pretty's break positions. Keep checking this in CI.
8. **CSS cascade bug in v5.** `.slide p { text-wrap: pretty }` beats `.subtitle { text-wrap: balance }`, so the subtitle renders with `pretty`. Balance on the subtitle kept the count in 1,000/1,000 anyway. Generated CSS (spec §4.1) removes this class of drift.
9. **Markup.** Bold runs are shaped as separate items (kerning is lost at the boundary). `[[focus]]` spans are colour only and do not split shaping. Both matched Chrome, with 100% counts on the Geist slots.

## Not covered

- Windows and Linux Chrome (condition 6). Geist Mono, table cells, chart labels and the other slots.
- `font-variant-numeric: tabular-nums`. Spec §4.1 puts it in the feature lock, but v5 only sets it on table number cells. Add `tnum` to the shaper's feature list when the lock is generated.
- Soft hyphens and `hyphens: auto` (spec pins `hyphens: none`), emoji and non-Latin scripts (rejected by the coverage check).
- Chrome version drift, especially the score-based breaker. The CI calibration (D5 layer 3) stays, and it should run this harness's comparisons.

## Files

| File | What |
|---|---|
| `fit.mjs` | Predictor: slots, markup parser, shaping, Blink break rules, greedy fill, balance width |
| `hvar.mjs` | Fractional advances from hmtx + HVAR + avar |
| `gen.mjs` → `strings.json` | Seeded, boundary-weighted strings |
| `chrome.mjs`, `run.mjs` → `chrome.json` (ignored, 10MB) | Chrome ground truth |
| `analyze.mjs` → `results.json`, `disagreements.json`, `analyze.log` | Comparison, variants, margin sweep, timing |
| `balance.mjs` → `balance.json`, `balance.log` | Computed-width balance check |
| `fonts/` | The exact TTFs and their OFL licences |

> Ran at commit 788f4d7; paths refer to that tree (the prototype has since moved to src/).

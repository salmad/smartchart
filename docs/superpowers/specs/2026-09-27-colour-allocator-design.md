# Colour allocator: design

Status: design approved in chat 2026-09-27; spec awaiting review.
Parent spec: `2026-09-26-slide-system-architecture-design.md` (this adds a deterministic step next to fit, 4, and a rule check, 6).

## 1. Problem

The v5 chart engine has three series colours: `focus`, `neutral` and `contrast` (= the text colour). Everything else is `neutral`, so:

- two or more context series (a 3-segment stack, three competitors) render in the **identical** colour;
- the context grey is below the 3:1 non-text contrast minimum in both palettes (Ink `#4A443B` 2.05:1, Paper `#CFC6B6` 1.53:1);
- a user accent close to the loss red or gain green is detected (`semanticClash()` in `v5/accent.js`) but nothing acts on it, so a red accent reads as "loss";
- chart, legend, cards, steps and markup pick colours independently; nothing checks the slide as a whole.

## 2. Goal

A deterministic guarantee, like fit: **no two different things on a slide share a colour, every mark is legible, and meaning colours mean one thing.** Code assigns every colour; the model never writes one.

## 3. Decisions

| # | Decision |
|---|---|
| C1 | The agent writes **roles only**: `focus` on one item, `contrast` / `neutral` on series, `[[…]]` `[-…-]` `[+…+]` in text. No colour values in the schema, ever. |
| C2 | `allocateColours(slide, palette, accent)` runs on every write, after validation and before fit (it can turn on labels, which fit must then measure). Pure function, no DOM, no model. |
| C3 | At most **6 series** per chart: 1 focus + up to 3 greys + a second hue for series 5–6. A 7th is a hard error to the agent: "merge the smallest into Other, or cut". |
| C4 | Contrast rule: **every mark ≥ 3:1 against the slide background, or the series shows direct value labels.** Only `quiet` sits below 3:1, and the allocator switches its labels on. |
| C5 | Greys are assigned by **role, then data order**, not by value: stable when data change. `contrast` takes the strongest grey; `neutral` series take the next steps in the order written. |
| C6 | `neg` and `pos` are **meaning colours only** (loss/gain markup, waterfall down/up, difference arrows). They are never given to an ordinary series. |
| C7 | When the accent's hue is within 30° of `neg` or `pos`, the **meaning colour moves**, within its own family (red stays red, green stays green), by up to 25°. If it still cannot get 30° apart, the accent picker refuses the colour with a reason ("too close to the loss red"). |
| C8 | Same series name → same colour everywhere on the slide (chart, legend, end labels, notes). Deck-wide consistency comes later with the claims registry (parent spec, 14). |

## 4. The colour set

Fixed per palette, checked in CI like geometry constants. Grey candidates are interpolated between the background and the text colour (keeps the warm cast) and set by lightness:

| Slot | Ink (bg `#0B0A09`) | Paper (bg `#F6F3EC`) | Use |
|---|---|---|---|
| `focus` | accent or `#E8B94A` (10.8:1) | accent or `#2447D1` (6.5:1) | the one focus item |
| `ctx-1` | `#CAC6BE` L\*80, 11.6:1 | `#44423D` L\*28, 9.1:1 | `contrast` series; first context series otherwise |
| `ctx-2` | `#9E9A94` L\*64, 7.1:1 | `#66635D` L\*42, 5.4:1 | next context series |
| `ctx-3` | `#74716C` L\*48, 4.1:1 | `#898680` L\*56, 3.3:1 | next context series |
| `quiet` | `#524F4C` L\*34, 2.4:1 | `#B8B6AF` L\*74, 1.8:1 | only when there is exactly one context series; labels on (C4). Keeps the calm v4 look |
| `alt`, `alt-2` | chosen at run time (below) | chosen at run time | series 5 and 6 |
| `neg`, `pos` | `#FF5A45`, `#7BD88F` (may move, C7) | `#D2402C`, `#1C8248` (may move, C7) | meaning only |

Adjacent grey steps are ≥ 14 L\* apart, and differ in lightness only, so they survive colour-vision deficiency. The hex values are candidates: they are approved on the visual baseline (parent spec, 5) before they ship.

**The quiet default.** A chart with the focus plus **one** context series gives that series `quiet` with labels on, which keeps today's restrained look. With two or more context series, the ramp `ctx-1…3` is used and `quiet` is not.

**Second hue.** Candidate hues: 200° (teal), 230° (blue), 275° (violet), 35° (amber). The allocator picks the candidate whose minimum hue distance to `focus`, `neg` and `pos` is largest, sets its lightness to the middle of the ≥ 3:1 band, and makes `alt-2` the same hue ≥ 15 L\* away. It must stay distinguishable from `focus` under deuteranopia simulation (ΔE2000 ≥ 10); otherwise the next candidate is taken.

## 5. Algorithm

```
allocateColours(slide, palette, accent) → { map: itemId → colour, labelsOn: seriesIds, errors }
1. focus  = accentOn(accent, bg)                       // existing: ≥ 4.5:1, text colour on fills
2. neg/pos = resolveMeaning(focus, palette)            // C7; may return an accent error
3. series = chart series in written order; count > 6 → error (C3)
4. focus series → focus
5. grey slots = one context series ? [quiet]
              : [ctx-1, ctx-2, ctx-3]
   `contrast` series first, then `neutral` series in order (C5)
6. series 5–6 → alt, alt-2 (4, second hue)
7. any series on `quiet` → labelsOn (C4)
8. same name → same colour (C8); cards, steps, markup take focus/neg/pos from the same map
9. assert: all assigned colours pairwise distinct (ΔE2000 ≥ 10) and C4 holds; else throw (a bug, not a content error)
```

The renderer reads the map and sets classes/CSS variables; it no longer decides colours. `semanticClash()` is replaced by `resolveMeaning()`.

## 6. Agent and schema

- `series[].color` keeps its enum (`focus` · `neutral` · `contrast`); descriptions drop any hint of hue.
- `checkChart` gains the 6-series error (the existing "at most 3 bar series" stays; lines can make up the rest).
- Errors are phrased as fixes, like the existing ones: "`chart.series`: 7 series; a chart shows at most 6. Merge the smallest into 'Other' or cut."

## 7. Checks

**R15** (rule, both styles): after render, read every mark's computed fill/stroke and every coloured text span, and assert C4, C6 and pairwise distinctness. It re-checks the allocator against what Chrome actually painted, so a CSS regression can't slip through. Runs in the quality matrix lints as well as the per-slide checks list.

## 8. Tests

- **Colour set:** every palette × accent samples (the two defaults, pure red, pure green, near-grey, yellow, each 30° hue step): all pairs distinct, all ≥ 3:1 except `quiet`, meaning colours ≥ 30° from the accent or an accent error.
- **Allocator:** seeded slides with 1–7 series and mixed roles: guarantees hold, same inputs give same outputs, 7 series errors.
- **Fit interaction:** a slide whose `quiet` series gains labels is re-measured; labels that do not fit follow the 4.2a rules.
- **Visual baseline:** the new greys on the contact sheet, both palettes, for approval.

## 9. Build order

Per the agreed order: prototype first. `docs/design/proposals/v5/colours.js` (allocator + `resolveMeaning`), wired into `v5/chart.js` and `v5/render.js`, with the stress page showing 1–6 series; then the journey uses it. In M1 it ports to `src/slides/theme/colours.ts` (next to the theme tokens in `render/`).

## 10. Out of scope

- Deck-wide colour memory (with the claims registry).
- User-picked per-series colours.
- Chart capabilities (annotations, waterfall, timeline): the next spec, which builds on this one (waterfall uses `neg`/`pos` for down/up, annotations take colours from the same map).

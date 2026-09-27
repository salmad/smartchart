# Known visual issues (2026-09-27)

Systematic problems seen while reviewing the 17 starters (68 renders: both styles × Ink/Paper) and agent-made slides during the v1 migration. None breaks a slide or fails a lint today; they are the next quality layer. Each entry: what shows, where, the likely cause, and directions to consider.

## Charts

1. **Value labels collide with lines and call-outs.** Examples: the dashed plan line runs through the "£88m" bar label (chart-cagr); call-out stems land on value labels (chart-notes, "£85m"); on a line + bar mix a value label can sit on a line's dot. Cause: bar labels, line labels, annotation lines and note markers are placed independently; the collision pass covers axis and end labels only. Directions: one label-placement pass over every text mark in the plot (nudge, then hide the lower-priority label); break dashed lines behind labels.
2. **End labels and axis labels crowd on many-series line charts (pitch).** Examples: chart-six pitch: a series line crosses the "£5bn" axis label, the "2026" tick touches "£1bn", the lowest end label drops under the x-axis. Cause: pitch's larger type on the same plot size; end-label de-overlap pushes labels down without a floor. Directions: clamp end labels to the plot, drop axis labels a series end label already states, fewer gridlines in pitch.
3. **100% stacked bars leave a band of empty space under the legend, and two greys are hard to tell apart.** Example: chart-mix (Interest vs Fees). Cause: fixed legend and plot heights; the context palette's greys are close in lightness. Directions: let bars take the free height; space the context greys further (colour allocator); label small segments or say why they are unlabelled.
4. **Sparse two-bar comparisons look empty.** A chart with two categories (e.g. 2023 vs 2025) is two bars on a wide plot, and uneven years read as adjacent. Directions: the agent asks for missing years, or the chart shows an empty slot for them; a narrower plot or bigger bars for 2–3 categories.

## Colour

5. **Waterfall decreases are always red.** Ordinary costs (funding, rewards) read as losses. Cause: the waterfall colours by sign. Directions: neutral for decreases by default, red only for a named loss (same rule as markup: red and green are rare and never decorative).
6. **Framed "them vs us" cards colour every label on the losing card red** (headline plus "Outcome" and "Examples" labels), so one card carries three reds. Direction: red on the headline only; labels neutral.
7. **Red and green markup in titles.** The agent was guided to colour "the problem" red and gains green, so problem and traction slides got red/green title words. Guidance now keeps titles to the focus colour unless the user asks; worth a deterministic check (a rule check or autofix that flags `[-…-]`/`[+…+]` in titles and subtitles).

## Layout and text

8. **Split layouts with few notes leave the lower right empty** (pitch chart + 2 notes, waterfall + 2 short notes). Cause: notes stack from the top at a fixed size. Directions: centre the notes column vertically, or scale note spacing to the chart height.
9. **Tall table rows with text pinned to the top** (table with notes, consulting): each row is ~100 px with a hole under the text. Cause: row height grows to fill the body (L5 fix) but cells stay top-aligned. Direction: centre cell text vertically when rows are stretched.
10. **Awkward line breaks.** Orphans such as "all in / one app." or "£550 / a year". Cause: no balancing for short 2-line texts. Directions: `text-wrap: balance` (or pretty) on subtitles, notes and captions; non-breaking spaces between a number and its unit.
11. **Footer wording is the same in both styles** ("Board memorandum" on pitch slides). Direction: footer per style, or from the deck's cover.

## Agent-made slides (review of 55 slides from the harness run, before the red/green guidance)

13. **Colour by mood, not by request.** The agent mapped problem / before / worse / cost to red and total / winner to green (big numbers, before-cards, whole rows, even single words in body text). Titles were already clean. Fixed so far: guidance says red/green only for a loss or gain the user named or on request; table total rows no longer turn green automatically. Still open: a deterministic check (e.g. a big number whose tone differs from the title's focus span; `[-…-]`/`[+…+]` in body text with no named loss or gain).
14. **The same fact in two colours.** Title highlights "62%…" in the focus colour while the big number shows 62% in red. Direction: the number slide's value takes the title's focus colour unless a loss is named.
15. **Focus span is erratic in consulting titles**: a whole line, a clause plus a column plus the takeaway (too much focus), or none; some picks are arbitrary words. Direction: one short span (2–5 words) naming the proof; a rule check for length and presence.
16. **Number slides repeat the figure three times** (title or subtitle, big number, caption) and pitch number slides leave the right half empty. Direction: caption says what the number means, not the number again; a split layout when there is body text.
17. **Content slips the checks do not catch**: a sentence in another language (Norwegian) in an English deck, `$` in a `£` deck, a stray "(60)", a caption contradicting the table ("last" when it is second), invented figures. Direction: judgment checks for language, currency consistency and caption-vs-data.
18. **Requests with a premise the data contradicts** (a crossover that never happens; "interchange is 82" when interchange is 85): the agent writes around it instead of saying so. Direction: prompt rule to state the mismatch in the reply.
20. **Edits drop what they were not asked to change.** Walk-through: "use my numbers: revenue £4.2m, £6.8m, £9.1m" on the CAGR starter kept the starter's "loan book" wording (the user said revenue), dropped the chart's `£{v}m` format (bars read "4.2") and the CAGR annotation while the title still quotes 47% a year. Direction: patch rules that keep format and annotations unless asked; a check that a title figure computed by code still has its annotation.
19. **Tall empty cards and lower thirds** on cards and number slides with little text (y ≈ 620–750 is where content ends). Same family as #8.

## App chrome (not slides)

12. **Chat shows builder detail**: the step trace names models and tools (Jev, GLM Flash, create_slide). Useful for us, noise for customers. Direction: hide it behind a "details" toggle, or show plain steps.

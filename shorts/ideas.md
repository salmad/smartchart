# Shorts ideas

The backlog, grouped by theme. Pick from here at step 1 of the pipeline; move an idea to `ledger.md` once it posts. Each idea names its hook, the turn and the scenes that carry it. **Code** marks ideas that need a new scene or mode first. Never put a figure on screen that isn't sourced; ideas marked *verify* lean on one.

## What the niche rewards (research, 2026-10-31)

- **AI-tool fix in one move** gets the biggest spikes: @miss.excel's "Turn off this ChatGPT setting" 226K, about 90× her median ([viralswipefile](https://viralswipefile.com/tiktok/miss.excel)).
- **Recognition**: "Boss: I need you to…" (43×) and "I saw the intern doing this" (16×) on the same account; Joe Fenti's boss-feedback PowerPoint skits, 4.1M and 2.6M views ([Daily Dot](https://dailydot.com/boss-misunderstands-powerpoint)).
- **Insider frame**: Analyst Academy's consulting structure and storyline videos are the niche's long-form staples ([channel](https://www.youtube.com/@AnalystAcademy/search?query=slides)).
- **Before/after on one artefact**: the chart-makeover genre ([storytelling with data](https://www.storytellingwithdata.com/blog/2021/1/10/lets-improve-this-graph-yt9xj)).
- **The gap**: tip channels are screen recordings with no point of view; consulting channels are long-form. Polished motion consulting craft is open.

Notes and more sources: `docs/temp/shorts-niche-research-2026-10-31.md`.

## 1. Pyramid series (series: "Consulting craft")

Minto's pyramid principle, one rule per short. Search phrase for titles: "pyramid principle".

| Slug | Hook | The turn | Scenes |
|---|---|---|---|
| three-sentences | Every consulting deck opens with the same *three* sentences | "Then the answer." The third title lights | `deck` (situation, complication, answer) → `slide` retitle → recap |
| so-what-test (scripted) | Ask every bullet *one* question | "So what?" Bullets that prove the title light, the rest dim | `slide` with `bullets` and `pick: [..]` → recap |
| dot-dash | Your bullets are all the *same size* | "One point. Then the proof under it." Flat list regroups into a dot with dashes | **code**: a nested-bullet mode in `slide` |
| titles-first | Consultants write the slides *before* the analysis | "They write the titles first." Ghost deck: empty slides with titles only | `deck` (titles only) → `slide` filling in → recap |
| group-in-threes | Your boss can hold *three* things | "Three. Not seven." Seven bullets fold into three groups | **code**: bullets that regroup |
| why-how | Every title should start an *argument* | "Why? How? The slide below answers it." | `slide` retitle + checks ("raises a why", "the chart answers it") |

## 2. Chart fixes (series: "Chart fixes")

Before/after on the same chart, one move each. Highest share potential: people send these to the colleague whose chart it is.

| Slug | Hook | The turn | Scenes |
|---|---|---|---|
| sort-bars (started) | Alphabetical order is *hiding* your story | "Sort it. Biggest on top." | **code**: bars re-sort at the turn |
| lying-axis | This chart *lies* without one wrong number | "Start the axis at zero." Bars at 90 collapse to their real gap | **code**: a `baseline` mode in `slide` |
| kill-the-legend | Delete your chart's *legend* | "Label the bars." Legend fades, labels land on the data | **code**: legend before the turn |
| round-it | Nobody can read *$4,382,917* | "Round it. $4.4M." | `compare` or `stat` → `slide` with rounded labels |
| no-pie | Consultants almost never use *pie charts* | "Same data. Bars." Pie unrolls into sorted bars | **code**: a pie that morphs into bars |
| label-the-line | Your line chart needs *one* label, not five | "Label the end of the line." | **code**: a line-chart scene |

## 3. AI slide fixes (series: "AI slides")

The format with the biggest spikes in the adjacent niche. Teach the prompt, then show the same fix done in Occam; never pitch it.

| Slug | Hook | The turn | Scenes |
|---|---|---|---|
| one-line-prompt | Add *one* line to your ChatGPT slide prompt | "Title each slide with its answer." Reply flips from topics to claims | `prompt` (generic reply) → `prompt` (with the line) → `deck` of the new titles |
| titles-before-slides | Don't ask AI for slides. Ask for *titles*. | "Get the story right first." | `prompt` → `deck` → recap |
| ask-it-to-cut | Ask ChatGPT to *delete* half your deck | "Which slides don't prove the answer?" | `prompt` → `deck` with slides struck (**code**: strike in `deck`) |
| read-it-back | Paste your titles back into ChatGPT | "Ask: what's the story?" If it can't say it, nor can the room | `prompt` → reply → recap |

## 4. Boss feedback, decoded (series: "Boss feedback, decoded")

Recognition first (the Joe Fenti pain), then the craft fix. Each short translates one piece of feedback.

| Slug | Hook | The turn | Scenes |
|---|---|---|---|
| make-it-pop (scripted) | "Can you make it *pop*?" | "It means: I can't find the point." One bar lights | `statement` quote → `slide` with `before: rainbow` → recap |
| too-busy | "This slide is too *busy*." | "It means: two points. Split it." | `slide` → **code**: one slide splitting into two |
| whats-the-so-what (scripted) | "What's the *so what*?" | "It means: your title describes. Make it claim." | `slide` retitle → recap |
| walk-me-through-it (scripted) | "Walk me *through* it." | "It means: your titles don't tell the story." | `deck` titles → retitled `deck` |
| too-many-words (done) | Your boss didn't read your *bullets* | "You found it last. So say it first." | see the episode |

## 5. Pitch deck fixes (series: "Deck fixes")

For founders. Pitch-deck teardown is a long-form staple; nobody does it as one-slide shorts.

| Slug | Hook | The turn | Scenes |
|---|---|---|---|
| traction-title | Your traction slide is missing its *headline* | "Say the number in the title." | `slide` retitle on a growth chart |
| investor-minutes | Investors spend *minutes* on your deck (*verify*: DocSend's deck-time research) | "So the titles carry it." | `stat` → `deck` |
| ask-slide | Put your ask on slide *one* | "Amount, use, milestone. First." | `deck` reorder |
| market-size | Your TAM slide is the one investors *skip* | "Count customers, not percentages." | `compare` (top-down vs bottom-up) → `stat` |

## 6. Office pain, then the fix (recognition hooks)

Borrowed hook shapes from the adjacent niche, always paying off with a craft fix. Never invent the anecdote: frame as "most decks", not "I saw my coworker".

- "Most decks end with a *thank you* slide" → end on the recommendation instead (`deck` with the last title retitled).
- "Your agenda slide is *wasting* slide two" → put the executive summary there (`deck` reorder).
- "Stop centring your *titles*" → left-aligned titles read faster (**code**: alignment before/after).
- "Your deck has *four* fonts" → one font, two weights (**code**: a typography before/after).

## Variant hooks worth testing on posted shorts

- action-titles: "Read *only* your slide titles" (challenge).
- one-color: "Make *one* bar do all the talking" (result).
- answer-first: "Stop saving the answer for slide *12*" (problem).
- too-many-words: scripted as `too-many-words-b` ("The point is hiding in bullet *two*") and `-c` ("You found the point last. Say it *first*.").

# Red-pen review of any deck (FUTURE #12, first slice)

Status: design, 2026-10-04 (decided overnight).

## What the user gets
"Review a deck" (on a new deck's empty chat, and in the decks sidebar) opens a dialog: drop a PDF or PPTX made anywhere, pick consulting or pitch, and in a few seconds get the review a partner would give:
- **The storyline** (the D1–D6 deck checks on the titles in order): answer first, one argument, no repeats, nothing off-case, ends on what to do, in parts.
- **Per slide, red-pen notes:** a title that names a topic instead of a finding; no figure in a consulting title when the slide has figures; a title too long to read at a glance; a wall of text; the same title as another slide.
- A one-line verdict: "7 notes on 12 slides; the titles name topics."
- **Rebuild in Occam (trial, 2026-10-07):** one slide, the deck's most impressive and visual one from the middle of it, while whole-deck rebuild is unreliable (one turn builds 1–2 slides; see FUTURE.md). Was: a new deck, and a turn sent to the agent with the deck's text attached and the review's notes as the brief. The same story, every flaw fixed.

## Decisions
| Question (FUTURE #12) | Decision |
|---|---|
| Reading other formats | In the browser, like attachments. PDF via pdfjs: each page is a slide, and its title is the run of largest text. PPTX: a small zip reader on `DecompressionStream('deflate-raw')` (no dependency); slides in order, the title from the title placeholder, else the first text. Google Slides: export to PDF (said in the dialog). |
| Guests before an account | Later. This slice is for signed-in users; a public, model-backed endpoint needs abuse limits first. |
| Shareable review | Later. |

## Engine
`src/engine/agent/review.ts`: `reviewDeck(pages, style, jev)`. One Jev call runs the deck questions (the storyline checks, refactored so they take lines rather than Occam slides) together with one finding-or-topic question per content page (consulting; pitch titles are topics by design). The code notes need no model. Only text leaves the browser, inside the model calls, as with attachments.

## Tests
Unit: the zip reader (a stored entry and a deflated one), PPTX title and body extraction, PDF title-by-size grouping (pure function), the review's code notes, and the storyline refactor unchanged. Browser: open the dialog, drop a small PPTX made in the test, see the slides listed (the review needs the models, so the browser test covers reading and the empty state only).

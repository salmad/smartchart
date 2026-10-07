# Slide gaps: agenda, text slide, bars in table cells

Date: 2026-10-04. FUTURE.md #4. Decided without the owner (asleep, goal: keep building); each choice below is the
conventional one and is easy to revisit.

## Agenda: built by code from the chapter dividers
- New template `agenda`, outside the title frame like the cover. One optional field, `title` (default "Agenda").
- The list is the deck's section slides (chapter dividers), numbered like their dividers, with each divider's subtitle as
  a quiet second line. The agent writes nothing else: the agenda can never disagree with the deck.
- **You are here:** an agenda placed after chapter k highlights chapter k + 1, the one about to start (the consulting
  habit of repeating the agenda before each chapter); the chapters already covered go quiet. An agenda before the first
  chapter highlights nothing.
- A deck with no chapter dividers: the agenda says so on the slide ("Add chapter dividers…") and validation of the deck
  warns. Slide context gains `sections` (every chapter's title and subtitle) so the renderer has the list.

## Text: 2–3 headlined paragraphs
- New template `text`: the title frame plus `paragraphs`, 2–3 of `{ title, text }`. The consulting argument slide: a
  claim per column, each with a headline and a paragraph of reasoning, not forced into cards or the summary.
- Columns side by side, a rule above each, numbered like the summary. Limits: headline 40 characters; text 320
  (consulting) or 160 (pitch), 260 / 140 with three paragraphs, 190 / 100 with a takeaway.
- Picking guide: "an argument made in prose: 2–3 reasons, each needing a paragraph".

## Bars in table cells
- A column flag, `bars: true`, on a column of figures: each cell gets a small horizontal bar for its value, drawn from a
  common left edge to scale with the column's largest value, with the figure to its right. The agent sets the flag; code
  reads the figures and draws.
- Only on columns code reads as figures (right-aligned numbers); not with marks; values of 0 or more. Validation says so.
- The bar is quiet (`--neutral`); in a focus column or a focus row it is the focus colour.

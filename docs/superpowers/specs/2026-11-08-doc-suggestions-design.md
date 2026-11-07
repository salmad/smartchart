# Doc suggestions: catching walls of text and offering ready-made fixes

Date: 2026-11-08. Status: draft for approval.

## Why

Doc checks today are attached to figures only (captions, units, sources, focus: `src/engine/docs/checks.ts`). A doc that
is all prose has no figures, so it gets no checks and reads as clean. That is backwards: in Occam a wall of text is a
failure. The bar is an MGI report: an argument a reader can skim through its exhibits and structure, with prose as
support.

The fix is twofold. First, judge the doc's readability as a whole. Second, for blocks of text that already have a
shape, offer a ready-made, more readable version the person can preview in place and approve or cancel. An MCP agent
gets the same suggestions so it can apply them itself.

## Goals

- A doc that is mostly prose, with few or no exhibits, fails visibly, as a verdict on the whole doc.
- Concrete suggestions tied to a specific text block, made from that block's own content and limited to what Occam can
  draw (figure kinds, their capabilities and limits). Not "add a visual".
- Suggestions cover structure as well as figures: **grouped tables first** (rows under group headings, as the table
  card's `style: "group"`), then plain tables, steps, value cards, summaries, callouts, and text restructuring: bullets
  that lead with a bold label, nested bullets, a long paragraph split into short ones.
- In the editor, a suggestion is previewed **in the place of its block**: the block temporarily becomes the suggestion,
  then Approve keeps it and Cancel restores the text exactly.
- MCP agents get the same suggestions, ready to write, through `check_doc`, and cheap code findings through write
  results.
- The UI shows that checks ran, with a verdict and a panel to expand for the problems.

## Non-goals

- No automatic rewriting. Checks warn and suggest; a person or an agent decides (thin-harness rule).
- No new figure kinds (spec block, box, exhibit numbering). Those are separate work in
  `docs/temp/doc-tooling-mgi-gaps.md`.
- No suggestions for decks or slides.
- No suggestions while someone is typing. They are produced on demand.

## Anti-goals: failure even if it works

- Decoration: pushing figures into a doc that already reads well, or a chart where a sentence is the point. A doc with
  enough structure gets no suggestions.
- Losing content silently. Every replacement says whether it keeps every word.
- Laundry-list tables: a flat table where the rows fall into natural groups.
- Suggestions that fail validation, or that the agent can't write as they stand.

## The parts

### 1. Readability checks: code, cheap, every time

New doc checks in `src/engine/docs/checks.ts`, next to D1–D3. They run wherever doc checks run today, including in every
doc write result.

- **D4, long paragraph:** a paragraph over about 90 words (`blockId` = that paragraph).
- **D5, prose run:** more than about 250 words of paragraphs in a row with no figure, list, callout or quote between
  them (`blockId` = the first paragraph of the run).
- **D6, section without an exhibit:** a `##` section over about 150 words with no figure (`blockId` = the heading).
- **D7, the verdict on the whole doc** (`blockId` = `"doc"`): pass or fail. It fails when prose makes up more than about
  70% of the doc's words and there are fewer exhibits than one per two `##` sections. The message gives the numbers,
  for example "2,140 words, 3 exhibits, 4 of 6 sections have none".

The thresholds are the builder's starting values, kept as named constants and tuned against the reels doc
(doc_mw6uwzssyw39, which should pass after this session's restructure) and a wall-of-text fixture (which must fail).

Also fix the false alarms seen in this session: R8 (no source) and R13 (mixed units) should not fire on a table where no
cell is mainly a number. In the reels doc, "2 a.m.", "5 s" and numbered reel names tripped them.

### 2. Suggestions: one model call, on demand

A new `suggestDoc(doc)` in `src/engine/agent/` (a sibling of `suggest.ts`). It runs on the main model through
`complete()` (Haiku 5.5 via `api/glm.ts`). This is open-ended reading and writing, not a fixed-choice decision, so it
does not go to Jev.

**Input:** the doc as Markdown with block ids, and the figure catalogue. The catalogue is built from the doc cards the
same way `suggest.ts` builds its menu from `MENU`, so new kinds and capabilities flow in automatically: each kind, its
capabilities and its hard limits (cell 40/80, steps 2–5, cards 2–4, callout 240).

**What the prompt asks for:**
- Up to 5 suggestions, best first, ranked by reading time saved and whether the block is a section's main point.
- Each suggestion is tied to one block (or a run of adjacent blocks) and comes in one of two modes:
  - `replace`: the suggestion takes the block's place.
  - `insert`: an exhibit goes above the block and the text stays.
- **Prefer grouped tables.** When rows fall into categories, use group rows; avoid flat lists of rows.
- Prefer turning parallel bold-label bullets into a table, sequences into steps or a beats table, and figures in
  sentences into value cards.
- Text-only fixes count too: a long paragraph split into bullets that lead with a bold label, using the same words.
- Never invent figures or sources. Every number comes from the block.
- No suggestion when the doc already reads well.

**Output per suggestion:**
`{ id, blockIds, mode, kind: figure kind | "text", label (≤40, e.g. "Try as grouped table"), why (one line), body }`.
`body` is the figure body exactly as `create_block` takes it, or Markdown for `"text"`.

**Code then does the hard parts:**
- **Validate:** each body goes through the same validation as `create_block`. Invalid ones get one repair call with
  the error, as `shorten.ts` does, then are dropped.
- **Word check:** compare the content words and every number in the original blocks with the suggestion. If every word
  is kept, mark `keeps: "all"`. Otherwise mark `keeps: "drops"` with the list of dropped words. A `replace` that drops
  words is still offered, labelled, and also offers "Add above instead" so the text can stay (see the open question).
- **Cache:** results are cached by doc revision, so opening the panel twice costs one call.

### 3. MCP

> Superseded in part by "Decided by the user" below. Over MCP, `check_doc` makes no model call; the agent proposes with
> `propose_block`, or writes directly. The bullets below describe the earlier draft.

- `check_doc` returns, beside `checks`, a list of `proposals`: each one's id, blockIds, mode, kind, why, keeps and the
  ready body. Rank them first in the result, and update the tool description to say that `create_block`, then
  `delete_block` for a `replace`, applies a proposal as it stands. There is no new apply tool: the agent applies a
  proposal with the existing write tools, which keeps the thin-harness rule.
- Write results already carry `suggestions`. Add the cheap D4–D7 findings there, so a wall of text is reported to the
  agent without it asking. The model call stays in `check_doc` only.
- The doc guide (`docGuideText`) gains two lines: a doc should read through its exhibits, and grouped tables come
  before flat ones.

### 4. The editor

**Checks button** in `DocBar.tsx`, beside Versions and Comments, in reading and editing modes:
- It shows a gold dot and a count when there are suggestions or failed checks, and a quiet tick when the doc passes.
- It opens a panel with three parts, in order: the verdict line, the suggestions (label and why), and the figure checks
  folded below.
- Clicking a suggestion scrolls to its block and starts the preview.
- The panel runs the model call when opened (with a short loading state), not on every save.

**On the block** (mockup: `.superpowers/brainstorm/…/block-suggestion-v2.html`):
- A block with a suggestion gets a thin gold rule in the left margin and a chip such as "✦ Try as table". The chip
  shows on hover, and always while the panel is open.
- **Try** swaps the block in place for the suggestion, rendered by the real figure renderer at full width, with a
  dashed outline and a label line: "Suggestion · grouped table · every word kept", or "drops 14 words" (hover lists
  them).
- Below it sit **Approve** and **Cancel**, plus "‹ 1 of 2 ›" when a block has more than one suggestion.
- **Approve** writes through the same path as hand editing: one version, written by "Occam suggestion".
- **Cancel** restores the original exactly. Nothing is written until Approve.
- Only people who can edit see Try. Readers see the checks verdict and the suggestions but can't apply them.

The preview is a ProseMirror decoration or widget over the block (the figure node view pattern in
`editor/figure.ts`), not a change to the document. The builder chooses the mechanism.

## Constraints

- No `any`, no inline styles, split components over ~300 lines, shadcn primitives for the button and panel.
- `doc.css` never reaches inside a figure's canvas. The preview reuses the figure renderer as it is.
- API keys stay in `api/`. The editor reaches the model through an `api/` endpoint, the same way the in-app doc agent
  does.
- The model's output is untrusted. Every body is validated before it is shown or offered to an agent.

## Tests

- **Unit (vitest):**
  - D4–D7 on a wall-of-text fixture (fails) and on the restructured reels doc (passes).
  - R8 and R13 stay quiet on tables of words.
  - The word check on keep and drop cases.
  - Validation and repair of a bad body.
- **Browser (Playwright):** open the panel on a fixture with a canned suggestion; Try, Cancel (text unchanged), Try,
  Approve (figure in place, one new version).
- **Agent harness:** a live run on 2–3 prose docs. Check that most suggestions validate, that tables use groups where
  rows fall into categories, and that a well-structured doc gets none.

## Decided by the user after the builder check (2026-11-08)

- **Preserve content.**
  - A `text` suggestion keeps every word.
  - A figure suggestion may condense, as an exception, but only if it keeps every fact: every number, name and quoted
    phrase. Code checks this. It is labelled "condensed", and hovering shows what was cut.
  - When a figure can't keep every fact, it is offered only as `insert`: above the block, with the text kept.
- **Who makes suggestions.**
  - **In the app:** Occam's model makes them, only for editors, counted toward their daily quota. Readers and share
    links see only the code verdict.
  - **Over MCP:** Occam spends no model call. `check_doc` returns the code findings (D4–D7, ranked first) and a pointer
    to the figure catalogue and the grouped-table preference, and the outside agent comes up with the improvements
    itself.
  - **New tool `propose_block { docId, blockIds, mode, figure | markdown, why }`:** lets an agent leave a suggestion on
    a block for the user to approve, instead of writing it. The suggestion is validated and word-checked like Occam's.
    Suggestions are stored with the doc (a pending list, like comments) until approved, cancelled, or orphaned by an
    edit.
  - The agent chooses between writing directly and proposing. The guide says: propose when the change replaces the
    user's own words.
- **Swap in and out to compare.** A block with a suggestion has an **Original ⇄ Suggestion** switch. Flipping it swaps
  the block in place, as often as the user likes, and nothing is written. Approve and Cancel sit beside the switch.
  Cancel removes the suggestion and leaves the original.
- **Fixture.** The restructured reels doc may be committed to `tests/fixtures`.

## Calls made after the builder check (author's calls, not yet confirmed by the user)

- **Name.** The new function is `proposeDoc`. The existing `suggestDoc` (the doc composer's next-step pills,
  `src/app/docPills.ts`) stays as it is, beside it.
- **Prose and exhibits** for D5–D7:
  - Prose: paragraph words only. Lists (bold-label bullets especially) count as structure, not prose.
  - Exhibits: figures of every kind except callouts. Image, team and logos figures count.
  - Callouts and quotes break a prose run (D5) but are not exhibits (D7).
- **Badge.**
  - Before the panel is opened, the badge reflects the code checks only (D1–D7 and the figure rules), plus a cached
    proposal count when one exists for this revision.
  - Opening the panel runs the model call and J9/J10.
- **Text suggestions** (`kind: "text"`) must keep every word. Otherwise they are dropped. They are always `replace`.
- **Versions.** Approve saves with writer `by: 'agent'` (shown as Occam) and a label such as "Suggestion: grouped
  table". A save with a label stands alone and never folds into a hand edit, so the Playwright test checks for one new
  labelled version.
- **Builder's choices:**
  - `insert` carries the block it goes after (`create_block` adds after a block).
  - Proposals whose blockIds no longer exist after an edit are dropped from the cache.
  - The R8/R13 fix applies to slides too if it's the same check function.

## Left to the builder

- The exact thresholds, tuned on the two fixtures.
- The endpoint shape for the editor's call, and the cache store.
- The preview mechanism in ProseMirror.
- The exact wording of the prompt.

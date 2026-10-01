# Manual slide editing: design

Date: 2026-10-01 · Status: approved, revised after review · Milestone: M4 "hand editing" in the slide-system spec (§11)

## 1. Goal

Let the user edit a slide by hand, on the slide itself, in an edit mode they enter on purpose and leave with **Save** or **Discard**. Only the current version is saved. There is no history.

## 2. Principles

1. **Thin harness** (CLAUDE.md Rules). Write code only where the job is really hard: rendering, measuring, validation, mapping a click to a field, and keeping the cursor in place. Everything else goes to the prompt or the user.
2. **The human is another writer.** A manual edit is a patch to the slide JSON, the same format as the agent's `patch_slide`. The human can do exactly what the agent can do and nothing more: no font, size, colour or free layout control, and no images. Images arrive later, for both writers together, once the schema has them.
3. **Human words win.** Saving never shortens or rewords the user's text. Checks run and **warn**. To get a fix, the user asks in chat ("fix the warnings"). The structural repairs the agent's writes also get still run (§5).
4. **The JSON is the truth, not the page.** Each field's text-plus-markup string is the source of truth. The page only displays it.

## 3. What can be edited

| What | How |
|---|---|
| Every text field: title, kicker or subtitle, takeaway, footnote, source, caption, notesTitle, notes, card fields, bullets, steps, table header and cells (value and note) | Typed in place on the slide |
| Emphasis in markup fields: `**bold**` and `[[focus]]` | A floating bar on text selection, with **Bold** and **Focus**. It only appears in markup fields. Positive and negative colours aren't offered by hand: existing ones survive, and the agent applies new ones when asked. |
| List items: cards, card bullets, steps, notes, table rows | "+" and "×" on hover, hidden at the template's min and max |
| Chart data, every kind | Click the chart: it flips in place into a data grid (§4.3) |
| Template | A switcher in the edit bar (§4.4) |

Not in edit mode: adding, removing and moving slides (the strip does that), deck look (style, theme, accent), and anything the schema doesn't have.

## 4. The edit mode

- **Enter** with the Edit button (pencil) under the slide, or **E**. You can't enter while the agent is busy. Clicking the slide still presents.
- **Exclusive.** While editing, `state.editing` holds the slide id. Everything that changes the deck or starts a turn treats it like `busy`:
  - the reducer guards (`removeSlide`, `moveSlide`, `insertStarter`, `restoreSlide`, `select`, `open`, `new`)
  - the Composer's `canSend` ("Save or discard to keep chatting")
  - the Strip, Add slide, the Decks sidebar, the look menu in the Bar, Present
  - the Editor shortcuts
- **Edit bar** under the slide, where the strip and checks sit (the strip is locked while editing anyway, which keeps the layout still): the template switcher, the warning count ("2 warnings"), **Discard** and **Save**.
- **Keys:** ⌘S or ⌘↵ saves. Esc discards, asking to confirm only when something changed. The browser's own ⌘B, ⌘I and ⌘U are blocked.
- **Leaving the page** with unsaved edits brings up the browser's "leave site?" prompt. Drafts are not saved anywhere.

### 4.1 Fields and the cursor

The renderer tags every editable element with `data-path`, using the path syntax `applyPatch` reads (§6.1). In edit mode each one becomes a contentEditable field, and:

- **The string is the truth.** On each input event the field's plain text is read, and the change is mapped back onto its markup string. The markup marks keep their place around the text that changed.
- **Only that field is redrawn**, from the string, with the field's own renderer (`md`, `display` or `esc`). The cursor is put back by its offset in the plain text.
- **Nothing the browser inserts survives**, because the field is redrawn from the string each time. Paste is reduced to plain text. Enter never adds a line break: in a list it adds the next item, elsewhere it does nothing.
- **Fixed prefixes stay outside the field.** "Source: " and the note numbers sit in their own spans, outside the editable text.
- **The whole slide re-renders** only when focus leaves a field, on +/×, on a template switch and on leaving the chart grid. That brings the layout up to date: value fitting, table sizing and the chart.

### 4.2 Lists

On hover, an item shows "×" and the list shows "+" after its last item. Both come from `listOps(slide, style)`, which reads the min and max the schema already has, so they hide exactly at the limits.

A new item **copies the shape of the item next to it** (icon or value lead, tone, mark), with its text cleared. That keeps it valid with no logic per template. The cursor goes into its first text field. Reordering is out.

### 4.3 Chart grid

Clicking the chart replaces the chart area with a compact grid of inputs, in place and at the same size. The rest of the slide stays editable.

| Chart kind | Grid | Can add or remove |
|---|---|---|
| bars | rows = categories; one column per series (name in the header, then values) | categories, series |
| waterfall | rows = items: label, value, a "total" checkbox | items |
| timeline | rows = workstreams: label, start period, end period (selects from `periods`); a periods row that can be edited; a milestones row | rows, periods, milestones |

Limits come from the schema. A new series copies the shape of the last one (mark, colour). "Show chart", or clicking outside the grid, flips back with a re-render. Chart kind and annotations are not edited here; those stay with the agent. `chartGrid` and `fromGrid(chart, grid)` convert both ways with no loss for every kind, and a test checks it. `fromGrid` takes the chart it came from so it can merge: marks, colours and formats survive, and an annotation that no longer points at a category or series is dropped.

### 4.4 Template switch

1. The user picks a template in the switcher, using the select-then-confirm pattern.
2. Before confirming, a key diff shows what changes, e.g. "Keeps: title, takeaway · Drops: chart, 3 notes".
3. Confirming applies `switchTemplate(draft, to, starter)`:
   - **Kept:** the common frame fields (`title`, `kicker`/`subtitle`, `takeaway`, `footnote`, `source`). To and from cover or section, only `title` and `subtitle` are kept.
   - **Body:** comes from the first gallery starter for that template, in the deck's style (`starters.json`). It is not a second set of examples.
4. Starter text shows muted until the user types over it. Starter text left at save is an ordinary warning ("2 fields still have sample text"). This is one predicate over the set of starter paths.

Discard is the undo.

### 4.5 Warnings

The draft is measured, debounced at about 300 ms, with the existing measurer. Each issue is tied to a field:

- **`validate()`**: its messages already start with the field path (`cards[2].title: 31 characters, limit 24 …`), so the path is read from that prefix.
- **Measured fit** (`fitIssues`, `layoutLints`): each check names the element it measured. The issue takes its path from that element's closest `[data-path]`. This is a small change to `lints.ts`, which returns `{ msg, path? }` and keeps the text exactly as it is today.
- **Rule checks and Jev checks** don't belong to a field. They only count.

A field with an issue gets a quiet amber underline, and hovering it shows the reason. The edit bar counts every issue.

Nothing blocks typing or Save. The only hard stops are structural: the +/× limits, and a slide that cannot render at all (Save is disabled with the reason).

## 5. Save

1. Run the agent's write pipeline **except `shorten`**: `autofix` → `validate` → `resolveAuto` (Jev, only when an `"auto"` value is present) → `autofix` → measure → rule checks, then the judgment checks through the existing `runChecks`.
   - `autofix` is mostly structural: icons, chart kind, focus placement. Its two fixes to words are house style ("Source:" prefix, the full stop at the end of a consulting title), so they run like the template's typography.
   - The write pipeline is extracted from `agent.ts` `write()` as a shared function, so both writers call the same code.
2. Replace the item's slide through the existing `items` action. A slide with errors gets `status: 'draft'`, as it does today.
3. Add the slide id to `state.edited`. The next turn's Deck state block has one line, "Edited by hand since last turn: s4". The set is cleared when that turn starts. The user never sees it, and no message is added to the history.
4. Leave edit mode. Autosave picks up the change through `editKey()`. Revision and stale handling are unchanged.

Discard drops the draft and leaves.

## 6. Code

### 6.1 Engine (framework-free)

- **`slides/render.ts`** adds `data-path` and `data-kind` (`md` | `display` | `esc`) to each editable element. HTML structure and `slides.css` are unchanged. The fixed prefixes ("Source: ", note numbers) are already in their own elements, or move into their own spans. Table cells: `table.rows[r].cells[c]` for a string cell, and `….value` / `….note` for an object cell. Typing a note into a string cell turns it into `{ value, note }`.
- **`slides/edit.ts`** is new and pure:
  - `listOps(slide, style)`: list paths with their min, max and length
  - `newItem(list)`: a copy of the neighbour's shape with its text cleared
  - `switchTemplate(slide, to, starter)` → `{ slide, keeps, drops }`
  - `chartGrid(chart)` and `fromGrid(kind, grid)`
- **`slides/markup.ts`** is new and pure:
  - `plainOf(markup)`: the plain text and the map from each plain offset to its markup offset
  - `applyText(markup, nextPlain)`: puts the changed text into the markup string so the marks stay in place
  - `toggle(markup, from, to, mark)`: Bold or Focus over a plain-text range, so marks never overlap
- **`slides/lints.ts`** returns `{ msg, path? }`, and callers that want strings map `msg`.
- **`agent/write.ts`**: the write pipeline extracted from `agent.ts`, with `shorten` as an option (on for the agent, off for the human).

### 6.2 App (each in its own file, under ~300 lines)

- **`state.ts`** gets `editing: string | null` and `edited: string[]`, and the guards treat `editing` like `busy`.
- **`useSlideEdit`**: `{ draft, dirty, issues }`. It patches, measures (debounced), and does `save()` and `discard()`.
- **`EditSurface`** sits over the mounted slide. It handles the editable fields, cursor restore, +/×, the amber underlines and the muted starter text. Everything is positioned from the slide's own elements, and app chrome never styles slide internals.
- **`EditBar`**: template switcher, keeps/drops line, warning count, Discard, Save.
- **`SelectionBar`**: Bold, Focus.
- **`ChartGrid`**: the grid in place, built from shadcn primitives.
- **Stage** gets the Edit button and renders the edit parts while editing. `agent-prompt.ts` `stateBlock` gets the "edited by hand" line.

## 7. Testing

- **Unit (vitest):**
  - `markup.ts`: typing, deleting and pasting inside, before and after each mark keeps the marks in place. `toggle` never makes overlapping marks. The round trip of `plainOf` holds.
  - Every rendered `data-path` resolves with `applyPatch`, for every starter in both styles, and the rendered text equals the field's plain text.
  - `chartGrid` / `fromGrid` round trip for every chart kind in the starters, plus adding and removing at the limits.
  - `switchTemplate` for every pair of templates: `keeps` and `drops` are right, and the result validates.
  - `listOps` agrees with the schema. `newItem` on every list in the starters gives an item that validates once its text is filled in.
  - Save path: a card added with "+" saves without errors. An over-long title saves unchanged, with a warning.
  - Reducer: deck-changing actions are ignored while `editing`.
- **Browser (Playwright),** in the app smoke test:
  1. Enter edit mode. Chat, strip and deck switching are locked.
  2. Type into a title past its limit. The underline and the count appear, and Save still works.
  3. Bold and Focus on a selection, and the cursor stays put while typing.
  4. Add and remove a card.
  5. Edit a value in the chart grid for bars, waterfall and timeline.
  6. Switch template and see the keeps/drops line.
  7. Save, reload, and the edit is still there. Discard leaves nothing changed.
- **Review page:** `data-path` must not change any measured value. Lints are identical before and after. Existing exact-HTML tests in `render-html.test.ts` are updated for the new attributes.

## 8. Out of scope

- Adding an optional field that isn't on the slide (a missing takeaway, footnote or caption) by hand. Deleting all the text of one removes it. Adding a note to a plain table cell: the agent does that; a note that exists can be edited.
- Images.
- Fonts, sizes, colours and layout.
- Positive and negative emphasis by hand.
- Version history and undo beyond Discard.
- Reordering list items.
- Editing chart kind and annotations.
- Editing several slides at once, or chatting while editing.
- Who-wrote-what tracking and field locks.
- The deterministic fit calculator. Warnings use the existing DOM measurer.

## 9. Risks

- **Mapping text changes onto markup** (`applyText`) is the subtle part. A change that spans a mark boundary must keep the mark, or shrink it, and never break it. Tests cover it thoroughly before any UI is built on it.
- **Layout lag inside a field.** Value fitting and table sizing update only when focus leaves the field. That is acceptable, because the user is still typing.
- **IME composition** (accents, CJK). Fields don't redraw between `compositionstart` and `compositionend`.

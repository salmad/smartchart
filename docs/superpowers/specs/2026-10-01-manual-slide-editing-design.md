# Manual slide editing: design

Date: 2026-10-01 · Status: draft for review · Milestone: M4 "hand editing" in the slide-system spec (§11)

## 1. Goal

Let the user edit a slide by hand, on the slide itself, in a calm edit mode that they enter on purpose and leave with **Save** or **Discard**. Only the current version is saved. There is no history.

## 2. Principles

1. **Thin harness** (CLAUDE.md Rules). Write code only where the job is really hard: rendering, measuring, validation and mapping clicks to fields. Everything else goes to the prompt or the user.
2. **The human is another writer.** A manual edit is a patch to the slide JSON, the same format as the agent's `patch_slide`. The human can do exactly what the agent can do and nothing more. There is no font, size, colour or free layout control, and no images. Images come later, for the agent and the human together, once the schema has them.
3. **Human words win.** Saving a manual edit never rewrites the user's text: no autofix and no automatic shortening. Checks run and **warn**. If the user wants a fix, they ask in chat ("fix the warnings").

## 3. What can be edited

| What | How |
|---|---|
| Every text field (title, kicker or subtitle, takeaway, footnote, source, caption, notesTitle, notes, card fields, bullets, steps, table header and cells) | Typed in place on the slide |
| Emphasis in markup fields: `**bold**`, `[[focus]]`, `[+pos+]`, `[-neg-]` | A floating bar on text selection: **Bold**, **Focus**, with positive and negative behind "…". It only appears in markup fields. |
| List items: cards, card bullets, steps, notes, table rows | "+" and "×" on hover, hidden at the template's min and max |
| Chart data | Click the chart: it flips in place into a data grid |
| Template | A switcher in the edit bar |

Not in edit mode: adding, removing and moving slides (the strip does that already), deck look (style, theme, accent), and anything the schema doesn't have.

## 4. The edit mode

- **Enter** with the Edit button (pencil) in the Stage area, or **E**. You can't enter while the agent is busy. Clicking the slide still presents.
- **Exclusive.** While editing, the chat input is disabled ("Save or discard to keep chatting"), the strip is dimmed and locked, and Present and the editor shortcuts are off. A single state flag does this, so there is one writer at a time and nothing to merge.
- **Edit bar.** A thin bar above the slide holds the template switcher, the warning count ("2 warnings"), **Discard** and **Save**.
- **Keys.** ⌘S or ⌘↵ saves. Esc discards, asking to confirm only when something changed.
- **Leaving the page** with unsaved edits: the browser's standard "leave site?" prompt. The draft is not autosaved.

### 4.1 Typing

Editable elements carry `data-path` (see §6.1) and become contentEditable. Typing updates the **draft** slide JSON at that path, and the slide is **not** re-rendered on each keystroke, so the cursor never moves. A full re-render happens only on:
- leaving a field
- +/×
- a template switch
- leaving the chart grid

Pasted content is reduced to plain text, and Enter does not add a line break: in a list it adds the next item, and elsewhere it does nothing.

The DOM goes back to the JSON as text plus markup: `<strong>` → `**…**`, `.hl-focus` → `[[…]]` and so on, which is the inverse of `md()`. The `display()` wrapping for no-break compounds is removed when reading back.

### 4.2 Lists

On hover, an item shows "×" and the list shows "+" after its last item. Both come from `listOps(slide)`, which reads the limits that already exist in the schema, so they hide exactly at the min and max. A new item starts with empty text and the cursor in it. Removing an item re-renders. Reordering is out for now. If the user asks for it, it would be drag on the same handles.

### 4.3 Chart grid

Clicking the chart replaces the chart area, in place and at the same size, with a compact grid of inputs. Everything else on the slide stays editable.

| Chart kind | Grid |
|---|---|
| bars | rows = categories, columns = series (label and values) |
| waterfall | rows = steps (label and value) |
| timeline | rows = rows or milestones, columns = periods |

The grid can add or remove rows and series within the schema limits. "Show chart", or clicking outside the grid, flips it back with a re-render. Chart kind and computed annotations are not edited here. `chartGrid` / `fromGrid` convert between the two forms with no loss for every kind; a test checks the round trip.

### 4.4 Template switch

1. The user picks a template in the switcher, using the select-then-confirm pattern.
2. Before confirming, one line names what will be lost, e.g. "Steps keeps the title, subtitle and takeaway. The chart and 3 notes go."
3. Confirming applies `switchTemplate(draft, to, starter)`:
   - **Kept:** the common frame fields (`title`, `kicker`/`subtitle`, `takeaway`, `footnote`, `source`). To and from cover or section, only `title` and `subtitle` are kept.
   - **Body:** comes from the first gallery starter for that template, in the deck's style (`starters.json`). This is not another example set.
4. Body text from the starter shows muted until the user types over it. Sample text still there at save is an ordinary warning ("2 steps still have sample text").

Discard is the undo.

### 4.5 Warnings

The draft is measured, debounced at about 300 ms, using the existing measurer. Measuring runs `validate()` (limits), the measured fit checks and `ruleChecks`. Each issue that has a path gives a quiet amber underline on that field, and hovering it shows the reason ("Title: 3 lines, aim for 2"). Issues without a path only count towards the total in the edit bar.

Nothing blocks typing or Save. The only hard stops are structural: the +/× limits, and a slide that cannot render at all (Save is disabled with the reason).

## 5. Save

1. Run the same checks as the agent's `write()` except the parts that change text: **no** `autofix`, no `resolveAuto`, no `shorten`. That is validate, measure, rule checks, then the Jev judgment checks through the existing `runChecks`, exactly as after an agent write.
2. Replace the item's slide with the draft, through the existing `items` action. A slide with errors gets `status: 'draft'`, as it does today.
3. Add a **hidden** note to the agent's `history`, not to `messages`, so the user never sees it: `[The user edited slide N by hand.]`. The agent already sees the current slide JSON every turn. This line only tells it who changed it.
4. Leave edit mode. Autosave picks up the change through `editKey()` with no new save code, and the revision and stale handling are unchanged.

Discard drops the draft and leaves.

## 6. Code

### 6.1 Engine (framework-free)

- **`slides/render.ts`** adds `data-path` attributes on editable elements, e.g. `title`, `cards[2].bullets[0]`, `notes[1].text` and `table.rows[3].cells[1]`. These are attributes only: HTML structure and `slides.css` are unchanged, so presenting, thumbnails and the review page look identical. The path format is the same one that `applyPatch` reads.
- **`slides/edit.ts`** is new and pure:
  - `listOps(slide)`: the list paths and their min/max, from `MENU`/schema
  - `switchTemplate(slide, to, starter)` → `{ slide, lost }`
  - `chartGrid(chart)` / `fromGrid(kind, grid)`
  - `toMarkup(el)`: the inverse of `md()` and `display()`

  All draft changes go through the existing `applyPatch`.

### 6.2 App (each in its own file, each under ~300 lines)

- **`state.ts`** gets `editing: string | null`. Chat, Strip, Present and the shortcuts read it to lock themselves. The `Editor.tsx` shortcut guard also skips contentEditable targets.
- **`useSlideEdit`** holds `{ draft, dirty, issues }` and provides patch, measure (debounced), `save()` and `discard()`.
- **`EditSurface`** sits over the mounted slide and handles contentEditable, the +/× buttons, the amber underlines and the muted starter text. Everything is positioned from the slide's own elements, and app chrome never styles slide internals (CLAUDE.md).
- **`EditBar`**: template switcher, warning count, Discard, Save.
- **`SelectionBar`**: Bold, Focus, and "…".
- **`ChartGrid`**: the in-place grid, built from shadcn primitives.
- **Stage** gets the Edit button and renders the edit parts while editing.

## 7. Testing

- **Unit (vitest)**:
  - `toMarkup(md(x)) === x` for every markup form, plus the no-break compounds.
  - `chartGrid` / `fromGrid` round trip for every chart kind in the starters.
  - `switchTemplate` for every pair of templates: kept fields, `lost` list, and the result validates once the starter body is in.
  - `listOps` agrees with the schema limits.
  - Every rendered `data-path` resolves with `applyPatch`, for every starter in both styles.
- **Browser (Playwright)**, in the app smoke test:
  1. Enter edit mode and check that chat and strip are locked.
  2. Edit the title past its limit, see the amber underline and the count, and check that Save is still possible.
  3. Add and remove a card.
  4. Edit one chart value in the grid.
  5. Switch template and see the "lost" line.
  6. Save, reload, and check that the edit persisted.
  7. Discard and check that nothing changed.
- **Review page**: `data-path` must not change any measured value. Lints are identical before and after.

## 8. Out of scope

- Images.
- Fonts, sizes, colours and layout.
- Version history and undo beyond Discard.
- Reordering list items.
- Editing several slides at once.
- Chatting while editing.
- Who-wrote-what tracking or field locks.
- The deterministic HarfBuzz fit calculator (§4 of the slide-system spec): the warnings use the existing DOM measurer.

## 9. Risks

- **contentEditable drift.** Browsers insert `<div>`, `<br>` and styled spans. Mitigation: plain-text paste, Enter handled by us, and `toMarkup` that drops anything except the four markup forms.
- **Fields that re-render from content**: `fitValues`, table sizing, notes in split layouts. The re-render on leaving a field keeps the layout honest, and within a field the layout may lag until then.
- **Table cells with notes (`{value, note}`)**: the value and the note are edited as separate paths.

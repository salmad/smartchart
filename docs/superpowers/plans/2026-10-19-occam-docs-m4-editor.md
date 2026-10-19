# Docs M4: The Doc Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, inline. Steps use checkbox (`- [ ]`) syntax for tracking. Bounded tasks marked **(Sonnet)** go to a Sonnet subagent in the background; design-heavy tasks and every visual review stay with the main model. Stop at the end of each task and report.

**Goal:** An editor can open a doc, press Edit, write and restructure its text, insert a chart or a table from a slash menu, edit the figure in place with the same tools a slide uses, and Save. The Markdown saved is what the page shows. Around it: who else is editing, a refused stale save, versions to restore, and comments that viewers can write too.

**Done when** (spec M4): in the running app you can create a doc, write a section, insert and edit a chart and a table, reload, and the Markdown matches what you see. Proven by the browser test in Task 9, which reads the saved Markdown back and compares it to the page.

**Spec:** `docs/superpowers/specs/2026-10-19-occam-docs-design.md` (§4 Editing by hand, §5 Storage, M4).

**Architecture:**
- **Read view and edit view are two renderings of one `Doc`.** Read stays `mountDoc` (M2), unchanged. Edit is a React page (`DocEditor`) that draws each block with the same HTML and `doc.css` classes (`blockHTML`, exported from `render.ts`), so editing looks like the page. Pressing Edit swaps one for the other. Save writes `serializeDoc(draft)` and goes back to read.
- **Block keys live in memory only (user's call, 2026-10-19).** The file keeps ids on headings and figures only. The editor wraps each block as `{ key, block }`, with keys made per session. Versions store each block by its content hash. A comment anchors to the id of its section or figure, plus the words quoted.
- **Figures edit in place (user's call).** Clicking a figure turns it into the deck's edit surface: `useSlideEdit` and `EditSurface`, generalised to take a slide, a `check` and a `render`. The same `EditMenu`, `ActionBar`, `EditOverlay`, `IconPicker` and `ChartGrid` are used over `asSlide(figure)`. Done writes the body back into the doc draft, and Discard drops it.
- **Explicit Save (user's call).** Nothing is written until Save (or ⌘S). Leaving with unsaved changes asks first, as slide edit mode does. A stale save is refused (409) and says so; presence tells you beforehand that someone else is editing.
- **Comments sit beside the text (user's call).** A `comments jsonb` column on `docs`, written by its own route as single operations (add, resolve, delete), so a viewer can comment without being able to write the doc.
- **The server stays one function.** New doc routes are query modes on `docsHandler`, as the deck's are (`api/_lib/decks.ts`).

**Tech Stack:** React 18 + TypeScript strict, shadcn/ui (Command is new: `npx shadcn@latest add command`), lucide, Neon Postgres, vitest, Playwright.

## Global Constraints

- **Slides don't change.** Task 2 touches the deck edit path (`useSlideEdit`, `EditSurface`, `EditMode`). `tests/browser/edit.spec.ts` and the unit edit tests must pass unchanged, and the render lock and `LOOK=1` look lock must show no diff.
- **One component implementation.** The figure editor is the deck editor's components, not a copy. If a deck edit component needs a change to work on a figure, change it for both.
- **Checks warn, never rewrite.** A figure with schema errors can't be closed with Done, as a slide can't be saved. Doc text is never altered by a check.
- **The file is the source of truth.** Every edit path ends in `serializeDoc`, and `parseDoc(serializeDoc(doc))` gives back the same doc. Never write ids onto text blocks.
- **Viewers never write the doc.** They read, open versions read-only, and add comments. The server enforces this; the app just hides the controls.
- **Dev account parity.** `localDocRepo` gets the same versions and comments, in localStorage, so `npm run dev` and the browser tests work without accounts.
- Usual rules: no `any`, no inline styles (CSS custom properties set from code are how the canvas scales, as now), files under ~300 lines, shadcn primitives, engine code framework-free, user-facing text says Occam, scratch notes in `docs/temp/`.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## My calls (for the user to check)

1. **The title is the name.** A doc's sidebar name is its front-matter title. Editing the title renames it, and renaming in the sidebar rewrites the title. Two names that drift apart would confuse people.
2. **New headings get their id on Save** (`giveIds`, from their text). After that the id stays put when the heading is reworded, so links keep working.
3. **What the slash menu holds:**
   - **Text:** Heading, Subheading, Bullets, Numbered list, Quote, Divider, Code, Callout.
   - **Figures:** Chart, Table, Key number, Cards, Steps, Summary, Pair.
   - Image, team and logos need picture upload, which M4 doesn't wire for docs. They wait for M5's pictures, or later (FUTURE).
4. **Figure starters** are a new `blocks` list beside `docs` in `starters.json` (one gallery source). Each one is validated at import, like the doc starters.
5. **Stale saves:** while editing, the page asks for the doc's revision every 15 s. If it has moved on, a bar says "Ann saved a newer version" before you press Save. Save is still refused with the server's sentence. **Reload** takes the newer version, and **Copy my text** puts your draft's Markdown on the clipboard first. There is no automatic merge: one writer at a time is the spec's model.
6. **Presence shows a name.** `presence.editing = { by, until }` (60 s, renewed every 30 s while editing). The read view and the editor show "Ann is editing" in the bar.
7. **Undo** is per edit session (⌘Z, ⇧⌘Z), across text and figure edits. Versions are the undo across sessions.
8. **Versions** are recorded on every save, grouped as decks are (`GROUP_MS`, `KEEP`). Restore writes the old doc as a new save, so it's undoable too. The panel lists who and when; there's no diff text in M4.
9. **Comments** anchor to a section (`##` id) or a figure id. In the read view you select words and choose **Comment**; with no selection, a figure's or heading's hover button comments on it. The panel lists open comments by section. Resolving one is for editors and its author; deleting is for its author.

## Review Focus

1. **A paragraph that looks like Markdown syntax** (starts with `## `, `- `, `> `, a fence): typed into a paragraph, it must save as a paragraph and reload as one, not turn into a heading. `serializeDoc` escapes with `\`. The Task 1 test pins it.
2. **Enter and Backspace at block edges** (split mid-paragraph, Backspace at the start of a paragraph after a figure, Enter on an empty list item): no text is lost, and no empty block is left behind silently. Pinned in Task 1 (ops) and Task 4 (browser).
3. **A figure edit left open when Save is pressed:** Save first closes the figure with Done (or refuses with its issue if it has errors). An open figure's changes are never dropped silently. Pinned in Task 6.
4. **A viewer's comment and a viewer's save:** the comment lands, and the save is 403 with the server's sentence. Pinned in Task 8 (API) and Task 7 (route).
5. **Restoring a version while editing:** not offered. Versions open from the read view only, so a draft can't be overwritten under you. Pinned in Task 8 (the button is absent in edit mode).

---

### Task 1: Block keys, text-block ops and `blockHTML` (Sonnet) — done 20a127c

**Files:**
- Create: `src/engine/docs/blocks.ts`
- Modify: `src/engine/docs/render.ts` (export `blockHTML`), `src/engine/docs/parse.ts` (export `giveIds`)
- Test: `tests/unit/docs-blocks.test.ts`

**Interfaces:**
- Produces:
  - `interface Keyed { key: string; block: Block }`
  - `keyed(blocks: Block[]): Keyed[]` (keys `b1`, `b2`, … unique per call)
  - `newKey(list: Keyed[]): string`
  - `unkeyed(list: Keyed[]): Block[]`
  - `blockHTML(b: Block, theme: Theme): string`. For a `##` heading it returns `<h2 id>…</h2>` without the section wrapper, which only `docHTML` adds.
  - `giveIds(blocks: Block[]): Block[]` (fills missing heading and figure ids, unique; existing ids untouched)
  - Ops are pure and return a new list:
    - `insertAfter(list, key: string | null, block: Block): { list: Keyed[]; key: string }` (null inserts first)
    - `removeBlock(list, key)`
    - `moveBlock(list, key, to: number)`
    - `replaceBlock(list, key, block)`
    - `splitText(list, key, at: number): { list; key }`, which splits a paragraph, quote or heading at a plain-text offset (as `caretRange` reports; a mark split in two is closed and reopened); the tail becomes a paragraph, and the result's key is the new block
    - `mergeBack(list, key): { list; key; at: number } | null`, which joins a text block onto the previous text block (`at` = the caret offset in the result); null when the previous block is not text (a figure, divider or code), and the caller then selects that block instead
    - `convert(list, key, to: 'paragraph' | 'heading2' | 'heading3' | 'bullets' | 'numbered' | 'quote')`

- [ ] **Step 1: Write the failing tests:**
  - `blockHTML` of a paragraph equals the `<p>` inside `docHTML` for the same doc.
  - `splitText` of `"Hello **bold** world"` at offset 6 gives `"Hello "` and `"**bold** world"`. Offsets are markup offsets, as `fields.ts` reports them: use `markup.ts` `parse`/`serialize` so marks are never cut open.
  - `mergeBack` after a figure returns null.
  - `mergeBack` of two paragraphs gives one, with `at` equal to the first one's length.
  - `insertAfter(null)` puts the block first.
  - `moveBlock` keeps every key.
  - **Round-trip:** for each doc starter, `parseDoc(serializeDoc({ ...doc, blocks: unkeyed(keyed(doc.blocks)) }))` deep-equals `doc`.
  - **Escape (Review Focus 1):** a paragraph with the text `## not a heading`, serialized and parsed, is still a paragraph with that text.
  - `giveIds` gives a new heading `"Pricing"` the id `pricing`, and the second one `pricing-2`. It keeps an existing id that no longer matches its text.
- [ ] **Step 2:** Run `npx vitest run tests/unit/docs-blocks.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3:** Implement the module, then export `blockHTML` and `giveIds`. `docHTML` keeps its output byte-identical: `tests/unit/docs-render.test.ts` passes.
- [ ] **Step 4:** Run `npx vitest run tests/unit/docs-*.test.ts`. Expected: PASS.
- [ ] **Step 5:** Commit: "Docs M4: blocks keyed in memory, text-block ops, blockHTML".

### Task 2: The slide edit hook and surface take any slide (main model) — done 795b756

**Files:**
- Modify: `src/app/edit/useSlideEdit.ts`, `src/app/edit/EditSurface.tsx`, `src/app/edit/EditMode.tsx`
- Test: existing `tests/unit/save-edit.test.ts`, `tests/unit/edit-ops.test.ts`, `tests/browser/edit.spec.ts` (unchanged), and a new `tests/unit/slide-edit-check.test.ts`

**Interfaces:**
- Produces:
  - `useSlideEdit({ slide: Slide; check: (draft: Slide) => Issue[]; save: (draft: Slide) => Promise<string | null>; onDone: () => void }): SlideEdit`. `item`, `index`, `deck`, `style` and `measurer` leave the hook (style only fed the checks). The sample-text count stays inside it. *(Built: style dropped.)*
  - `deckCheck(deck: Deck, index: number, style: Style, measurer: () => Measurer): (d: Slide) => Issue[]`, in a new `src/app/edit/check.ts`. It is today's body (measure, `validate`, `ruleChecks`), moved.
  - `EditSurface` props become `{ edit; deckStyle: Style; render: (el: HTMLElement, shown: Slide) => { node: HTMLElement; fit(): void }; onSurface; children }`.
  - `slideRender(ctx: SlideContext, deck: Pick<Deck,'style'|'theme'|'accent'>)`, in `EditSurface.tsx`, which returns today's `mountSlide` call plus the `--s = width/1920` fit. `EditMode` passes it. The memo on primitives stays in `EditMode`, so a new ctx object never remounts the slide under the cursor.

- [ ] **Step 1:** Write `slide-edit-check.test.ts`. On a stub measurer, `deckCheck` returns the schema error for a 9-row bars chart, with its `path`, and the same issues today's hook produces for the fixture slide in `tests/fixtures`.
- [ ] **Step 2:** Run it. Expected: FAIL (no `check.ts`).
- [ ] **Step 3:** Move the code without changing behaviour.
- [ ] **Step 4:** Run `npm test`, `npx playwright test tests/browser/edit.spec.ts tests/browser/review.spec.ts` and `LOOK=1` look lock. Expected: all pass, no pixel diff.
- [ ] **Step 5:** Commit: "Slide edit mode takes any slide, check and render: the doc's figures will use it".

### Task 3: Figure starters in `starters.json` (Sonnet) — done 9fd30a6, content fixed after review

**Files:**
- Modify: `src/engine/starters/starters.json` (adds `"blocks"`), `src/engine/starters/index.ts`, `src/dev/docs.ts` (a `?blocks=1` page showing every block starter)
- Test: `tests/unit/starters-docs.test.ts`

**Interfaces:**
- Produces:
  - `interface BlockStarter { id: string; kind: FigureKind; label: string; blurb: string; body: FigureBody }`
  - `BLOCK_STARTERS: readonly BlockStarter[]`, in this order: `chart` (bars, 5 categories, 1 series, caption, source), `table` (3 columns, 4 rows, caption, source), `number`, `cards` (3), `steps` (3), `summary` (3), `pair` (a bars chart beside a table), `callout` (note tone).
  - Each body is consulting-style sample content in the competitor-research voice of the doc starters, with a source. No red or green in the captions (memory: red sparingly).

- [ ] **Step 1:** Write the failing tests:
  - every block starter passes `validateDoc({ title: 'x', blocks: [{ type: 'figure', kind, id: 'f', body }] })` with no errors;
  - ids are unique;
  - kinds come only from `FIGURE_KINDS`.
- [ ] **Step 2:** Run `npx vitest run tests/unit/starters-docs.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Add the list, and validate it at import, as `DOC_STARTERS` is (throw on errors).
- [ ] **Step 4:** Run the tests. Expected: PASS. Render each starter on `/src/dev/docs.html` (`?blocks=1`) and look at each one at full size (memory: review individually). That look is the main model's.
- [ ] **Step 5:** Commit: "Doc figure starters in the one gallery".

### Task 4: The text editor and Save (main model) — done 253cf4f

> Built: list ops, paste and the tidy before Save in `src/engine/docs/lists.ts`; `setLink` in markup.ts; `fitFigures` taken out of `mountDoc` for the editor. Shift+Enter does nothing (the file has no line breaks inside a block); each list item is its own field. A new doc's brand accent waits for Task 7: the app can't read `workspaces.brand` yet, and nothing sets it.

**Files:**
- Create:
  - `src/app/components/docs/DocEditor.tsx`: the page, the head (title, subtitle) and the block list
  - `src/app/components/docs/TextBlock.tsx`: one contenteditable text block (paragraph, heading, quote, a list as one block with an item per line)
  - `src/app/components/docs/useDocEdit.ts`: the draft, history and save
  - `src/app/components/docs/DocBar.tsx`: Edit, Save, Discard, and the presence line later
  - `src/app/components/docs/docs-edit.css`: editor-only chrome. It never reaches inside `.fig`.
- Modify: `src/app/components/DocScreen.tsx` (a read/edit mode, `canEdit`), `src/app/App.tsx` (passes `canEdit = role !== 'viewer'`), `src/app/components/sidebar/Sidebar.tsx` (rename rewrites the title: call 1; a new doc takes the workspace's brand accent as its `accent`, as M3's call 9 promised)
- Test: `tests/browser/doc-edit.spec.ts`

**Interfaces:**
- Consumes: Task 1's `keyed`, ops and `blockHTML`, plus `fields.ts` `typed`, `redraw`, `caretRange` and `setCaret`.
- Produces:
  - `useDocEdit({ doc: Doc; save: (doc: Doc) => Promise<string | null>; onDone: () => void }): DocEdit`
  - `DocEdit { draft: { title; subtitle?; blocks: Keyed[] }; dirty; saving; error; setText(key, markup); setHead(field: 'title'|'subtitle', text); apply(list: Keyed[], focus?: { key; at: number }); takeFocus(); undo(); redo(); save(); discard(); figure: string | null; openFigure(key | null) }`
  - Typing in one block is one undo step, as `useSlideEdit` does it.
  - `save()` runs `giveIds` and `serializeDoc`, and `name` = title.

- [ ] **Step 1:** Write the failing browser tests, on the dev account with a seeded doc:
  - `edits a paragraph and saves`: click Edit, type into the first paragraph, press ⌘S. The bar returns to Edit. `localStorage['smartchart.docs.v1']` text contains the new words, and the read view shows them.
  - `enter splits, backspace joins`: Enter mid-paragraph gives two `<p>`. Backspace at the start of the second rejoins them. The saved Markdown has the original paragraph (Review Focus 2).
  - `enter on an empty list item ends the list`: the next block is a paragraph.
  - `a paragraph typed as "## x" stays a paragraph after reload` (Review Focus 1).
  - `leaving with changes asks`: Discard with a change opens the confirm.
  - `viewer sees no Edit` (seed the role as viewer through the dev workspace fixture used by `members.spec.ts`).
- [ ] **Step 2:** Run `npx playwright test tests/browser/doc-edit.spec.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. The keys are:
  - Enter splits;
  - Shift+Enter is a line break in a list item only, not elsewhere (the format has no soft breaks);
  - Backspace at offset 0 does `mergeBack`, or selects the block before;
  - ⌘B and ⇧⌘H use `markup.ts` `toggle` for bold and focus;
  - ⌘K makes a link on the selection (a small Popover with an Input);
  - ⌘S saves, ⌘Z undoes, Esc leaves the block.
  The editor page uses `doc.css`'s column and type scale through the same classes, with no new type sizes.
- [ ] **Step 4:** Run the tests. Expected: PASS. Take a screenshot of edit and read mode side by side at 1440 px: the text sits at the same place in both. Log it in `docs/temp/apple-bar-review.md`.
- [ ] **Step 5:** Commit: "Docs M4: write in a doc, Enter and Backspace across blocks, explicit Save".

### Task 5: The slash menu, reorder and delete (main model) — done c63ca9d

> Built: Code is left out of the menu (its block draws on a canvas and has no editor yet). Callout sits under Text. Edit chrome takes the page's theme colours (`chrome.ts`). The menu opens on "/" in an empty paragraph only.

**Files:**
- Create: `src/app/components/docs/SlashMenu.tsx`, `src/app/components/docs/BlockHandle.tsx`
- Modify: `DocEditor.tsx`; add `src/app/components/ui/command.tsx` via `npx shadcn@latest add command`
- Test: `tests/browser/doc-edit.spec.ts` (more cases)

**Interfaces:**
- Consumes: `BLOCK_STARTERS` (Task 3), and Task 1's `insertAfter`, `convert`, `moveBlock` and `removeBlock`.
- Produces:
  - `SlashMenu({ anchor: HTMLElement; onPick: (choice: SlashChoice) => void; onClose })`, where `SlashChoice = { text: 'heading2'|'heading3'|'bullets'|'numbered'|'quote'|'divider'|'code' } | { figure: BlockStarter }`
  - It opens on `/` typed in an empty paragraph, and filters as you type after the `/`.
  - Arrow keys select, Enter confirms, Esc closes and keeps the `/` (pattern: select-then-confirm).

- [ ] **Step 1:** Write the failing tests:
  - `/` then `table` then Enter inserts a table figure where the empty paragraph was, and it renders.
  - `/` then Esc leaves `/` as text.
  - The handle's menu offers Move up, Move down and Delete. Delete removes the block and focuses its neighbour.
  - Alt+Shift+↓ moves the block one place down.
  - Dragging a block by its handle to below the next one reorders it. The saved Markdown order matches.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement:
  - The handle appears on hover and focus, in the left margin, as a lucide `GripVertical` that opens a `DropdownMenu`.
  - Drag uses pointer events and the drop line from `useDragMove`'s `Box` pattern, but over block rects, not slide items.
  - A new figure gets `id = ''`; `giveIds` names it on save.
- [ ] **Step 4:** Run the tests. Expected: PASS. Look at the menu and the handle at full size in both themes.
- [ ] **Step 5:** Commit: "Docs M4: the slash menu inserts text and figures; blocks move and delete".

### Task 6: Edit a figure in place (main model) — done

> Built: the surface draws the whole read-view figure (canvas, takeaway, source), so source and takeaway edit in place too. EditMode's keys moved to `useEditKeys`, shared. The overlay's chips and the right-click menu take colour variables (deck values unchanged); an open figure gives them the page's. The open figure is marked by a focus-colour bar in the left margin. Picture lists (team, logos) can't add an item yet: docs have no picture upload in M4.

**Files:**
- Create: `src/app/components/docs/FigureEdit.tsx`, `src/app/components/docs/figureCheck.ts`
- Modify: `DocEditor.tsx`, `useDocEdit.ts` (the open figure), and the deck edit components only where a figure needs it (Global Constraints: for both)
- Test: `tests/browser/doc-edit.spec.ts`, `tests/unit/docs-figure-check.test.ts`

**Interfaces:**
- Consumes: Task 2's `useSlideEdit`, `EditSurface` (with `render`), `EditMenu`, `ActionBar`, `EditOverlay`, `IconPicker` and `ChartGrid`; `asSlide`, `mountFigure` and `figureCanvasHTML`; and `validateDoc`/`DOC_LIMITS`.
- Produces:
  - `figureCheck(kind: FigureKind): (draft: Slide) => Issue[]`, which validates the body as `validateDoc` does for one figure and maps each message to its `path` with `issuePath`.
  - `bodyOf(s: Slide): FigureBody`, which drops `template` and `title`.
  - `figureRender(kind, theme, accent): (el, shown) => { node; fit }`, which writes `canvas(kind, theme, figureCanvasHTML(...))` and runs `mountFigure`.
  - Clicking a figure in edit mode calls `openFigure(key)`. The figure shows the edit surface with a Done/Discard row under it. Callouts edit their text fields only: no list tools, because a callout has no template.
  - `useDocEdit.save()` with a figure open first runs the figure's Done. When the figure has errors, the save is refused with the first issue (Review Focus 3).

- [ ] **Step 1:** Write the failing tests:
  - **Unit:** `figureCheck('chart')` on a chart with 21 categories returns an issue with a `chart…` path. On the chart starter it returns none.
  - **Browser:**
    - insert a Chart, click it, open the data grid from its menu, type `999` into the first value, press Done; the bar's label shows 999, and after Save the Markdown has `999`;
    - insert a Table, type into a cell in place, press Done, Save, reload; the cell shows the text;
    - with a figure open and changed, ⌘S saves the figure's change too.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement. The overlay tools position from DOM rects, so the canvas scale needs no special case. If one assumes 1920 px, fix it to read the surface's scale for both decks and figures.
- [ ] **Step 4:** Run the tests and `npx playwright test tests/browser/edit.spec.ts`. Expected: PASS. Then look at a chart, a table and a pair in edit at full size: the menus and handles sit on the right things.
- [ ] **Step 5:** Commit: "Docs M4: figures edit in place with the slide's own tools".

### Task 7: Server: presence, revision, versions and comments for docs (Sonnet)  — done

**Files:**
- Create: `src/engine/docs/versions.ts`
- Modify: `api/_lib/db.ts` (SCHEMA and the Db contract), `api/_lib/db-decks.ts` (or a new `api/_lib/db-docs.ts` if it passes 300 lines), `api/_lib/docs.ts`, `api/_lib/versions.ts`, `tests/unit/fake-db.ts`
- Test: `tests/unit/db-contract.ts`, `tests/unit/api-workspaces.test.ts` (`docs API`), `tests/unit/docs-versions.test.ts`

**Interfaces:**
- Produces, in the engine (framework-free):
  - `DocTree { title: string; subtitle?: string; theme?: Theme; accent?: string; blocks: string[] }` (block hashes, using `versions.ts` `hash` of the block's JSON)
  - `docTree(doc: Doc): { tree: DocTree; blobs: Record<string, Block> }`
  - `docFrom(tree: DocTree, blobs: Record<string, Block>): Doc | null` (null when a blob is missing)
- Produces, in SQL (idempotent, appended to `SCHEMA`):
  - `doc_versions (doc_id, user_id, n, rev, by_client, label, tree jsonb, at; pk (doc_id, n))`
  - `doc_blobs (doc_id, hash, block jsonb; pk (doc_id, hash))`
  - `alter table docs add column if not exists comments jsonb not null default '[]'`
- Produces, on `Db` (membership checked in the same statement, as every call is):
  - `getDocMeta(userId, id): Promise<{ rev; presence: DocPresence; role: Role } | null>`
  - `setDocPresence(userId, id, p: DocPresence): Promise<boolean>`, where `DocPresence = { editing?: { by: string; until: number } }`. Editor and up.
  - `docVersionHead`, `writeDocVersion`, `listDocVersions(userId, id)`, `docBlobs(userId, id, hashes)`. These mirror the deck ones; viewers may list and read.
  - `docComment(userId, id, op: CommentOp): Promise<DocComment[] | 'foreign' | string>`, where `CommentOp = { add: { text; anchor; quote? } } | { resolve: { id; reply? } } | { remove: { id } }`. Add is viewer and up. Resolve is editor and up, or the author. Remove is the author only. It runs as one SQL statement on `comments`, with no read-modify-write.
  - `deleteDoc` also deletes the doc's versions and blobs.
- Produces, routes on `docsHandler`:
  - `GET ?id=&rev=1` returns `{ rev, presence, role }` (no-store)
  - `PUT ?id=&presence=1` takes `{ editing: boolean }`; the server stamps `by` (the user's name) and `until` (now + 60 s)
  - `GET ?id=&versions`, `GET ?id=&blobs=h1,h2` (at most 500, the same hash regex as decks)
  - `GET ?id=&comments`, `PUT ?id=&comment=1` with a `CommentOp` (text ≤ `MAX_COMMENT`, anchor matching `ID`)
  - A version is recorded after each successful doc PUT (`recordDocVersion`, using `nextStep` and `KEEP`).
- `DocComment = { id; anchor; text; by; at; quote?; done?: { by; at; reply? } }`, in `src/engine/comments.ts` beside `DeckComment`. It reuses `newCommentId` and `MAX_COMMENT`.

- [ ] **Step 1:** Write the failing tests:
  - `docs-versions.test.ts`: `docFrom(docTree(d))` round-trips each starter. Two blocks with equal content share a blob.
  - Contract (fake and SQL):
    - an editor's save records a version that `listDocVersions` returns;
    - a viewer can `listDocVersions` but `setDocPresence` is `false`;
    - a viewer's `docComment(add)` succeeds;
    - a viewer's `resolve` on another's comment is refused;
    - a non-member gets `'foreign'`;
    - `deleteDoc` leaves no `doc_versions` rows.
  - API:
    - `PUT ?comment=1` by a viewer returns 200 with the list;
    - a doc PUT by a viewer is still 403 with `You can view this doc, not edit it.` (Review Focus 4);
    - `GET ?rev=1` returns the role.
- [ ] **Step 2:** Run `npx vitest run tests/unit/docs-versions.test.ts tests/unit/db-fake.test.ts tests/unit/api-workspaces.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. It mirrors the deck code; there is no new pattern.
- [ ] **Step 4:** Run `npm test`, then the SQL contract on the Neon test branch (`TEST_DATABASE_URL=… npx vitest run tests/unit/db-sql.test.ts`). Expected: PASS, none skipped.
- [ ] **Step 5:** Commit: "Docs API: presence, revisions, versions and comments; viewers comment, never write".

### Task 8: The app: presence, stale saves, versions and comments (main model)  — done

**Files:**
- Modify: `src/app/docs.ts`: `DocRepo` gains
  - `meta(id): Promise<{ rev; presence; role } | null>`
  - `known(id): number`
  - `presence(id, editing: boolean): Promise<void>`
  - `versions(id): Promise<DocVersion[]>`
  - `blobs(id, hashes): Promise<Record<string, Block>>`
  - `comments(id): Promise<DocComment[]>`
  - `comment(id, op: CommentOp): Promise<DocComment[] | string>`
  
  `localDocRepo` implements them in localStorage (versions under `smartchart.docs.versions.v1`, kept to 30 per doc, as `LOCAL_KEEP` is; comments inside the stored doc record).
- Create:
  - `src/app/components/docs/useDocLive.ts`, which polls `meta` every 15 s while the doc is open and renews presence every 30 s while editing
  - `src/app/components/docs/DocVersions.tsx`, which reuses `VersionsPanel`'s layout pieces (`dayOf`, `timeOf`, icons). If `VersionsPanel` can take a `describe(v, before)` prop instead of the deck's `describeDiff`, generalise it rather than copying it.
  - `src/app/components/docs/DocComments.tsx`, built on `Comments.tsx`'s list parts, generalised the same way. Its anchors are named by their heading text or figure caption.
  - `src/app/components/docs/CommentButton.tsx`, the selection popover in the read view.
- Test: `tests/unit/workspaces-client.test.ts` (the repo's new methods: remote against a fake fetch, local against a stub storage), `tests/browser/doc-collab.spec.ts`

**Interfaces:**
- Consumes: Task 7's routes and types.
- Produces: what the user sees.
  - The bar shows `Ann is editing` when `presence.editing.by` is someone else and not expired.
  - With a newer rev while editing, the bar shows `Ann saved a newer version.`, with **Reload** and **Copy my text** (call 5). A refused save shows the server's sentence there too.
  - Versions open from the read view's menu (⋯ → Versions). A click previews the version in the read view, and **Restore** saves it as a new version. Versions are not offered in edit mode (Review Focus 5).
  - Comments: a panel toggle in the bar with the open count. A viewer can add.

- [ ] **Step 1:** Write the failing tests:
  - **Unit:** `remoteDocRepo.comment` sends `PUT ?id=x&comment=1` with the op. `localDocRepo.versions` returns the newest first after three saves, and keeps at most 30.
  - **Browser:**
    - `restore a version`: save twice, open Versions, pick the first, Restore. The read view shows the first text, and Versions now lists three.
    - `comment on selected words`: select words, Comment, type, post. The panel lists it under its section. Resolve hides it.
    - `stale save`: with a stubbed meta returning a higher rev while editing, the newer-version bar appears. Save shows the refusal.
    - `no Versions in edit mode`.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests. Expected: PASS. Look at the bar states, the panel and the selection popover at full size in both themes. Log the critique in `docs/temp/apple-bar-review.md`.
- [ ] **Step 5:** Commit: "Docs M4: presence, stale saves, versions and comments in the app".

### Task 9: Done-when, the full run and the spec (main model; runs to Sonnet)

**Files:**
- Create: `tests/browser/doc-done.spec.ts`
- Modify: the spec's M4 status line; `docs/product/FUTURE.md` (pictures in docs, if still open; a block-level merge of concurrent saves)

- [ ] **Step 1:** Write `creates a doc, writes a section, inserts and edits a chart and a table, and reload matches`:
  - New doc from the PRD starter, then Edit.
  - Add a `##` section via `/` → Heading, then a paragraph under it.
  - `/chart`, edit a value in the grid, Done. `/table`, edit a cell, Done.
  - Save, then reload.
  - Assert that `parseDoc(saved text)` has the section, the paragraph, the chart value and the cell. Assert that the read view's text (headings, paragraphs and `.fig` `[data-path]` contents) equals what `docHTML(parseDoc(saved))` renders for those blocks.
- [ ] **Step 2:** Run it. Expected: PASS (it rides on Tasks 4 to 8).
- [ ] **Step 3 (Sonnet, background):** `npm run lint`, `npm run build`, `npm test` (with the Neon branch), `npm run test:browser`, and the render and look locks. Report failures with output.
- [ ] **Step 4:** Open the app (`npm run dev`), go through the done-when by hand, and look at each changed screen at full size. Update the spec's M4 line with status, commits and the calls made here.
- [ ] **Step 5:** Commit: "Docs M4 done: the doc editor".

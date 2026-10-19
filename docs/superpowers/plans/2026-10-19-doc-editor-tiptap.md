# Doc editor on Tiptap: plan

Spec: `docs/superpowers/specs/2026-10-19-doc-editor-rewrite-design.md`. Inline execution; stop at each task boundary (memory). Each task ends with `npm test`, `npm run lint`, and the browser tests it touches.

## Task 0. Undo loses typed words (live bug)
In `useDocEdit.ts`: typing never calls `setShown`, so after `restore(prev)` the draft is reverted but the field is not redrawn, and Save writes the reverted draft. Fix so undo redraws and keeps the caret. Test in `tests/browser/doc-edit.spec.ts`: type, ⌘Z, the field shows the old words, Save writes them. Also probe the deck's slide edit mode with the same steps. Commit on its own.

## Task 1. Chart starters
Add bar chart (relabel), line chart and horizontal bars (ranked) to `blocks` in `starters.json`, with icons in `slash.ts`. Confirm on `/src/dev/docs.html` that ranked draws horizontal bars. Check each in both themes at three widths, `check_doc` clean. Offer waterfall, timeline, matrix, image, team and logos as numbered options; add none unasked.

## Task 2. Editor spike and section decision (done 2026-10-19; see the spec's Spike result)
Tiptap with the schema of the `Block` union only (StarterKit extras off), figures as atom NodeViews hosting `FigureEdit`, code and raw as atoms. Decide section nodes vs a flat doc with adjacency selectors. Look lock: every doc starter, read view against edit mode, chrome hidden, pixel-compared; `pre-wrap` checked. Check the licence of any drag-handle extension. Throwaway until the look lock passes.

## Task 3. Nested lists in the format
Item depth in `types.ts`, `parse.ts`, `serialize.ts`, `validate.ts`, `render.ts`, `doc.css` (what level 2 and nested numbers use for markers: shown on the docs dev page, full size, both themes), `ops.ts`/`write_doc_text`, the doc guide (token budget), round-trip tests. Does not deploy before Task 4.

## Task 4. The editor
ProseMirror ↔ `Block[]` through `markup.ts` and the existing serializer (no Tiptap Markdown serializer), ids as node attrs with `keepOnSplit: false`, input rules (`# `, `## `, `### `, `- `, `* `, `1. `, `> `, `---`), slash menu as a suggestion, floating toolbar (bold, Focus, link), Tab and Shift-Tab, drag handle, paste mapping, undo grouping, caret. `useDocEdit` shrinks to: state is the draft, Save closes the open figure, runs `accept()`, writes. Presence, 409, versions, comments unchanged. Port `doc-edit`, `doc-done`, `doc-collab` specs; add the new probes (select across blocks and delete, undo typing, every shortcut, Google Docs paste, no duplicate ids after a heading split, starters round-trip). Delete the old editor (`editorKeys.ts`, `editorHTML.ts`, redraw and focus code) with no shims.

## Task 5. Look review
Full-size screenshots, both themes: nested markers and indent, the new chart entries, section spacing in edit mode. Advisor review; critique logged in `docs/temp/apple-bar-review.md`.

## After
The nested page tree, its own spec. FUTURE: the Neon contract for M4 SQL, M5 MCP run against production.

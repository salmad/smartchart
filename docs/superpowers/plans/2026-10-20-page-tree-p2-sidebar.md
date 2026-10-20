# Page tree P2: the sidebar — plan

Spec: `docs/superpowers/specs/2026-10-19-page-tree-design.md` (section 4 and the edge cases). P1 (data and server) is built: `GET /api/pages?workspace=`, `PUT …?id=&move`, `GET …?id=&subpages`, `parent` on a new deck or doc's first save, subtree delete. Inline execution; stop at each task boundary (memory). Each task ends with `npm test`, `npm run lint`, `npm run build` and the browser tests it touches (`npm run test:browser`; in this container Playwright needs `/opt/pw-browsers/chromium_headless_shell-1208` linked to the installed 1194 build, and `doc-done.spec.ts` already fails on `origin/main`).

**Done when** (from the spec): the browser tests build a three-level tree, reload with it intact, and the tree works with the keyboard alone.

**Out of P2:** drag and drop (P3), MCP (P4). Moves in P2 go through the **Move to…** picker and the keyboard.

## What exists (read before starting)

- `Sidebar.tsx` (143 lines) holds two lists (`decks`, `docs`), loads each with `repos.decks.list` and `repos.docs.list` (200 each), builds the rename, delete and new flows. `ItemList.tsx` draws one section: a row is a button with name and a second line, and a `···` menu (Rename…, Delete…). `DeleteDeck.tsx` is the confirm dialog.
- A deck is made in the editor (`newDeck()` → `/new`) and gets its row only on its first save; its id and workspace come from app state (`workspaceId` in `state.ts`, `SavedDeck` in `store.ts`). A doc is saved at once by `createDoc` in the sidebar.
- Two repos per kind: the remote one (`remote.ts`, `docs.ts` `remoteDocRepo`) and a local one for the dev account (`store.ts`, `docs.ts`). Both must carry the new fields, or the dev account (and the browser tests that use it) lose nesting.
- Sidebar is `max-[900px]:hidden`. The spec says Move to… "works below 900 px"; it does not today because the whole sidebar is hidden there. Decision needed in Task 3 (see "Questions").

## Task 1. The client repos know the tree — done
Calls made: the dev account's tree rules live in `src/app/local-pages.ts` (raw reads of the four storage keys, so `store.ts` and `docs.ts` use it without importing each other; the key constants moved there and are re-exported under their old names). `PageSummary` moved to `engine/pages/tree.ts` (the server re-exports it). A local `remove` of a deck or doc now always deletes the branch and the versions of every page in it. `SavedDeck` carries `parent` and `sortKey`; the remote deck save keeps both out of the stored `data` and sends `parent` only when set. The local repos treat `parent` as first-save-only and keep an existing page's place, as the server does. `PageRepo` is not wired into `Root.tsx` yet; Task 2 does that with the hook.

- `src/app/pages.ts` (new): `PageRepo { list(workspaceId): Promise<PageSummary[]>; move(page, to): Promise<string | null>; subpages(page): Promise<number> }`, a `remotePageRepo({ fetcher })` over `/api/pages` and the `?move` and `?subpages` calls (a 409 or 403 answers its `error` sentence; 404 "That page is gone."), and a local one for the dev account over the local deck and doc stores (same rules, using `canMove`, `slotKey`, `descendants` from `engine/pages/tree.ts`).
- `DeckSummary` (store.ts) and `DocSummary` (docs.ts) get `parent` and `sortKey`; `SavedDeck` and `DocDraft` get an optional `parent: PageRef` used **only on the first save** (the server ignores it afterwards). Local repos store and return them.
- Local `remove` of a deck or doc deletes the subtree and its versions, as the server does.
- Tests (`tests/unit/pages-repo.test.ts`): remote calls with a stub fetcher (URLs, bodies, each status → sentence); local repo: nest, move, refuse cycle and depth with the shared sentences, delete a branch.

## Task 2. Tree state: one list, flattened rows

- `src/app/components/sidebar/flatten.ts` (pure): `visibleRows(pages, expanded, openRef)` → rows `{ ref, name, depth, hasChildren, open, parentRef }` in tree order; `pathTo(pages, ref)` (ancestors to auto-expand); `shownDepth = min(depth, 4)` for the indent (deeper levels keep the 4th indent, the breadcrumb tells the rest). A deck with no slides is hidden **only if it has no children** (spec edge case). Uses `buildTree` from `tree.ts`.
- `usePageTree.ts` (hook): loads `PageRepo.list` for the workspace; same reload triggers as today (open deck, open doc, tick); the **open deck** that has no row yet shows under its live name (the current rule), at the top level or under its pending parent; `expanded` state per viewer and workspace in `localStorage` (wrapped in try/catch; renders fine without it), with the path to the open page expanded on load and when the open page changes; `move(ref, to)` is optimistic (update the list at once, call the repo, put it back and surface the sentence on a refusal).
- Tests: `flatten` (order, collapsed, depth cap, hidden empty deck with and without children, a missing parent shows at the top, a deck and a doc with the same id); hook with a stub repo (optimistic move reverts on refusal).

## Task 3. The tree component replaces ItemList

- `PageTree.tsx` replaces `ItemList.tsx` (delete it and its use; no shim). One section, "Pages", with `+` (New doc or deck at the top level, from the existing New menu: today two buttons, so `+` opens a two-item menu).
- Row: chevron when it has children (a same-width gap when not), 14 px kind glyph (`FileText` and `Presentation` from lucide, `text-ink-3`), the name, `···` menu. Indent 14 px per shown level. The second line goes; the time moves to the tooltip (`title`). Open row styling as now.
- `role="tree"`, `role="treeitem"` with `aria-level`, `aria-expanded`, `aria-selected` for the open page, roving `tabindex`; Up and Down move, Right expands or enters, Left collapses or goes to the parent, Home and End, Enter opens. Typing a letter jumps by name (WAI-ARIA).
- Viewers: no `+`, no menus, no keyboard moves; they can expand and open.
- Loading, error and empty states keep today's wording ("Couldn’t load your pages.", "No pages yet.").
- Look: full-size screenshots, both themes, a deep tree, long names, collapsed; log the critique in `docs/temp/apple-bar-review.md`.
- Browser tests (`tests/browser/page-tree.spec.ts`, using the dev account helpers in `dev-account.ts`): the tree renders nested rows; chevrons toggle; the open page's path is expanded after a reload; collapse state survives a reload; arrow keys, Right, Left, Enter.

## Task 4. Add subpage, and a deck born under a parent

- Row `···` menu: **Add subpage → Doc | Deck**, plus a `+` on hover beside the menu (a small menu with the same two items). Menu order: Rename…, Add subpage, Move to…, Delete….
- Doc: `createDoc` saves with `parent` and opens it; the parent expands.
- Deck: `onNewDeck(parent?)` → app state gets `pendingParent` (a `PageRef`), cleared by `newDeck` without one; the first save sends it (`SavedDeck.parent`). Until the first save the sidebar shows the open deck under that parent, parent expanded. If the parent is deleted or the refusal comes back (depth), the deck is saved at the top level and the sidebar says why in one sentence (use the existing `say` path).
- The `+` at the top still makes a top-level page.
- Browser tests: add a subpage doc under a doc; add a subpage deck under a doc, make a slide (use the starter pick as other specs do), reload: the deck sits under its parent.

## Task 5. Move to…, and the keyboard moves

- `MovePicker.tsx` (a dialog like `NewDoc`): searchable list of the workspace's pages as an indented tree, "Top level" first. The page and its descendants are greyed (they would make a cycle); pages that would break the depth cap are greyed with the reason (`canMove` returns the sentence; show it as the row's description). Enter confirms; the page goes last under the choice. Focus is trapped and restored (shadcn Dialog).
- Keyboard on a focused row: ⌘↑ and ⌘↓ move it among its siblings (`before` or `after` the neighbour), Tab indents (becomes the last child of the sibling above), Shift-Tab outdents (placed after its parent). A refusal puts the row back and shows the sentence (aria-live region, same as the refused saves).
- If the **open** page is moved, nothing about the open screen changes (a move is not content).
- Tests: unit for the picker's greying (pure function `moveTargets(pages, ref)` → `{ ref, depth, reason | null }[]`); browser: move a page with the picker, refuse a cycle (greyed), keyboard indent, outdent, reorder, reload keeps it.

## Task 6. Delete with a count

- `DeleteDeck` takes `subpages?: number`: with children, "Delete “X” and its N subpage(s)? Their slides, text and figures go with them. This can’t be undone." and the button reads "Delete N+1 pages"; with none, today's dialog unchanged. The count is fetched (`PageRepo.subpages`) when the menu item is chosen; if it fails, say "Couldn’t check for subpages." and do not delete.
- After a delete, remove the branch from the list; if the **open** page is in it, call the existing `onDeckDeleted` or `onDocDeleted` (open another page / `/new`).
- Tests: browser: delete a parent with two children from the menu, the dialog names the count, the branch is gone after a reload, the open page was inside it so the app leaves it.

## Task 7. Breadcrumb

- `Breadcrumb.tsx`: `Research / Competitors / Revolut` above the title in the doc header (`DocScreen.tsx`) and the deck bar (`Bar.tsx`/`DeckTitle.tsx`), each ancestor a link (`go('/d/…')`, `go('/doc/…')`, whatever the routes are), read-only, truncated in the middle past three. Rendered only when the page has a parent; a shared page (`/s/…`) shows none.
- It reads the same tree state as the sidebar, so a move shows at once; it is stale for a move made elsewhere until the next load (accepted in the spec).
- Print: hidden in `@media print` for docs. Slides and `slides.css` are not touched; the deck bar is app chrome.
- Look review as in Task 3; tests: browser asserts the path and a link click.

## Task 8. Close the milestone

- `npm test`, `npm run lint`, `npm run build`, `npm run test:browser`; the **done-when** browser test (`page-tree.spec.ts`: build a three-level tree, reload, intact; then the same tree driven by keyboard alone: no `mouse` calls).
- Sidebar at 1,000 pages (seeded through the local repo or the Neon branch): scroll and expand stay smooth; render only expanded rows (collapsed by default), and measure the time to expand a 200-child node. If it janks, window the list (a small own virtual list, no new dependency) and say so in the spec.
- `design-guardian` review of the changed screens at full size, both themes; log in `docs/temp/apple-bar-review.md`.
- Spec P2 line: status, commits, calls made. Add to `docs/product/FUTURE.md` only what P2 leaves out. Stop; P3 (drag and drop) gets its own plan.

## Questions to settle before Task 3

1. **Below 900 px** the sidebar is hidden entirely today. Keep that (the spec's "Move to… works below 900 px" then only applies once a mobile menu exists), or add the sidebar as a slide-over now? Recommended: keep, and note it in the spec, since a slide-over is its own design.
2. **Order of the first load**: the backfill puts pages newest first at the top level; the sidebar will show docs and decks interleaved by that. Confirm this is wanted over "docs, then decks".

## Risks to watch

- `Sidebar.tsx` is 143 lines and this adds state: move the tree state to `usePageTree` and the flows (rename, delete, create) into small hooks so no file passes ~300 lines.
- The open-deck row before its first save must not flicker or duplicate when the real row arrives with the same id.
- Optimistic moves and the periodic reload must not fight: ignore a reload that started before an unfinished move.
- Two repos (remote and local) drifting: Task 1's tests run the same cases against both.

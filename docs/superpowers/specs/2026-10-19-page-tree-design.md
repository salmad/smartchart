# Page tree: docs and decks nested in the sidebar

> Status: approved 2026-10-19 (delete and subpage calls confirmed); P1 plan: `docs/superpowers/plans/2026-10-19-page-tree-p1-data-server.md`. Part of Occam Docs (`2026-10-19-occam-docs-design.md`, section 3 "Notion-like sidebar"). It follows the doc editor spec (`2026-10-19-doc-editor-rewrite-design.md`), which left it out. P1 (data and server) is built; P2 to P4 are not.

## Why

The sidebar is flat: a Docs section and a Decks section, each newest first (`src/app/components/sidebar/Sidebar.tsx`, `ItemList.tsx`). A research project is one overview doc, five competitor docs and the deck that came out of them, and today they sit among every other page in the workspace. The user asked for a Notion-style tree: a page can have subpages, you can drag one under another, and the sidebar shows the shape of the work.

## Goals

1. Any doc or deck can have a parent, and a parent can be a doc or a deck. One tree per workspace.
2. The sidebar shows that tree: expand and collapse, indent, and drag to re-parent or reorder.
3. A person can do everything without a mouse: a **Move to…** picker in each page's menu does what dragging does.
4. Agents see and build the same tree over MCP (`parentId`).
5. Nothing existing changes for anyone who never nests: every page starts at the top, in the order the sidebar shows today.

## Non-goals

- Page content changing with the tree. A subpage is not a section of its parent; the doc format, `Doc`, `Deck` and their checks are untouched.
- Inherited access or sharing. A page's role comes from the workspace, as now; sharing a page (`share_id`) shares that page only, never its children.
- Moving a page to another workspace (FUTURE #23). When that is built it moves the whole subtree; this spec only makes sure the tree does not make that harder.
- A trash or undo for deletes. Deleting is permanent today and stays so (see "Delete").
- Folders (a node with no content). A parent is always a real doc or deck.
- Favourites, a search box, "recently opened". Separate requests.

## What exists (2026-10-19)

- `decks` and `docs` are separate tables, each with `workspace_id` (`api/_lib/db.ts`). Access is checked in SQL with `may('decks'|'docs', user, roles)` against the workspace's `members`, so a call the user may not make answers as if the page did not exist.
- Lists: `listDecks(userId, workspaceId?)`, `listDocs(userId, workspaceId)`, both `order by updated_at desc limit 200`. The sidebar loads them separately and hides decks with no slides.
- Delete: `deleteDeck` and `deleteDoc` remove the row and its versions and blobs. There are no delete tools over MCP.
- Rename and delete live in each row's `···` menu (`ItemList.tsx`). Dragging exists only for slides in the strip (`Strip.tsx`, native `draggable`); there is no drag-and-drop library in `package.json`.

## Design

### 1. Data: two columns on each table

`decks` and `docs` each get `parent_kind text`, `parent_id text` (both null at the top level) and `sort_key text not null`. No new table.

I considered a single `pages` table holding kind, id, parent and order. It gives one place for the tree, but it would put a join in front of every access check and every list, and `may(...)` is written per table today. Two columns keep every existing query and test as they are, and the tree is read with one extra column.

- **Ids.** Decks and docs have separate id spaces. The app makes `d_…` and `doc_…` ids, but `putDeck` and `putDoc` accept an id the client chose, and older decks may not follow the pattern, so nothing guarantees a deck id never equals a doc id. A parent is therefore named by kind and id: `parent_kind` (`'deck'|'doc'`) beside `parent_id`, both null at the top level (decided 2026-10-19, after checking the generators in `api/_lib/deck-service.ts` and `src/app/store.ts`).
- **Order.** `sort_key` is a fractional index (a short string that sorts between its neighbours, as Figma and Linear do), so a move writes one row, not every sibling. Siblings are the pages with the same `workspace_id` and `parent_id`, across both tables, sorted by `sort_key` then `id`. Two pages can briefly share a key when two people move at once; the `id` tie-break keeps the order stable and the next move gives a fresh key.
- **Migration** (the same idempotent style as `db.ts`): add the columns; give every existing page `parent_id` null and a key that preserves what the sidebar shows today. Decks and docs interleave by `updated_at` newest first, so the first tree is "everything at the top, newest first", not "docs then decks". The order is then the user's: an edit no longer moves a page up the list.
- **New pages** go to the **bottom** of their siblings (Notion's rule, because order is now meaningful), under the parent they were made from, else the top level. "Newest first" stops being the sidebar's order; the doc list over MCP keeps `updated_at desc` (see section 5).

### 2. Rules the server enforces

All in single SQL statements, as the other writes are, so no check can race.

1. **Same workspace.** A page's parent must be in its workspace.
2. **No cycles.** A page can't be moved under itself or any of its descendants. The statement walks up from the new parent (a recursive CTE, bounded by the depth cap) and refuses if it meets the page.
3. **Depth.** At most **6** levels from the top (my call: deeper trees stop being readable in a 260 px sidebar). A move that would push any descendant past 6 is refused with a sentence.
4. **Permission.** Moving needs edit rights in the workspace (the same `R('write')` as a rename). The parent is just a pointer: moving a page under another needs no extra right on the parent, because the whole workspace's editors can already edit both. A viewer sees the tree and cannot change it.
5. **Missing parents.** A parent that is gone or not visible to the caller reads as "no such page", like any other call (it never says whether it exists elsewhere).

A refused move answers with a short sentence the UI shows as it is (the same pattern as the refused saves).

### 3. Delete

A parent with children is the one case that needs a decision. Options:

| Option | For | Against |
|---|---|---|
| **A. Delete the subtree** (Notion's trash, but permanent) | Matches the mental model: the page and everything inside it go | Permanent, and one click can lose a lot |
| B. Lift the children to the deleted page's parent | Nothing but the one page is lost | The user said "delete this", not "reorganise my pages"; surprising order changes |
| C. Refuse until the page is empty | Safest | Forces tedious moves |

**Decided (2026-10-19): A, with a count.** The confirm dialog (`DeleteDeck.tsx`'s pattern) names what goes: "Delete *Finbridge research* and its 6 subpages? This can't be undone." A page with no children keeps today's dialog. It matches how the user thinks of the tree, and because deletes are already permanent the dialog is the safeguard that exists. A trash is the real fix (a separate request).

The subtree delete is one statement (the descendants by the same recursive CTE), then the versions and blobs of each, as `deleteDeck` and `deleteDoc` do per page. It needs the write right on the workspace, so it can't delete a page the caller couldn't have deleted one by one.

### 4. The sidebar

`Sidebar.tsx` today builds two `ItemList`s. It becomes **one tree**, "Pages", with the workspace switcher above it as now.

- **Rows.** Each row has a chevron when it has children (a gap of the same width when it doesn't, so names align), a small kind mark (a document or a slides glyph from lucide, 14 px, `text-ink-3`), the name, and the existing `···` menu. Indent is 14 px per level. The row's second line (slide count and time) is dropped to fit the nesting; the time moves to the tooltip. This is a deliberate loss of information for room, and it is the call I would want reviewed.
- **Open and collapsed.** All collapsed on first load except the path to the open page, which expands automatically (including when the page is opened from a link). The state is per viewer, per workspace, in localStorage, and the sidebar renders correctly without it.
- **New.** The `+` at the top makes a page at the top level (a doc or a deck, from the existing New menu). Each row's `···` menu gets **Add subpage → Doc | Deck**, and the row shows a `+` on hover beside the menu. The new page opens, under its parent, with its parent expanded.
- **Menu.** `Rename…`, `Add subpage`, `Move to…`, `Delete…`. `Move to…` opens a small picker: a searchable list of the workspace's pages as an indented tree, with "Top level" first; the page and its descendants are greyed out (they would make a cycle) and pages that would break the depth cap are greyed with the reason. Enter confirms. This is the keyboard and touch path; it also works below 900 px.
- **Drag and drop.** Native HTML drag (as `Strip.tsx` does for slides), with no new library: dragging a row shows a 2 px line between rows (reorder, same parent or a new one) or a highlight on a row (become its child), decided by where in the row the pointer is (top quarter, middle half, bottom quarter). Dropping on a collapsed row expands it after 600 ms of hover. Illegal targets (a descendant, too deep) show no indicator and drop nothing. A viewer's rows aren't draggable. Reduced-motion users get no auto-expand animation; the expand is instant.
- **Keyboard.** The tree is a `role="tree"` with `treeitem` rows (arrow keys move, Right expands, Left collapses or goes to the parent, Enter opens, as the WAI-ARIA tree pattern says). ⌘↑ and ⌘↓ on a focused row reorder it among its siblings, Tab and Shift-Tab indent and outdent it. Nothing needs a pointer.
- **Breadcrumb.** The doc header and the deck bar show the path above the title (`Research / Competitors / Revolut`), each part a link, truncated in the middle past three. It is read-only; it appears only when the page has a parent.
- **Optimistic and honest.** A move updates the sidebar at once and writes in the background; a refusal puts the row back and shows the sentence. The sidebar re-reads on the same triggers it does today (open page, tick), so a move made over MCP shows up the next time it loads (no push; presence-style polling is not extended to the sidebar).

### 5. API and MCP

REST (the existing `api/decks.ts` and `api/docs.ts` routes): lists return `parentId` and `sortKey` per page. One new call per kind to move: `POST …/move { parentId: string | null, before?: id, after?: id }` (the server computes the `sort_key` from the neighbours, so a client can't write a bad key). Create takes an optional `parentId`.

`Db` gets `movePage(userId, kind, id, { parentId, before?, after? })`, which answers `'ok'`, `'foreign'` (as the other calls) or a sentence; `listDecks` and `listDocs` return the two columns; `deleteDeck` and `deleteDoc` delete the subtree. Both stay in `fake-db.ts` for the unit tests and in the real SQL contract tests (`tests/unit/db-contract.ts`).

MCP (thin harness: a field and one tool, no tree logic):
- `list_docs` and `list_decks` return `parentId` on every row. They keep their order (newest first), so an agent reads the shape from the ids, not the order.
- `create_doc` and `create_deck` take an optional `parentId`.
- **`move_page`**: `{ id, parentId | null, after? }` for a doc or a deck (the tool finds the kind from the id), returning the new parent and position. A refusal returns the same sentence the UI shows.
- Guide and `INSTRUCTIONS` get one line each: "Pages nest; give a new page a `parentId` to put it under another; `move_page` re-parents." The 470-token budget in `INSTRUCTIONS` is checked in the plan.
- No MCP delete is added; there is none today and this is not the place.

### 6. What the tree does not touch

- `Doc`, the doc file, the doc checks, deck slides, versions, comments, presence, share links and `rev`/conflict handling. A move changes only `parent_id`, `sort_key` and neither bumps `rev` nor makes a version (it is not content), so moving a page never makes another writer's save stale.
- Realtime for the open page: if someone moves the page you have open, you keep editing; your breadcrumb is stale until the next load. This is acceptable because the tree is navigation, not content.

## Edge cases

- **Deck with no slides.** The sidebar hides empty decks today. A hidden deck that has children would orphan them from view, so a deck is hidden only if it has no slides **and** no children.
- **A parent the viewer can't see.** Access is by workspace, so every member sees every page; the case exists only for a page whose parent was deleted by a path that predates this (not possible once subtree delete ships, but the migration treats a missing parent as the top level).
- **200-row list limit.** The lists cap at 200 per kind. A tree needs all of a workspace's pages or it shows holes, so the plan raises the cap for the tree call and measures the sidebar at 1,000 pages.
- **Two people moving at once.** Last write wins per page; the cycle and depth checks run on the state at write time, so a pair of moves that would make a cycle together cannot both land.
- **Rename and parent.** A rename never changes position. A page's name is not unique among siblings.
- **Sharing.** A shared deck or doc link opens that page only; a shared page shows no breadcrumb and no tree.

## Build order

Each milestone ends with its own plan and stops at the boundary (memory: inline execution).

**P0. Spec.** This file; add "page tree" to the Occam Docs spec's section 3 as built-by-this-spec.

**P1. Data and server.** The id check, the columns and migration, `movePage`, the cycle and depth rules, subtree delete, `parentId` on lists and creates, and the fake `Db`. *Done when:* a Neon-branch contract test (`tests/unit/db-sql.test.ts`) nests three levels, refuses a cycle, refuses a seventh level, deletes a subtree with its versions, and a viewer can't move.

*Built 2026-10-20, commits `f74a3ea..` on `claude/ecstatic-cerf-51uhxf` (plan `docs/superpowers/plans/2026-10-19-page-tree-p1-data-server.md`, calls recorded per task): tree helpers (`src/engine/pages/tree.ts`), `parent_kind`, `parent_id` and `sort_key` on both tables with a newest-first backfill, `parent` and `sortKey` on the lists, `listPages`, new pages last under their parent, `movePage`, subtree delete with `countSubpages`, and the REST routes (`/api/pages` as a route of `api/account.ts`, `PUT ?move`, `GET ?subpages`, `parent` on create). The done-when runs in `tests/unit/db-contract.ts` on the fake and on a Neon branch (`db-sql.test.ts`, 28 tests): three levels nest, mixed kinds, a cycle and a seventh level are refused, a branch is deleted with its versions and blobs, a viewer can't move. At 1,000 pages the tree call took about 0.4 s and a branch delete about 1.3 s. Not done in P1: any UI, drag and drop, MCP. Open: the sidebar ignores the new fields until P2.*

**P2. The sidebar.** One tree, expand and collapse, Add subpage, Move to… picker, the delete dialog with a count, keyboard, breadcrumb. *Done when:* the browser tests build a three-level tree and reload with it intact, and the tree works with the keyboard alone.

**P3. Drag and drop.** Reorder and re-parent by drag. *Done when:* a browser test drags a page under another and between two siblings, and an illegal drop does nothing.

**P4. MCP.** `parentId`, `move_page`, the guide line. *Done when:* an MCP session creates a doc, nests two under it and moves one out, and `list_docs` returns the parents.

## Critical files

- Changed: `api/_lib/db.ts` (columns, migration, `Db`), `db-decks.ts`, `db-docs.ts`, `fake-db.ts`, `api/decks.ts`, `api/docs.ts`, `src/engine/tools/docs.ts`, `decks.ts`, `instructions.ts`, `src/app/components/sidebar/Sidebar.tsx`, `ItemList.tsx` (becomes the tree), `DeleteDeck.tsx`, the doc header and deck bar for the breadcrumb.
- New: `src/app/components/sidebar/PageTree.tsx`, `MovePicker.tsx`, `src/engine/pages/tree.ts` (framework-free: build a tree from rows, the cycle, depth and fractional-key helpers, so the client and the fake `Db` share one implementation), `tests/unit/page-tree.test.ts`.

## Verification

- **Unit:** the tree helpers (build, cycle, depth, key between two keys, key before the first and after the last) and the fake `Db` rules.
- **Contract:** the SQL rules run against Neon (`TEST_DATABASE_URL`), as the workspace tests do.
- **Browser:** nest, reload, collapse state, drag, keyboard, delete with children, viewer can't move.
- **Look:** screenshot the sidebar with a deep tree, long names, 1,000 pages and a collapsed state, in both themes, and log a critique in `docs/temp/apple-bar-review.md`.

## My calls (to check while reading)

- A parent can be a doc or a deck, and any kind can be under any kind.
- Three columns on each table (`parent_kind`, `parent_id`, `sort_key`), not a `pages` table.
- Fractional `sort_key`; new pages at the bottom; the first tree keeps today's newest-first order. The user confirmed (2026-10-19) that the default order doesn't matter much because they can reset it by moving a page; so there is no "sort by…" control and no automatic re-sorting.
- Depth cap 6.
- Delete removes the subtree, with a count in the dialog, and is permanent (confirmed 2026-10-19; a Trash with restore, as Notion has, is a separate request).
- Subpages show in the sidebar and the breadcrumb only, not as a link list inside the page (confirmed 2026-10-19).
- The sidebar row loses its second line (slide count and time) to fit nesting.
- A move is not a version and does not bump `rev`.
- Sharing and access never inherit through the tree.
- `move_page` is one tool for both kinds; no MCP delete.

# Page tree P1: data and server — plan

Spec: `docs/superpowers/specs/2026-10-19-page-tree-design.md`. Inline execution; stop at each task boundary (memory). Each task ends with `npm test`, `npm run lint` and `npm run build`; tasks that touch SQL also run `tests/unit/db-sql.test.ts` against a Neon branch (`TEST_DATABASE_URL`).

**Done when** (from the spec): a Neon-branch contract test nests three levels, refuses a cycle, refuses a seventh level, deletes a subtree with its versions and blobs, and a viewer can't move.

**Out of P1:** any UI (P2), drag and drop (P3), MCP (P4). The lists return the new fields, but the sidebar ignores them until P2.

## Task 1. Tree helpers (framework-free)

New `src/engine/pages/tree.ts` and `tests/unit/page-tree.test.ts`. Pure functions, shared by the client (P2) and the fake `Db`:

- `type PageRef = { kind: 'deck' | 'doc'; id: string }` and `type PageNode = PageRef & { parent: PageRef | null; sortKey: string }`.
- `MAX_DEPTH = 6`.
- `keyBetween(a: string | null, b: string | null): string`: a fractional key strictly between `a` and `b` (either may be null: before the first, after the last). Base-62 digits; never returns a key equal to a neighbour; throws if `a >= b`.
- `buildTree(nodes)`: children by parent, each sorted by `(sortKey, id)`; a node whose parent is missing is treated as top level (the spec's migration rule).
- `depthOf(nodes, ref)`, `descendants(nodes, ref)`, `heightBelow(nodes, ref)` (levels in its subtree, itself included).
- `canMove(nodes, ref, parent)`: `'ok'`, or a sentence: "A page can't go inside itself or its subpages." / "Pages nest 6 levels deep at most." (the same sentences the SQL path returns, so the UI shows either).

Tests: key between two keys, before the first, after the last, 200 repeated insertions at the same spot stay ordered; cycle, depth 6 ok / 7 refused counting the moved subtree's height; a missing parent reads as top level.

## Task 2. Schema and migration

`api/_lib/db.ts` `SCHEMA` gets, for `decks` and for `docs`:

```sql
alter table decks add column if not exists parent_kind text;
alter table decks add column if not exists parent_id text;
alter table decks add column if not exists sort_key text;
-- same three for docs
```

Backfill (one statement each, `where sort_key is null`): per workspace, number every deck and doc together by `updated_at desc`, and write keys that sort in that order (`row_number()` mapped to fixed-width base-62 with a trailing `V`, e.g. `0001V`, `0002V`…: a key may not end in the lowest digit `0`, and the suffix leaves room on both sides for `keyBetween`). Then `alter column sort_key set not null` is **not** used: a page made by an old server between deploy and migration would break it, so `sort_key` stays nullable in SQL and reads as `coalesce(sort_key, '')`; the code treats null as "before everything" and the next move gives it a key. Indexes: `decks_parent (workspace_id, parent_id)` and the same for `docs`.

Decks with no workspace yet (before `ensureWorkspace`) keep null columns and are unaffected.

Check: running `SCHEMA` twice changes nothing (it already runs on every cold start).

## Task 3. Lists and creates carry the fields

- `DeckSummary` and `DocSummary` (`api/_lib/db.ts`) gain `parentKind: 'deck' | 'doc' | null`, `parentId: string | null`, `sortKey: string`. `listDecks` and `listDocs` select them. A new `PageRef` import from `tree.ts` is used for the pair if it reads better as `parent: PageRef | null`; pick one shape and use it in the API too.
- `putDeck` and `putDoc` take an optional `parent` for a **new** row: the parent must be in the same workspace and pass `canMove`'s depth rule, else the call answers a sentence; the row's key is after the parent's last child. An existing row's save never changes its parent or key (as a save never moves a deck between workspaces).
- The list cap (`limit 200`) is lifted for the tree: add `listPages(userId, workspaceId)` returning decks and docs together as `PageNode`-shaped summaries (id, kind, name, updated, slides, parent, sortKey), no limit but a safety of 5,000, one SQL statement (`union all`). P2 uses it for the sidebar; the old per-kind lists stay for everything else.

## Task 4. `movePage`

`Db.movePage(userId, page: PageRef, to: { parent: PageRef | null; before?: PageRef; after?: PageRef })`, answering `'ok' | 'foreign' | string` (a sentence).

One statement per kind (the table name is the only difference; build it from a map, never from input). It:

1. finds the page and requires the write right (`may(table, user, R('write'))`), else `'foreign'`;
2. when `to.parent` is set, requires it in the same workspace, else "No such page." (same sentence for gone and for another workspace);
3. refuses a cycle: a recursive CTE from the new parent up to the root; if it meets the page, "A page can't go inside itself or its subpages.";
4. refuses depth: depth of the new parent plus the height of the moved subtree above 6, "Pages nest 6 levels deep at most.";
5. computes the key: between `after` and its next sibling, or between `before` and its previous sibling, or after the last child, using the neighbours read in the same statement; the key arithmetic lives in SQL-free TypeScript, so the call is two round trips (read neighbours, write with `where sort_key is not distinct from $expected` for each neighbour read) and retries once if a neighbour changed. Say this in a comment: it is the one place the "single statement" rule bends, and why.
6. writes `parent_kind`, `parent_id`, `sort_key`. It does **not** touch `rev`, `updated_at`, or versions.

Fake `Db` (`tests/unit/fake-db.ts`): the same rules using `tree.ts`, so the contract holds for both.

## Task 5. Subtree delete

`deleteDeck` and `deleteDoc` delete the page and every descendant (the same recursive CTE, `returning` each row's kind and id), then each descendant's versions and blobs: `deck_versions`, `deck_blobs`, `doc_versions`, `doc_blobs`. Permission: the write right on the workspace, which is the same for every page in it, so it is checked once on the page named. Add `countSubpages(userId, page): number | null` for the dialog (null when the user can't read the page). The fake does the same.

The return value stays a boolean so the existing callers don't change.

## Task 6. API routes

`api/decks.ts` and `api/docs.ts` (and `api/_lib/decks.ts`, `docs.ts`): list responses include the fields (Task 3); `POST …/move` with `{ parent: {kind,id} | null, before?, after? }` calls `movePage`; a sentence answer returns 409 with `{ error }` (the same shape as the refused saves), `'foreign'` returns 404; a viewer gets 403 with a sentence, as other refused writes. A `GET …/subpages` (or a field on the existing read) returns the count for the delete dialog. A `GET /api/pages?workspaceId=` returns `listPages`.

Check against the M3 rule: a non-member reads as missing (404), a member who may not write gets a sentence (403).

## Task 7. Contract tests

In `tests/unit/db-contract.ts` (runs on the fake in `db-fake.test.ts` and on Neon in `db-sql.test.ts`):

- three levels nest, and `listPages` returns them with their parents and keys in order;
- a deck can sit under a doc and a doc under a deck;
- a cycle (page under itself, under its child, under its grandchild) is refused with the sentence;
- a seventh level is refused, and moving a subtree whose height would push it past 6 is refused;
- a viewer can't move (the sentence), a non-member's move reads as "no such page", a parent in another workspace reads as "no such page";
- a move changes no `rev` and writes no version, and another writer's save from the old `rev` still lands;
- order: move before, after, first and last among siblings, across a deck and a doc;
- deleting a parent deletes its subtree with their versions and blobs; a sibling and the parent's parent survive; a viewer's delete is refused and deletes nothing;
- the migration: rows from before the columns exist (seed with null keys) list at the top level in newest-first order, and the first move among them works.

Also the browser-free API test in `tests/unit/api-workspaces.test.ts`' style for the new routes.

## Task 8. Close the milestone

- `npm test`, `npm run lint`, `npm run build`, `npm run test:browser` (the sidebar still works, since it ignores the new fields).
- Run `tests/unit/db-sql.test.ts` on a Neon branch and record the result at the top of the spec's milestone line (as M4's note says when it could not).
- Update the spec's P1 line with what was built and the calls made there, and add "page tree" to `docs/product/FUTURE.md`'s list only for what P1–P4 leave out (Trash with restore).
- Stop. P2 gets its own plan.

## Risks to watch

- **Recursive CTE cost** on a 1,000-page workspace: the cycle and depth checks walk at most 6 levels up, but the subtree delete walks down; measure it in Task 7 with a 1,000-page seed.
- **Keys running out of room** after many moves into the same gap: `keyBetween` lengthens the key, never fails; a test inserts 200 times at one spot and checks the longest key stays short.
- **Client-chosen ids**: a deck and a doc may share an id. Every parent pointer and every query in this milestone names the kind with the id; no helper takes an id alone.

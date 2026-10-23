# Page tree P4: MCP — plan

Spec: `docs/superpowers/specs/2026-10-19-page-tree-design.md` (P4: "`parentId`, `move_page`, the guide line"). P1 to P3 are built and on `main`. An agent that writes through MCP can only put pages at the top level today, and cannot tidy them afterwards. P4 gives it the same two abilities a person has: make a page under another, and move a page. It adds no rule: the server already refuses cycles, depth, a missing parent, a viewer and a parent in another workspace (`db.putDeck`, `db.putDoc`, `db.movePage`, all built and contract-tested in P1), and both services already turn a `{ refused }` put into a tool error. Inline execution; stop at each task boundary. Each task ends with `npm test`, `npm run lint` and `npm run build`.

**Done when** (from the spec): an MCP session creates a doc, nests two under it and moves one out, and `list_docs` returns the parents.

**Out of P4:** reordering among siblings by an agent beyond "before/after one sibling" (the same `Slot` the REST route takes, nothing more); the sidebar (nothing to change: it already reads the list and refreshes when it is open); a `list_pages` tool for the whole tree in one call (see Calls); the in-app agent (it has its own tools, not these).

## What exists (read before starting)

- `src/engine/tools/docs.ts` and `decks.ts`: `create_doc`, `create_deck`, `list_docs`, `list_decks`. A create handler returns `{ result, file | deck, workspaceId }`; the service saves it.
- `api/_lib/doc-service.ts` line ~51 calls `db.putDoc(uid, id, name, text, baseRev, workspaceId)`; `api/_lib/deck-service.ts` line ~95 calls `db.putDeck(..., { named, workspaceId })`. Both `Db` methods already take an optional `parent: PageRef` (used by the REST routes), and both services already return `{ ok: false, error: { code: 'refused', ..., fix: 'Choose another parent.' } }` for `{ refused }`.
- `AccountPort` (`src/engine/tools/types.ts`) is what an `account`-scope tool talks to: `listDecks`, `listDocs`, `workspaces`, `share`. Its implementation is the `port` object in `deck-service.ts`. `db.listDocs` and `db.listDecks` already return `parent` and `sortKey` per row (P1); the port drops them.
- `db.movePage(userId, page, { parent, before?, after? })` answers `'ok'`, `'foreign'` (not found or not readable), or a sentence (`NO_EDIT` for a viewer, otherwise the cycle, depth or missing-parent sentence). `api/_lib/pages.ts` `moveBody` validates the body shape; `pageRef` validates a page.
- `tests/unit/tools-registry.test.ts` snapshots every tool's MCP view, so adding a tool or a parameter changes `__snapshots__/tools-registry.test.ts.snap` (update it, and read the diff).
- `tests/unit/doc-tools.test.ts`, `deck-service.test.ts`, `mcp.test.ts` run tools against the fake `Db` (`tests/unit/fake-db.ts`), which already enforces the tree rules.

## Task 1. `parent` on create_doc and create_deck — done

Calls made: the workspace question needed no new lookup: the server's `place` (P1) already takes the parent's workspace and refuses a different `workspaceId` ("No such page."), so the services only stop defaulting to the most recently opened workspace when a parent is given. A `'foreign'` put with a parent can only be a viewer (an unreadable parent is refused earlier as "No such page."), so it answers with the viewer sentence. The page schema and the shape check live in `src/engine/tools/pages.ts` (also where `move_page` goes). Tests are in `tests/unit/tools-parent.test.ts`; the registry snapshot changed only for the two create tools.

- Both tools get an optional `parent: { kind: 'doc' | 'deck', id: string }` (see Calls on why an object and not `parentId`). Description: "Put it under this page (a doc or a deck; it goes last among that page's subpages). Without it, the page is at the top level of the workspace." It must be in the same workspace; with `parent` and no `workspaceId`, the workspace is the parent's, not the most recently opened one.
- `HandlerOut` gains `parent?: PageRef`. The handlers validate the shape only (kind is `doc` or `deck`, `id` matches the id pattern: `pageRef` from `api/_lib/pages.ts` is server-side, so the schema in the tool carries the enum and the handler a small shape check, `bad_input` otherwise). Everything else is the server's: `doc-service.ts` and `deck-service.ts` pass `out.parent` to `putDoc` / `putDeck`.
- Workspace rule: if the call names both `parent` and `workspaceId` and the parent is elsewhere, `put` answers `{ refused }` already ("a new page asked to go under a parent that isn't there"); the error's `fix` is "Choose another parent." Keep that. For the case with `parent` only, the service looks the parent's workspace up (`db.listPages` is a workspace list, so add nothing new: use `db.getDocMeta` / the deck row the service already reads for the role; if neither tells the workspace cheaply, require `workspaceId` with `parent` and say so in the description. Pick the cheap one while reading `db-docs.ts` and `db-decks.ts`, and record the call.)
- The result of a create gains `parent` (the ref or null) so the agent sees where it landed.
- Tests: in `doc-tools.test.ts` and `deck-service.test.ts`, on the fake: a doc under a doc; a deck under a doc; a doc under a deck; a seventh level is refused with the depth sentence as a tool error (`refused`, with the fix); a parent that does not exist is refused; a viewer in the parent's workspace is refused as a viewer; a bad shape is `bad_input`; no `parent` still creates at the top level (existing tests untouched).

## Task 2. `move_page` — done

Calls made: annotated `IDEMPOTENT` (the contract test shows the same move twice leaves the list unchanged, "last under a parent" included, since a page already last stays where it is). `parent` is required in the input, as `null` for the top level, so an agent cannot move a page to the top by leaving a field out. `AccountPort.movePage` hands the `Db` answer to the tool, which maps `'foreign'` to `not_found` ("No such page."), the viewer sentence and every other sentence to `refused` with a fix. The tool is in `src/engine/tools/pages.ts` with the page helpers; tests in `tests/unit/pages-tool.test.ts` (moves under a deck and back, before/after/last, loop, seventh level, missing parent, bad shapes, viewer, stranger, idempotence). The registry test's name list and snapshot now include `move_page`.

- New tool in a new file `src/engine/tools/pages.ts` (a third group file beside `docs.ts` and `decks.ts`; add it to `index.ts`): `move_page { page: { kind, id }, parent: { kind, id } | null, before?: { kind, id }, after?: { kind, id } }`. `parent: null` is the top level. At most one of `before` and `after`; neither means last. Scope `account`; annotations `IDEMPOTENT` is wrong (moving after a sibling twice lands the same, but "last under" twice also does), so use `IDEMPOTENT` only if the contract test confirms the second identical call changes nothing; otherwise `WRITE`. Decide when the test is written, and record it.
- `AccountPort` gains `movePage(page, to): Promise<'ok' | string>`; `deck-service.ts`'s `port` implements it with `db.movePage(uid, page, to)` and maps the result: `'ok'` → `{ moved: true, page, parent }`; `'foreign'` → `not_found` ("No such page." with fix "list_docs and list_decks show your pages."); `NO_EDIT` → `refused` with the viewer sentence; any other sentence → `refused` with the sentence and the fix "Pick another parent, or another place among its subpages."
- A move writes no version and bumps no revision (P1's call: a page's place is not its content). Say so in the description so an agent does not look for a version.
- Tests (`tests/unit/pages-tool.test.ts`, on the fake): move a doc under a deck and back to the top; before and after a sibling put it there; into its own child is refused (cycle sentence); a seventh level is refused; a viewer is refused; a page in another user's workspace is `not_found` (not "refused", so it does not confirm it exists); both `before` and `after` is `bad_input`; the second identical call is a no-op (decides the annotation).

## Task 3. `list_docs` and `list_decks` return parents; the guide line — done

Calls made: rows carry `parent` (ref or null) and no sortKey; order unchanged. The guide line is one sentence in `instructions.ts` (shortened to fit) and one bullet in the doc guide. The instructions token budget rose 470 to 495 for that sentence (it was at 467). Registry snapshot diff: only the two list descriptions. Test in `tests/unit/tools-parent.test.ts`.

- `AccountPort.listDocs` and `listDecks` rows gain `parent: { kind, id } | null` (the port already has it from the `Db` rows; it just stops dropping it). Order stays "newest first" (it is a list, not the tree); update the two tool descriptions to say each row says where the page sits ("`parent` is the page it sits under, or null at the top level; a parent can be a doc or a deck"). No `sortKey` in the answer: the agent works with `before` / `after`, never with a key.
- The one guide line, in `instructions.ts` (the MCP server's instructions, where docs and decks are introduced) and in the doc and deck guides (`guide-text.ts`), short: "Pages nest: pass `parent` to `create_doc` or `create_deck` to start one under another page, and `move_page` to move one; keep a deck's supporting docs under the deck." (What to nest is the agent's judgement; the line only says the ability exists. Thin harness: no nesting policy in code.)
- Tests: `list_docs` and `list_decks` show `parent` for a nested page and null for a top-level one; the registry snapshot is updated (read the diff: three descriptions changed, one tool added, two inputs added); `guide` tests that match text still pass.

## Task 4. The done-when, and close the milestone — done

Calls made: `tests/unit/page-tree-mcp.test.ts` runs the scenario through the MCP transport on the fake `Db` and compares `list_docs` with the `/api/pages` handler. The live run was skipped (no `TEST_DATABASE_URL` approved; `DATABASE_URL` untouched). Spec and `FUTURE.md` #30 updated. MCP clients that cached `tools/list` need to reconnect to see `move_page`.

- `tests/unit/page-tree-mcp.test.ts` (one scenario, through `mcp.ts` the way `mcp.test.ts` does, so the transport is in it, on the fake `Db`): create a doc "Research"; create two docs with `parent` = Research; `list_docs` shows both with that parent and Research with null; `move_page` one to the top level; `list_docs` shows it with null and the other still under Research; `get_doc` still works on all three; the REST `/api/pages` list (the same fake) agrees, which is what the sidebar reads.
- `npm test`, `npm run lint`, `npm run build`.
- **Live run (not part of the done-when, needs a decision):** one real MCP session against a database. Options, in the order of safety: `TEST_DATABASE_URL` (the Neon branch the contract tests use), then skip; never `DATABASE_URL` without an explicit go-ahead. If run, it makes three pages in a throwaway workspace and deletes them; log the transcript in `docs/temp/`.
- Spec: update the P4 line (status, commits, calls), and the header line ("P1 to P4 are built"). `docs/product/FUTURE.md`: only what P4 leaves out (a `list_pages` for the whole tree; reordering by position number; agents moving a page into another workspace, which is #23). Stop.

## Calls made here (to check while reading)

- **`parent` is an object `{ kind, id }`, not a bare `parentId`.** Deck and doc ids can collide (the whole tree is keyed by kind and id for that reason), and the MCP's other tools name ids by kind (`deckId`, `docId`). A bare id would need a guess. The spec said `parentId`; the object says the same thing without the guess.
- **One `move_page` for both kinds** (a page is a page in the tree), not `move_doc` and `move_deck`.
- **Moves are not versioned** and the tool says so, as in P1.
- **`list_docs` / `list_decks` keep their order** and gain `parent`; no whole-tree tool. If agents turn out to need the tree in one call (to find a good parent among many pages), `list_pages` is a small addition later: the data and the REST route exist.
- **No nesting policy in code.** Which pages belong together is the agent's judgement, taught by one guide line; the server only refuses what is impossible.
- **Viewer and foreign pages** answer as the REST route does: a viewer is told so, a page the user can't read is "No such page", so a move cannot be used to probe other people's pages.

## Risks to watch

- **Registry snapshot churn:** the snapshot is large; check that only the intended tools changed in the diff.
- **Workspace of the parent:** the easy way to get this wrong is creating the page in the "most recently opened" workspace while the parent is in another one; the put then refuses, with a confusing "no such parent". Test that call explicitly.
- **MCP clients caching the tool list:** a client that cached `tools/list` will not see `move_page` until it reconnects. Nothing to build; mention in the final report.
- **Rate and quota:** `move_page` counts as a call like the others (the `account` scope already does); no new limit.

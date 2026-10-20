# Instant app, layer C (optimistic sidebar actions) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename and delete a deck or doc, and create a doc, change the sidebar list and its stored copy at once and send the request in the background. A failure puts the row back and says why in one sentence.

**Spec:** `docs/superpowers/specs/2026-10-20-instant-app-design.md` (Layer C). Layers A and B are in `2026-10-20-instant-app-layer-a.md` and `-layer-b.md`.

**Architecture:** Two small framework-free pieces in `src/app/optimistic.ts`, no state library.
- `overlay(rows, ops)`: a pending list of `{ key, apply(rows) }` applied on top of every list the server returns. This is the model, not inverse patches: the sidebar refetches whenever the open deck or doc changes (and our own actions change them), so a server list that still has a deleted row must not bring it back while the request is in flight. The stored list is written with the ops applied.
- `ordered()`: a per-row promise chain. `run(rowId, send)` sends in the order issued; `wait(rowId)` resolves when that row has nothing in flight.

On success the op is dropped (the next read reflects it). On failure the op is dropped, the list is read again (server is truth; offline, the visible list is rebuilt from state without the op), and the notice says why.

## Global Constraints

- No `any`, no inline styles, components under ~300 lines. Thin harness: no retry or cascade logic; a queued action behind a failed one still runs and the server decides.
- Optimistic only for: rename deck, rename doc, delete deck, delete doc, create doc. Create deck is already instant (it opens `/new`; the deck saves after its first slide). Workspace create, invites, roles, share links keep their spinners.
- Navigation to a row waits for that row's queue: `ordered.wait(id).then(open)`. Decks open from the stored copy (`readKept`), which `cachedDeckRepo.save` updates only on success, so opening a just-renamed deck early would load the old name and autosave it back.
- Ops carry the list name (`decks:<ws>` / `docs:<ws>`) they were made in, and apply only to that list. A failure in a workspace that is no longer on screen corrects only that workspace's stored list; the notice shows either way.
- `loadDecks` drops decks with zero slides; no op may add a deck row.
- A doc rename bumps `onDocRenamed` only after its save succeeds (earlier, DocScreen reads the old title). The get+save runs inside the queued step.
- Renaming the open deck stays synchronous through `onRenameOpenDeck`.
- The sidebar's notice (role=alert, one line at the foot of the nav) uses the existing sentence style, clears after about six seconds or on the next write, and not on hover or open.
- Known gap, same as today: a save already in flight can reach the server after a delete; edits in the last 250 ms before deleting the open deck are not flushed, so a rollback may lose them. App's menu `deleteDeck` (App.tsx) moves to the same optimistic path and wording.
- Run `npm run build`, `npm run lint`, `npm test` before each commit; Playwright with `npm run test:browser` (known failures not from this work: `chart-area`, `doc-done`).

## Review Focus

- A refetch arriving mid-flight (route change after delete, docTick after rename) must not undo the optimistic row.
- Rename then delete, and delete then rename, on one row: server order is issue order; a failed rename after a delete does not resurrect the row.
- Workspace switch mid-action.
- Stored list never holds a row the user deleted, nor a row the server refused.

---

### Task 1: `overlay` and `ordered`

**Files:** Create `src/app/optimistic.ts`; test `tests/unit/optimistic.test.ts`.

**Interfaces:**
```ts
export interface Op<R extends { id: string }> { list: string; row: string; apply(rows: R[]): R[] }
export function overlay<R extends { id: string }>(list: string, rows: R[], ops: readonly Op<R>[]): R[]  // ops for other lists are skipped
export function ordered(): { run<T>(row: string, send: () => Promise<T>): Promise<T>; wait(row: string): Promise<void> }
```
`run` never rejects the chain (the next send still runs); it returns the caller's own result or rejection.

- [ ] Failing tests: ops apply in order; ops for another list are ignored; rename-then-delete leaves the row gone; sends for one row run in issue order while different rows run in parallel; a failed send does not block the next; `wait` resolves after the last queued send settles (success or failure).
- [ ] Implement; tests pass; commit.

### Task 2: Optimistic delete and rename in the sidebar

**Files:** Modify `Sidebar.tsx` (extract the actions into `sidebar/useRowActions.ts` if it passes ~300 lines); `ItemList.tsx` unchanged.

- [ ] Hold `ops` in a ref plus a state tick. `loadDecks`/`loadDocs` pass `overlay(...)` of the fetched slim list in `fetchFresh` so state and the stored list both carry pending ops.
- [ ] Delete: add op (remove row), re-render and store, fire `onDeckDeleted`/`onDocDeleted` at once, send `remove` through `ordered.run`. Failure: drop op, notice `Couldn’t delete “<name>”. It’s back in your list.`, reload the list.
- [ ] Rename (not the open deck): close the dialog at once, op sets the name, queued step does get+save (doc: serialize the title, then `onDocRenamed`), failure: drop op, notice `Couldn’t rename “<old>”. It’s back to its old name.`, reload.
- [ ] `RenameItem`: the deck/doc paths no longer throw into the dialog (the workspace create path still does).
- [ ] Opening a row: `ordered.wait(id).then(() => onOpenX(id))`.
- [ ] App's menu `deleteDeck` shares the delete path and wording.
- [ ] Tests (vitest, node): the rule that matters is covered in Task 1; add a test for the failure-restore decision as a pure function if one is extracted. Commit.

### Task 3: Optimistic create doc

- [ ] `NewDoc` closes at once. The row appears (op adds `{id, name, sub: 'just now'}`) and is marked current; navigation to the doc waits on the single save (`ordered.run(id, save)`), then `onOpenDoc(id)`.
- [ ] Failure: drop op, navigate to `/` if the doc was open or about to open, notice `Couldn’t create the doc. Try again.`
- [ ] Commit.

### Task 4: Playwright spec for failed actions

**Files:** Create `tests/browser/instant-actions.spec.ts` (pattern of `instant-lists.spec.ts`: mocked session, workspaces, lists).

- [ ] Delete with the DELETE route held: the row is gone at once and stays gone after a route change; release with a 500: row returns and the sentence shows.
- [ ] Rename with the save failing: new name shows at once; old name and sentence after the failure.
- [ ] Create doc with the save failing: row appears, then is removed and the sentence shows.
- [ ] Success paths: row stays removed and renamed after the server's next list.
- [ ] Commit.

### Task 5: Measure and report

- [ ] Same method as layers A and B, mock API (note a real-backend run needs a fresh test account; ask first). Time from click to the row changing, before and after, at Fast 4G. Append to `docs/temp/instant-app-measurements.md`.
- [ ] Tick the checkboxes of this plan; report the table, the deviations and the known gap above.

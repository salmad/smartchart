# Instant app, layer B (local-first data) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On a repeat visit the workspace, the deck list, the doc list and the last open deck appear from this browser at once; the server's answer then confirms or replaces them.

**Architecture:** One small module, `src/app/cache.ts`, keyed by account id (IndexedDB, in-memory fallback). The three remote repos stay as they are; a thin stale-while-revalidate layer sits between them and the screens that list (`useWorkspace`, `Sidebar`, App boot). A cache never beats a newer server copy and a save made from cached state still carries its `rev`.

**Tech Stack:** React 18, TypeScript strict, vitest (+ `fake-indexeddb` as a devDependency), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-20-instant-app-design.md` (Layer B). Layer A is `2026-10-20-instant-app-layer-a.md`; layer C (optimistic actions) is a separate plan.

## Global Constraints

- No `any`, no inline styles, components under ~300 lines; the thin harness rule applies: no clever cache policy, one rule: show what is stored, then replace it with what the server says.
- Cache key space: `occam.cache.v1`, one IndexedDB database `occam-cache`, store `entries`, entry key `<accountId>:<name>`. A schema change bumps the version and discards the old data.
- Names: `workspaces`, `decks:<workspaceId>`, `docs:<workspaceId>`, `deck:<deckId>` (a whole `SavedDeck` plus the `rev` it was read at), `last` (`{ workspaceId, deckId }`).
- Every cache read and write swallows errors (blocked IndexedDB, private mode, quota): the app then behaves as today.
- Sign-out clears the account's entries; a different account id never reads another's entries.
- The dev account (local repos) does not use the cache: its data is already local.
- Slide edits keep their existing local-first save (`usePersist.ts`); nothing here changes the save path except that a deck opened from cache carries its cached `rev`.
- Run `npm run build`, `npm run lint`, `npm test` before each commit; Playwright with `npm run test:browser`. The browser suite has two known failures on this branch that are not from this work (`chart-area`, `doc-done`); note them, do not fix them here.

## Review Focus

- Stale data shown after a delete or a role change elsewhere: the fresh answer must replace the list and the open deck; an opened deck that no longer exists shows the existing "missing" message, not the cached copy.
- Opening from cache must never save over a newer server copy: the first save from a cached deck goes through the existing `STALE` check and merge (`syncNow`), not around it.
- Account switch: user X's cached lists must not show for user Y, not even for a frame (key by account id, read only after the session id is known).
- Viewer role: a deck cached as editable must not stay editable if the server now says viewer (role comes from the fresh `get`).
- Cache failures (blocked, full, corrupt entry) behave as a first visit, with no thrown errors.

---

### Task 1: Measure the list payload (decides Task 6)

**Files:**
- Create: `docs/temp/instant-app-measurements.md` (gitignored; append)

- [ ] **Step 1:** With a real signed-in account (ask the user to sign in in the built-in browser), record the byte size and time of `GET /api/decks?workspace=<id>`, `GET /api/docs?workspace=<id>`, `GET /api/workspaces`, and `GET /api/decks?id=<last deck>`. Note whether each `DeckSummary.first` (a full slide) is present and how much of the list size it is.
- [ ] **Step 2:** Record time to the sidebar lists and to the deck interactive on a repeat visit (Fast 4G) as the baseline for Task 8. Layer A is already in, so this is the "after A" baseline.

No commit.

### Task 2: The cache module

**Files:**
- Create: `src/app/cache.ts`
- Test: `tests/unit/cache.test.ts`
- Modify: `package.json` (devDependency `fake-indexeddb`)

**Interfaces:**
- Produces:
  ```ts
  export function cacheGet<T>(account: string, name: string): Promise<T | undefined>
  export function cacheSet(account: string, name: string, value: unknown): Promise<void>
  export function cacheClear(account: string): Promise<void>
  ```
  All three never reject. Values are structured-cloneable JSON. A stored value that fails a caller's own shape check is the caller's to ignore.

- [ ] **Step 1: Write failing tests** (import `fake-indexeddb/auto`): set then get returns an equal value; a second account does not see the first's entries; `cacheClear` removes only that account; with `indexedDB` deleted from `globalThis` get returns `undefined` and set does not throw; a database at a different version is discarded and reads as empty.
- [ ] **Step 2:** `npm i -D fake-indexeddb`; run `npx vitest run tests/unit/cache.test.ts`; expect FAIL.
- [ ] **Step 3: Implement.** Open the database lazily once (`indexedDB.open('occam-cache', 1)`), one object store `entries`, key `${account}:${name}`; `cacheClear` deletes the key range `${account}:` to `${account}:￿`. On any failure fall back to a module-level `Map` so a session still benefits.
- [ ] **Step 4:** Tests pass; `npm run lint`. **Commit** `feat: per-account cache in IndexedDB`.

### Task 3: Cached workspace list and last-open deck

**Files:**
- Modify: `src/app/components/sidebar/useWorkspace.ts`, `src/app/Root.tsx` (pass the account id), `src/app/auth.ts` (`signOut` clears)
- Test: `tests/unit/use-workspace.test.ts` (or extend the nearest existing hook test), `tests/browser/instant-lists.spec.ts`

**Interfaces:**
- Consumes: `cacheGet/cacheSet/cacheClear` (Task 2); the account id from `Root`.
- Produces: `useWorkspace(repo, onChange, account?: string)` where, with an account, `list` starts as the cached list (if any), then the fetched list replaces it and is written back; `ready` resolves from the cached list as soon as it is read when one exists (so boot need not wait for the network); `currentWorkspace` is computed from whichever list is newest.

- [ ] **Step 1: Failing tests:** with a cached list the hook's first rendered `list` equals it before the repo promise resolves; the repo's answer then replaces it and is stored; a repo rejection keeps the cached list (a first-visit rejection still gives `[]`); `signOut` empties the account's entries.
- [ ] **Step 2:** Run them; expect FAIL. **Step 3: Implement** (read cache in an effect before the fetch; ignore a cached value that is not an array of objects with `id` and `name`). `signOut` calls `cacheClear(previous account id)` before publishing null.
- [ ] **Step 4:** Tests pass; `npm run build && npm run lint`. **Commit** `feat: the workspace list paints from the cache`.

### Task 4: Deck and doc lists in the sidebar, cached then fresh

**Files:**
- Modify: `src/app/components/sidebar/Sidebar.tsx` (`loadDecks` and `loadDocs`, lines 47–59; keep the file under ~300 lines, move the new helper out if needed)
- Create: `src/app/components/sidebar/useCachedList.ts` (a small hook: given `account`, `name`, `fetch`, returns `[rows, refresh]`)
- Test: `tests/unit/use-cached-list.test.ts`

**Interfaces:**
- Produces: `useCachedList<T>(account: string, name: string, fetch: () => Promise<T[]>, enabled: boolean): { rows: T[] | null; failed: boolean; refresh(): Promise<void> }`. First render of a known `name` shows the cached rows; `refresh` fetches, stores and replaces; a failed fetch keeps the rows and sets `failed`.

- [ ] **Step 1: Failing tests** for the hook: cached rows first, fresh rows replace them and are stored; fetch rejection keeps cached rows and reports `failed`; switching `name` (another workspace) shows that workspace's cache, not the previous one's rows.
- [ ] **Step 2:** Run; expect FAIL. **Step 3:** Implement the hook; replace the two `load*` callbacks with it (mapping rows to the existing `ListRow` shape stays in `Sidebar`). Keep the "deck with 0 slides is hidden" filter on the mapped rows.
- [ ] **Step 4:** Playwright `instant-lists.spec.ts`: seed `occam.account.v1` and the cache (via `page.evaluate` into IndexedDB or by running a first load), route `/api/decks` and `/api/docs` to a 3 s delay; assert the sidebar shows the cached rows within the first second, then the fresh answer replaces them (a row added server-side appears; a removed one goes).
- [ ] **Step 5:** `npm run test:browser -- instant-lists decks workspace`; expect PASS. **Commit** `feat: sidebar lists paint from the cache, then refresh`.

### Task 5: Boot opens the last deck from the cache

**Files:**
- Modify: `src/app/App.tsx` (the boot effect), `src/app/remote.ts` (seed `revs`/`bases`/`roles` from a cached deck), `src/app/live.ts` only if the merge needs a hook
- Test: `tests/unit/remote-seed.test.ts`, `tests/browser/instant-deck.spec.ts`

**Interfaces:**
- Produces: in `remoteDeckRepo`, an optional `seed?(deck: SavedDeck, rev: number, role: Role | null): void` that primes the per-deck `revs`, `bases` and `roles` maps exactly as a `get` would, so a save made before the fresh read carries the cached `rev`. Boot: if the cache has `last` and `deck:<id>` for this account, open it with `openDeck`, show it, then run the normal `findDeck`; if the server copy has a newer `rev` it goes through `syncNow`, as when another writer changed it. If the server says the deck is gone (404) or the user is no longer in the workspace, reset to the normal "missing" path.

- [ ] **Step 1: Failing tests:** `seed` then `save` sends the cached `rev` (the existing `STALE` refusal still triggers against a newer server rev); a deck read from the server is written to the cache with its `rev` and role.
- [ ] **Step 2:** Run; expect FAIL. **Step 3:** Implement. Write `deck:<id>` and `last` after every successful `get` and every successful `save` (use the existing `onSaved` path rather than a new one). In the boot effect, open from cache without awaiting `ws.ready` or the network; still await `document.fonts.ready` before `setBooted(true)` (slides must measure with the real faces).
- [ ] **Step 4:** Playwright `instant-deck.spec.ts`: after a first load, hold `/api/decks?id=…` for 3 s on the second; assert the deck's first slide is shown within 1.5 s with the composer working offline of the answer; then release a server copy with a changed slide and assert it merges in with the "slides changed" notice the live merge already shows; a second case where the server answers 404 shows the missing message and not the cached deck; a third where the server answers `role: viewer` makes the deck read-only.
- [ ] **Step 5:** `npm run test:browser`; expect only the two known failures. **Commit** `feat: the last deck opens from the cache`.

### Task 6: A lighter list (only if Task 1 says the list is heavy)

**Files:**
- Modify: `api/decks.ts` (list response), `src/app/remote.ts` (`DeckSummary` mapping), the sidebar thumbnail users of `DeckSummary.first`
- Test: the API's unit tests and `tests/browser/decks.spec.ts`

- [ ] **Step 1:** If Task 1 shows the `first` slide is under ~25% of the list bytes, stop here and record "not needed". Otherwise return only `id, name, updated, slides, style, theme, accent` from the list and load `first` per deck lazily for the rows that need it.
- [ ] **Step 2:** Update tests that read `first`; run the unit and decks specs; **Commit** `perf: the deck list carries what the sidebar shows`.

### Task 7: Hover prefetch

**Files:**
- Modify: `src/app/components/sidebar/ItemList.tsx` (row `onPointerEnter` / `onFocus`), `src/app/components/sidebar/Sidebar.tsx`
- Test: `tests/browser/instant-deck.spec.ts` (add a case)

- [ ] **Step 1: Failing spec:** hovering a deck row issues one `GET /api/decks?id=<id>` (debounced ~100 ms, once per row until it changes); clicking it afterwards opens the deck with no further request on the critical path.
- [ ] **Step 2:** Implement via a `prefetch(id)` that calls `repos.decks.get(id)` and stores the result in the cache (Task 5's writer); ignore failures. **Step 3:** Run; **Commit** `perf: hovering a deck row loads it`.

### Task 8: Measure and record

- [ ] **Step 1:** Repeat Task 1 Step 2's method; append "after B" to `docs/temp/instant-app-measurements.md`.
- [ ] **Step 2:** `npm run build && npm run lint && npm test && npm run test:browser`; expect all pass except the two known failures.
- [ ] **Step 3:** Report the before/after table and what remains for layer C (optimistic create, rename, delete in the sidebar).

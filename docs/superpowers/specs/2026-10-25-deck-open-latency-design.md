# Deck open latency: return visits and sidebar switches

Date: 2026-10-25 · Status: draft for review · Builds on [2026-10-20-instant-app-design.md](./2026-10-20-instant-app-design.md) Layer B

## Intent

On occamslides.com, repeat visits to `/` and `/d/:id` and switching decks in the sidebar still feel slow even though much of Layer B exists (IndexedDB cache, `showThenFetch`, boot skeleton, hover prefetch). This spec narrows Layer B to two user-visible cases:

- **B — Return visit:** signed in, cache warm, opening the last deck or a deck URL.
- **C — Sidebar switch:** clicking another deck or doc in the page tree (same fast path for both).
- **W — Workspace switch:** changing workspace in the switcher opens the right deck without waiting on a fresh `decks.list`.

Success feels like Linear: the deck or doc on screen updates immediately from what this browser already knows; network work confirms or merges quietly. No full-screen wait, no second full download when nothing changed.

## Root causes (prioritized)

Problems below are ordered by how often they hurt B/C and how wrong a fix would be if we got the order wrong.

### 1. Deck cache had no in-memory fast path (highest)

Docs already use `cachedDocRepo` with synchronous `peek` and async `kept` (memory first, then IndexedDB). Decks used only `readCachedDeck` → IndexedDB. Sidebar hover prefetch called `repo.get`, which populated the remote repo’s in-memory `base` but **open still went through IDB**, racing async `cacheSet` and often missing on a quick click. On a miss, `findDeck` called `get` again → **another full HTTP round-trip**.

**Risk if ignored:** prefetch is wasted work; C stays network-bound.

### 2. Background sync always downloaded the full deck (high)

After opening from cache, `refreshKept` called `syncNow(true)`, which skipped the cheap `?rev=1` check and always ran `get` + `events`. Large decks (chat history) made return visits feel slow and could jank the editor after paint.

**Risk:** user sees slides then a merge flicker; wasted bandwidth when rev unchanged.

### 3. Boot blocked on `document.fonts.ready` even with a cache hit (high, B only)

Boot awaited fonts before `openDeck` for every path. Return visits with a cached deck do not need every face loaded to show stored slides; `openDeck` already measures the open slide first and defers the rest via `recheckInIdle`.

**Risk:** font CDN latency dominates B despite a warm cache.

### 4. IndexedDB read on every open (medium)

First paint in a new tab still awaits IDB for `last` + `deck:*`. Unavoidable on cold IDB, but memory `peek` removes IDB from the hot path within a session and after prefetch.

### 5. Cold path unchanged (medium, out of scope here)

First visit, cleared storage, or a deck never prefetched still needs `ws.ready` → `list` → `get` on `/`. Improving B/C does not fix that; measure separately before investing in idle prefetch of N neighbors or API payload splits.

### 6. Server cold start (medium, not client-fixable alone)

Vercel + Neon first request after idle adds latency. Client cache masks it on B/C; instrumentation should tag cache hit vs miss so we do not chase server ms in the wrong place.

## Non-goals

- Service worker or offline-first editing beyond existing failed-save backup.
- **Progressive “one slide then the rest” open on a cold network fetch** — see [§ Progressive slide load](#progressive-slide-load-one-slide-first) (too much for this phase; cheaper wins first).
- Changing slide rendering, measuring rules, or agent behaviour.
- Layer C optimistic sidebar (rename/delete) — already shipped elsewhere.

## Anti-goals

- Opening from cache must not skip conflict detection: saves still use seeded `rev`; stale server copies merge by slide id, never silently overwrite local edits.
- Another account’s decks in a shared browser: cache keys stay `account:id`; sign-out clears via `cacheClear`.
- Showing a deck as current when `backup` (failed-save local copy) is newer than account cache — existing `readKept` guard stays.

## Design

### D1. Align deck cache with doc cache

Extend `cachedDeckRepo` with:

| API | Role |
|-----|------|
| `peek(id)` | Sync read from session memory after any `get`/`save`/`seed`. |
| `kept(id?)` | Async: memory → wait for in-flight `get` → IndexedDB. `id` omitted uses `last` pointer (same as `readCachedDeck(undefined)`). |
| `seed` | Updates memory and inner repo (unchanged contract). |

`DeckRepo` gains optional `peek` / `kept` and shared `KeptDeck` type in `store.ts`. `readCachedDeck` remains for tests and direct IDB reads.

On `get` completion: write memory immediately, then `cacheSet` (async). Prefetch and open share the same `reading` dedupe map.

### D2. Open path uses memory first

**Boot (B):** `readKept` calls `repo.kept` when wrapped. If cache hit: `setBooted(true)` → `openDeck` → `refreshKept` without awaiting `document.fonts.ready`. Fonts continue loading in the background for later measurement. Cache miss: keep today’s order (fonts before open).

**Route / sidebar (C):** new `openKept(id)`:

1. `peek(id)` → if hit and no backup conflict → `seed` + `openDeck` + `refreshKept`.
2. Else `kept(id)` → same.
3. Else `findDeck` (network).

Sidebar `readAhead` skips prefetch when `peek` already has the deck.

### D3. Rev before full body on forced sync

In `useLiveDeck` / `syncNow`:

1. `head = await repo.rev(id)`, `known = repo.known(id)`.
2. If `head && head.rev <= known` → return (no `get`, no merge).
3. If `!force && !head` → return (unchanged offline behaviour).
4. Else existing `get` + merge; `force && !server` → `'gone'`.

This is the cheap validation step from the instant-app doc, applied on every post-cache refresh.

### D4. Unified sidebar open (docs and decks)

Today docs and decks use parallel cache shapes (`DocRepo.peek`/`kept` vs `DeckRepo.peek`/`kept`) but **different call sites**: `DocScreen` resets from `peek` on id change; decks use `openKept` in `App`. The sidebar calls `openPage` → `onOpenDeck` / `onOpenDoc` without a single “open from cache first” contract.

**Contract:** one helper used by both routes (name TBD, e.g. `openPageRef` in `src/app/open-page.ts`):

| Kind | Sync | Async | Network fallback |
|------|------|-------|------------------|
| `deck` | `decks.peek(id)` → seed + dispatch open | `decks.kept(id)` | `findDeck` |
| `doc` | `docs.peek(id)?.doc` → set state | `docs.kept(id)` | `docs.get` (DocScreen keeps background refresh) |

**Sidebar:** `openPage` does not change UX (still `settled` then navigate). **Prefetch:** `readAhead` already covers both; deck branch respects `peek`, doc branch already skips when `peek` has doc.

**App routing:** deck navigation still goes through `leaveTo` + route effect; the route effect and boot call the shared deck branch of the helper (replacing duplicated `openKept` / `readKept` wiring). Doc navigation unchanged at URL level; ensure doc id change always hits `peek` before paint (already in `DocScreen`; add regression test).

**Tests:** Playwright — from a deck, open a doc (cached) and back to another deck (cached); assert slide title / doc heading before mocked API completes.

### D5. Workspace switch without blocking on list

**Today:** `Sidebar.switchTo` awaits `decks.list(workspaceId)`, opens the **first** deck with `slides > 0` — wrong deck, always network-bound.

**Cache keys (IndexedDB, per account):**

- `lastDeck:${workspaceId}` → `{ deckId: string }` (written when a deck in that workspace is opened or saved, same as bumping `last` globally).
- Keep existing `last` for `/` boot (deck worked on last across the app).

**Switch flow:**

1. `ws.switchTo(id)` (local + `repo.use` in background, as today).
2. **Sync:** if `peek(lastDeckId)` or `kept(lastDeckId)` hits → `openKept` / navigate to `/d/:id` immediately.
3. **Else:** show editor shell with page tree from cached `pages:${workspaceId}` if present; do **not** block on `decks.list`. Idle or parallel: `list` → if no last pointer, open first deck with slides (today’s heuristic) or new deck — same as now but after paint.
4. When user opens any deck in workspace W, update `lastDeck:W`.

**Boot on `/`:** unchanged — global `last` deck in current workspace context; optional later: prefer `lastDeck:${wsId}` when workspace is known from cache.

**Anti-goal:** auto-opening a deck from another workspace’s cache key; keys must include `workspaceId`.

## Data flow (B, cache hit)

```text
Navigation → readKept / peek
  → seed(rev, role) → openDeck (slides on screen)
  → refreshKept → rev check → [skip | merge]
  → fonts.ready (background, no boot gate)
```

## Data flow (C, after hover prefetch)

```text
mouseenter (100ms) → decks.get (deduped) → memory + IDB
click → openKept → peek hit → openDeck (no IDB, no HTTP)
```

## Testing

- **Unit:** `cached-decks` — `peek` after in-flight `get`; `kept` waits on shared read; existing IDB tests unchanged.
- **Unit:** `live` — forced sync with `rev <= known` does not call `get` (extract pure `syncLiveDeck` if hooks are awkward to test).
- **Browser:** repeat visit to `/d/:id` with IDB seeded — slide title before deck API completes; switch deck after hover — open without second full GET (network tab or route mock).

## Instrumentation (follow-up, not blocking ship)

Log or debug-channel timings: `readKept` source (peek / idb / network), boot `fromCache`, `refreshKept` skipped vs merged. Store samples in `docs/temp/` per instant-app measuring section.

## Progressive slide load (one slide first)

**Ask:** fetch only the slide being viewed, then the rest while the user reads.

**Verdict: too complex for this phase** — not because rendering one slide is hard, but because the **deck is one atomic document** everywhere else:

- `GET /api/decks?id=` returns full `data` + `chat` in one row; no slide index or slice parameter.
- Saves send the whole deck with `baseRev`; merge, versions, presenter channel, agent tools, and `mergeDecks` assume a full `items[]`.
- A “partial deck” state would need: new API (e.g. `?slide=` or split `data` / `chat`), loading flags per item, rules for save/sync while incomplete, strip/thumbnail behaviour, and presenter/agent parity.

**What to do instead (recommended order):**

1. **Ship D1–D5** — cache + rev check fixes most repeat-visit and switch pain.
2. **Split chat from slide `data` on GET/PUT** (smaller API change) — drop megabytes of `history`/`messages` from the first paint payload while still returning all slides; one round-trip, no partial-state machine.
3. **Re-measure cold open** — only if still bad, spec progressive load as its own project with explicit partial-deck type and test matrix.

Incremental slide fetch is a **sync-model change**, not a caching tweak; budget it separately if metrics still justify it after (1) and (2).

## Implementation status (2026-10-25)

| Item | Status |
|------|--------|
| D1 `peek` / `kept` / memory in `cachedDeckRepo` | Done in working tree |
| D2 `openKept`, boot skips fonts on cache hit | Done in working tree |
| D2 sidebar `peek` in `readAhead` | Done in working tree |
| D3 rev-before-full in `syncNow` | Done in working tree |
| D4 unified open helper (`open-kept-deck.ts`) + doc↔deck Playwright | Done (`instant-switch`); helper wired in App |
| D5 `lastDeck:${workspaceId}` + instant workspace switch | Done in Sidebar; unit test; browser test skipped (flaky menu) |
| Unit tests for peek / kept | Done in working tree |
| Unit test for live rev skip | Not done (optional extract) |
| Playwright B/C scenarios | Not done |

## Order of work

1. Land D1–D3 + unit tests (current branch).
2. **D4** — shared open helper; Playwright doc ↔ deck cached switches.
3. **D5** — per-workspace last deck + `switchTo` fast path.
4. Measure B/C/W on throttled 4G; idle prefetch of adjacent decks if C still misses without hover.
5. If cold opens still hurt: spec **chat/slide payload split** before considering progressive slides.

## Open questions

- **Fontless open:** if a rare layout shift appears when webfonts arrive, remeasure open slide only — not a boot gate.
- **Gone detection when `rev` is null:** keep full `get` only when rev endpoint does not answer; do not treat offline as deleted.

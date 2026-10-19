# Instant app: paint first, confirm after

Date: 2026-10-20 · Status: draft for approval

## Intent

Opening Occam feels slow everywhere: the profile icon, the text on the home screen and the deck list all seem to load. Linear feels instant because it paints the shell and the last-known data at once and lets the network confirm or correct them afterward. Occam does the reverse: it waits for the network, then paints. This design reverses that order, in three layers shipped in order: **A** paint at once, **B** local-first data, **C** optimistic actions.

Success: on a repeat visit, the signed-in shell, the user's account, the sidebar lists and the last open deck show without waiting on any request, and nothing visibly jumps or swaps when the network answers.

## Why it is slow today (read from the code, not yet timed)

1. `Root.tsx` renders a blank page until `/api/auth/get-session` answers. The account menu and everything tied to the user appear after it. The avatar (`account.image`) is a remote image that pops in later.
2. `index.html` loads Archivo, Instrument Serif, Geist and Geist Mono from Google Fonts with `display=block`: text stays invisible until the fonts arrive.
3. The last `dist/` build had a ~2.3 MB `index` chunk (uncompressed, possibly stale). Only the doc editor is lazy. The slide engine, charts and editor load before first paint.
4. Boot is a chain: session, then `workspaces.list`, then `decks.list`, then `decks.get`, then fonts, then a `/health` call that can block up to 3 s before `setBooted(true)`. The sidebar fetches the deck list a second time. Nothing is cached between visits.
5. Unverified: `DeckSummary.first` carries a full slide per deck in the list response, which may make the list heavy.

## Goals

- Repeat visits paint a usable signed-in app with no blocking request.
- Fewer requests on the critical path; none that block paint.
- Create, rename and delete in the sidebar feel immediate and roll back honestly on failure.
- Measured before and after, so each layer shows its gain.

## Non-goals

- A Linear-style full sync engine (websocket deltas, a local database as the source of truth). The existing `rev`/`events` API leaves room for it later.
- Offline editing beyond what the failed-save backup already does.
- Moving to Next.js or server rendering (per the product-goal memory: not during v1).
- Changing slide or doc rendering, or the engine.

## Anti-goals (a failure even if it technically works)

- Showing another user's data. Every cache is keyed by account id and cleared on sign-out.
- Silently rewriting or losing a user's edits to make things look fast. Checks warn, they never silently rewrite; a stale cache must never overwrite a newer server copy.
- A flash of content that is then taken away, or layout that jumps when real data arrives.
- A signed-in shell for someone whose session ended that lets them act as if saved. A 401 still opens "Sign in again", and edits stay in the local backup.

## Constraints

- Stack: React 18, Vite, TypeScript strict, Tailwind and shadcn. No `any`, no inline styles, components under ~300 lines.
- Thin harness: code only where it is really hard. A small cache module is justified; a generic state-management or sync library is not.
- Decks stay in the account on the server; the dev account's decks stay in this browser (`localDeckRepo`). The cache must not interfere with the dev account.

## Layer A: paint at once

**A1. Cached account.** After a successful session check, store `{ id, email, name, image }` in localStorage (`occam.account.v1`). On load, `useSession` starts from it instead of `undefined`, so `Root` renders the signed-in shell immediately. The real check still runs; the result either confirms (no visible change) or replaces it. `null` from the server clears the cache and shows the signed-out site. A network error keeps the cached state (do not sign the user out because they are offline); a definite "no session" answer does not.

**A2. Avatar.** Show the initial first; load the image in the background and fade it over the initial only once it has loaded, so no empty circle appears. The image URL is cached by the browser; keep the cached account's `image` so it can load in parallel with everything else.

**A3. Fonts.** Self-host the four families as subset WOFF2 files under `public/fonts`, `@font-face` with `font-display: swap`, and `<link rel="preload">` for the faces used above the fold. Remove the Google Fonts links and the two `preconnect` lines. Pick fallback stacks with matched metrics (`size-adjust`, `ascent-override`) so the swap does not shift layout. The engine's measuring (`document.fonts.ready`) is unchanged: slides still wait for fonts before measuring, but app chrome and the home screen do not.

**A4. Bundle.** Route-level `lazy` for the screens that are not the first thing a signed-in user sees (docs, present, presenter, review, PDF/export, the auth library already is). Move PDF code behind a dynamic import at the point of use. Check the result with a bundle report and set a budget (the main chunk under a target agreed after measuring; my guess is under 500 kB uncompressed for the entry chunk). Keep the slide engine in the editor chunk, not the entry.

**A5. Boot does not wait on non-essentials.** `setBooted(true)` no longer waits for the `/health` call; `live` updates when it answers. The composer shows its state from the cached last value until then (my call: default `false`, no flash of "unavailable" text).

## Layer B: local-first data

A small module, `src/app/cache.ts`, keyed by account id, backed by IndexedDB (localStorage for the small account record). It holds:

- the workspace list and the last-used workspace,
- deck summaries and doc lists per workspace,
- the last open deck, whole, with the `rev` it was read at.

**Read path (stale-while-revalidate):** each repo (`remoteDeckRepo`, `remoteDocRepo`, `remoteWorkspaceRepo`) is wrapped so `list`/`get` first return the cached value to the UI, then fetch, write the fresh value to the cache and push it to the UI. Hooks (`useWorkspace`, the sidebar's `loadDecks`/`loadDocs`) accept two answers in a row, cached then fresh, and update state for both. Implementation shape is the builder's call; the contract is "never wait on the network when a cached value exists".

**Boot:** with a cached workspace list and deck list, boot opens the most recent deck from the cache and does not wait for `ws.ready` or `decks.list`. The deck loads from the cached copy while `get` runs; if the server copy has a newer `rev`, it merges by slide id through the existing sync path (`syncNow`), exactly as when another writer changed it. A cache never wins over a newer server copy, and a save made from cached state carries the cached `rev` so the server's stale check (`STALE`) still catches conflicts.

**Prefetch:** hovering or focusing a deck row in the sidebar starts `decks.get` for it into the cache, so opening it is instant.

**List payload:** measure the list response. If `first` (a full slide) makes it heavy, return only what the sidebar shows (id, name, updated, slide count) and fetch thumbnails separately and lazily. This is a measured decision, not a presumption.

**Invalidation:** sign-out clears the account's cache. A deck deleted elsewhere disappears from the list on the next refresh; opening it then shows the existing "missing" message. Cache schema is versioned; a mismatch discards the cache and behaves like a first visit.

## Layer C: optimistic actions

For the sidebar and deck menu actions (create deck, rename, delete, reorder if any, create/rename/delete doc): update the local list and the cache at once, send the request in the background, and on failure restore the previous state and say why in the same place errors show today (a chat message or toast, matching the existing wording style: a sentence, not a code). Concurrent actions on the same row apply in order. No optimistic update for anything that needs the server's answer to be meaningful (invites, role changes, sharing links); those keep their spinners.

Slide edits are already local-first with a retrying, merging save (`usePersist.ts`); they are unchanged.

## Measuring

Before any change, record: time to first meaningful paint of the signed-in shell, time until the sidebar lists appear, time until the last deck is interactive, entry JS size, and request count on the critical path, on a warm and a cold cache and on throttled "Fast 4G". Repeat after each layer and record the numbers in `docs/temp/instant-app-measurements.md` (gitignored). The Lighthouse or DevTools method is the builder's choice, but the same method each time.

## Risks and calls to check

- **Cached signed-in shell for an expired session (my call):** accepted because the shell shows only cached data from the same browser; the 401 path still opens "Sign in again" and nothing is lost.
- **Offline (my call):** a network failure on the session check keeps the cached account; a definite signed-out answer clears it.
- **Font swap (my call):** self-hosting plus metric-matched fallbacks over `optional`, to keep the intended typography on every visit rather than sometimes dropping it.
- **IndexedDB (my call):** used for decks and lists because a deck can be large; localStorage only for the tiny account record. Private-mode or blocked storage must degrade to today's behaviour with no error.
- **Entry chunk budget:** left to be set after measuring.

## Left to the builder

Exact cache API and file layout, how repos expose the cached-then-fresh answers to hooks, the font subsetting tool and font files' sizes, the lazy-loading boundaries, and the test plan (vitest for the cache and the optimistic rollback; Playwright for a repeat-visit paint and a failed optimistic action).

## Order of work

A (A1–A5), measure; B, measure; C, measure. Each layer ships on its own.

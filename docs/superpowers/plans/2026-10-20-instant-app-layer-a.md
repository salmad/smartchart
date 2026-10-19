# Instant app, layer A (paint at once) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A repeat visit paints the signed-in shell, the account and the fonts without waiting on a request, and the entry bundle shrinks.

**Architecture:** Cache the last account in localStorage and start `useSession` from it; confirm with the real session check in the background. Self-host the fonts with `font-display: swap` and metric-matched fallbacks. Split the entry bundle by route with `lazy`. Stop `/health` from blocking boot.

**Tech Stack:** React 18, Vite, TypeScript strict, vitest, Playwright, `@fontsource` font packages (build-time source of WOFF2 files).

**Spec:** `docs/superpowers/specs/2026-10-20-instant-app-design.md` (Layer A, A1–A5). Layers B and C are separate plans.

## Global Constraints

- No `any`, no inline styles, components under ~300 lines; use shadcn/ui for primitives.
- localStorage key for the account: `occam.account.v1`, value `{ id, email, name, image }`.
- Every cache is per account and cleared on sign-out; a 401 still opens "Sign in again" (Root's `ended` flow).
- A network error on the session check keeps the cached account; a definite signed-out answer clears it.
- Blocked or corrupt storage degrades silently to today's behaviour.
- Fonts: Archivo (wdth 62–125, wght 100–900), Instrument Serif (regular and italic), Geist (wght 100–900), Geist Mono (wght 100–900), `font-display: swap`, no Google Fonts links.
- Slides must still wait for fonts before measuring (`loadFaces` in `src/engine/docs/mount.ts`, `document.fonts.ready` in `App.tsx` boot).
- Run `npm run build`, `npm run lint`, `npm test` before each commit; Playwright specs with `npm run test:browser`.
- Measure with the same method before and after (Task 1 fixes the method). Notes go in `docs/temp/` (gitignored).

## Review Focus

- Corrupt or non-object JSON under `occam.account.v1` → treated as no cache, no throw.
- Storage that throws on access (private mode) → app boots as today.
- Cached account for user X, server then says user Y is signed in → Y replaces X, X's data is not shown after the check.
- Server says signed out (200 `null` or 401) while a cached account exists → cache cleared and the site shows; 5xx or thrown fetch → cached shell stays.
- Avatar URL that fails to load → the initial stays, no broken-image icon.

---

### Task 1: Baseline measurements

**Files:**
- Create: `docs/temp/instant-app-measurements.md` (results; gitignored)

**Interfaces:**
- Produces: a baseline table other tasks append to (rows: entry JS size, request count on the critical path, time to signed-in shell, time to sidebar lists, time to deck interactive; columns: cold, warm; each on Fast 4G throttle).

- [ ] **Step 1:** `npm run build && npx vite preview`; open the preview in the built-in browser signed in with a real account (ask the user to sign in). Record the entry chunk size from the build output (largest `index-*.js`, uncompressed and gzip).
- [ ] **Step 2:** In DevTools throttled to Fast 4G, record cold and warm numbers for the five rows with the Performance panel; write them to `docs/temp/instant-app-measurements.md` with the method used, so later tasks repeat it.
- [ ] **Step 3:** Confirm whether `/api/decks` responses include a full `first` slide per deck; record the response size. This is input for plan B.

No commit (the file is gitignored).

### Task 2: Cached account (A1)

**Files:**
- Modify: `src/app/auth.ts`
- Test: `tests/unit/auth.test.ts` (add cases; the file stubs `location`, `history`, `fetch` and resets modules)

**Interfaces:**
- Produces (internal to `auth.ts`): `readCachedAccount(): Account | null` and `writeCachedAccount(a: Account | null): void`, both swallowing storage errors; `useSession()` unchanged in signature.

- [ ] **Step 1: Write failing tests** in `tests/unit/auth.test.ts`, stubbing `localStorage` with a Map-backed object (the file already stubs globals per test):
  - `starts from the cached account` : with a valid cache, the first snapshot of `useSession`'s store (read via a newly exported `sessionSnapshot()` for tests, or by rendering through the existing pattern in the file) equals the cached account before any fetch resolves.
  - `a confirmed session rewrites the cache`; `a signed-out answer (null body, and 401) clears it and publishes null`.
  - `a thrown fetch or a 500 keeps the cached account` and does not publish null.
  - `a different user's session replaces the cached one`.
  - `corrupt JSON, a non-object, or a throwing localStorage reads as no cache`.
  - `signOut clears the cache`.
- [ ] **Step 2:** Run `npx vitest run tests/unit/auth.test.ts`; expect the new cases to FAIL.
- [ ] **Step 3: Implement in `auth.ts`.** `current` starts as `readCachedAccount() ?? undefined`. In `check()`: network error or non-ok non-401 response → leave `current` as is if it was an account (else `null`); 200 with a user → `publish` and write the cache; 200 with null or 401 → `publish(null)` and clear the cache. `publish` keeps the old reference when the account's four fields are equal, so listeners are not woken for a no-op confirm. `signOut()` clears the cache. Note `App` is keyed by `session.id` in `Root.tsx`, so an unchanged id must not remount it.
- [ ] **Step 4:** Run the auth tests; expect PASS. Run `npm run build && npm run lint`.
- [ ] **Step 5: Commit** `feat: paint the signed-in shell from the cached account`.

### Task 3: Avatar without a blank circle (A2)

**Files:**
- Modify: `src/app/components/AccountMenu.tsx:19` (the trigger's avatar)
- Create: `src/app/components/Avatar.tsx` (`Avatar({ name, image }: { name: string; image: string | null }): JSX.Element`)
- Test: `tests/browser/account-avatar.spec.ts`

- [ ] **Step 1: Write failing Playwright spec.** Cases: with the dev account or a stubbed session carrying an `image` URL routed to a delayed 1×1 PNG, the trigger shows the initial immediately and no `<img>` is visible until the image has loaded; with the URL routed to a 404, only the initial shows and there is no `img` element in the trigger. Look at `tests/browser/dev-account.ts` for how specs sign in.
- [ ] **Step 2:** Run it (`npm run test:browser -- account-avatar`); expect FAIL.
- [ ] **Step 3: Implement `Avatar`:** render the initial; create a `new Image()` in an effect, and on `load` set state to show the `<img>` fading over the initial (a Tailwind opacity transition class, no inline style); on `error` do nothing. Use it in `AccountMenu`.
- [ ] **Step 4:** Run the spec; expect PASS. `npm run lint`.
- [ ] **Step 5: Commit** `feat: avatar fades in over the initial`.

### Task 4: Self-hosted fonts (A3)

**Files:**
- Modify: `index.html` (remove Google Fonts `<link>`s and both `preconnect` lines; add `<link rel="preload" as="font" type="font/woff2" crossorigin>` for the faces used above the fold)
- Create: `src/fonts.css` (`@font-face` rules and metric-matched fallback faces), `public/fonts/*.woff2`
- Modify: `src/main.tsx` (import `./fonts.css` before `./index.css`), `tailwind.config.js:35-40` (append the metric-matched fallback names to each family stack)
- Test: `tests/browser/fonts.spec.ts`

**Interfaces:**
- Consumes: the four family names and axes in Global Constraints. `loadFaces` in `src/engine/docs/mount.ts` and the dev pages request `800 100px Archivo`, `900 100px Archivo`, `400 30px Geist`, `600 30px Geist`, `500 20px 'Geist Mono'`; those must still resolve to the self-hosted faces.

- [ ] **Step 1: Write failing spec.** On `/home` (signed out), assert: no request to `fonts.googleapis.com` or `fonts.gstatic.com`; `document.fonts.check` is true for each of the five strings above after `document.fonts.ready`; the computed `font-display` of the `@font-face` rules is `swap` (read via `document.fonts` entries / CSSFontFaceRule).
- [ ] **Step 2:** Run it; expect FAIL.
- [ ] **Step 3: Get the files.** Install the font packages as devDependencies (`@fontsource-variable/archivo` with the `wdth` axis, `@fontsource-variable/geist`, `@fontsource-variable/geist-mono`, `@fontsource/instrument-serif`), copy the latin-subset WOFF2 files (and italic for Instrument Serif) into `public/fonts/`, keep only what the app uses, then write `@font-face` blocks with variable `font-weight`/`font-stretch` ranges and `font-display: swap`. If a package lacks the `wdth` axis for Archivo, stop and ask: slides use `font-stretch: 62%`/`78%`.
- [ ] **Step 4: Fallbacks.** Add fallback `@font-face` entries (`local('Arial')` etc.) with `size-adjust`, `ascent-override`, `descent-override` tuned so text does not shift when the real face swaps; name them e.g. `"Geist Fallback"` and append them to the Tailwind stacks.
- [ ] **Step 5: Preload** the Geist (sans) and Archivo faces in `index.html`; check in DevTools that nothing is fetched twice.
- [ ] **Step 6:** Run the spec and `npm run test:browser -- landing site`; expect PASS. Compare the home screen and one slide before and after in the built-in browser for layout shift, and run `/src/dev/review.html` to confirm slides measure identically (`?stress=1` passes).
- [ ] **Step 7: Commit** `feat: self-host fonts with swap and metric-matched fallbacks`.

### Task 5: Split the entry bundle (A4)

**Files:**
- Modify: `src/app/Root.tsx` (lazy `Site`, `Shared`, `Invite`, `Present`, `Presenter`), `src/app/App.tsx` (lazy `DocScreen`, `PrintDeck`, `ViewDeck` where they are not needed for first paint)
- Create: `scripts/check-bundle.mjs` (reads `dist/assets`, fails when the largest `index-*.js` exceeds the budget), add `"check:bundle"` to `package.json`
- Test: `tests/browser/app.spec.ts` (existing smoke must still pass) and the script itself

**Interfaces:**
- Produces: a `Suspense` fallback `<div className="h-full bg-app-bg" />` (and `bg-paper` for the site routes), matching Root's existing blank page so nothing flashes.

- [ ] **Step 1:** Run `npx vite-bundle-visualizer` (no install) on the current build and list what is in the entry chunk; record in `docs/temp/instant-app-measurements.md`.
- [ ] **Step 2:** Convert the screens above to `lazy(() => import(...).then((m) => ({ default: m.X })))` following the pattern in `src/app/components/DocScreen.tsx:46`; wrap each use in `Suspense`. A signed-in user must not download `Site`; a signed-out user must not download `App`. Check PDF code is only imported dynamically at its use.
- [ ] **Step 3:** Rebuild; compare entry size to the baseline. Target: entry chunk ≤ 500 kB uncompressed. If it cannot be reached without moving the slide engine, record the best achieved size and the biggest remaining modules and ask the user before going further.
- [ ] **Step 4: Write `scripts/check-bundle.mjs`** to fail with the chunk name and size when the entry exceeds the budget constant (set to the achieved size rounded up to the next 25 kB). Run `npm run build && npm run check:bundle`; expect PASS.
- [ ] **Step 5:** Run `npm run test:browser` (whole suite: lazy loading can break specs that open routes directly); expect PASS.
- [ ] **Step 6: Commit** `perf: split the entry bundle by route and add a size budget`.

### Task 6: Boot does not wait on `/health` (A5)

**Files:**
- Modify: `src/app/App.tsx:107-139` (boot effect)
- Test: `tests/browser/boot-health.spec.ts`

- [ ] **Step 1: Write failing spec.** Route `config.healthUrl` to a response delayed 5 s; assert the editor is booted and the deck visible in under 2 s on a repeat visit, and that when the response arrives later with `{ live: true }` the composer becomes enabled with no reload. A second case: a prompt typed on the site (`takePendingPrompt`) still waits for the health answer before sending (see `src/app/route.ts` `parsePending` and `boot-race.spec.ts` for how it is seeded).
- [ ] **Step 2:** Run it; expect FAIL on the timing assertion.
- [ ] **Step 3: Implement.** Start the health fetch without awaiting it; dispatch `{ live }` when it answers (still capped at 3 s). Call `setBooted(true)` right after the deck is opened. Await the health promise only when a pending site prompt exists, before sending it. Keep the `document.fonts.ready` wait (my call: Task 4's preload makes it near-instant on repeat visits, and slides must measure after fonts). Before the first answer, check what the composer renders when `live` is false; if it shows an "unavailable" message, show nothing until the first answer arrives.
- [ ] **Step 4:** Run the new spec and `npm run test:browser -- boot-race`; expect PASS.
- [ ] **Step 5: Commit** `perf: boot no longer waits on the health check`.

### Task 7: Measure and record

- [ ] **Step 1:** Repeat Task 1's method; append the "after A" columns to `docs/temp/instant-app-measurements.md`.
- [ ] **Step 2:** Run `npm run build && npm run lint && npm test && npm run test:browser`; expect all PASS.
- [ ] **Step 3:** Report the before/after table to the user, plus anything left over for plan B (list payload size from Task 1 step 3).

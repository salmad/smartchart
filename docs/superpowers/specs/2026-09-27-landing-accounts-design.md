# SmartChart: landing page, accounts and decks per user

Status: built on `feat/landing-accounts`, 2026-09-27; this spec is updated to match what was built. Approved as "build the way you describe"; the visual bar is the priority.

## 1. Intent

A stranger lands on SmartChart, recognises their own ugly chart, sees it become a good one, types what they need and gets a real slide within a minute. They leave an email to keep it. A returning user sees their decks, opens one to keep editing, or deletes it.

The page sells `docs/product/PRODUCT_INPUT.md`: **the agent configures, it never designs**. Taste is encoded once, measured on every slide, and never improvised, so consistency is a property of the product, not a hope.

## 2. Decisions

| Area | Decision | Why |
|---|---|---|
| Framework | Stay on Vite + Vercel functions for this branch | Next.js stays its own migration spec (memory: product-goal-beyond-mvp); the engine is framework-free either way |
| Routing | A tiny History-API router in `src/app/route.ts`: `/`, `/d/:id`, `/new` | Three routes do not justify a dependency |
| Auth | Neon Auth (managed Better Auth): **Continue with Google** (Neon's shared credentials, no Google Console) and **email one-time code** | Zero setup; own Google OAuth client is a later production step (§9) |
| Database | Neon Postgres via `@neondatabase/serverless` (HTTP) from `api/`; the tables create themselves on first use (`create table if not exists`, once per cold start) | Same project as auth; users live in `neon_auth`; no migration step |
| Server auth | Neon Auth is reached through `/api/auth/*` on our own origin (`handleAuthProxyRequest`), so its session cookies are first-party; `api/` reads the user by asking Neon Auth's `get-session` with those cookies | No tokens in the browser, no third-party cookies; the auth library loads only on sign-in or sign-out |
| First slide | Anonymous visitors may run **one turn**; the email is asked for to keep the slide and continue | The ask comes after the magic, not before it |
| Model spend | `/api/glm` and `/api/jev` require a signed-in user **or** an anonymous IP quota (hashed IP, 20 model calls a day) | Closes the v1 "lock down /api" follow-up |
| "Before" chart | A generic default-slide-tool chart drawn by us; no product is named or copied | Recognisable without trademark use |

## 3. Screens

### 3.1 Landing (`/`, signed out)
Dark, the app's Ink tokens; Archivo condensed for display (the slides' own face), Geist for text. No gradients, badges, emoji or stock art. Every visual is a real slide rendered by the engine or a chart we draw.

1. **Nav:** wordmark · Sign in · **Start free**.
2. **Hero (the scroll stopper):**
   - Headline in Archivo, 2 lines max at every desktop width: "Charts that look designed." The left column (headline, lede, prompt) is centred on the before/after.
   - Lede opens with the payoff: "Because they were." then: describe the slide; SmartChart builds it from components a designer made once.
   - **Before / after**, full width, 16:9: left, the default chart (rainbow series, gridlines, legend box, Arial, cramped labels, a topic title "Revenue by Quarter"); right, the same data as a SmartChart slide (action title, one focus colour, direct labels, source). A draggable divider (keyboard: arrows) reveals one over the other; it rests at 50% and, the first time it is seen, sweeps once from 90% to 50% (no motion with reduced motion).
   - The **prompt box** under it: textarea + **Build my slide**, and 3 example prompts as chips.
3. **The problem, three ways** (one line each plus a small drawn visual):
   - **Defaults are noise.** Rainbow series, a legend to decode, gridlines everywhere.
   - **Every slide is a new design decision.** Three slides from one deck with three fonts, sizes and colours.
   - **AI slide tools improvise.** Text overflowing its box, a layout invented per prompt.
4. **The answer:** "Designed once. Configured forever." The agent picks from a closed menu of 7 components and fills them; it never writes layout. A slow strip of real starters (live `SlideView`s) shows the whole menu.
5. **How it works:** three steps, each with its visual:
   1. *Describe it:* paste numbers, notes or a table.
   2. *It picks the component:* a chart, table, number, steps or cards, and fills it.
   3. *Every slide is measured:* at 1920×1080, before you see it.
6. **Taste, quantified:** a spec sheet, not a slogan. The actual rules with their numbers, e.g. titles ≤ 2 lines · exactly one focus element · every figure you gave is on the slide · units on every value · time runs left to right · bars sorted largest first · parallel items within 2.5× of each other · cards share one height to the pixel. Headline figure: the count of checks run on every slide, computed from the engine (not typed in).
7. **Use cases:** Board update (Consulting), Seed pitch (Pitch), Monthly finance review (bridge and table). Each a live slide with one line; a Consulting/Pitch toggle re-renders them.
8. **Closing CTA:** the prompt box again. **Footer:** wordmark, year.

Responsive: at 390 px every section is one column, the before/after stays 16:9, no horizontal scroll.

### 3.2 First slide, anonymous (`/new`)
- A prompt from the landing opens the editor at `/new` and sends it. The deck lives in the browser (the local repo) while anonymous.
- When that turn ends, a **Keep this deck** card appears in the chat: *Continue with Google* / *email → 6-digit code*. The composer stays disabled with "Sign in to keep going".
- After sign-in (Google returns via redirect, so the local deck survives in `localStorage`), the local deck is uploaded to the account, removed locally, and the URL becomes `/d/:id`.
- Picking a starter tile works the same way (no model call).

### 3.3 Your decks (`/`, signed in)
- **Header:** wordmark · **New deck** · account menu (email, Sign out).
- **Grid** of deck cards, newest first: the first slide rendered live (`SlideView`, 16:9), the deck name, "7 slides · edited 2 h ago". The card opens the deck; a `…` menu has **Open** and **Delete** (a confirm dialog naming the deck).
- **Empty:** "Your first deck starts with a sentence." plus the prompt box and the starter gallery.

### 3.4 Editor (`/d/:id`), cleaned up
From the review of the running app:
- **Bar:** wordmark (link back to *Your decks*) · deck name · style, palette, accent · **Add slide** · **Present**. The deck picker, **Delete**, **New deck** and the Ready pill leave the bar (decks and delete live in *Your decks*; Offline still shows when offline).
- **Chat:** model traces show only in debug (`?debug=1` or dev with `localStorage.smartchart.debug`).
- **Checks:** lead with what needs attention ("2 to look at"), each with its message; passes folded into one "N passed" line (expandable). Rule ids show only in debug.

## 4. Data and API

```sql
create table decks (
  id text primary key, user_id text not null, name text not null,
  data jsonb not null, updated_at timestamptz not null default now());
create index decks_user on decks(user_id, updated_at desc);
create table anon_usage (key text not null, day date not null default current_date, calls int not null default 0, primary key (key, day));
```

- Created by `api/_lib/db.ts` on first use; there is no separate SQL file. `key` is a salted SHA-256 of the first forwarded IP.
- `data` is the existing `SavedDeck`; `name` is `deckName()` at save time. A deck id belongs to whoever saved it first: an upsert never takes over another user's row.
- `GET /api/decks` → `[{ id, name, updated, data }]`, newest first, at most 200 (`data` is the whole deck, so a card draws its first slide; decks are tens of kB).
- `GET /api/decks?id=` → `SavedDeck`; `PUT /api/decks` (body `SavedDeck`) upserts; `DELETE /api/decks?id=`. Every query is scoped by the verified `user_id`; another user's id answers 404.
- `DeckRepo` becomes per-deck: `list()`, `get(id)`, `save(deck)`, `remove(id)`. `localDeckRepo` keeps the same key (anonymous and legacy decks, and a copy kept while saves fail); `remoteDeckRepo({ onSignedOut })` calls the API with the session cookie and reports a 401.
- Legacy browser decks (from v1) are offered once after first sign-in: "Import 3 decks from this browser".

## 5. Units

| Unit | Does | Depends on |
|---|---|---|
| `api/_lib/auth.ts` | `proxyAuth(request)` for `/api/auth/*`; `userFrom(request)`: the signed-in `{ id, email }` from the session cookies, or null | `@neondatabase/auth/server`, `NEON_AUTH_URL`, `NEON_AUTH_COOKIE_SECRET` |
| `api/auth/[...path].ts` | the auth proxy route | auth |
| `api/_lib/db.ts` | `getDb()`: every query the API makes, scoped by user; null without a database | `DATABASE_URL` |
| `api/_lib/quota.ts` | `modelGate(request)`: user → go; else counts the hashed IP for today, 429 past 20 | db |
| `api/_lib/decks.ts`, `api/decks.ts` | CRUD above | auth, db |
| `src/app/auth.ts` | client: `useSession()` (one plain `get-session` request), `signInWithGoogle()`, `sendCode(email)`, `verifyCode()`, `signOut()`; the library itself loads lazily | `@neondatabase/auth` |
| `src/app/remote.ts` | `remoteDeckRepo`, and `findDeck` (the deck in the URL; a newer browser copy moves to the account) | store |
| `src/app/route.ts` | `useRoute()`, `go(path)` | History API |
| `src/app/components/landing/*` | the sections of 3.1, each < 300 lines | engine starters, `SlideView` |
| `src/app/components/Home.tsx`, `DeckCard.tsx` | 3.3 | repo |
| `src/app/components/SignIn.tsx` | the sign-in card and dialog | auth |

## 6. Errors
- API down or 5xx: the editor keeps working and says once "Couldn't save. Retrying." It tries again after 2 s, doubling to at most 30 s, and any new change saves at once. A copy stays in this browser until a save succeeds; opening the deck later uploads that copy if it is newer than the account's.
- Session ended (a 401 from `/api/decks`): the "Sign in again" dialog opens over the current screen; the browser copy keeps the work. Signing in clears it.
- Quota spent (429): the chat says "That's the free slide for today. Sign in to keep going."
- Auth not configured (no `NEON_AUTH_URL` or cookie secret on the server): `/api/auth/*` answers 503 and the sign-in dialog says accounts aren't set up; the landing still renders. Without `DATABASE_URL`, decks answer 503 and model calls are not limited (local dev).

## 7. Testing
- **vitest:** reading the user from Better Auth's session body, deck handlers scoped per user (a fake `Db`), quota counting and IP hashing, the router, the server repo round trip and its 401, `findDeck` (browser copy vs account copy), the checks count used on the landing.
- **Playwright** (the test server blanks the Neon settings, so it never reaches the real database): the landing at 1440 and 390 (every slide 0 fit issues, no horizontal scroll, the divider moves by keyboard); signed-out prompt goes to `/new`; with a mocked API: the decks grid lists, opens and deletes; a failed save retries and keeps then drops the browser copy; a 401 opens "Sign in again".
- **Live** (dev server against Neon): sign-up, session, deck save, list, open and delete through `/api`; the email-code and Google endpoints answer.
- **Visual review:** every landing section screenshotted at 1440 and 390 and checked one by one before it is shown.

## 8. Out of scope
Sharing links, billing, teams, export, Next.js, own Google OAuth client, own SMTP.

## 9. Production steps (user)
1. Neon project `divine-wildflower` with Neon Auth on the `production` branch (done). In `.env` (done) and in Vercel: `DATABASE_URL` (pooled), `NEON_AUTH_URL` (the branch's auth base URL), `NEON_AUTH_COOKIE_SECRET` (32+ random bytes, hex; a different one per environment).
2. Add the production and preview origins to Neon Auth's trusted domains.
3. Before real users: own Google OAuth client and own SMTP in Neon Auth (their production checklist).

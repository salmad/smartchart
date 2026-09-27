# Plan: landing page, accounts and decks per user

Spec: `docs/superpowers/specs/2026-09-27-landing-accounts-design.md`. Branch `feat/landing-accounts`. Executed inline; stop at task boundaries.

1. **Router and screens.** `src/app/route.ts` (`/`, `/new`, `/d/:id`); `App` picks Landing, Home or Editor. Vercel rewrite already serves `index.html`.
2. **Landing.** `src/app/components/landing/`: `Hero` (headline, `BeforeAfter`, `PromptBox`), `Problems`, `Answer` (starter strip), `How`, `Taste` (rules sheet, count from the engine), `UseCases`, `Closing`. A `DefaultChart` drawn in SVG. Screenshot every section at 1440 and 390; fix; repeat.
3. **Data and API.** `api/_lib/{auth,db,quota}.ts`, `api/decks.ts`, `scripts/db.sql`; quota on `/api/glm` and `/api/jev`; dev routes in `vite/api-dev.ts`. vitest for each.
4. **Auth client and sign-in.** `src/app/auth.ts` on `@neondatabase/auth`; `SignIn` (Google + email code); the anonymous one-turn gate and the upload after sign-in.
5. **Your decks.** `DeckRepo` per deck (local + remote); `Home` + `DeckCard` (live first slide, open, delete with confirm); empty state; legacy import.
6. **Editor clean-up.** Bar trimmed; traces behind debug; checks as "Checked · N rules".
7. **Verify.** build, lint, vitest, Playwright (landing, flows with mocked API), live sign-in once Neon is configured, visual review, preview deploy.

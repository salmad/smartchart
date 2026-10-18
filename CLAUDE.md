# CLAUDE.md

SmartChart: users make consulting and pitch slides by chatting. The bar is "the Apple of charts and presentations" with Linear/Revolut-level polish: restrained, precise, premium. Guiding philosophy: `docs/product/PRODUCT_INPUT.md` — the agent configures, never designs; beauty and taste are the product. Who the users are and the words we use for them: `docs/product/USERS.md`.

Stack: React 18 + TypeScript (strict), Vite, Tailwind + shadcn/ui, lucide, vitest, Playwright. Deployed on Vercel (`api/` functions).

## Commands

`npm run dev` (app + `/api` locally, reads `.env`) · `npm run build` (typechecks) · `npm run lint` · `npm test` (vitest) · `npm run test:browser` (Playwright: review page, lints, app smoke)

Dev review page: `/src/dev/review.html` (every example in both styles, validated and measured; `?stress=1`, `?theme=paper`, `?only=<i>&full=1` for one slide at full size, `?compare=788f4d7` against the pre-Acme starters). Docs: `/src/dev/docs.html` (`?doc=<id>`, `?theme=ink`, `?width=<px>`; figures checked for C1 and R15).

## Structure

- `src/engine`: framework-free. `components/` (charts, tables, cards, notes, pictures, fitters, `components.css`: shared by slides and docs), `slides/` (schema, the slide frame in render, lints, colours, `slides.css`), `docs/` (the doc file's format, validation, the page renderer and read view, `doc.css`), `agent/` (agent loop, prompts, checks, LLM calls), `starters/` (the gallery)
- `src/app`: the React app. `App.tsx` holds state and picks the screen; `components/` (screens and parts), `components/ui` (shadcn)
- `src/dev`: review page and lint fixture (dev only, not built)
- `api/`: Vercel functions (web `Request`/`Response`; keys stay here)
- `tests/unit` (vitest), `tests/browser` (Playwright), `tests/fixtures`, `tests/agent-harness` (live agent quality run, needs the models)

## Rules

- Use shadcn/ui for primitives: `npx shadcn@latest add <name>`.
- No `any`, no inline styles. Split components over ~300 lines.
- Slides use `slides.css` and `components.css` unchanged; docs use `doc.css` and `components.css`, and `doc.css` never reaches inside a figure's canvas; app chrome never styles slide internals.
- Examples and the gallery come only from `src/engine/starters/starters.json`; never add another example set.
- Slide system: the source of truth is `docs/superpowers/specs/2026-09-26-slide-system-architecture-design.md` (start at section 14).
- Agent design, thin harness: write code only where the job is really hard (rendering, measuring, validation, storage). Everything else goes to the prompt, or to the user to decide. Give the models tools and let them choose; don't build logic that smarter models will make obsolete. A human editor is just another writer on the same path: checks warn, they never silently rewrite.
- AI: the main model goes through `api/glm.ts`: `LLM_PROVIDER=openrouter` (default, metered, `OPENROUTER_MODEL`, Haiku 5.5) or `glm` (GLM 5.3 Flash subscription). Jev (via OpenRouter) handles routing and closed-set decisions.
- Scratch notes and plans go in `docs/temp/` (gitignored).

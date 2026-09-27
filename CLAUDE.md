# CLAUDE.md

SmartChart: users make consulting and pitch slides by chatting. The bar is "the Apple of charts and presentations" with Linear/Revolut-level polish: restrained, precise, premium. Guiding philosophy: `docs/product/PRODUCT_INPUT.md` — the agent configures, never designs; beauty and taste are the product.

Stack: React 18 + TypeScript (strict), Vite, Tailwind + shadcn/ui, lucide, vitest, Playwright. Deployed on Vercel (`api/` functions).

## Commands

`npm run dev` (app + `/api` locally, reads `.env`) · `npm run build` (typechecks) · `npm run lint` · `npm test` (vitest) · `npm run test:browser` (Playwright: review page, lints, app smoke)

Dev review page: `/src/dev/review.html` (every example in both styles, validated and measured; `?stress=1`, `?theme=paper`, `?only=<i>&full=1` for one slide at full size, `?compare=788f4d7` against the pre-Acme starters).

## Structure

- `src/engine`: framework-free. `slides/` (schema, render, charts, lints, colours, `slides.css`), `agent/` (agent loop, prompts, checks, LLM calls), `starters/` (the gallery)
- `src/app`: the React app. `App.tsx` holds state and picks the screen; `components/` (screens and parts), `components/ui` (shadcn)
- `src/dev`: review page and lint fixture (dev only, not built)
- `api/`: Vercel functions (web `Request`/`Response`; keys stay here)
- `tests/unit` (vitest), `tests/browser` (Playwright), `tests/fixtures`, `tests/agent-harness` (live agent quality run, needs the models)

## Rules

- Use shadcn/ui for primitives: `npx shadcn@latest add <name>`.
- No `any`, no inline styles. Split components over ~300 lines.
- Slides use `slides.css` unchanged; app chrome never styles slide internals.
- Examples and the gallery come only from `src/engine/starters/starters.json`; never add another example set.
- Slide system: the source of truth is `docs/superpowers/specs/2026-09-26-slide-system-architecture-design.md` (start at section 14).
- AI: GLM 5.3 Flash is the main model; Jev (via OpenRouter, the only OpenRouter use) handles routing and closed-set decisions.
- Scratch notes and plans go in `docs/temp/` (gitignored).

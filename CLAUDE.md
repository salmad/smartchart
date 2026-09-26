# CLAUDE.md

SmartChart: users create and edit charts through natural-language chat. The bar is "the Apple of charts and presentations" with Linear/Revolut-level polish: restrained, precise, premium.

**Rewrite in progress:** the existing code was written with older model generations and is being rewritten. Treat current patterns as reference, not precedent. Prefer clean, simple implementations over matching legacy code.

Stack: React 18 + TypeScript (strict), Vite, Tailwind + shadcn/ui, Recharts, lucide-react. Deployed on Vercel.

## Commands

`npm run dev` · `npm run build` (runs `tsc -b`, so use it to typecheck) · `npm run lint`

## Structure

- `src/features/{chart,chat,settings}` holds the feature components and hooks
- `src/app/providers` holds the React Context state (`ChartConfigProvider`, `UIStateProvider`)
- `src/services/ai` holds the LLM layer (see `docs/AI_SERVICE.md`)
- `src/shared/{components,lib,types}` holds shared code, including the shadcn primitives in `shared/components/ui`

**Legacy duplicates:** `src/components`, `src/lib`, `src/utils` and `src/types` mirror files in `src/shared`. Edit the `shared/` copy. A few files still import `@/lib/utils` and `@/types/chart`, so check before deleting either tree.

## Rules

- Use shadcn/ui for primitives: `npx shadcn@latest add <name>`.
- No `any`, no inline styles. Split components over ~300 lines.
- The AI layer is provider-agnostic: Gemini Flash is primary, Claude Haiku is the fallback, and both share the prompt and parser code in `services/ai/shared/`.
- Before UI work, read `docs/DESIGN_SYSTEM.md` (tokens, card/chart patterns, `glass` and `transition-smooth` utilities).
- Scratch notes and plans go in `docs/temp/` (gitignored).

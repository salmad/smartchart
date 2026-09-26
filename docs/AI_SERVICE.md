# AI Service

`src/services/ai/aiServiceFactory.ts` tries Gemini (`gemini-2.5-flash`) first and falls back to Claude (`claude-haiku-4-5`) on failure. Callers import from `@/services/ai` and never know which provider answered.

- `shared/promptBuilder.ts` builds one prompt for both providers.
- `shared/responseParser.ts` parses the model's JSON reply. It must contain `configuration` and `message`.
- `types.ts` defines the `AIService` interface every provider implements.

Adding a provider: implement `AIService`, reuse the shared prompt and parser, and register it in the factory.

Env keys (`.env`): `VITE_GEMINI_API_KEY`, `VITE_ANTHROPIC_API_KEY`. These are exposed to the browser.

## Chart data shape

```ts
[{ quarter: 'Q1', 'Product A': 240, 'Product B': 139 }, ...]
```

The first key is the x-axis. The remaining keys are series. Chart types: `'bar' | 'line' | 'combined'` (`src/shared/types/chart.ts`).

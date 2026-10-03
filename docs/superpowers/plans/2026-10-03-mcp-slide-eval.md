# MCP Slide Eval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A standing eval, run with one command: Claude Code (Sonnet), driven headless on the subscription, makes a slide through the app's own `/mcp/v1` from an inexperienced user's request. It is scored by exact code checks and an Opus judge, and the report compares the run against a baseline.

**Architecture:**
- `tests/mcp-eval/eval.ts` spawns `claude -p` for each case against `npm run dev`'s real MCP endpoint, using a test account's agent key.
- It reads the final deck through `/api/decks`, measures it on the existing lint fixture, judges it with a second `claude -p` (Opus), and writes `out/<label>/` (results, summary, report, gallery).
- The judge also reads the full transcript and, for every mismatch, quotes the SmartChart text that misled the agent, names its source and proposes a fix. The report groups these by source.
- Pure modules (`claude.ts`, `checks.ts`, `judge.ts`, `scores.ts`, `report.ts`) are unit-tested. `eval.ts` is the only file with side effects at import.

**Tech Stack:** TypeScript (strict), vite-node (runs it, resolves `@/`), vitest, Playwright (`@playwright/test`'s `chromium`), the `claude` CLI 2.1.283+.

**Spec:** `docs/superpowers/specs/2026-10-03-mcp-slide-eval-design.md`

## Global Constraints

- No paid Anthropic or OpenAI keys. The agent and the judge run through the `claude` CLI on the subscription, `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `CLAUDE_CODE_USE_BEDROCK` and `CLAUDE_CODE_USE_VERTEX` are removed from the child environment, and `--bare` is never used.
- The eval stops unless `system/init` reports `apiKeySource: "none"` and exactly the expected MCP servers (`smartchart` for the agent, none for the judge).
- Agent flags are exactly: `-p --model <m> --mcp-config <file> --allowedTools mcp__smartchart__* --max-turns 40 --setting-sources local --strict-mcp-config --no-session-persistence --output-format stream-json --verbose`. Never `--tools` for the agent: it keeps Claude Code's full default tool set.
- Test the existing code, build no copies, change no product code: the app's own `/mcp/v1` and `/api/decks`, `docFromData()`, `src/dev/fixture.html`'s `window.lint`, `validate()`. SmartChart's own verdicts (write issues, `check_slide`'s J-checks) reach the judge through the transcript.
- Code checks only exact, stable facts (S, F1–F2, R, P). Anything that depends on the slide schema's details goes in a case question for the judge.
- No `any`, and no non-null assertions (`typescript-eslint` strict). Match the surrounding code's style: terse comments, short names.
- Keys come from `.env` `SMARTCHART_EVAL_KEYS` (comma-separated); one worker per key.
- Output goes in `tests/mcp-eval/out/<label>/` (gitignored). Committed baselines go in `tests/mcp-eval/baselines/<label>.{json,md}`.
- The default label is `<git short sha>[-dirty]-<yyyy-mm-dd>`.

## Review Focus

1. **The dev server isn't running, or the key is wrong.** The agent's `smartchart` server reports `failed` or `needs-auth`. Expected: the eval stops at once with a message naming `npm run dev` and the key, and doesn't score 75 empty runs. Pinned in Task 1 (`guardInit`).
2. **The `claude` CLI isn't logged in, or exits before the init event.** Expected: the eval stops with "no init event: is claude logged in?", and never records the case as an agent failure. Pinned in Task 1.
3. **The agent writes two slides (a cover and the content), or creates a deck and then only asks a question.** Expected: S2 fails (or S1, with no slide), facts and the judge use the content slide, not the cover, and an unjudged run is never counted as magic. Pinned in Tasks 2 and 5.
4. **A case is removed from or renamed in `cases.json` after runs exist under a label.** Expected: its old runs are ignored by the summary and the report, not crashed on. Pinned in Task 5.
5. **A chart near-miss whose values are written through a `format` (`£{v}m`).** Expected: the request's bare figures (`18`) still match. Pinned in Task 2.

---

### Task 1: Scaffold, shapes and the Claude Code runner

**Files:**
- Create: `tests/mcp-eval/types.ts`
- Create: `tests/mcp-eval/claude.ts`
- Test: `tests/unit/mcp-eval/claude.test.ts`
- Modify: `package.json` (scripts), `tsconfig.json` (`include`), `.gitignore`

**Interfaces:**
- Produces:
  - `types.ts`: `Case`, `Group`, `Check`, `ToolCall`, `Init`, `Outcome`, `Transcript`, `Deck`, `Measured`, `Verdict`, `Run`, `Results`.
  - `claude.ts`:
    - `childEnv(env): NodeJS.ProcessEnv`
    - `agentArgs(model: string, mcpConfig: string): string[]`
    - `judgeArgs(model: string, schema: object): string[]`
    - `parseStream(lines: string[]): Transcript`
    - `guardInit(init: Init | null, servers: string[]): string | null`
    - `isLimited(t: Transcript, stderr: string): boolean`
    - `runClaude(args: string[], prompt: string, cwd: string, timeoutMs: number): Promise<{ lines: string[]; stderr: string; code: number | null }>`

- [ ] **Step 1: Add the shapes**

`tests/mcp-eval/types.ts`:

```ts
// Shapes of the MCP slide eval (docs/superpowers/specs/2026-10-03-mcp-slide-eval-design.md).
import type { Slide, Style, TemplateId } from '@/engine/types'

export type Group = 'criteria' | 'figures' | 'positions' | 'actions' | 'stress' | 'near-miss' | 'ask'
export interface Case {
  id: string; group: Group; style: Style; prompt: string
  gold: TemplateId | null; acceptable: TemplateId[]; ask: boolean; files: string[]
  facts: { numbers: string[]; names: string[] }
  questions: { q: string; must: boolean }[]
}
/** One check's outcome; `must` marks a case question that gates the magic rate. */
export interface Check { id: string; ok: boolean; msg: string; must?: boolean }
export interface ToolCall { name: string; input: Record<string, unknown>; result: string; isError: boolean }
export interface Init { apiKeySource: string; model: string; mcpServers: { name: string; status: string }[]; version: string }
export interface Outcome { isError: boolean; numTurns: number; durationMs: number; costUsd: number; denials: string[]; text: string; structured: unknown }
export interface Transcript { init: Init | null; calls: ToolCall[]; finalText: string; outcome: Outcome | null }
export interface Deck { id: string; style: Style; edit: string; slides: { id: string; slide: Slide }[] }
export interface Measured { slideId: string; fit: string[]; issues: string[]; warnings: string[]; png: string }
export interface Verdict {
  generic: Record<string, { answer: string; why: string }>
  case: { q: string; yes: boolean; why: string }[]
  numbers: { value: string; kind: 'derived' | 'invented'; why: string }[]
  magic: { presentAsIs: boolean; fix: string }
}
export interface Run {
  id: string; caseId: string; n: number; status: 'done' | 'limited' | 'error'; error?: string
  transcript: Transcript | null; deck: Deck | null; measured: Measured[]
  checks: Check[]; unknownFigures: string[]
  verdict?: Verdict; judgeModel?: string
}
export type Results = Record<string, Run>
```

- [ ] **Step 2: Wire the scripts, the typecheck and the ignore list**

In `package.json` `"scripts"`, after `"test:browser"`, add:

```json
    "eval:mcp": "vite-node --config vitest.config.ts tests/mcp-eval/eval.ts --",
```

In `tsconfig.json` `"include"`, add `"tests/mcp-eval"` after `"tests/browser"`.

In `.gitignore`, append:

```
# MCP slide eval runs (baselines/ is committed)
tests/mcp-eval/out/
```

- [ ] **Step 3: Write the failing test**

`tests/unit/mcp-eval/claude.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { agentArgs, childEnv, guardInit, isLimited, judgeArgs, parseStream } from '../../mcp-eval/claude'
import type { Init, Transcript } from '../../mcp-eval/types'

const stream = [
  { type: 'system', subtype: 'init', apiKeySource: 'none', model: 'claude-sonnet-5-5', mcp_servers: [{ name: 'smartchart', status: 'connected' }], claude_code_version: '2.1.283' },
  { type: 'assistant', message: { content: [{ type: 'text', text: 'Let me look.' }, { type: 'tool_use', id: 'u1', name: 'mcp__smartchart__list_decks', input: {} }] } },
  { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'u1', content: [{ type: 'text', text: '{"decks":[]}' }] }] } },
  { type: 'assistant', message: { content: [{ type: 'tool_use', id: 'u2', name: 'Bash', input: { command: 'ls' } }] } },
  { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'u2', content: 'Permission denied', is_error: true }] } },
  { type: 'result', subtype: 'success', is_error: false, num_turns: 3, duration_ms: 1200, total_cost_usd: 0.4, permission_denials: [{ tool_name: 'Bash' }], result: 'Done: http://x/d/1', structured_output: { a: 1 } },
].map((e) => JSON.stringify(e))
const init = (over: Partial<Init> = {}): Init => ({ apiKeySource: 'none', model: 'm', mcpServers: [{ name: 'smartchart', status: 'connected' }], version: '2.1.283', ...over })
const empty: Transcript = { init: null, calls: [], finalText: '', outcome: null }

describe('Claude Code runner', () => {
  it('runs on the subscription: key and provider variables are removed, others kept', () => {
    const env = childEnv({ ANTHROPIC_API_KEY: 'k', ANTHROPIC_AUTH_TOKEN: 't', CLAUDE_CODE_USE_BEDROCK: '1', CLAUDE_CODE_USE_VERTEX: '1', PATH: '/bin', HOME: '/h' })
    expect(env).toEqual({ PATH: '/bin', HOME: '/h' })
  })
  it('agent: isolated from this machine, default tools kept, only SmartChart allowed', () => {
    const a = agentArgs('sonnet', '/tmp/mcp.json')
    expect(a).toContain('--strict-mcp-config')
    expect(a.join(' ')).toContain('--setting-sources local')
    expect(a.join(' ')).toContain('--allowedTools mcp__smartchart__*')
    expect(a.join(' ')).toContain('--mcp-config /tmp/mcp.json')
    expect(a).not.toContain('--bare')
    expect(a).not.toContain('--tools')
  })
  it('judge: Read only, structured answer, isolated', () => {
    const a = judgeArgs('opus', { type: 'object' })
    expect(a.join(' ')).toContain('--tools Read')
    expect(a.join(' ')).toContain('--json-schema {"type":"object"}')
    expect(a).toContain('--strict-mcp-config')
    expect(a).not.toContain('--bare')
  })
  it('parses stream-json: init, tool calls with results, denials, final text, structured output', () => {
    const t = parseStream([...stream, 'not json'])
    expect(t.init).toEqual({ apiKeySource: 'none', model: 'claude-sonnet-5-5', mcpServers: [{ name: 'smartchart', status: 'connected' }], version: '2.1.283' })
    expect(t.calls).toEqual([
      { name: 'mcp__smartchart__list_decks', input: {}, result: '{"decks":[]}', isError: false },
      { name: 'Bash', input: { command: 'ls' }, result: 'Permission denied', isError: true },
    ])
    expect(t.finalText).toBe('Done: http://x/d/1')
    expect(t.outcome).toMatchObject({ isError: false, numTurns: 3, durationMs: 1200, costUsd: 0.4, denials: ['Bash'], structured: { a: 1 } })
  })
  it('guard: the subscription and exactly the expected servers, connected', () => {
    expect(guardInit(init(), ['smartchart'])).toBeNull()
    expect(guardInit(null, ['smartchart'])).toMatch(/no init event.*logged in/)
    expect(guardInit(init({ apiKeySource: 'ANTHROPIC_API_KEY' }), ['smartchart'])).toMatch(/ANTHROPIC_API_KEY/)
    expect(guardInit(init({ mcpServers: [{ name: 'smartchart', status: 'connected' }, { name: 'prod', status: 'connected' }] }), ['smartchart'])).toMatch(/prod/)
    expect(guardInit(init({ mcpServers: [{ name: 'smartchart', status: 'failed' }] }), ['smartchart'])).toMatch(/npm run dev/)
    expect(guardInit(init({ mcpServers: [] }), [])).toBeNull()
  })
  it('limited: a usage limit from Claude Code, or SmartChart rate and quota errors', () => {
    expect(isLimited({ ...empty, outcome: { isError: true, numTurns: 1, durationMs: 0, costUsd: 0, denials: [], text: 'Claude usage limit reached', structured: null } }, '')).toBe(true)
    expect(isLimited(empty, 'Error: 429 rate limit')).toBe(true)
    expect(isLimited({ ...empty, calls: [{ name: 'mcp__smartchart__create_slide', input: {}, result: 'quota: You’ve used today’s model calls.', isError: true }] }, '')).toBe(true)
    expect(isLimited({ ...empty, outcome: { isError: false, numTurns: 1, durationMs: 0, costUsd: 0, denials: [], text: 'ok', structured: null } }, '')).toBe(false)
  })
})
```

- [ ] **Step 4: Run it to make sure it fails**

Run: `npx vitest run tests/unit/mcp-eval/claude.test.ts`
Expected: FAIL, cannot resolve `../../mcp-eval/claude`.

- [ ] **Step 5: Implement `claude.ts`**

`tests/mcp-eval/claude.ts`:

```ts
// Claude Code as a user runs it, headless, on this machine's subscription (spec §2). The isolation flags and the
// environment scrubbing live only here.
import { spawn } from 'node:child_process'
import type { Init, Outcome, ToolCall, Transcript } from './types'

/** Variables that would make the CLI bill an API key or another provider instead of the subscription login. */
const NOT_SUBSCRIPTION = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX']
export function childEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const out = { ...env }
  for (const k of NOT_SUBSCRIPTION) delete out[k]
  return out
}

// Isolate the run from this machine (its settings, plugins and MCP servers), never from what Claude Code does.
const ISOLATE = ['--setting-sources', 'local', '--strict-mcp-config', '--no-session-persistence', '--output-format', 'stream-json', '--verbose']
/** The agent: default prompt and tools, only the SmartChart connector, always allowed. The prompt goes on stdin. */
export const agentArgs = (model: string, mcpConfig: string): string[] =>
  ['-p', '--model', model, '--mcp-config', mcpConfig, '--allowedTools', 'mcp__smartchart__*', '--max-turns', '40', ...ISOLATE]
/** The judge: reads the screenshot, answers in the schema. */
export const judgeArgs = (model: string, schema: object): string[] =>
  ['-p', '--model', model, '--json-schema', JSON.stringify(schema), '--tools', 'Read', '--allowedTools', 'Read', ...ISOLATE]

interface Block { type: string; id?: string; name?: string; input?: Record<string, unknown>; text?: string; tool_use_id?: string; content?: string | { type: string; text?: string }[]; is_error?: boolean }
interface StreamEvent {
  type: string; subtype?: string; apiKeySource?: string; model?: string; mcp_servers?: { name: string; status: string }[]; claude_code_version?: string
  message?: { content?: Block[] | string }; is_error?: boolean; num_turns?: number; duration_ms?: number; total_cost_usd?: number
  permission_denials?: { tool_name: string }[]; result?: string; structured_output?: unknown
}
const event = (line: string): StreamEvent | null => { try { return JSON.parse(line) as StreamEvent } catch { return null } }

/** The transcript in Claude Code's stream-json: init, every tool call with its result, the final text and the outcome. */
export function parseStream(lines: string[]): Transcript {
  const t: Transcript = { init: null, calls: [], finalText: '', outcome: null }, open = new Map<string, ToolCall>()
  for (const line of lines) {
    const e = event(line), content = e?.message?.content, blocks = Array.isArray(content) ? content : []
    if (!e) continue
    if (e.type === 'system' && e.subtype === 'init') t.init = { apiKeySource: e.apiKeySource ?? '', model: e.model ?? '', mcpServers: e.mcp_servers ?? [], version: e.claude_code_version ?? '' }
    else if (e.type === 'assistant') for (const b of blocks) {
      if (b.type === 'tool_use' && b.id && b.name) { const c: ToolCall = { name: b.name, input: b.input ?? {}, result: '', isError: false }; open.set(b.id, c); t.calls.push(c) }
      else if (b.type === 'text' && b.text) t.finalText = b.text
    }
    else if (e.type === 'user') for (const b of blocks) {
      const c = b.type === 'tool_result' && b.tool_use_id ? open.get(b.tool_use_id) : undefined
      if (c) { c.result = typeof b.content === 'string' ? b.content : (b.content ?? []).map((x) => x.text ?? '').join(''); c.isError = !!b.is_error }
    }
    else if (e.type === 'result') {
      const o: Outcome = { isError: !!e.is_error, numTurns: e.num_turns ?? 0, durationMs: e.duration_ms ?? 0, costUsd: e.total_cost_usd ?? 0,
        denials: (e.permission_denials ?? []).map((d) => d.tool_name), text: e.result ?? '', structured: e.structured_output ?? null }
      t.outcome = o
      if (e.result) t.finalText = e.result
    }
  }
  return t
}

/** Why the run must stop, or null: it must bill the subscription and see exactly the expected MCP servers, up. */
export function guardInit(init: Init | null, servers: string[]): string | null {
  if (!init) return 'Claude Code sent no init event: is claude installed and logged in?'
  if (init.apiKeySource !== 'none') return `Claude Code is billing ${init.apiKeySource}, not the subscription login`
  const names = init.mcpServers.map((s) => s.name).sort().join(','), want = [...servers].sort().join(',')
  if (names !== want) return `MCP servers are [${names}], expected [${want}]`
  const down = init.mcpServers.find((s) => s.status === 'failed' || s.status === 'needs-auth')
  return down ? `MCP server ${down.name} is ${down.status}: is npm run dev running, and is the key in SMARTCHART_EVAL_KEYS valid?` : null
}

const LIMIT = /usage limit|rate limit|limit reached|overloaded|\b429\b/i
/** Cut off by a limit (Claude's usage limit, SmartChart's rate or quota): retried later, never scored. */
export const isLimited = (t: Transcript, stderr: string): boolean =>
  ((!t.outcome || t.outcome.isError) && LIMIT.test(`${t.outcome?.text ?? ''}\n${stderr}`)) || t.calls.some((c) => c.isError && /^(rate|quota):/.test(c.result))

/** Runs the CLI with the prompt on stdin; killed after `timeoutMs`. */
export function runClaude(args: string[], prompt: string, cwd: string, timeoutMs: number): Promise<{ lines: string[]; stderr: string; code: number | null }> {
  return new Promise((done) => {
    const p = spawn('claude', args, { cwd, env: childEnv(process.env), stdio: ['pipe', 'pipe', 'pipe'] })
    let out = '', err = ''
    const timer = setTimeout(() => p.kill('SIGTERM'), timeoutMs)
    p.stdout.on('data', (d: Buffer) => { out += d.toString() })
    p.stderr.on('data', (d: Buffer) => { err += d.toString() })
    p.on('close', (code) => { clearTimeout(timer); done({ lines: out.split('\n').filter(Boolean), stderr: err, code }) })
    p.stdin.end(prompt)
  })
}
```

- [ ] **Step 6: Run the tests and make sure they pass**

Run: `npx vitest run tests/unit/mcp-eval/claude.test.ts`
Expected: PASS (6 tests).

Run: `npx tsc -b && npx eslint tests/mcp-eval tests/unit/mcp-eval`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add tests/mcp-eval/types.ts tests/mcp-eval/claude.ts tests/unit/mcp-eval/claude.test.ts package.json tsconfig.json .gitignore
git commit -m "MCP eval: shapes and the headless Claude Code runner (subscription only, isolated)"
```

---

### Task 2: The code checks

**Files:**
- Create: `tests/mcp-eval/checks.ts`
- Test: `tests/unit/mcp-eval/checks.test.ts`

**Interfaces:**
- Consumes: `Case`, `Check`, `Deck`, `Measured`, `Transcript` from `types.ts`; `plain`, `validate` from `@/engine/slides/schema`.
- Produces:
  - `figures(text: string): { key: string; text: string }[]`
  - `slideText(s: Slide): string`
  - `requestText(c: Case, filesDir: string): string`
  - `factChecks(c: Case, s: Slide, request: string): { checks: Check[]; unknown: string[] }`
  - `choiceChecks(c: Case, t: Transcript, deck: Deck | null): Check[]`
  - `renderChecks(deck: Deck | null, measured: Measured[]): Check[]`
  - `wiringChecks(c: Case, t: Transcript, deck: Deck | null): Check[]`

- [ ] **Step 1: Write the failing test**

`tests/unit/mcp-eval/checks.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import starters from '@/engine/starters/starters.json'
import type { Slide } from '@/engine/types'
import { choiceChecks, factChecks, figures, renderChecks, slideText, wiringChecks } from '../../mcp-eval/checks'
import type { Case, Deck, ToolCall, Transcript } from '../../mcp-eval/types'

const key = (s: string) => figures(s).map((f) => f.key)
const scoring = starters.find((x) => x.id === 'scoring')?.consulting as unknown as Slide
const kase = (over: Partial<Case> = {}): Case => ({ id: 'c', group: 'criteria', style: 'consulting', prompt: 'Score the providers; Acme comes out on top', gold: 'table', acceptable: [], ask: false, files: [], facts: { numbers: [], names: [] }, questions: [], ...over })
const call = (tool: string, input: Record<string, unknown> = {}, result = '{}', isError = false): ToolCall => ({ name: `mcp__smartchart__${tool}`, input, result, isError })
const transcript = (calls: ToolCall[], finalText = '', denials: string[] = []): Transcript =>
  ({ init: null, calls, finalText, outcome: { isError: false, numTurns: 1, durationMs: 0, costUsd: 0, denials, text: finalText, structured: null } })
const deckOf = (slides: Slide[], style: Deck['style'] = 'consulting'): Deck => ({ id: 'd1', style, edit: 'http://localhost:5173/d/d1', slides: slides.map((slide, i) => ({ id: `s${i + 1}`, slide })) })
const good = [call('list_decks'), call('create_deck', { style: 'consulting' }), call('get_guide', { style: 'consulting' }), call('get_template', { template: 'table', style: 'consulting' }),
  call('create_slide', { deckId: 'd1', slide: scoring, request: 'Score the providers' }, '{"applied":true,"slideId":"s1"}'), call('check_slide', { deckId: 'd1', slideId: 's1' })]

describe('figures', () => {
  it('normalises format and scale, never rounds', () => {
    expect(key('£1,200k')).toEqual(key('£1.2m'))
    expect(key('(53)')).toEqual(key('-53'))
    expect(key('−53')).toEqual(key('53'))
    expect(key('42%')).not.toEqual(key('42'))
    expect(key('£84bn')).toEqual(['84000000000'])
    expect(key('11.0')).toEqual(key('11'))
    expect(key('11.4')).not.toEqual(key('11'))
  })
  it('skips codes that are not figures', () => {
    expect(key('FY25 Q1 H2')).toEqual([])
    expect(key('2019-2025')).toEqual(['2019', '2025'])
  })
  it('reads chart values raw and through their format, and skips positions', () => {
    const chart = { template: 'chart', title: 't', chart: { format: '£{v}m', categories: ['Jan'], series: [{ name: 'Spend', mark: 'bar', values: [18] }], annotations: [{ type: 'cagr', from: 0, to: 7 }] } } as unknown as Slide
    const k = key(slideText(chart))
    expect(k).toContain('18')
    expect(k).toContain('18000000')
    expect(k).not.toContain('7')
  })
})

describe('facts', () => {
  it('every request figure and name present: F1 and F2 pass', () => {
    const r = factChecks(kase({ facts: { numbers: [], names: ['Acme', 'Neobank'] } }), scoring, 'Score Acme and Neobank')
    expect(r.checks.map((c) => [c.id, c.ok])).toEqual([['F1', true], ['F2', true]])
  })
  it('a figure or name missing fails, and figures not in the request go to the judge', () => {
    const r = factChecks(kase({ facts: { numbers: ['£250k'], names: ['Amex'] } }), { ...scoring, takeaway: 'Saves £3,000 a year' }, 'limit £250k vs Amex')
    expect(r.checks.map((c) => c.ok)).toEqual([false, false])
    expect(r.unknown).toContain('£3,000')
  })
})

describe('choice', () => {
  it('right template, one slide, wrote without asking, style as expected', () => {
    expect(choiceChecks(kase(), transcript(good, 'Done'), deckOf([scoring])).map((c) => [c.id, c.ok])).toEqual([['S1', true], ['S2', true], ['S3', true], ['S4', true]])
  })
  it('two slides fail S2; another template fails S1; a pitch deck fails S4', () => {
    const r = choiceChecks(kase({ gold: 'chart' }), transcript(good), deckOf([scoring, scoring], 'pitch'))
    expect(r.filter((c) => !c.ok).map((c) => c.id)).toEqual(['S1', 'S2', 'S4'])
  })
  it('a clear request answered with a question fails S3; an ask case passes it', () => {
    const asked = transcript([call('list_decks')], 'Which competitors, and on what?')
    expect(choiceChecks(kase(), asked, null).find((c) => c.id === 'S3')?.ok).toBe(false)
    expect(choiceChecks(kase({ ask: true, gold: null }), asked, null).map((c) => [c.id, c.ok])).toEqual([['S2', true], ['S3', true]])
  })
})

describe('render', () => {
  it('fit issues fail R1, layout lints R2; a valid gallery slide passes R3', () => {
    const r = renderChecks(deckOf([scoring]), [{ slideId: 's1', fit: ['title wraps to 3 lines'], issues: ['table: L1'], warnings: [], png: '' }])
    expect(r.map((c) => [c.id, c.ok])).toEqual([['R1', false], ['R2', false], ['R3', true]])
  })
  it('no slide, no render checks', () => expect(renderChecks(null, [])).toEqual([]))
})

describe('wiring', () => {
  it('a well-behaved run passes P1–P7', () => {
    const r = wiringChecks(kase(), transcript(good, 'Added it: http://localhost:5173/d/d1'), deckOf([scoring]))
    expect(r.filter((c) => !c.ok)).toEqual([])
    expect(r.map((c) => c.id)).toEqual(['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'])
  })
  it('writing first, leaving issues, no check, no request, setting the look, a long reply, a denied tool', () => {
    const bad = [call('create_deck', { style: 'consulting', theme: 'paper' }), call('create_slide', { deckId: 'd1', slide: { ...scoring, footer: 'x' } }, '{"applied":true,"issues":["title: too long"]}')]
    const r = wiringChecks(kase(), transcript(bad, `${'word '.repeat(130)} {"slide":1}`, ['Bash']), deckOf([scoring]))
    expect(r.filter((c) => !c.ok).map((c) => c.id)).toEqual(['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'])
  })
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run tests/unit/mcp-eval/checks.test.ts`
Expected: FAIL, cannot resolve `../../mcp-eval/checks`.

- [ ] **Step 3: Implement `checks.ts`**

`tests/mcp-eval/checks.ts`:

```ts
// The code checks (spec §4): only what is exact and stable. What depends on the slide schema's details (focus,
// marks, totals) is a case question for the judge, so a schema change breaks nothing here.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { plain, validate } from '@/engine/slides/schema'
import type { Slide } from '@/engine/types'
import type { Case, Check, Deck, Measured, Transcript } from './types'

const SCALE: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9, bn: 1e9 }
const FIGURE = /(?<![\w.])[£$€]?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(bn|b|m|k|%|x)?(?!\w)/gi
/** Figures in a text: separators and currency dropped, scale applied, % and x kept as units, sign ignored, never rounded. */
export function figures(text: string): { key: string; text: string }[] {
  return [...text.matchAll(FIGURE)].map((m) => {
    const unit = (m[3] ?? '').toLowerCase(), value = Number(`${m[1].replace(/,/g, '')}${m[2] ?? ''}`) * (SCALE[unit] ?? 1)
    return { key: `${Number(value.toPrecision(12))}${unit === '%' || unit === 'x' ? unit : ''}`, text: m[0] }
  })
}

// Positions and indices, not figures a reader sees.
const NOT_SHOWN = new Set(['from', 'to', 'start', 'end', 'x', 'y', 'series'])
/** Every piece of text on the slide, plain; a number under a `format` is written both raw and through it (18, £18m). */
export function slideText(s: Slide): string {
  const out: string[] = []
  const walk = (v: unknown, format: string | null, key: string): void => {
    if (typeof v === 'string') out.push(plain(v))
    else if (typeof v === 'number') { if (!NOT_SHOWN.has(key)) out.push(String(v), ...(format ? [format.replace('{v}', String(v))] : [])) }
    else if (Array.isArray(v)) v.forEach((x) => walk(x, format, key))
    else if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>, f = typeof o.format === 'string' ? o.format : format
      for (const [k, x] of Object.entries(o)) if (k !== 'format') walk(x, f, k)
    }
  }
  walk(s, null, '')
  return out.join('\n')
}

/** What the user gave: the prompt, plus the files the case puts in the folder. */
export const requestText = (c: Case, filesDir: string): string =>
  [c.prompt, ...c.files.map((f) => `${f}:\n${readFileSync(path.join(filesDir, f), 'utf8')}`)].join('\n\n')

/** F1–F2: the request's figures and names are on the slide; figures it doesn't state go to the judge (F3). */
export function factChecks(c: Case, s: Slide, request: string): { checks: Check[]; unknown: string[] } {
  const text = slideText(s), shown = figures(text), have = new Set(shown.map((f) => f.key)), asked = new Set(figures(request).map((f) => f.key))
  const lost = c.facts.numbers.filter((n) => figures(n).some((f) => !have.has(f.key)))
  const lostNames = c.facts.names.filter((n) => !text.toLowerCase().includes(n.toLowerCase()))
  const unknown = [...new Map(shown.filter((f) => !asked.has(f.key)).map((f) => [f.key, f.text])).values()]
  return { unknown, checks: [
    { id: 'F1', ok: !lost.length, msg: lost.length ? `Figures from the request missing: ${lost.join(', ')}` : 'Every figure from the request is on the slide' },
    { id: 'F2', ok: !lostNames.length, msg: lostNames.length ? `Names from the request missing: ${lostNames.join(', ')}` : 'Every name from the request is on the slide' },
  ] }
}

const tool = (name: string) => name.replace(/^mcp__smartchart__/, '')
const SLIDE_WRITES = ['create_slide', 'update_slide', 'change_template']
const asks = (text: string) => text.trim().split('\n').slice(-3).join(' ').includes('?')

/** S1–S4: the right kind of slide, one of it, asked only when the case is unclear, the expected style. */
export function choiceChecks(c: Case, t: Transcript, deck: Deck | null): Check[] {
  const slides = deck?.slides ?? [], wrote = t.calls.some((x) => SLIDE_WRITES.includes(tool(x.name)) && !x.isError), asked = asks(t.finalText), out: Check[] = []
  if (!c.ask) {
    const tpl = slides[0]?.slide.template, ok = !!tpl && (tpl === c.gold || c.acceptable.includes(tpl))
    out.push({ id: 'S1', ok, msg: `${tpl ?? 'No slide'}; expected ${[c.gold, ...c.acceptable].join(' or ')}` })
  }
  const want = c.ask ? 0 : 1
  out.push({ id: 'S2', ok: slides.length === want, msg: `${slides.length} slides; expected ${want}` })
  out.push(c.ask
    ? { id: 'S3', ok: asked && !wrote, msg: wrote ? 'Wrote a slide instead of asking' : asked ? 'Asked first' : 'Neither asked nor wrote' }
    : { id: 'S3', ok: wrote || !asked, msg: wrote ? 'Wrote the slide' : 'Asked instead of writing a clear request' })
  if (deck) out.push({ id: 'S4', ok: deck.style === c.style, msg: `Style ${deck.style}; expected ${c.style}` })
  return out
}

/** R1–R3: the existing fixture's fit issues and layout lints, and validate(). */
export function renderChecks(deck: Deck | null, measured: Measured[]): Check[] {
  if (!deck?.slides.length) return []
  const fit = measured.flatMap((m) => m.fit), lints = measured.flatMap((m) => m.issues)
  const errors = deck.slides.flatMap((s) => validate(s.slide, deck.style).errors.map(String))
  return [
    { id: 'R1', ok: !fit.length, msg: fit.length ? fit.join('; ') : 'Fits: no overflow or overlap' },
    { id: 'R2', ok: !lints.length, msg: lints.length ? lints.join('; ') : 'Layout lints clean' },
    { id: 'R3', ok: !errors.length, msg: errors.length ? errors.join('; ') : 'Validates' },
  ]
}

const LOOK = ['style', 'theme', 'accent', 'layout', 'color', 'colors', 'colour', 'colours', 'page', 'footer']
const keysOf = (v: unknown): string[] => (v && typeof v === 'object' ? Object.keys(v) : [])
const json = (s: string): Record<string, unknown> => { try { const v: unknown = JSON.parse(s); return v && typeof v === 'object' ? (v as Record<string, unknown>) : {} } catch { return {} } }

/** P1–P7, did the server's instructions land: read before writing, fix issues, check, pass the request, leave the look
    alone, reply briefly with the link, need no other tool. */
export function wiringChecks(c: Case, t: Transcript, deck: Deck | null): Check[] {
  const calls = t.calls.map((x) => ({ ...x, tool: tool(x.name) })), writes = calls.filter((x) => SLIDE_WRITES.includes(x.tool)), out: Check[] = []
  const add = (id: string, ok: boolean, pass: string, fail: string) => out.push({ id, ok, msg: ok ? pass : fail })
  if (writes.length) {
    const first = calls.indexOf(writes[0]), before = calls.slice(0, first), tpl = deck?.slides[0]?.slide.template
    const guide = before.some((x) => x.tool === 'get_guide'), card = before.some((x) => x.tool === 'get_template' && x.input.template === tpl)
    add('P1', guide && card, 'Read the guide and the card before writing', `Wrote before reading ${[!guide && 'the guide', !card && `the ${tpl ?? ''} card`].filter(Boolean).join(' and ')}`)
    const last = writes[writes.length - 1], issues = json(last.result).issues
    const left = Array.isArray(issues) ? issues.map((i) => (typeof i === 'string' ? i : JSON.stringify(i))) : []
    add('P2', !last.isError && !left.length, 'The last write returned no issues', last.isError ? `The last write failed: ${last.result.slice(0, 200)}` : `The last write left: ${left.join('; ')}`)
    add('P3', calls.slice(calls.indexOf(last) + 1).some((x) => x.tool === 'check_slide'), 'Checked the slide after the last write', 'No check_slide after the last write')
    const bare = writes.filter((x) => { const r = x.input.request; return typeof r !== 'string' || !r.trim() }).length
    add('P4', !bare, 'Every write passed the request', `${bare} of ${writes.length} writes without the request`)
  }
  const touched = calls.flatMap((x) => {
    if (x.tool === 'create_deck' || x.tool === 'update_deck') return keysOf(x.input).filter((k) => k === 'theme' || k === 'accent')
    if (x.tool === 'create_slide' || x.tool === 'change_template') return keysOf(x.input.slide).filter((k) => LOOK.includes(k))
    if (x.tool === 'update_slide') return keysOf(x.input.set).filter((p) => LOOK.includes(p.split(/[.[]/)[0]))
    return []
  })
  add('P5', !touched.length, 'Left the look to SmartChart', `Set ${[...new Set(touched)].join(', ')}`)
  if (!c.ask) {
    const text = t.finalText.trim(), words = text.split(/\s+/).filter(Boolean).length, hasJson = /[{[]\s*"/.test(text), link = !!deck && text.includes(deck.edit)
    add('P6', words <= 120 && !hasJson && link, 'Short reply with the editor link', [words > 120 && `${words} words`, hasJson && 'JSON in the reply', !link && 'no editor link'].filter(Boolean).join(', '))
  }
  const denied = t.outcome?.denials ?? []
  add('P7', !denied.length, 'No tool call needed approval', `Denied: ${denied.join(', ')}`)
  return out
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npx vitest run tests/unit/mcp-eval/checks.test.ts`
Expected: PASS. If `validate(scoring)` returns errors on the gallery slide (R3 false), stop and report it: that is an engine finding, not a test to loosen.

Run: `npx tsc -b && npx eslint tests/mcp-eval tests/unit/mcp-eval`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add tests/mcp-eval/checks.ts tests/unit/mcp-eval/checks.test.ts
git commit -m "MCP eval: code checks for choice, facts, render and wiring"
```

---

### Task 3: The cases

**Files:**
- Create: `tests/mcp-eval/cases.json`
- Create: `tests/mcp-eval/files/pilot-stores.csv`
- Test: `tests/unit/mcp-eval/cases.test.ts`

**Interfaces:**
- Consumes: `Case` (types), `figures`, `requestText` (checks), `OFFERED` (`@/engine/slides/schema`).

- [ ] **Step 1: Write the failing test**

`tests/unit/mcp-eval/cases.test.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { OFFERED } from '@/engine/slides/schema'
import { figures, requestText } from '../../mcp-eval/checks'
import type { Case } from '../../mcp-eval/types'

const dir = path.resolve(__dirname, '../../mcp-eval')
const cases = JSON.parse(readFileSync(path.join(dir, 'cases.json'), 'utf8')) as Case[]

describe('eval cases', () => {
  it('25 cases with unique ids, in the spec’s groups', () => {
    expect(cases).toHaveLength(25)
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length)
    const count = (g: string) => cases.filter((c) => c.group === g).length
    expect([count('criteria'), count('figures'), count('positions'), count('actions'), count('stress'), count('near-miss'), count('ask')]).toEqual([4, 4, 2, 2, 5, 6, 2])
  })
  it.each(cases.map((c) => [c.id, c] as const))('%s is honest', (_id, c) => {
    for (const f of c.files) expect(existsSync(path.join(dir, 'files', f)), f).toBe(true)
    const request = requestText(c, path.join(dir, 'files')), asked = new Set(figures(request).map((f) => f.key))
    for (const n of c.facts.numbers) for (const f of figures(n)) expect(asked.has(f.key), `${n} is not in the request`).toBe(true)
    for (const n of c.facts.names) expect(request.toLowerCase(), `${n} is not in the request`).toContain(n.toLowerCase())
    if (c.ask) { expect(c.gold).toBeNull(); return }
    expect(c.gold && OFFERED.includes(c.gold)).toBe(true)
    for (const t of c.acceptable) expect(OFFERED).toContain(t)
    expect(c.questions.some((q) => q.must)).toBe(true)
  })
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run tests/unit/mcp-eval/cases.test.ts`
Expected: FAIL, ENOENT on `cases.json`.

- [ ] **Step 3: Write the file fixture**

`tests/mcp-eval/files/pilot-stores.csv`:

```
store,region,sales_gbp_m,labour_pct,shrink_pct,footfall_k,avg_basket_gbp,opened
Leeds,North,4.1,31,3.8,612,6.70,2019
York,North,3.2,24,1.9,455,7.03,2016
Hull,North,2.9,25,2.1,430,6.74,2018
Bradford,North,3.0,26,2.4,441,6.80,2017
```

- [ ] **Step 4: Write the cases**

`tests/mcp-eval/cases.json`:

```json
[
 { "id": "t01", "group": "criteria", "style": "consulting",
   "prompt": "Board wants to see how our SME card stacks up against the competition. Acme (us): £250k credit limit, no annual fee, 1% cashback, Xero sync yes. Amex Business Gold: £50k limit, £550 a year, 0.5% cashback, Xero sync yes. Barclaycard Select: £25k limit, £32 a year, no cashback, no Xero sync. Revolut Business: it's debit so no credit line, no fee, no cashback, Xero sync yes. The point: we're the only one with a big limit and no fee.",
   "gold": "table", "acceptable": [], "ask": false, "files": [],
   "facts": { "numbers": ["£250k", "1%", "£50k", "£550", "0.5%", "£25k", "£32"], "names": ["Acme", "Amex", "Barclaycard", "Revolut"] },
   "questions": [
     { "q": "Is Acme the one highlighted row or column, with nothing else highlighted?", "must": true },
     { "q": "Is Xero sync shown as ✓ / ✗ marks rather than the words yes / no?", "must": true },
     { "q": "Does the title make Acme's big limit with no fee the so-what?", "must": true },
     { "q": "Is Revolut's credit limit shown as not applicable (— or a short note) rather than £0?", "must": false } ] },
 { "id": "t02", "group": "criteria", "style": "consulting",
   "prompt": "Rate the four vendors we shortlisted for the CRM replacement, Salesforce, HubSpot, Pipedrive and Attio, on ease of migration, reporting depth, price and fit with our sales team. My take: Salesforce has great reporting but a painful migration and it's expensive; HubSpot is good all-round at a decent price; Pipedrive is cheap and easy but weak on reporting; Attio is easy and modern, reporting still immature, mid price. We're recommending HubSpot.",
   "gold": "table", "acceptable": [], "ask": false, "files": [],
   "facts": { "numbers": [], "names": ["Salesforce", "HubSpot", "Pipedrive", "Attio"] },
   "questions": [
     { "q": "Are the ratings shown as Harvey balls (○ ◔ ◑ ◕ ●) rather than words?", "must": true },
     { "q": "Is HubSpot highlighted as the recommendation?", "must": true },
     { "q": "Do the ratings follow the user's take (Salesforce lowest on migration and price, Pipedrive lowest on reporting)?", "must": true },
     { "q": "Does the title recommend HubSpot and say why?", "must": true } ] },
 { "id": "t03", "group": "criteria", "style": "pitch",
   "prompt": "Investor slide: why we win. Us (Ledgerly) vs QuickBooks, Xero and FreeAgent. Real-time bank feeds: we have it, QuickBooks yes, Xero yes, FreeAgent no. AI categorisation: only us. Multi-currency: us, Xero and QuickBooks. Under £10 a month: us and FreeAgent.",
   "gold": "table", "acceptable": [], "ask": false, "files": [],
   "facts": { "numbers": ["£10"], "names": ["Ledgerly", "QuickBooks", "Xero", "FreeAgent"] },
   "questions": [
     { "q": "Are the has/lacks answers shown as ✓ / ✗ marks?", "must": true },
     { "q": "Do the marks match the user's facts exactly (AI categorisation only Ledgerly; FreeAgent lacks bank feeds; multi-currency Ledgerly, Xero and QuickBooks; under £10 Ledgerly and FreeAgent)?", "must": true },
     { "q": "Is Ledgerly highlighted?", "must": true },
     { "q": "Is the slide light enough for a pitch: one message, no dense notes?", "must": false } ] },
 { "id": "t04", "group": "criteria", "style": "consulting",
   "prompt": "Which of our three expansion markets is most attractive? Germany, France and the Netherlands on market size (Germany big, France big, Netherlands small), competition (Germany intense, France moderate, Netherlands low), regulatory ease (Germany hard, France moderate, Netherlands easy) and ops fit (Germany medium, France low, Netherlands high). We recommend the Netherlands as the beachhead.",
   "gold": "table", "acceptable": [], "ask": false, "files": [],
   "facts": { "numbers": [], "names": ["Germany", "France", "Netherlands"] },
   "questions": [
     { "q": "Are the assessments shown as one kind of mark (Harvey balls) rather than words?", "must": true },
     { "q": "Is the Netherlands highlighted as the recommendation?", "must": true },
     { "q": "Does the title recommend the Netherlands as the beachhead?", "must": true },
     { "q": "Does the slide acknowledge the Netherlands' small market size as the trade-off?", "must": false } ] },
 { "id": "f01", "group": "figures", "style": "consulting",
   "prompt": "Unit economics of our three plans side by side (price / gross margin / CAC / payback months): Starter £0 / 42% / £180 / 14; Growth £49 / 61% / £420 / 9; Scale £199 / 68% / £1,900 / 11. Point out Growth is the sweet spot and Scale payback is inflated by enterprise sales cost.",
   "gold": "table", "acceptable": [], "ask": false, "files": [],
   "facts": { "numbers": ["£0", "42%", "£180", "14", "£49", "61%", "£420", "9", "£199", "68%", "£1,900", "11"], "names": ["Starter", "Growth", "Scale"] },
   "questions": [
     { "q": "Is Growth highlighted?", "must": true },
     { "q": "Does the title name Growth as the sweet spot?", "must": true },
     { "q": "Does the slide say Scale's payback is inflated by enterprise sales cost?", "must": true },
     { "q": "Are the units clear for every measure (in the headers or the cells)?", "must": false } ] },
 { "id": "f02", "group": "figures", "style": "consulting",
   "prompt": "FY25 P&L summary for the board, £m. FY25: revenue 48.2, COGS (19.1), gross profit 29.1, sales & marketing (12.4), R&D (8.8), G&A (4.6), EBITDA 3.3. FY24: revenue 39.5, COGS (16.8), gross profit 22.7, sales & marketing (11.0), R&D (7.9), G&A (4.4), EBITDA (0.6). Message: this is our first year of positive EBITDA.",
   "gold": "table", "acceptable": [], "ask": false, "files": [],
   "facts": { "numbers": ["48.2", "19.1", "29.1", "12.4", "8.8", "4.6", "3.3", "39.5", "16.8", "22.7", "11.0", "7.9", "4.4", "0.6"], "names": ["EBITDA"] },
   "questions": [
     { "q": "Is EBITDA set apart as the bottom line (a total row or equivalent)?", "must": true },
     { "q": "Does the title say FY25 is the first year of positive EBITDA?", "must": true },
     { "q": "Are costs written consistently (all in brackets or all as negatives)?", "must": false },
     { "q": "Is FY25 the highlighted column?", "must": false } ] },
 { "id": "f03", "group": "figures", "style": "consulting",
   "prompt": "Store P&L for the four pilot stores: Leeds sales £4.1m, labour 31%, shrink 3.8%; York £3.2m, 24%, 1.9%; Hull £2.9m, 25%, 2.1%; Bradford £3.0m, 26%, 2.4%. I need to explain why Leeds underperforms despite the best top line.",
   "gold": "table", "acceptable": [], "ask": false, "files": [],
   "facts": { "numbers": ["£4.1m", "31%", "3.8%", "£3.2m", "24%", "1.9%", "£2.9m", "25%", "2.1%", "£3.0m", "26%", "2.4%"], "names": ["Leeds", "York", "Hull", "Bradford"] },
   "questions": [
     { "q": "Is Leeds highlighted?", "must": true },
     { "q": "Does the title say Leeds underperforms because of labour and shrink despite the best sales?", "must": true },
     { "q": "Can the reader see at a glance that Leeds is worst on both labour and shrink?", "must": true } ] },
 { "id": "f04", "group": "figures", "style": "consulting",
   "prompt": "Cost base by region for the CFO: North America £2.4m, Europe £850k, APAC £1.15m, LatAm £310k, total £4.71m. Europe is the one to cut.",
   "gold": "table", "acceptable": ["chart"], "ask": false, "files": [],
   "facts": { "numbers": ["£2.4m", "£850k", "£1.15m", "£310k", "£4.71m"], "names": ["North America", "Europe", "APAC", "LatAm"] },
   "questions": [
     { "q": "Are all the costs written in one unit (all £m or all £k)?", "must": true },
     { "q": "Is Europe highlighted?", "must": true },
     { "q": "Does the title make Europe the one to cut?", "must": true } ] },
 { "id": "p01", "group": "positions", "style": "consulting",
   "prompt": "How the big four UK banks are playing SME lending: Lloyds leans on its branch network and bundles loans with current accounts; NatWest is digital-first with fast approvals under £50k; Barclays focuses on larger SMEs with relationship managers; HSBC goes after international trade finance. Where's the white space for us?",
   "gold": "table", "acceptable": [], "ask": false, "files": [],
   "facts": { "numbers": ["£50k"], "names": ["Lloyds", "NatWest", "Barclays", "HSBC"] },
   "questions": [
     { "q": "Does each bank's row say how it plays, matching the user's description?", "must": true },
     { "q": "Does the title or takeaway name a white space for us?", "must": true },
     { "q": "Is the first column short (just the bank names), with the explanation in one column?", "must": false } ] },
 { "id": "p02", "group": "positions", "style": "pitch",
   "prompt": "Competitor landscape for our seed deck: Deel and Remote do global payroll for big companies, Gusto is US-only small business, we (Payloop) do global payroll for 5-50 person startups at a flat $29 per employee.",
   "gold": "table", "acceptable": ["cards"], "ask": false, "files": [],
   "facts": { "numbers": ["$29"], "names": ["Deel", "Remote", "Gusto", "Payloop"] },
   "questions": [
     { "q": "Is Payloop highlighted or otherwise clearly ours?", "must": true },
     { "q": "Does the slide make clear the gap Payloop fills (global payroll for 5–50 person startups)?", "must": true },
     { "q": "Is the slide light enough for a pitch?", "must": false } ] },
 { "id": "a01", "group": "actions", "style": "consulting",
   "prompt": "Next steps after the steering committee: finalise the vendor contract, Priya, 14 Nov, in progress; data migration plan, Tom, 21 Nov, not started; train the regional leads, Sarah, 5 Dec, not started; go-live readiness review, Priya, 12 Dec, not started.",
   "gold": "table", "acceptable": [], "ask": false, "files": [],
   "facts": { "numbers": [], "names": ["Priya", "Tom", "Sarah"] },
   "questions": [
     { "q": "Does each action show its owner and date exactly as given?", "must": true },
     { "q": "Is the status shown as a status label (In progress, Not started)?", "must": true },
     { "q": "Does the title say what the committee should take away rather than just 'Next steps'?", "must": false } ] },
 { "id": "a02", "group": "actions", "style": "pitch",
   "prompt": "Last slide before the ask: what the £2m buys over the next 18 months. Hire 6 engineers by Q2 (CTO owns it), launch in Germany in Q3 (COO), reach £1m ARR by Q4 (CEO).",
   "gold": "table", "acceptable": ["steps", "cards"], "ask": false, "files": [],
   "facts": { "numbers": ["£2m", "6", "£1m"], "names": ["Germany"] },
   "questions": [
     { "q": "Are all three milestones on the slide with their timing?", "must": true },
     { "q": "Does the title tie the milestones to the £2m raise?", "must": true },
     { "q": "Is it light enough for a pitch slide?", "must": false } ] },
 { "id": "s01", "group": "stress", "style": "consulting",
   "prompt": "make a slide from this for the ops review, the point is Manchester is our most efficient depot\n\ndepot,region,headcount,vans,parcels_k,on_time_pct,cost_per_parcel,fuel_k,overtime_hrs,complaints,nps,sq_ft\nManchester,North,142,61,812,97.1,1.84,212,1210,38,52,48000\nLeeds,North,118,55,640,94.3,2.11,198,1540,51,41,41000\nBirmingham,Midlands,171,74,905,93.8,2.06,251,2210,77,38,56000\nBristol,South West,96,40,455,95.2,2.24,149,980,33,45,30000\nCroydon,London,155,70,770,91.6,2.39,240,2600,94,29,39000",
   "gold": "table", "acceptable": [], "ask": false, "files": [],
   "facts": { "numbers": ["1.84", "97.1"], "names": ["Manchester", "Leeds", "Birmingham", "Bristol", "Croydon"] },
   "questions": [
     { "q": "Did the agent pick the few columns that prove efficiency (such as cost per parcel and on-time %) rather than all twelve?", "must": true },
     { "q": "Is Manchester highlighted?", "must": true },
     { "q": "Does the title say Manchester is the most efficient depot, with the measure that proves it?", "must": true } ] },
 { "id": "s02", "group": "stress", "style": "consulting",
   "prompt": "Our 15 product lines, FY25 revenue £m and growth: Core Payroll 18.2 +12%, HR Suite 9.4 +8%, Expenses 6.1 +15%, Time Tracking 3.3 +4%, Benefits 2.8 +6%, Pensions 1.9 +2%, Recruiting 1.2 -3%, Learning 0.9 -5%, Surveys 0.6 -8%, Rota 0.5 +1%, Docs 0.4 -2%, Compliance Pack 0.3 -6%, Mobile Kiosk 0.2 -10%, Legacy Desktop 0.2 -15%, Partner API 0.1 +3%. I want to show the long tail isn't worth keeping.",
   "gold": "table", "acceptable": ["chart"], "ask": false, "files": [],
   "facts": { "numbers": ["18.2", "9.4", "6.1"], "names": ["Core Payroll", "HR Suite", "Expenses"] },
   "questions": [
     { "q": "Are the small lines grouped (an 'other' or 'long tail' row or group) rather than silently dropped?", "must": true },
     { "q": "Does the slide or the reply say which lines were combined or left out?", "must": true },
     { "q": "Does the title argue the long tail isn't worth keeping, with a figure?", "must": true } ] },
 { "id": "s03", "group": "stress", "style": "consulting",
   "prompt": "Feature comparison for the product review. We are Tessera. SSO: Tessera Yes, Notion Yes, Coda No, Confluence Yes. Offline mode: Tessera Partly, Notion No, Coda No, Confluence Yes. API: Tessera Yes, Notion Yes, Coda Yes, Confluence Partly. Audit log: Tessera Yes, Notion Partly, Coda No, Confluence Yes.",
   "gold": "table", "acceptable": [], "ask": false, "files": [],
   "facts": { "numbers": [], "names": ["Tessera", "Notion", "Coda", "Confluence"] },
   "questions": [
     { "q": "Are Yes / No / Partly shown as marks (✓ ✗ or Harvey balls), not words?", "must": true },
     { "q": "Do the marks match the user's answers?", "must": true },
     { "q": "Is Tessera highlighted?", "must": true } ] },
 { "id": "s04", "group": "stress", "style": "consulting",
   "prompt": "For the QBR: show our NRR by segment this year (Enterprise 118%, Mid-market 104%, SMB 91%) and also how total NRR moved over the last 6 quarters (Q1'24 101%, Q2 103%, Q3 104%, Q4 106%, Q1'25 107%, Q2 108%).",
   "gold": "pair", "acceptable": ["chart", "table"], "ask": false, "files": [],
   "facts": { "numbers": ["118%", "104%", "91%", "108%"], "names": ["Enterprise", "Mid-market", "SMB"] },
   "questions": [
     { "q": "Are both the segment split and the six-quarter trend on the slide?", "must": true },
     { "q": "Does the title connect the two (for example, NRR rising overall while SMB stays below 100%)?", "must": true } ] },
 { "id": "s05", "group": "stress", "style": "consulting",
   "prompt": "the numbers are in pilot-stores.csv, make the board slide on why Leeds underperforms",
   "gold": "table", "acceptable": [], "ask": false, "files": ["pilot-stores.csv"],
   "facts": { "numbers": ["4.1", "31", "3.8"], "names": ["Leeds", "York", "Hull", "Bradford"] },
   "questions": [
     { "q": "Is Leeds highlighted?", "must": true },
     { "q": "Does the title say Leeds underperforms on labour and shrink despite the best sales?", "must": true },
     { "q": "Did the agent leave out columns that don't serve the point (such as the opening year)?", "must": false } ] },
 { "id": "n01", "group": "near-miss", "style": "consulting",
   "prompt": "Revenue trend for the FinBridge board. Monthly card spend processed (£m): Jan 18, Feb 19, Mar 22, Apr 21, May 26, Jun 31, Jul 30, Aug 36. Need to explain the June jump (Xero integration launch) and the July dip (seasonality).",
   "gold": "chart", "acceptable": [], "ask": false, "files": [],
   "facts": { "numbers": ["18", "19", "22", "21", "26", "31", "30", "36"], "names": [] },
   "questions": [
     { "q": "Does the slide call out the June jump and say it was the Xero integration launch?", "must": true },
     { "q": "Does it explain the July dip as seasonality?", "must": true } ] },
 { "id": "n02", "group": "near-miss", "style": "consulting",
   "prompt": "I need to convince the board the addressable market is big enough: UK SMEs with 10-249 employees put £84bn a year through business cards. That's the point of the slide.",
   "gold": "number", "acceptable": [], "ask": false, "files": [],
   "facts": { "numbers": ["£84bn"], "names": [] },
   "questions": [
     { "q": "Is £84bn the one big figure the slide is built around?", "must": true },
     { "q": "Does the slide say who the market is (UK SMEs with 10–249 employees)?", "must": true } ] },
 { "id": "n03", "group": "near-miss", "style": "consulting",
   "prompt": "Our rollout plan for the self-checkout tills: pilot in 3 stores in January, fix what we learn in February and March, roll out to 40 stores by June, then all 120 stores by December.",
   "gold": "steps", "acceptable": ["chart"], "ask": false, "files": [],
   "facts": { "numbers": ["3", "40", "120"], "names": [] },
   "questions": [
     { "q": "Are the phases in time order with their months?", "must": true },
     { "q": "Does the title say where the plan ends (all 120 stores by December)?", "must": false } ] },
 { "id": "n04", "group": "near-miss", "style": "consulting",
   "prompt": "Before and after the new onboarding: before, setup took 3 weeks, needed an engineer, and 40% dropped off; after, it takes 2 days, it's self-serve, and 12% drop off.",
   "gold": "cards", "acceptable": [], "ask": false, "files": [],
   "facts": { "numbers": ["3", "40%", "2", "12%"], "names": [] },
   "questions": [
     { "q": "Is it a before-and-after contrast with 'after' as the emphasised side?", "must": true },
     { "q": "Does the title state the improvement?", "must": true } ] },
 { "id": "n05", "group": "near-miss", "style": "consulting",
   "prompt": "Market share of UK SME card issuers in 2025: Amex 31%, Barclaycard 22%, Lloyds 14%, Capital on Tap 9%, others 24%. We want to show how concentrated it is.",
   "gold": "chart", "acceptable": [], "ask": false, "files": [],
   "facts": { "numbers": ["31%", "22%", "14%", "9%", "24%"], "names": ["Amex", "Barclaycard", "Lloyds", "Capital on Tap"] },
   "questions": [
     { "q": "Are the issuers ordered by share, largest first?", "must": true },
     { "q": "Does the title say how concentrated the market is (for example, the top two hold over half)?", "must": true } ] },
 { "id": "n06", "group": "near-miss", "style": "consulting",
   "prompt": "Show the UK SME card market growing (2022 £61bn, 2023 £68bn, 2024 £76bn, 2025 £84bn) and our share of it rising (0.1%, 0.4%, 1.1%, 2.3%).",
   "gold": "pair", "acceptable": ["chart"], "ask": false, "files": [],
   "facts": { "numbers": ["£61bn", "£68bn", "£76bn", "£84bn", "0.1%", "0.4%", "1.1%", "2.3%"], "names": [] },
   "questions": [
     { "q": "Are the market size and our share shown as two separate measures, not on one axis?", "must": true },
     { "q": "Does the title connect the growing market with our rising share?", "must": true } ] },
 { "id": "q01", "group": "ask", "style": "consulting",
   "prompt": "make a slide comparing us to competitors",
   "gold": null, "acceptable": [], "ask": true, "files": [],
   "facts": { "numbers": [], "names": [] }, "questions": [] },
 { "id": "q02", "group": "ask", "style": "pitch",
   "prompt": "can you do the table slide for the deck",
   "gold": null, "acceptable": [], "ask": true, "files": [],
   "facts": { "numbers": [], "names": [] }, "questions": [] }
]
```

- [ ] **Step 5: Run the tests and make sure they pass**

Run: `npx vitest run tests/unit/mcp-eval/cases.test.ts`
Expected: PASS (26 tests). If a fact fails "is not in the request", fix the case's facts (the prompt is the source of truth), never the matcher.

- [ ] **Step 6: Commit**

```bash
git add tests/mcp-eval/cases.json tests/mcp-eval/files tests/unit/mcp-eval/cases.test.ts
git commit -m "MCP eval: 25 cases (tables, stress, near-misses, ask) with an honesty test"
```

---

### Task 4: The judge: expectations, and what confused the agent

**Files:**
- Create: `tests/mcp-eval/judge.ts`
- Test: `tests/unit/mcp-eval/judge.test.ts`

No engine change. Jev's J-check verdicts are in the transcript (the `check_slide` results), and the judge reads them there with every other tool result.

**Interfaces:**
- Consumes: `Case`, `Transcript`, `Verdict`, `SOURCES` (types).
- Produces:
  - `interface Schema { type: string; additionalProperties?: boolean; required?: string[]; properties?: Record<string, Schema>; items?: Schema; enum?: string[]; minItems?: number; maxItems?: number }`
  - `genericQuestions(style: Style): { id: string; q: string }[]`
  - `judgeSchema(generic: number, questions: number): Schema`
  - `transcriptText(t: Transcript): string`
  - `judgePrompt(input: JudgeInput): string`, with `interface JudgeInput { c: Case; request: string; t: Transcript; slide: Slide; style: Style; lints: string[]; unknown: string[] }`

- [ ] **Step 1: Add the verdict's diagnosis to the shapes**

In `tests/mcp-eval/types.ts`, replace the `Verdict` interface with:

```ts
/** Where the text that misled the agent lives, so the report says what to fix. */
export const SOURCES = ['server instructions', 'tool description', 'template card', 'guide', 'tool result', 'none'] as const
export interface Verdict {
  generic: { id: string; yes: boolean; why: string }[]
  case: { q: string; yes: boolean; why: string }[]
  numbers: { value: string; kind: 'derived' | 'invented'; why: string }[]
  magic: { presentAsIs: boolean; fix: string }
  confusedBy: { mismatch: string; quote: string; source: (typeof SOURCES)[number]; why: string; fix: string }[]
}
```

- [ ] **Step 2: Write the failing test**

`tests/unit/mcp-eval/judge.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import starters from '@/engine/starters/starters.json'
import type { Slide } from '@/engine/types'
import { genericQuestions, judgePrompt, judgeSchema, transcriptText } from '../../mcp-eval/judge'
import type { Case, Transcript } from '../../mcp-eval/types'

const scoring = starters.find((x) => x.id === 'scoring')?.consulting as unknown as Slide
const c: Case = { id: 't', group: 'criteria', style: 'consulting', prompt: 'p', gold: 'table', acceptable: [], ask: false, files: [], facts: { numbers: [], names: [] },
  questions: [{ q: 'Is Acme highlighted?', must: true }, { q: 'Are marks used?', must: false }] }
const t: Transcript = { init: null, finalText: 'REPLY', outcome: null, calls: [
  { name: 'mcp__smartchart__create_slide', input: { slide: { title: 'x' } }, result: '{"issues":["title: too long"]}', isError: false },
  { name: 'mcp__smartchart__check_slide', input: {}, result: '{"checks":[{"id":"J9","ok":false,"msg":"Judgements in words may read faster as marks"}]}', isError: false },
] }

describe('judge', () => {
  it('generic questions: the so-what title in consulting only, the body proving it in both', () => {
    expect(genericQuestions('consulting').map((g) => g.id)).toEqual(['G1', 'G2'])
    expect(genericQuestions('pitch').map((g) => g.id)).toEqual(['G2'])
  })
  it('schema: exact counts, the sources enum for what confused the agent', () => {
    const s = judgeSchema(2, 3)
    expect([s.properties?.generic.minItems, s.properties?.case.maxItems]).toEqual([2, 3])
    expect(s.properties?.confusedBy.items?.properties?.source.enum).toContain('template card')
  })
  it('the transcript shows every call with SmartChart’s issues and Jev’s verdicts, then the reply', () => {
    const x = transcriptText(t)
    for (const s of ['1. create_slide', 'title: too long', '2. check_slide', 'J9', 'REPLY']) expect(x).toContain(s)
  })
  it('the prompt carries the screenshot, request, transcript, lints, every question and the figures to classify', () => {
    const p = judgePrompt({ c, request: 'REQ', t, slide: scoring, style: 'consulting', lints: ['table: L1'], unknown: ['£3,000'] })
    for (const s of ['slide.png', 'REQ', 'title: too long', 'table: L1', 'G1.', '1. Is Acme highlighted?', '2. Are marks used?', '£3,000', 'confusedBy']) expect(p).toContain(s)
  })
})
```

- [ ] **Step 3: Run it to make sure it fails**

Run: `npx vitest run tests/unit/mcp-eval/judge.test.ts`
Expected: FAIL, cannot resolve `../../mcp-eval/judge`.

- [ ] **Step 4: Implement `judge.ts`**

`tests/mcp-eval/judge.ts`:

```ts
// The judge (spec §4): did the slide meet the case's expectations, and when not, what in SmartChart's text confused the
// agent. It reads the whole transcript, so SmartChart's own feedback (write issues, check_slide's verdicts) is evidence.
import type { Slide, Style } from '@/engine/types'
import { SOURCES, type Case, type Transcript } from './types'

export interface Schema { type: string; additionalProperties?: boolean; required?: string[]; properties?: Record<string, Schema>; items?: Schema; enum?: string[]; minItems?: number; maxItems?: number }
const str: Schema = { type: 'string' }, yes: Schema = { type: 'boolean' }
const obj = (properties: Record<string, Schema>): Schema => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties })
const list = (items: Schema, n?: number): Schema => ({ type: 'array', items, ...(n === undefined ? {} : { minItems: n, maxItems: n }) })

/** Asked of every slide: a consulting title states the so-what; the body proves the title. */
export const genericQuestions = (style: Style): { id: string; q: string }[] => [
  ...(style === 'consulting' ? [{ id: 'G1', q: 'Does the title state a so-what (a conclusion the reader should take away), not a topic label?' }] : []),
  { id: 'G2', q: 'Does the body (the table, chart, cards or steps, and any notes) prove what the title and subtitle claim?' },
]

export const judgeSchema = (generic: number, questions: number): Schema => obj({
  generic: list(obj({ id: str, yes, why: str }), generic),
  case: list(obj({ q: str, yes, why: str }), questions),
  numbers: list(obj({ value: str, kind: { type: 'string', enum: ['derived', 'invented'] }, why: str })),
  magic: obj({ presentAsIs: yes, fix: str }),
  confusedBy: list(obj({ mismatch: str, quote: str, source: { type: 'string', enum: [...SOURCES] }, why: str, fix: str })),
})

const tool = (name: string) => name.replace(/^mcp__smartchart__/, '')
/** Every call in order, with what SmartChart answered (long results trimmed), then the reply to the user. */
export const transcriptText = (t: Transcript): string => [
  ...t.calls.map((x, i) => `${i + 1}. ${tool(x.name)} ${JSON.stringify(x.input).slice(0, 1500)}\n   → ${x.isError ? 'ERROR ' : ''}${x.result.slice(0, 3000)}`),
  `Reply to the user:\n${t.finalText}`,
].join('\n')

export interface JudgeInput { c: Case; request: string; t: Transcript; slide: Slide; style: Style; lints: string[]; unknown: string[] }
export function judgePrompt({ c, request, t, slide, style, lints, unknown }: JudgeInput): string {
  const generic = genericQuestions(style)
  return [
    'You are judging one slide an AI agent made in SmartChart for a first-time user, and diagnosing what in SmartChart led the agent wrong. Be strict and concrete: the user will present the slide to a board or to investors without checking it closely.',
    'First Read slide.png in this folder: the slide as rendered at 1920×1080. Judge what the reader sees; use the JSON only to read values exactly.',
    `Deck style: ${style}.`,
    `The user's request:\n<<<\n${request}\n>>>`,
    `What the agent did (SmartChart tool calls and answers, including its issues, warnings and check_slide verdicts), then its reply:\n<<<\n${transcriptText(t)}\n>>>`,
    `Final slide JSON:\n${JSON.stringify(slide)}`,
    `Measured on the rendered slide: ${lints.length ? lints.join('; ') : 'no fit issues or layout lints'}.`,
    `Answer "generic" in this order, copying each id:\n${generic.map((g) => `${g.id}. ${g.q}`).join('\n')}`,
    c.questions.length ? `Answer "case" in this order, copying each question into q:\n${c.questions.map((q, i) => `${i + 1}. ${q.q}`).join('\n')}` : 'Answer "case" with an empty list.',
    unknown.length
      ? `Answer "numbers" for each of these figures on the slide that the request does not state, in this order: ${unknown.join(', ')}. "derived" if it follows from the request (a sum, share or difference of its figures, or a count or year it implies); "invented" if not.`
      : 'Answer "numbers" with an empty list.',
    'Answer "magic": would a first-time user present this slide unchanged? If not, the one thing they would fix first.',
    'Answer "confusedBy": for every "no" above, every invented figure and every SmartChart issue the agent left unfixed, find in the transcript the text that led the agent there: a server instruction, a tool description, a template card or the guide (from get_guide or get_template results), or a tool result it misread or ignored. Quote it exactly, name its source, say why it misled, and propose the smallest fix to that text. Use source "none" when the agent simply erred against clear guidance, and say which guidance. An empty list when nothing went wrong.',
  ].join('\n\n')
}
```

- [ ] **Step 5: Run the tests and make sure they pass**

Run: `npx vitest run tests/unit/mcp-eval/judge.test.ts`
Expected: PASS (4 tests).

Run: `npx tsc -b && npx eslint tests/mcp-eval tests/unit/mcp-eval`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add tests/mcp-eval/types.ts tests/mcp-eval/judge.ts tests/unit/mcp-eval/judge.test.ts
git commit -m "MCP eval: judge reads the transcript and names what confused the agent"
```

---

### Task 5: Scores and the report

**Files:**
- Create: `tests/mcp-eval/scores.ts`
- Create: `tests/mcp-eval/report.ts`
- Test: `tests/unit/mcp-eval/scores.test.ts`

**Interfaces:**
- Consumes: `Case`, `Check`, `Run` (types); `genericQuestions` (judge).
- Produces:
  - `scores.ts`:
    - `allChecks(r: Run, c: Case): Check[]`
    - `gates(k: Check): boolean`
    - `isFatal(k: Check): boolean`
    - `isMagic(r: Run, c: Case, checks?: Check[]): boolean`
    - `interface Rate { n: number; of: number }`
    - `interface Summary { done; limited; errors; judged: number; magic: Rate; fatal: Rate; checks, groups, cases: Record<string, Rate>; versions, judges: string[] }`
    - `summarize(runs: Run[], cases: Case[]): Summary`
  - `report.ts`:
    - `reportMd(label: string, s: Summary, runs: Run[], cases: Case[], base?: { label: string; s: Summary }): string`
    - `galleryHtml(label: string, runs: Run[], cases: Case[], shot: (png: string) => string): string`

- [ ] **Step 1: Write the failing test**

`tests/unit/mcp-eval/scores.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import starters from '@/engine/starters/starters.json'
import type { Slide } from '@/engine/types'
import { galleryHtml, reportMd } from '../../mcp-eval/report'
import { allChecks, isMagic, summarize } from '../../mcp-eval/scores'
import type { Case, Run, Verdict } from '../../mcp-eval/types'

const scoring = starters.find((x) => x.id === 'scoring')?.consulting as unknown as Slide
const c: Case = { id: 't01', group: 'criteria', style: 'consulting', prompt: 'p', gold: 'table', acceptable: [], ask: false, files: [], facts: { numbers: [], names: [] },
  questions: [{ q: 'Is Acme highlighted?', must: true }, { q: 'Nice icons?', must: false }] }
const ask: Case = { ...c, id: 'q01', group: 'ask', gold: null, ask: true, questions: [] }
const passing = ['S1', 'S2', 'S3', 'S4', 'F1', 'F2', 'R1', 'R2', 'R3', 'P1'].map((id) => ({ id, ok: true, msg: '' }))
const verdict = (over: Partial<Verdict> = {}): Verdict => ({
  generic: [{ id: 'G1', yes: true, why: '' }, { id: 'G2', yes: true, why: '' }],
  case: [{ q: 'Is Acme highlighted?', yes: true, why: '' }, { q: 'Nice icons?', yes: false, why: 'decorative' }],
  numbers: [], magic: { presentAsIs: false, fix: 'shorter title' },
  confusedBy: [{ mismatch: 'Nice icons? no', quote: 'Header icons: columns that are categories', source: 'template card', why: 'read as decoration', fix: 'say: not over entities' }], ...over })
const run = (over: Partial<Run> = {}): Run => ({ id: 't01#1', caseId: 't01', n: 1, status: 'done', transcript: null,
  deck: { id: 'd', style: 'consulting', edit: 'e', slides: [{ id: 's1', slide: scoring }] }, measured: [], checks: passing, unknownFigures: [], verdict: verdict(), judgeModel: 'opus', ...over })

describe('scores', () => {
  it('magic: gating checks and must questions pass; a failed non-must question and M1 do not block it', () => {
    expect(isMagic(run(), c)).toBe(true)
  })
  it('a failed must question blocks magic', () => {
    expect(isMagic(run({ verdict: verdict({ case: [{ q: 'x', yes: false, why: 'no' }, { q: 'y', yes: true, why: '' }] }) }), c)).toBe(false)
  })
  it('an unjudged slide is not magic yet; an ask case needs no judge', () => {
    expect(isMagic(run({ verdict: undefined }), c)).toBe(false)
    expect(isMagic(run({ caseId: 'q01', deck: null, verdict: undefined, checks: [{ id: 'S2', ok: true, msg: '' }, { id: 'S3', ok: true, msg: '' }] }), ask)).toBe(true)
  })
  it('an invented figure fails F3 and is fatal; derived ones pass', () => {
    const invented = allChecks(run({ unknownFigures: ['£3,000'], verdict: verdict({ numbers: [{ value: '£3,000', kind: 'invented', why: 'not in the request' }] }) }), c)
    expect(invented.find((k) => k.id === 'F3')?.ok).toBe(false)
    const derived = allChecks(run({ unknownFigures: ['£1.2m'], verdict: verdict({ numbers: [{ value: '£1.2m', kind: 'derived', why: 'sum' }] }) }), c)
    expect(derived.find((k) => k.id === 'F3')?.ok).toBe(true)
  })
  it('summary: rates by check, group and case; limited and errors apart; runs of removed cases ignored', () => {
    const s = summarize([run(), run({ id: 't01#2', n: 2, verdict: undefined }), run({ id: 't01#3', status: 'limited' }), run({ id: 'gone#1', caseId: 'gone' })], [c])
    expect([s.done, s.limited, s.judged, s.magic]).toEqual([2, 1, 1, { n: 1, of: 2 }])
    expect(s.cases.t01).toEqual({ n: 1, of: 2 })
    expect(s.checks.Q1).toEqual({ n: 1, of: 1 })
  })
  it('a failed generic question blocks magic', () => {
    expect(isMagic(run({ verdict: verdict({ generic: [{ id: 'G1', yes: false, why: 'topic label' }, { id: 'G2', yes: true, why: '' }] }) }), c)).toBe(false)
  })
  it('report: headline, deltas against a baseline, failures listed, confusions grouped by source; gallery escapes text', () => {
    const runs = [run()], s = summarize(runs, [c]), base = { ...s, magic: { n: 0, of: 2 } }
    const md = reportMd('abc-2026-10-03', s, runs, [c], { label: 'old', s: base })
    expect(md).toContain('| Magic rate | 100% (1/1) | +100 |')
    expect(md).toContain('Q2')
    expect(md).toContain('### template card')
    expect(md).toContain('Header icons: columns that are categories')
    expect(galleryHtml('x', [run({ transcript: { init: null, calls: [], finalText: '<b>', outcome: null } })], [c], (p) => p)).toContain('&lt;b&gt;')
  })
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run tests/unit/mcp-eval/scores.test.ts`
Expected: FAIL, cannot resolve `../../mcp-eval/report`.

- [ ] **Step 3: Implement `scores.ts`**

`tests/mcp-eval/scores.ts`:

```ts
// Scores (spec §5): a run's checks with the judge's verdict folded in, the magic bar, and the summary a report compares.
import type { Case, Check, Run } from './types'

const FATAL = new Set(['F1', 'F2', 'F3', 'R1'])
const GATES = new Set(['S1', 'S2', 'S3', 'F1', 'F2', 'F3', 'R1', 'R3', 'G1', 'G2'])
export const gates = (k: Check): boolean => GATES.has(k.id) || !!k.must
export const isFatal = (k: Check): boolean => FATAL.has(k.id) && !k.ok

/** The slide the case is about: the first that is not a cover or a section divider. */
export const contentSlide = (r: Run) => r.deck?.slides.find((s) => s.slide.template !== 'cover' && s.slide.template !== 'section') ?? r.deck?.slides[0]

/** The code checks, then what the judge decided: F3, the generic questions (G1, G2), the case questions (Q1…) and M1. */
export function allChecks(r: Run, c: Case): Check[] {
  const out = [...r.checks], v = r.verdict, slide = contentSlide(r)?.slide
  if (!slide || !r.deck) return out
  if (!r.unknownFigures.length) out.push({ id: 'F3', ok: true, msg: 'No figures beyond the request' })
  if (!v) return out
  if (r.unknownFigures.length) {
    const made = v.numbers.filter((x) => x.kind === 'invented')
    out.push({ id: 'F3', ok: !made.length, msg: made.length ? `Invented: ${made.map((x) => `${x.value} (${x.why})`).join('; ')}` : `Derived: ${r.unknownFigures.join(', ')}` })
  }
  for (const g of v.generic) out.push({ id: g.id, ok: g.yes, msg: g.why })
  v.case.forEach((a, i) => out.push({ id: `Q${i + 1}`, ok: a.yes, msg: `${c.questions[i]?.q ?? a.q} ${a.why}`, must: c.questions[i]?.must ?? false }))
  out.push({ id: 'M1', ok: v.magic.presentAsIs, msg: v.magic.presentAsIs ? 'Would present it as is' : v.magic.fix })
  return out
}

/** Magic: every gating check passed, and the judge has seen the slide (ask cases have none to see). */
export const isMagic = (r: Run, c: Case, checks = allChecks(r, c)): boolean => (c.ask || !!r.verdict) && checks.filter(gates).every((k) => k.ok)

export interface Rate { n: number; of: number }
export interface Summary {
  done: number; limited: number; errors: number; judged: number
  magic: Rate; fatal: Rate; checks: Record<string, Rate>; groups: Record<string, Rate>; cases: Record<string, Rate>
  versions: string[]; judges: string[]
}
const bump = (m: Record<string, Rate>, k: string, hit: boolean) => { const r = (m[k] ??= { n: 0, of: 0 }); r.of++; if (hit) r.n++ }

/** Rates over finished runs of the given cases; `fatal.n` counts runs with any fatal failure. */
export function summarize(runs: Run[], cases: Case[]): Summary {
  const byId = new Map(cases.map((c) => [c.id, c])), versions = new Set<string>(), judges = new Set<string>()
  const s: Summary = { done: 0, limited: 0, errors: 0, judged: 0, magic: { n: 0, of: 0 }, fatal: { n: 0, of: 0 }, checks: {}, groups: {}, cases: {}, versions: [], judges: [] }
  for (const r of runs) {
    const c = byId.get(r.caseId)
    if (!c) continue
    if (r.status === 'limited') { s.limited++; continue }
    if (r.status === 'error') { s.errors++; continue }
    s.done++
    if (r.verdict) s.judged++
    const ks = allChecks(r, c), magic = isMagic(r, c, ks)
    s.magic.of++; if (magic) s.magic.n++
    s.fatal.of++; if (ks.some(isFatal)) s.fatal.n++
    for (const k of ks) bump(s.checks, k.id, k.ok)
    bump(s.groups, c.group, magic)
    bump(s.cases, c.id, magic)
    if (r.transcript?.init) versions.add(`Claude Code ${r.transcript.init.version}, ${r.transcript.init.model}`)
    if (r.judgeModel) judges.add(r.judgeModel)
  }
  return { ...s, versions: [...versions], judges: [...judges] }
}
```

- [ ] **Step 4: Implement `report.ts`**

`tests/mcp-eval/report.ts`:

```ts
// The report (markdown, for reading and committing as a baseline) and the gallery (every slide at full size).
import { allChecks, gates, isFatal, isMagic, type Rate, type Summary } from './scores'
import type { Case, Run } from './types'

const pct = (r: Rate | undefined) => (r && r.of ? Math.round((100 * r.n) / r.of) : null)
const cell = (r: Rate | undefined) => { const p = pct(r); return p === null || !r ? '–' : `${p}% (${r.n}/${r.of})` }
const delta = (a: Rate | undefined, b: Rate | undefined) => { const x = pct(a), y = pct(b); return x === null || y === null ? '' : `${x > y ? '+' : ''}${x - y}` }
const byCheck = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true })

export function reportMd(label: string, s: Summary, runs: Run[], cases: Case[], base?: { label: string; s: Summary }): string {
  const byId = new Map(cases.map((c) => [c.id, c])), vs = base ? ` | vs ${base.label} (points)` : '', sep = base ? '|---|---|---|' : '|---|---|'
  const row = (name: string, a: Rate | undefined, b?: Rate) => `| ${name} | ${cell(a)}${base ? ` | ${delta(a, b)}` : ''} |`
  const review = runs.flatMap((r) => {
    const c = byId.get(r.caseId)
    if (!c) return []
    if (r.status !== 'done') return [`### ${r.id}: ${r.status}`, r.error ?? '', '']
    const ks = allChecks(r, c), failed = ks.filter((k) => !k.ok)
    if (!failed.length) return []
    return [`### ${r.id}${isMagic(r, c, ks) ? ' (magic)' : ''}${ks.some(isFatal) ? ' · fatal' : ''}`, ...failed.map((k) => `- ${gates(k) ? `**${k.id}**` : k.id}: ${k.msg}`), '']
  })
  return [
    `# MCP slide eval: ${label}`, '',
    `${s.versions.join('; ') || 'No agent runs'}. Judge: ${s.judges.join(', ') || 'none yet'}. ${s.done} runs done (${s.judged} judged), ${s.limited} limited, ${s.errors} errors.`,
    ...(base && base.s.versions.join() !== s.versions.join() ? ['', `Note: the baseline ran on ${base.s.versions.join('; ')}. Differences may come from Claude Code, not SmartChart.`] : []),
    '', `| Measure | Result${vs} |`, sep, row('Magic rate', s.magic, base?.s.magic), row('Fatal rate', s.fatal, base?.s.fatal),
    '', '## By group', '', `| Group | Magic${vs} |`, sep, ...Object.keys(s.groups).map((g) => row(g, s.groups[g], base?.s.groups[g])),
    '', '## Per check', '', `| Check | Pass${vs} |`, sep, ...Object.keys(s.checks).sort(byCheck).map((k) => row(k, s.checks[k], base?.s.checks[k])),
    '', '## Runs at magic, per case', '', Object.entries(s.cases).map(([id, r]) => `${id} ${r.n}/${r.of}`).join(' · '),
    '', '## What confused the agent, by where to fix it', '', ...confusions(runs),
    '', '## For review', '', ...review,
  ].join('\n')
}

/** The judge's diagnoses grouped by source: the fix list. */
function confusions(runs: Run[]): string[] {
  const by = new Map<string, string[]>()
  for (const r of runs) for (const x of r.verdict?.confusedBy ?? [])
    by.set(x.source, [...(by.get(x.source) ?? []), `- **${r.id}** ${x.mismatch}. “${x.quote}”: ${x.why} Fix: ${x.fix}`])
  return by.size ? [...by].flatMap(([source, items]) => [`### ${source}`, '', ...items, '']) : ['Nothing.']
}

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch] ?? ch)
export function galleryHtml(label: string, runs: Run[], cases: Case[], shot: (png: string) => string): string {
  const byId = new Map(cases.map((c) => [c.id, c]))
  const items = runs.flatMap((r) => {
    const c = byId.get(r.caseId)
    if (!c || r.status !== 'done') return []
    const ks = allChecks(r, c), magic = isMagic(r, c, ks), failed = ks.filter((k) => !k.ok)
    const imgs = r.measured.map((m) => `<img src="${esc(shot(m.png))}" alt="${esc(r.id)}">`).join('')
    return [`<section class="${magic ? 'magic' : 'miss'}"><h2>${esc(r.id)} ${magic ? '✓ magic' : '✗'}</h2><p class="req">${esc(c.prompt)}</p>${imgs || '<p>No slide.</p>'}<p class="reply">${esc(r.transcript?.finalText ?? '')}</p><ul>${failed.map((k) => `<li><b>${esc(k.id)}</b> ${esc(k.msg)}</li>`).join('')}</ul></section>`]
  })
  return `<!doctype html><html><head><meta charset="utf-8"><title>MCP eval ${esc(label)}</title><style>
body{font:15px/1.5 system-ui,sans-serif;margin:24px;background:#fff;color:#111}section{margin:0 0 48px}img{display:block;width:100%;max-width:1920px;border:1px solid #ddd}
.req,.reply{color:#555;white-space:pre-wrap}body.only-miss .magic{display:none}</style></head><body>
<h1>MCP eval ${esc(label)}</h1><label><input type="checkbox" onchange="document.body.classList.toggle('only-miss',this.checked)"> Only runs short of magic</label>
${items.join('\n')}</body></html>`
}
```

- [ ] **Step 5: Run the tests and make sure they pass**

Run: `npx vitest run tests/unit/mcp-eval/scores.test.ts`
Expected: PASS (7 tests).

Run: `npx tsc -b && npx eslint tests/mcp-eval tests/unit/mcp-eval`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add tests/mcp-eval/scores.ts tests/mcp-eval/report.ts tests/unit/mcp-eval/scores.test.ts
git commit -m "MCP eval: magic bar, summary, report with baseline deltas, gallery"
```

---

### Task 6: Measuring on the lint fixture, and the account

**Files:**
- Create: `tests/mcp-eval/measure.ts`
- Create: `tests/mcp-eval/account.ts`
- Test: `tests/browser/mcp-eval-measure.spec.ts`

**Interfaces:**
- Consumes: `window.lint` and `LintResult` from `src/dev/fixture.ts`; `docFromData` from `@/engine/tools/doc`; `Deck` and `Measured` from types.
- Produces:
  - `measure.ts`:
    - `interface Measurer { measure(slideId: string, slide: Slide, style: Style, png: string): Promise<Measured>; close(): Promise<void> }`
    - `openMeasurer(app: string): Promise<Measurer>`
  - `account.ts`:
    - `interface Account { origin: string; key: string }`
    - `emptyAccount(a): Promise<void>`
    - `readOnlyDeck(a): Promise<Deck | null>`

- [ ] **Step 1: Write the failing browser test**

`tests/browser/mcp-eval-measure.spec.ts`:

```ts
/* The eval measures slides on the same fixture the lint tests use: a gallery table is clean, an overlong title is flagged. */
import { expect, test } from '@playwright/test'
import starters from '../../src/engine/starters/starters.json'
import type { Slide } from '../../src/engine/types'
import { openMeasurer } from '../mcp-eval/measure'

test('measures a gallery table clean and flags an overlong title', async ({ baseURL }, info) => {
  const scoring = starters.find((x) => x.id === 'scoring')?.consulting as unknown as Slide
  const m = await openMeasurer(String(baseURL))
  try {
    const ok = await m.measure('s1', scoring, 'consulting', info.outputPath('ok.png'))
    expect([...ok.fit, ...ok.issues]).toEqual([])
    const bad = await m.measure('s2', { ...scoring, title: 'An action title that runs on and on '.repeat(6) }, 'consulting', info.outputPath('bad.png'))
    expect(bad.fit.some((f) => f.startsWith('title wraps'))).toBe(true)
  } finally { await m.close() }
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx playwright test -c tests/browser/playwright.config.ts mcp-eval-measure`
Expected: FAIL, cannot resolve `../mcp-eval/measure`.

- [ ] **Step 3: Implement `measure.ts`**

`tests/mcp-eval/measure.ts`:

```ts
// Rendering and lints are the existing dev fixture's (src/dev/fixture.html): the same fit issues and layout lints the
// app reports, at 1920×1080, plus a PNG for the judge and the gallery. One page, one slide at a time.
import { chromium } from '@playwright/test'
import type { LintResult } from '@/dev/fixture'
import type { Slide, Style } from '@/engine/types'
import type { Measured } from './types'

export interface Measurer { measure(slideId: string, slide: Slide, style: Style, png: string): Promise<Measured>; close(): Promise<void> }

export async function openMeasurer(app: string): Promise<Measurer> {
  const browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  await page.goto(`${app}/src/dev/fixture.html`)
  await page.waitForFunction(() => window.ready)
  let queue: Promise<unknown> = Promise.resolve()
  const one = async (slideId: string, slide: Slide, style: Style, png: string): Promise<Measured> => {
    const r = await page.evaluate(([s, st]) => (window.lint as (s: Slide, st: Style) => Promise<LintResult>)(s, st), [slide, style] as const)
    await page.locator('#frame').screenshot({ path: png })
    return { slideId, fit: r.fit, issues: r.issues, warnings: r.warnings, png }
  }
  return {
    measure: (slideId, slide, style, png) => { const p = queue.then(() => one(slideId, slide, style, png)); queue = p.catch(() => undefined); return p },
    close: () => browser.close(),
  }
}
```

- [ ] **Step 4: Run the browser test and make sure it passes**

Run: `npx playwright test -c tests/browser/playwright.config.ts mcp-eval-measure`
Expected: PASS.

- [ ] **Step 5: Implement `account.ts`**

`tests/mcp-eval/account.ts`:

```ts
// The test account behind one agent key, through the app's own decks API: the calls the app itself makes.
import { docFromData } from '@/engine/tools/doc'
import type { Deck } from './types'

export interface Account { origin: string; key: string }
const auth = (a: Account) => ({ Authorization: `Bearer ${a.key}` })
async function ok(r: Response, what: string): Promise<Response> {
  if (!r.ok) throw new Error(`${what}: ${r.status} ${(await r.text()).slice(0, 200)}`)
  return r
}
const deckIds = async (a: Account): Promise<string[]> =>
  ((await (await ok(await fetch(`${a.origin}/api/decks`, { headers: auth(a) }), 'GET /api/decks')).json()) as { id: string }[]).map((d) => d.id)

/** Every run starts as a new user: no decks. */
export async function emptyAccount(a: Account): Promise<void> {
  for (const id of await deckIds(a)) await ok(await fetch(`${a.origin}/api/decks?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: auth(a) }), `DELETE deck ${id}`)
}

/** The deck the run made (the newest; none when the agent only asked). */
export async function readOnlyDeck(a: Account): Promise<Deck | null> {
  const [id] = await deckIds(a)
  if (!id) return null
  const row = (await (await ok(await fetch(`${a.origin}/api/decks?id=${encodeURIComponent(id)}`, { headers: auth(a) }), `GET deck ${id}`)).json()) as { id: string; name: string; data: unknown }
  const doc = docFromData(row.id, row.name, row.data)
  return { id: doc.id, style: doc.style, edit: `${a.origin}/d/${doc.id}`, slides: doc.slides.map((s) => ({ id: s.id, slide: s.slide })) }
}
```

Run: `npx tsc -b && npx eslint tests/mcp-eval tests/browser/mcp-eval-measure.spec.ts`
Expected: no errors. `account.ts` is exercised for real in Task 7.

- [ ] **Step 6: Commit**

```bash
git add tests/mcp-eval/measure.ts tests/mcp-eval/account.ts tests/browser/mcp-eval-measure.spec.ts
git commit -m "MCP eval: measure on the lint fixture, test account through /api/decks"
```

---

### Task 7: The command, the README and the first runs

**Files:**
- Create: `tests/mcp-eval/eval.ts`
- Create: `tests/mcp-eval/README.md`
- Create (after the full run): `tests/mcp-eval/baselines/<label>.json` and `<label>.md`

**Interfaces:**
- Consumes everything above.

**Prerequisite (the user does this; the agent never makes accounts or handles keys):**
1. With `npm run dev` running against the database the user chose, the user signs up one or two test accounts used only for the eval. Under Agent keys, they make a key for each.
2. They add `SMARTCHART_EVAL_KEYS=<key1>,<key2>` to `.env` in the checkout the eval runs from. A worktree has no `.env` of its own, so copy it or run from the main checkout. `npm run dev` must also run from a folder with `.env`: without `DATABASE_URL` it answers 503 on `/mcp/v1` and `/api/decks`.
3. `claude` is logged in with the subscription (`claude` → `/login`).

- [ ] **Step 1: Implement `eval.ts`**

`tests/mcp-eval/eval.ts`:

```ts
// The MCP slide eval, one command: run each case through Claude Code against the app's /mcp/v1, measure, judge, report.
// Spec: docs/superpowers/specs/2026-10-03-mcp-slide-eval-design.md. Usage: tests/mcp-eval/README.md.
import { execSync } from 'node:child_process'
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'
import { emptyAccount, readOnlyDeck, type Account } from './account'
import { choiceChecks, contentSlide, factChecks, renderChecks, requestText, wiringChecks } from './checks'
import { agentArgs, guardInit, isLimited, judgeArgs, parseStream, runClaude } from './claude'
import { genericQuestions, judgePrompt, judgeSchema } from './judge'
import { openMeasurer, type Measurer } from './measure'
import { galleryHtml, reportMd } from './report'
import { summarize, type Summary } from './scores'
import type { Case, Measured, Results, Run, Verdict } from './types'

const HERE = path.dirname(fileURLToPath(import.meta.url)), FILES = path.join(HERE, 'files'), BASELINES = path.join(HERE, 'baselines')
const arg: Record<string, string> = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--'))
  .map((a) => { const [k, ...v] = a.slice(2).split('='); return [k, v.join('=') || 'true'] }))
const git = (cmd: string) => { try { return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() } catch { return '' } }
const label = arg.label ?? `${git('git rev-parse --short HEAD') || 'nogit'}${git('git status --porcelain') ? '-dirty' : ''}-${new Date().toISOString().slice(0, 10)}`
const url = arg.url ?? 'http://localhost:5173/mcp/v1', app = arg.app ?? 'http://localhost:5173'
const OUT = path.join(HERE, 'out', label), RESULTS = path.join(OUT, 'results.json')
const cases = (JSON.parse(readFileSync(path.join(HERE, 'cases.json'), 'utf8')) as Case[])
  .filter((c) => !arg.only || arg.only.split(',').includes(c.id)).filter((c) => !arg.group || c.group === arg.group)
const results: Results = existsSync(RESULTS) ? (JSON.parse(readFileSync(RESULTS, 'utf8')) as Results) : {}
const save = () => writeFileSync(RESULTS, JSON.stringify(results, null, 1))
/** Stops the whole eval: the run would not be the user's experience on the subscription. */
class Stop extends Error {}

async function runCase(c: Case, i: number, account: Account, measurer: Measurer): Promise<Run> {
  const run: Run = { id: `${c.id}#${i}`, caseId: c.id, n: i, status: 'error', transcript: null, deck: null, measured: [], checks: [], unknownFigures: [] }
  try {
    await emptyAccount(account)
    const dir = mkdtempSync(path.join(tmpdir(), 'mcp-eval-')), work = path.join(dir, 'work'), config = path.join(dir, 'mcp.json')
    mkdirSync(work)
    for (const f of c.files) cpSync(path.join(FILES, f), path.join(work, f))
    writeFileSync(config, JSON.stringify({ mcpServers: { smartchart: { type: 'http', url, headers: { Authorization: `Bearer ${account.key}` } } } }))
    const out = await runClaude(agentArgs(arg.model ?? 'sonnet', config), c.prompt, work, 600_000)
    const t = parseStream(out.lines), bad = guardInit(t.init, ['smartchart'])
    if (bad) throw new Stop(bad)
    if (isLimited(t, out.stderr)) return { ...run, status: 'limited', transcript: t }
    if (!t.outcome) return { ...run, transcript: t, error: `Claude Code exited ${out.code}: ${out.stderr.slice(-300)}` }
    const deck = await readOnlyDeck(account), measured: Measured[] = []
    if (deck) for (const s of deck.slides) measured.push(await measurer.measure(s.id, s.slide, deck.style, path.join(OUT, 'shots', `${c.id}-${i}-${s.id}.png`)))
    const slide = contentSlide(deck)?.slide, facts = slide ? factChecks(c, slide, requestText(c, FILES)) : { checks: [], unknown: [] }
    return { ...run, status: 'done', transcript: t, deck, measured, unknownFigures: facts.unknown,
      checks: [...choiceChecks(c, t, deck), ...facts.checks, ...renderChecks(deck, measured), ...wiringChecks(c, t, deck)] }
  } catch (e) {
    if (e instanceof Stop) throw e
    return { ...run, error: e instanceof Error ? e.message : String(e) }
  }
}

async function judgeAll(model: string, workers: number): Promise<void> {
  const byId = new Map(cases.map((c) => [c.id, c]))
  const todo = Object.values(results).filter((r) => r.status === 'done' && !r.verdict && r.measured.length && byId.has(r.caseId))
  await Promise.all(Array.from({ length: workers }, async () => {
    for (let r = todo.shift(); r; r = todo.shift()) {
      const c = byId.get(r.caseId), deck = r.deck, target = contentSlide(r.deck), m = r.measured.find((x) => x.slideId === target?.id)
      if (!c || !deck || !target || !m || !r.transcript) continue
      const dir = mkdtempSync(path.join(tmpdir(), 'mcp-judge-'))
      copyFileSync(m.png, path.join(dir, 'slide.png'))
      const prompt = judgePrompt({ c, request: requestText(c, FILES), t: r.transcript, slide: target.slide, style: deck.style, lints: [...m.fit, ...m.issues], unknown: r.unknownFigures })
      const out = await runClaude(judgeArgs(model, judgeSchema(genericQuestions(deck.style).length, c.questions.length)), prompt, dir, 300_000)
      const t = parseStream(out.lines), bad = guardInit(t.init, [])
      if (bad) throw new Stop(bad)
      const v = t.outcome?.structured
      if (isLimited(t, out.stderr) || !v || typeof v !== 'object') { console.log(`judge ${r.id}: ${isLimited(t, out.stderr) ? 'limited' : 'no verdict'}`); continue }
      r.verdict = v as Verdict
      r.judgeModel = model
      save()
      console.log(`judge ${r.id}: done`)
    }
  }))
}

function loadSummary(l: string): Summary {
  for (const f of [path.join(BASELINES, `${l}.json`), path.join(HERE, 'out', l, 'summary.json')]) if (existsSync(f)) return JSON.parse(readFileSync(f, 'utf8')) as Summary
  throw new Error(`No summary for ${l} in baselines/ or out/`)
}

function writeReport(): void {
  const runs = Object.values(results).filter((r) => cases.some((c) => c.id === r.caseId)).sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }))
  const s = summarize(runs, cases), base = arg.against ? { label: arg.against, s: loadSummary(arg.against) } : undefined
  writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(s, null, 1))
  writeFileSync(path.join(OUT, 'report.md'), reportMd(label, s, runs, cases, base))
  writeFileSync(path.join(OUT, 'gallery.html'), galleryHtml(label, runs, cases, (png) => path.relative(OUT, png)))
  if (arg['save-baseline'] === 'true') {
    mkdirSync(BASELINES, { recursive: true })
    copyFileSync(path.join(OUT, 'summary.json'), path.join(BASELINES, `${label}.json`))
    copyFileSync(path.join(OUT, 'report.md'), path.join(BASELINES, `${label}.md`))
  }
  console.log(`Magic ${s.magic.n}/${s.magic.of}, fatal ${s.fatal.n}/${s.fatal.of}. Report: ${path.join(OUT, 'report.md')} · gallery: ${path.join(OUT, 'gallery.html')}`)
}

mkdirSync(path.join(OUT, 'shots'), { recursive: true })
if (arg['report-only'] !== 'true') {
  const keys = (loadEnv('', process.cwd(), '').SMARTCHART_EVAL_KEYS ?? '').split(',').map((k) => k.trim()).filter(Boolean)
  if (!keys.length) throw new Error('Set SMARTCHART_EVAL_KEYS in .env: agent keys of test accounts made for the eval (tests/mcp-eval/README.md).')
  const n = Number(arg.n ?? 3), origin = new URL(url).origin
  const todo = cases.flatMap((c) => Array.from({ length: n }, (_, i) => ({ c, i: i + 1 }))).filter(({ c, i }) => results[`${c.id}#${i}`]?.status !== 'done')
  const measurer = await openMeasurer(app)
  try {
    await Promise.all(keys.map(async (key) => {
      for (let job = todo.shift(); job; job = todo.shift()) {
        const r = await runCase(job.c, job.i, { origin, key }, measurer)
        results[r.id] = r
        save()
        console.log(`${r.id}: ${r.status}${r.error ? ` (${r.error})` : ''}`)
      }
    }))
  } finally { await measurer.close() }
  if (arg['no-judge'] !== 'true') await judgeAll(arg['judge-model'] ?? 'opus', keys.length)
}
writeReport()
```

Run: `npx tsc -b && npx eslint tests/mcp-eval`
Expected: no errors.

- [ ] **Step 2: Write the README**

`tests/mcp-eval/README.md`:

````markdown
# MCP slide eval

Claude Code (Sonnet), run headless on the Claude subscription, makes one slide per case through the app's own `/mcp/v1`, exactly as a user's agent would. Each run is scored by exact code checks and an Opus judge, and the report compares it with a baseline. Rerun it after any prompt, card, guide or tool change. Spec: `docs/superpowers/specs/2026-10-03-mcp-slide-eval-design.md`.

## Setup (once)

1. Sign up one or two test accounts in the app, used only by the eval. Under Agent keys, make a key for each.
2. Put the keys in `.env` as `SMARTCHART_EVAL_KEYS=<key1>,<key2>` (one worker per key). The eval reads `.env` from the folder you run it in, so a worktree needs its own copy.
3. Log `claude` in with the subscription. The eval never uses an API key: it strips them, and stops if Claude Code reports anything but the subscription.

## Run

```bash
npm run dev                                    # the app: /mcp/v1, /api/decks, the lint fixture
npm run eval:mcp                               # all 25 cases × 3, then judge, then report
npm run eval:mcp -- --group=criteria --n=1     # a quick read after a prompt change
npm run eval:mcp -- --against=<label>          # deltas against a baseline
npm run eval:mcp -- --label=<label> --report-only --against=<other>
```

| Flag | Meaning |
|---|---|
| `--n=3` | Runs per case |
| `--only=t01,f02` / `--group=near-miss` | Pick cases |
| `--label=` | Output folder (`out/<label>`); default `<sha>[-dirty]-<date>`. Rerunning a label resumes it |
| `--against=<label>` | Compare with `baselines/<label>.json` or `out/<label>/summary.json` |
| `--save-baseline` | Copy this run's summary and report to `baselines/` (commit them) |
| `--judge-model=opus` | `sonnet` when usage limits are tight; the report names it |
| `--no-judge`, `--report-only` | Skip judging, or only rewrite the report |
| `--model=sonnet` | The agent's model |
| `--url=`, `--app=` | The MCP endpoint (any deployment) and the app serving the lint fixture |

Output, in `out/<label>/`: `report.md` (headline, by group, per check, for review), `gallery.html` (every slide at full size with its failures: review slides one by one), `results.json`, `summary.json`, `shots/`.

## Reading it

- **Magic rate:** every gating check passed (right template, one slide, facts kept, nothing invented, fits, validates, a so-what title that the body proves, the case's `must` questions).
- **What confused the agent:** the judge's diagnoses grouped by where to fix them (server instructions, tool descriptions, template cards, the guide), each with the exact text quoted. This is the fix list.
- **Fatal rate:** a figure dropped or invented, or the slide overflows.
- **`P` checks** show whether the server's instructions landed (guide and card read first, issues fixed, `check_slide` run, request passed, look left alone, short reply with the link).
- **Compare like with like:** the same cases and `--n`, and the same Claude Code version (the report flags a version change).

## Adding a case

Add it to `cases.json`. `facts` lists only figures and names the request states exactly. Anything about the slide's details (what is highlighted, which marks, a total row) is a yes/no question for the judge, with `must: true` when the slide fails the user without it. `npx vitest run tests/unit/mcp-eval` checks that the case is honest.

The eval changes no product code. SmartChart's own verdicts (write issues, `check_slide`'s J-checks) reach the judge through the transcript.
````

- [ ] **Step 3: First end-to-end run, one case**

With `npm run dev` running in the same checkout and the prerequisite done:

Run: `npm run eval:mcp -- --only=t01 --n=1 --label=first`
Expected:
- `t01#1: done`, then `judge t01#1: done`, then the Magic and fatal summary line.
- `tests/mcp-eval/out/first/` holds `report.md`, `gallery.html` and `shots/t01-1-*.png`.

Check, and fix what's wrong before going on:
- Open `gallery.html`. The slide renders at full size, and the failed checks read sensibly.
- In `results.json`: `transcript.init.apiKeySource` is `"none"`, and the calls include `mcp__smartchart__create_slide`.
- `transcript.outcome.denials` holds no `mcp__smartchart__*` tool. If it does, the wildcard in `--allowedTools` isn't honoured: use `mcp__smartchart` (the whole server) in `agentArgs` and its test.
- The test account in the app shows the deck. The next run deletes it.

If the guard stops the run, the message names the cause (dev server, key, login). Fix that, not the guard.

- [ ] **Step 4: Commit**

```bash
git add tests/mcp-eval/eval.ts tests/mcp-eval/README.md
git commit -m "MCP eval: one command to run, judge and report, with README"
```

- [ ] **Step 5: Full baseline run**

Run: `npm run eval:mcp -- --save-baseline`
Expected: 75 runs (rerun the same command to resume after any `limited` runs), then a report.

Review `gallery.html` slide by slide. Then:

```bash
git add tests/mcp-eval/baselines
git commit -m "MCP eval: first baseline"
```

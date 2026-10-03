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

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
/** The agent: default prompt and tools, only the Occam connector, always allowed. The prompt goes on stdin. */
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
/** Cut off by a limit (Claude's usage limit, Occam's rate or quota): retried later, never scored. */
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

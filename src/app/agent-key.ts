/* The agent keys (/api/keys): up to five per account. A key itself is shown once, when made. */
export interface AgentKeyInfo { id: string; prefix: string; created: number; lastUsed: number | null }

export const connectCommand = (origin: string, key: string) =>
  `claude mcp add --transport http smartchart ${origin}/mcp/v1 --header "Authorization: Bearer ${key}"`

/** How each agent client connects, one step each: a command to run, a link that installs, or config to paste. */
export interface Client { id: string; name: string; how: 'command' | 'link' | 'config'; note: string; value: (origin: string, key: string) => string }
const server = (origin: string, key: string) => ({ url: `${origin}/mcp/v1`, headers: { Authorization: `Bearer ${key}` } })
const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)))
export const CLIENTS: readonly Client[] = [
  { id: 'claude-code', name: 'Claude Code', how: 'command', note: 'Run it in a terminal; Claude Code can then make and edit your decks.', value: connectCommand },
  { id: 'cursor', name: 'Cursor', how: 'link', note: 'Opens Cursor and adds Occam to its MCP servers.',
    value: (o, k) => `cursor://anysphere.cursor-deeplink/mcp/install?name=occam&config=${encodeURIComponent(b64(JSON.stringify(server(o, k))))}` },
  { id: 'vscode', name: 'VS Code', how: 'link', note: 'Opens VS Code and adds Occam for Copilot’s agent mode.',
    value: (o, k) => `vscode:mcp/install?${encodeURIComponent(JSON.stringify({ name: 'occam', type: 'http', ...server(o, k) }))}` },
  { id: 'claude-desktop', name: 'Claude Desktop', how: 'config', note: 'Settings → Developer → Edit Config: add this to claude_desktop_config.json, then restart Claude.',
    value: (o, k) => JSON.stringify({ mcpServers: { occam: { command: 'npx', args: ['-y', 'mcp-remote', `${o}/mcp/v1`, '--header', `Authorization: Bearer ${k}`] } } }, null, 2) },
  { id: 'other', name: 'Other', how: 'config', note: 'Any MCP client that speaks Streamable HTTP: this URL, with this header.',
    value: (o, k) => `URL     ${o}/mcp/v1\nHeader  Authorization: Bearer ${k}` },
]

/** Installs the Occam skill for Claude Code, so it reaches for Occam whenever it is asked for slides. */
export const skillCommand = (origin: string) => `mkdir -p ~/.claude/skills/occam && curl -fsSL ${origin}/agents/occam/SKILL.md -o ~/.claude/skills/occam/SKILL.md`

const fail = async (r: Response, fallback: string): Promise<never> => {
  const e = (await r.json().catch(() => null)) as { error?: string } | null
  throw new Error(e?.error ?? fallback)
}
export const agentKey = {
  list: async (): Promise<{ keys: AgentKeyInfo[]; max: number }> => {
    const r = await fetch('/api/keys', { credentials: 'same-origin' })
    return r.ok ? ((await r.json()) as { keys: AgentKeyInfo[]; max: number }) : fail(r, 'Couldn’t load your keys.')
  },
  make: async (): Promise<{ key: string; id: string; prefix: string }> => {
    const r = await fetch('/api/keys', { method: 'POST', credentials: 'same-origin' })
    return r.ok ? ((await r.json()) as { key: string; id: string; prefix: string }) : fail(r, 'Couldn’t make a key. Try again.')
  },
  remove: async (id: string): Promise<void> => {
    const r = await fetch(`/api/keys?id=${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'same-origin' })
    if (!r.ok) await fail(r, 'Couldn’t remove the key.')
  },
}

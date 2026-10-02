/* The agent keys (/api/keys): up to five per account. A key itself is shown once, when made. */
export interface AgentKeyInfo { id: string; prefix: string; created: number; lastUsed: number | null }

export const connectCommand = (origin: string, key: string) =>
  `claude mcp add --transport http smartchart ${origin}/mcp/v1 --header "Authorization: Bearer ${key}"`

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

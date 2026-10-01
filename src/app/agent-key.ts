/* The agent key (/api/keys): one per account. The key itself is shown once, when made. */
export const connectCommand = (origin: string, key: string) =>
  `claude mcp add --transport http smartchart ${origin}/mcp/v1 --header "Authorization: Bearer ${key}"`

const call = (method: string) => fetch('/api/keys', { method, credentials: 'same-origin' })
export const agentKey = {
  get: async (): Promise<string | null> => { const r = await call('GET'); return r.ok ? ((await r.json()) as { prefix: string | null }).prefix : null },
  make: async (): Promise<string> => { const r = await call('POST'); if (!r.ok) throw new Error('Couldn’t make a key. Try again.'); return ((await r.json()) as { key: string }).key },
  remove: async (): Promise<void> => { await call('DELETE') },
}

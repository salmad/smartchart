import { keyId, MAX_KEYS, type Db, type DeckEventRow, type DeckRow, type KeyRow, type Presence } from '../../api/_lib/db'

/** An in-memory Db with the same ownership rules as the SQL one. */
export type FakeRow = DeckRow & { user: string; share?: string | null; named: boolean; presence: Presence }
export type FakeDb = Db & {
  rows: Map<string, FakeRow>
  events: (DeckEventRow & { user: string; deck: string })[]
  keys: Map<string, KeyRow & { hash: string; created: number }>
  rate: Map<string, number>
  calls: Map<string, number>
}

export function fakeDb(): FakeDb {
  const rows = new Map<string, FakeRow>()
  const events: FakeDb['events'] = []
  const keys: FakeDb['keys'] = new Map()
  const rate = new Map<string, number>()
  const calls = new Map<string, number>()
  let n = 0
  return {
    rows, events, keys, rate, calls,
    listDecks: async (u) => [...rows.values()].filter((r) => r.user === u).sort((a, b) => b.updated - a.updated).map(({ id, name, updated, data, share }) => {
      const d = data as { items?: { slide: unknown }[]; style?: unknown; theme?: unknown; accent?: unknown }
      return { id, name, updated, slides: d.items?.length ?? 0, style: d.style, theme: d.theme, accent: d.accent, first: d.items?.[0]?.slide ?? null, shared: !!share }
    }),
    getDeck: async (u, id) => { const r = rows.get(id); return r && r.user === u ? structuredClone(r) : null },
    putDeck: async (u, id, name, data, chat, baseRev, opts = {}) => {
      const r = rows.get(id)
      if (r && r.user !== u) return 'foreign'
      if (r && r.rev !== baseRev) return 'conflict'
      const rev = (r?.rev ?? 0) + 1
      const named = !!r?.named || !!opts.named
      rows.set(id, { id, name: r?.named && !opts.named ? r.name : name, data, chat, rev, updated: Date.now() + rows.size, user: u, share: r?.share, named, presence: r?.presence ?? {} })
      return { rev }
    },
    getDeckMeta: async (u, id) => { const r = rows.get(id); return r && r.user === u ? { rev: r.rev, share: r.share ?? null, presence: r.presence, named: r.named } : null },
    sharedRev: async (t) => { const r = [...rows.values()].find((x) => x.share === t); return r ? { rev: r.rev } : null },
    setPresence: async (u, id, presence) => { const r = rows.get(id); if (!r || r.user !== u) return false; r.presence = presence; return true },
    addEvents: async (u, id, evs) => { for (const e of evs) events.push({ ...e, at: Date.now(), user: u, deck: id }) },
    eventsSince: async (u, id, rev) => events.filter((e) => e.user === u && e.deck === id && e.rev > rev).sort((a, b) => a.rev - b.rev).slice(0, 200)
      .map(({ user: _u, deck: _d, ...e }) => e),
    countCall: async (u) => { const c = (calls.get(u) ?? 0) + 1; calls.set(u, c); return c },
    callsToday: async (u) => calls.get(u) ?? 0,
    addKey: async (userId, email, hash, prefix) => {
      if ([...keys.values()].filter((k) => k.userId === userId).length >= MAX_KEYS) return false
      keys.set(hash, { userId, email, prefix, hash, created: Date.now() })
      return true
    },
    keyUser: async (hash) => { const k = keys.get(hash); return k ? { userId: k.userId, email: k.email, prefix: k.prefix } : null },
    listKeys: async (u) => [...keys.values()].filter((k) => k.userId === u).map((k) => ({ id: keyId(k.hash), prefix: k.prefix, created: k.created, lastUsed: null })),
    deleteKey: async (u, id) => { const k = [...keys.values()].find((x) => x.userId === u && keyId(x.hash) === id); return !!k && keys.delete(k.hash) },
    bumpRate: async (key, minute) => { const k = `${key}:${minute}`, c = (rate.get(k) ?? 0) + 1; rate.set(k, c); return c },
    deleteDeck: async (u, id) => { const r = rows.get(id); return !!r && r.user === u && rows.delete(id) },
    shareDeck: async (u, id, on) => {
      const r = rows.get(id)
      if (!r || r.user !== u) return undefined
      if (on !== undefined) r.share = on ? r.share ?? `tok_${++n}` : null
      return r.share ?? null
    },
    sharedDeck: async (t) => { const r = [...rows.values()].find((x) => x.share === t); return r ? { name: r.name, data: r.data, rev: r.rev } : null },
  }
}

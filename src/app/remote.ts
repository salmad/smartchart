/* Decks on the server for a signed-in user (/api/decks). The session cookie authenticates each call. */
import { deckName, type DeckRepo, type SavedDeck } from './store'

interface Row { id: string; name: string; updated: number; data: SavedDeck }

export function remoteDeckRepo(fetcher: typeof fetch = (...a) => fetch(...a)): DeckRepo {
  const call = (query: string, init?: RequestInit) => fetcher(`/api/decks${query}`, { credentials: 'same-origin', ...init })
  return {
    list: async () => {
      const r = await call('')
      if (!r.ok) throw new Error(`decks: ${r.status}`)
      return ((await r.json()) as Row[]).map((row) => ({ ...row.data, id: row.id, updated: row.updated }))
    },
    get: async (id) => {
      const r = await call(`?id=${encodeURIComponent(id)}`)
      if (r.status === 404) return null
      if (!r.ok) throw new Error(`deck: ${r.status}`)
      const row = (await r.json()) as Row
      return { ...row.data, id: row.id }
    },
    save: async (deck) => {
      try {
        const r = await call('', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: deck.id, name: deckName(deck), data: deck }) })
        return r.ok
      } catch { return false }
    },
    remove: async (id) => {
      try { return (await call(`?id=${encodeURIComponent(id)}`, { method: 'DELETE' })).ok } catch { return false }
    },
  }
}

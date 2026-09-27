/* Decks on the server for a signed-in user (/api/decks). The session cookie authenticates each call;
   a 401 means the session ended, and `onSignedOut` hears about it. */
import { deckName, localDeckRepo, type DeckRepo, type SavedDeck } from './store'

interface Row { id: string; name: string; updated: number; data: SavedDeck }

export function remoteDeckRepo({ fetcher = (...a) => fetch(...a), onSignedOut }: { fetcher?: typeof fetch; onSignedOut?: () => void } = {}): DeckRepo {
  const call = async (query: string, init?: RequestInit) => {
    const r = await fetcher(`/api/decks${query}`, { credentials: 'same-origin', ...init })
    if (r.status === 401) onSignedOut?.()
    return r
  }
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

/** The deck in the URL. Signed in, a deck still in this browser (a visitor's first, one from before accounts,
    or a copy kept while saves failed) moves to the account the first time it is opened, unless the account's is newer. */
export async function findDeck(id: string, repo: DeckRepo, account: { id: string } | null, local: DeckRepo = localDeckRepo()): Promise<SavedDeck | null> {
  const d = await repo.get(id).catch(() => null)
  if (!account) return d
  const mine = await local.get(id)
  if (!mine || (d && d.updated >= mine.updated)) { if (mine) await local.remove(id); return d }
  if (await repo.save(mine)) await local.remove(id)
  return mine
}

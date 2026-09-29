/* Decks on the server for a signed-in user (/api/decks). The session cookie authenticates each call;
   a 401 means the session ended, and `onSignedOut` hears about it. */
import { deckName, localDeckRepo, type DeckRepo, type DeckSummary, type SavedDeck } from './store'

/** Why a save failed, by status, as the chat says it. */
const SAVE_FAILED: Record<number, string> = {
  401: 'Your session ended.', 404: 'This deck belongs to another account.', 413: 'This deck is too large to save.', 503: 'Saving isn’t set up on this server.',
}

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
      // A missing look falls back to the defaults, so a deck saved before a field existed still lists.
      return ((await r.json()) as Partial<DeckSummary>[]).map((d) => ({
        id: String(d.id), name: d.name || 'Untitled deck', updated: Number(d.updated) || 0, slides: Number(d.slides) || 0,
        style: d.style === 'pitch' ? 'pitch' : 'consulting', theme: d.theme === 'paper' ? 'paper' : 'ink', accent: typeof d.accent === 'string' ? d.accent : null, first: d.first ?? null,
      }))
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
        if (r.ok) return null
        const said = ((await r.json().catch(() => null)) as { error?: unknown } | null)?.error
        console.warn('deck save failed', r.status, said)
        return SAVE_FAILED[r.status] ?? `The server answered ${r.status}${typeof said === 'string' ? `: ${said}` : '.'}`
      } catch { return 'You’re offline, or the server can’t be reached.' }
    },
    remove: async (id) => {
      try { return (await call(`?id=${encodeURIComponent(id)}`, { method: 'DELETE' })).ok } catch { return false }
    },
  }
}

/** The deck in the URL. A copy kept in this browser while saves failed moves to the account the first time the deck
    is opened, unless the account's is newer. `backup` is null when the decks already live in this browser (the dev account). */
export async function findDeck(id: string, repo: DeckRepo, backup: DeckRepo | null = localDeckRepo()): Promise<SavedDeck | null> {
  const d = await repo.get(id).catch(() => null)
  if (!backup) return d
  const local = backup, mine = await local.get(id)
  if (!mine || (d && d.updated >= mine.updated)) { if (mine) await local.remove(id); return d }
  if (!(await repo.save(mine))) await local.remove(id)
  return mine
}

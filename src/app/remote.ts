/* Decks on the server for a signed-in user (/api/decks). The session cookie authenticates each call;
   a 401 means the session ended, and `onSignedOut` hears about it. */
import { deckName, localDeckRepo, type DeckRepo, type DeckSummary, type SavedDeck } from './store'

/** What the chat says when the server refuses a save because the deck moved on since this tab read it. */
export const STALE = 'This deck was changed in another tab or window. Reload to see the latest.'

/** Why a save failed, by status, as the chat says it. */
const SAVE_FAILED: Record<number, string> = {
  401: 'Your session ended.', 404: 'This deck belongs to another account.', 409: STALE, 413: 'This deck is too large to save.', 503: 'Saving isn’t set up on this server.',
}

/** A deck saved before chats were kept apart has `chat: null` and its conversation inside `data`. */
interface Row { id: string; name: string; updated: number; rev?: number; data: SavedDeck; chat?: Partial<SavedDeck> | null }

export function remoteDeckRepo({ fetcher = (...a) => fetch(...a), onSignedOut }: { fetcher?: typeof fetch; onSignedOut?: () => void } = {}): DeckRepo {
  const call = async (query: string, init?: RequestInit) => {
    const r = await fetcher(`/api/decks${query}`, { credentials: 'same-origin', ...init })
    if (r.status === 401) onSignedOut?.()
    return r
  }
  // The revision last read or written per deck: a save from an older one is refused.
  const revs = new Map<string, number>()
  // One request per deck at a time: autosave, leaving the page and the retry timer can overlap, and a second save
  // sent before the first one answers would carry the old revision and be refused as stale.
  const lines = new Map<string, Promise<unknown>>()
  const inOrder = <T>(id: string, run: () => Promise<T>): Promise<T> => {
    const next = (lines.get(id) ?? Promise.resolve()).then(run, run)
    lines.set(id, next.catch(() => undefined))
    return next
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
    get: (id) => inOrder(id, async () => {
      const r = await call(`?id=${encodeURIComponent(id)}`)
      if (r.status === 404) return null
      if (!r.ok) throw new Error(`deck: ${r.status}`)
      const row = (await r.json()) as Row
      revs.set(id, row.rev ?? 0)
      // `chat` wins when present; an older deck has the conversation in `data`.
      return { ...row.data, ...(row.chat ?? {}), id: row.id }
    }),
    save: (deck) => inOrder(deck.id, async () => {
      try {
        const { history, messages, working, ...look } = deck
        const r = await call('', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: deck.id, name: deckName(deck), data: look, chat: { history, messages, working }, baseRev: revs.get(deck.id) ?? 0 }) })
        if (r.ok) {
          revs.set(deck.id, ((await r.json().catch(() => null)) as { rev?: number } | null)?.rev ?? (revs.get(deck.id) ?? 0) + 1)
          return null
        }
        if (r.status === 409) {
          // A save can commit while its answer is lost, and the retry then looks stale. If the deck on the server is
          // exactly the one sent (same `updated`), it is this tab's own save: take its revision and call it saved.
          const now = await call(`?id=${encodeURIComponent(deck.id)}`)
          const row = now.ok ? ((await now.json()) as Row) : null
          if (row && row.data?.updated === deck.updated) { revs.set(deck.id, row.rev ?? 0); return null }
        }
        const said = ((await r.json().catch(() => null)) as { error?: unknown } | null)?.error
        console.warn('deck save failed', r.status, said)
        return SAVE_FAILED[r.status] ?? `The server answered ${r.status}${typeof said === 'string' ? `: ${said}` : '.'}`
      } catch { return 'You’re offline, or the server can’t be reached.' }
    }),
    remove: (id) => inOrder(id, async () => {
      try {
        const ok = (await call(`?id=${encodeURIComponent(id)}`, { method: 'DELETE' })).ok
        if (ok) revs.delete(id)
        return ok
      } catch { return false }
    }),
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

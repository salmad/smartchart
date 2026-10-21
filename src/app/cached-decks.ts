/* The deck last read or saved is kept in this browser, with the revision and role it was read at, so the next visit
   opens it at once; the server is then asked what changed (see `useLiveDeck`). A deck that is gone, or an account that
   signed out, takes its copy with it. */
import { cacheDelete, cacheGet, cacheSet } from './cache'
import type { DeckRepo, SavedDeck } from './store'
import type { Role } from './workspaces'

export interface CachedDeck { deck: SavedDeck; rev: number; role: Role | null }

const LAST = 'last'
const valid = (v: unknown): v is CachedDeck => {
  const c = v as Partial<CachedDeck> | null
  return !!c && typeof c === 'object' && typeof c.rev === 'number' && !!c.deck && typeof c.deck.id === 'string' && Array.isArray(c.deck.items)
}

/** The stored copy of a deck: the one asked for, or (at /) the one worked on last. Null when there is none to trust. */
export async function readCachedDeck(account: string, id: string | undefined): Promise<CachedDeck | null> {
  const want = id ?? (await cacheGet<{ deckId?: unknown }>(account, LAST))?.deckId
  if (typeof want !== 'string') return null
  const c = await cacheGet<unknown>(account, `deck:${want}`)
  return valid(c) ? c : null
}

/** Drops the stored copy of a deck, and the claim that it was the last one worked on. */
export async function forgetCachedDeck(account: string, id: string): Promise<void> {
  await cacheDelete(account, `deck:${id}`)
  if ((await cacheGet<{ deckId?: unknown }>(account, LAST))?.deckId === id) await cacheDelete(account, LAST)
}

/** The same repo, remembering what it reads and saves. A read does not make a deck the last one (a prefetch reads
    decks nobody opened); a save does, as that is working on it. */
export function cachedDeckRepo(inner: DeckRepo, account: string): DeckRepo {
  const keep = (deck: SavedDeck) => cacheSet(account, `deck:${deck.id}`, { deck, rev: inner.known?.(deck.id) ?? 0, role: inner.role?.(deck.id) ?? null } satisfies CachedDeck)
  return {
    ...inner,
    get: async (id) => {
      const d = await inner.get(id)
      if (d) void keep(d)
      return d
    },
    save: async (deck, meta) => {
      const why = await inner.save(deck, meta)
      if (!why) { void keep(deck); void cacheSet(account, LAST, { deckId: deck.id }) }
      return why
    },
    remove: async (id) => {
      const ok = await inner.remove(id)
      if (ok) void forgetCachedDeck(account, id)
      return ok
    },
  }
}

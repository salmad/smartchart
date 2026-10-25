/* The deck last read or saved is kept in memory and in this browser, with the revision and role it was read at, so the
   next visit and the next click open it at once; the server is then asked what changed (see `useLiveDeck`). A deck that
   is gone, or an account that signed out, takes its copy with it. */
import { cacheDelete, cacheGet, cacheSet } from './cache'
import type { DeckRepo, KeptDeck, SavedDeck } from './store'
export type CachedDeck = KeptDeck

const LAST = 'last'
const deckKey = (id: string) => `deck:${id}`
/** The deck last opened in a workspace (for switching workspaces without waiting on list). */
export const lastDeckInWorkspace = (workspaceId: string) => `lastDeck:${workspaceId}`
const lastInWorkspace = new Map<string, string>()

const valid = (v: unknown): v is KeptDeck => {
  const c = v as Partial<KeptDeck> | null
  return !!c && typeof c === 'object' && typeof c.rev === 'number' && !!c.deck && typeof c.deck.id === 'string' && Array.isArray(c.deck.items)
}

/** The stored copy of a deck: the one asked for, or (at /) the one worked on last. Null when there is none to trust. */
export async function readCachedDeck(account: string, id: string | undefined): Promise<KeptDeck | null> {
  const want = id ?? (await cacheGet<{ deckId?: unknown }>(account, LAST))?.deckId
  if (typeof want !== 'string') return null
  const c = await cacheGet<unknown>(account, deckKey(want))
  return valid(c) ? c : null
}

/** Drops the stored copy of a deck, and the claim that it was the last one worked on. */
export async function forgetCachedDeck(account: string, id: string): Promise<void> {
  await cacheDelete(account, deckKey(id))
  if ((await cacheGet<{ deckId?: unknown }>(account, LAST))?.deckId === id) await cacheDelete(account, LAST)
  for (const [ws, deckId] of lastInWorkspace) if (deckId === id) lastInWorkspace.delete(ws)
}

/** Remembers which deck was opened in a workspace (memory and IndexedDB). */
export function touchLastDeckInWorkspace(account: string, workspaceId: string, deckId: string): void {
  lastInWorkspace.set(workspaceId, deckId)
  void cacheSet(account, lastDeckInWorkspace(workspaceId), { deckId })
}

/** The deck last opened in this workspace, if any. */
export async function lastDeckIdInWorkspace(account: string, workspaceId: string): Promise<string | null> {
  const mem = lastInWorkspace.get(workspaceId)
  if (mem) return mem
  const stored = await cacheGet<{ deckId?: unknown }>(account, lastDeckInWorkspace(workspaceId))
  const id = typeof stored?.deckId === 'string' ? stored.deckId : null
  if (id) lastInWorkspace.set(workspaceId, id)
  return id
}

/** The same repo, remembering what it reads and saves. A read does not make a deck the last one (a prefetch reads
    decks nobody opened); a save does, as that is working on it. */
export function cachedDeckRepo(inner: DeckRepo, account: string): DeckRepo {
  const memory = new Map<string, KeptDeck>()
  let lastId: string | null = null
  const pack = (deck: SavedDeck): KeptDeck => ({ deck, rev: inner.known?.(deck.id) ?? 0, role: inner.role?.(deck.id) ?? null })
  const remember = (c: KeptDeck) => { memory.set(c.deck.id, c); inner.seed?.(c.deck, c.rev, c.role) }
  const keep = (deck: SavedDeck) => {
    const c = pack(deck)
    remember(c)
    void cacheSet(account, deckKey(deck.id), c)
  }
  const reading = new Map<string, Promise<SavedDeck | null>>()
  const resolveKept = async (want: string): Promise<KeptDeck | null> => {
    const inFlight = reading.get(want)
    if (inFlight) await inFlight.catch(() => undefined)
    const mem = memory.get(want)
    if (mem) return mem
    const stored = await cacheGet<unknown>(account, deckKey(want))
    if (!valid(stored)) return null
    remember(stored)
    return stored
  }
  return {
    ...inner,
    seed: (deck, rev, role) => { remember({ deck, rev, role }) },
    peek: (id) => memory.get(id) ?? null,
    kept: async (id) => {
      let want = id ?? lastId
      if (want === undefined) {
        const last = await cacheGet<{ deckId?: unknown }>(account, LAST)
        want = typeof last?.deckId === 'string' ? last.deckId : null
      }
      if (typeof want !== 'string') return null
      return resolveKept(want)
    },
    get: (id) => {
      const have = reading.get(id)
      if (have) return have
      const p = inner.get(id).then((d) => { if (d) keep(d); return d }).finally(() => reading.delete(id))
      reading.set(id, p)
      return p
    },
    save: async (deck, meta) => {
      const why = await inner.save(deck, meta)
      if (!why) {
        keep(deck); lastId = deck.id
        void cacheSet(account, LAST, { deckId: deck.id })
      }
      return why
    },
    remove: async (id) => {
      const ok = await inner.remove(id)
      if (ok) {
        memory.delete(id)
        if (lastId === id) lastId = null
        void forgetCachedDeck(account, id)
      }
      return ok
    },
  }
}

/* The page tree as the app reaches it: every deck and doc of a workspace in one list, moving a page, and counting what
   deleting it would take with it. On the server (/api/pages and the ?move and ?subpages calls) for a signed-in user, or in
   this browser for the dev account, where the same rules from engine/pages/tree.ts are applied to the stored pages. */
import { canMove, descendants, slotKey, type PageRef, type PageSummary, type Slot } from '@/engine/pages/tree'
import { deckName, loadStore } from './store'
import { DOCS_KEY, localNodes, setPlace, type LocalStorage } from './local-pages'
import { refOf } from './pages-wire'
import { OFFLINE } from './workspaces'

export type { PageSummary }
export type MoveTo = { parent: PageRef | null; workspaceId?: string } & Slot

export interface PageRepo {
  /** Every deck and doc of the workspace the user can open, with parents and order keys. Throws when the list can't be read. */
  list(workspaceId: string): Promise<PageSummary[]>
  /** Null when moved; otherwise why not, as a sentence (a cycle, too deep, a viewer, offline). */
  move(page: PageRef, to: MoveTo): Promise<string | null>
  /** How many pages sit below this one: what deleting it would also remove. Throws when it can't be known. */
  subpages(page: PageRef): Promise<number>
}

const GONE = 'That page is gone.'
const MOVE_FAILED: Record<number, string> = { 401: 'Your session ended.', 404: GONE }
const route = (kind: PageRef['kind']) => (kind === 'deck' ? 'decks' : 'docs')

export function remotePageRepo({ fetcher = (...a) => fetch(...a), onSignedOut }: { fetcher?: typeof fetch; onSignedOut?: () => void } = {}): PageRepo {
  const call = async (url: string, init?: RequestInit) => {
    const r = await fetcher(url, { credentials: 'same-origin', ...init })
    if (r.status === 401) onSignedOut?.()
    return r
  }
  return {
    list: async (ws) => {
      const r = await call(`/api/pages?workspace=${encodeURIComponent(ws)}`)
      if (!r.ok) throw new Error(`pages: ${r.status}`)
      return ((await r.json()) as Partial<PageSummary>[]).flatMap((p): PageSummary[] => {
        const kind = p.kind === 'deck' || p.kind === 'doc' ? p.kind : null
        return kind && typeof p.id === 'string'
          ? [{ kind, id: p.id, name: p.name || (kind === 'deck' ? 'Untitled deck' : 'Untitled doc'), updated: Number(p.updated) || 0,
              slides: typeof p.slides === 'number' ? p.slides : null, parent: refOf(p.parent), sortKey: typeof p.sortKey === 'string' ? p.sortKey : null }]
          : []
      })
    },
    move: async (page, to) => {
      try {
        const r = await call(`/api/${route(page.kind)}?id=${encodeURIComponent(page.id)}&move`,
          { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(to) })
        if (r.ok) return null
        const said = ((await r.json().catch(() => null)) as { error?: unknown } | null)?.error
        // The server's own sentence wins (a cycle, too deep, a viewer); the status is the fallback.
        return typeof said === 'string' && said && r.status !== 404 ? said : MOVE_FAILED[r.status] ?? `The server answered ${r.status}.`
      } catch { return OFFLINE }
    },
    subpages: async (page) => {
      const r = await call(`/api/${route(page.kind)}?id=${encodeURIComponent(page.id)}&subpages`)
      const body = (r.ok ? await r.json() : null) as { count?: unknown } | null
      if (typeof body?.count !== 'number') throw new Error(`subpages: ${r.status}`)
      return body.count
    },
  }
}

/** The dev account's tree, over the decks and docs this browser keeps. `ws` is the workspace the docs live in. */
export function localPageRepo(storage?: LocalStorage): PageRepo {
  return {
    list: async (ws) => {
      const nodes = localNodes(storage, ws), decks = loadStore(storage).decks
      let docs: Record<string, { name?: string; updated?: number }> = {}
      try { docs = (JSON.parse((storage ?? localStorage).getItem(DOCS_KEY) ?? 'null') as typeof docs | null) ?? {} } catch { /* none */ }
      return nodes.map((n): PageSummary => n.kind === 'deck'
        ? { ...n, name: deckName(decks[n.id]), updated: decks[n.id].updated || 0, slides: decks[n.id].items?.length ?? 0 }
        : { ...n, name: docs[n.id]?.name ?? '', updated: docs[n.id]?.updated ?? 0, slides: null })
    },
    move: async (page, to) => {
      const nodes = localNodes(storage)
      const ok = canMove(nodes, page, to.parent)
      if (ok !== 'ok') return ok
      const slot = slotKey(nodes, page, to.parent, to)
      if ('refused' in slot) return slot.refused
      return setPlace(storage, page, to.parent, slot.key) ? null : 'This browser’s storage is full.'
    },
    subpages: async (page) => descendants(localNodes(storage), page).length,
  }
}

/* The sidebar's list of pages and what happens to it: loading, and moving a page at once while the server catches up. No
   React in here, so it runs under test; usePageTree puts it on screen. */
import { canMove, descendants, keyOf, NO_PAGE, slotKey, type PageRef, type PageSummary } from '@/engine/pages/tree'
import type { MoveTo, PageRepo } from '@/app/pages'
import { showThenFetch } from '@/app/swr'

/** The stored name of a workspace's page list. */
export const pageList = (workspaceId: string) => `pages:${workspaceId}`
export const isPages = (v: unknown): v is PageSummary[] => Array.isArray(v) && v.every((p) => !!p && typeof p === 'object'
  && ((p as PageSummary).kind === 'deck' || (p as PageSummary).kind === 'doc') && typeof (p as PageSummary).id === 'string' && typeof (p as PageSummary).name === 'string' && typeof (p as PageSummary).updated === 'number')

export interface TreeState {
  /** Null until the first load. */
  pages: PageSummary[] | null
  failed: boolean
  /** Why the last move was refused, until the next move or `dismiss`. */
  notice: string | null
}

export interface PageTree {
  getState(): TreeState
  subscribe(listener: () => void): () => void
  load(): Promise<void>
  /** Moves the page in the list at once, then asks the repo; a refusal puts it back and is returned as a sentence.
      `view` is what the sidebar shows (pending creates and the open deck included); when omitted, the last server list is used. */
  move(page: PageRef, to: MoveTo, view?: PageSummary[] | null): Promise<string | null>
  dismiss(): void
}

const is = (a: PageRef, b: PageRef) => a.kind === b.kind && a.id === b.id

/** With an `account`, the list stored in this browser shows first (once: a later read would put an older copy over a change just made). */
export function createPageTree(repo: PageRepo, workspaceId: string, account?: string): PageTree {
  let state: TreeState = { pages: null, failed: false, notice: null }
  const listeners = new Set<() => void>()
  const set = (patch: Partial<TreeState>) => { state = { ...state, ...patch }; listeners.forEach((l) => l()) }
  // A list read that began before a move, or while one is unfinished, would put the old order back: it is dropped, and the
  // move reads the list again when it ends.
  let epoch = 0, moving = 0

  let stored = false
  const load = async () => {
    const at = epoch
    const ok = await showThenFetch(stored ? undefined : account, pageList(workspaceId), () => repo.list(workspaceId), isPages,
      (pages) => { if (at === epoch && !moving) { stored = true; set({ pages, failed: false }) } })
    if (!ok && at === epoch && !moving) set({ failed: true })
  }

  const move = async (page: PageRef, to: MoveTo, view?: PageSummary[] | null): Promise<string | null> => {
    const list = view ?? state.pages
    const refuse = (why: string) => { set({ notice: why }); return why }
    if (!list) return refuse(NO_PAGE)
    const before = list.find((p) => is(p, page))
    if (!before) return refuse(NO_PAGE)

    const parent = to.parent ?? null
    const cross = !!(to.workspaceId && to.workspaceId !== workspaceId)
    const parentHere = parent === null || list.some((p) => is(p, parent))
    const ok = cross && !parentHere ? canMove(list, page, null) : canMove(list, page, parent)
    if (ok !== 'ok') return refuse(ok)

    let slot: { key: string } | null = null
    if (!cross) {
      const at = slotKey(list, page, parent, to)
      if ('refused' in at) return refuse(at.refused)
      slot = at
    }

    const base = state.pages
    const inBase = !!base?.some((p) => is(p, page))
    const saved = inBase && base ? base.find((p) => is(p, page))! : before

    epoch++; moving++
    if (inBase && base) {
      set({
        notice: null,
        pages: cross
          ? base.filter((p) => !new Set([keyOf(page), ...descendants(list, page).map(keyOf)]).has(keyOf(p)))
          : base.map((p) => (is(p, page) ? { ...p, parent, sortKey: slot!.key } : p)),
      })
    } else set({ notice: null })

    const why = await repo.move(page, to)
    moving--; epoch++
    if (why) {
      if (inBase && base) {
        set({
          notice: why,
          pages: cross ? base : base.map((p) => (is(p, page) ? { ...p, parent: saved.parent, sortKey: saved.sortKey } : p)),
        })
      } else set({ notice: why })
    }
    if (!moving) void load()
    return why
  }

  return {
    getState: () => state,
    subscribe: (l) => { listeners.add(l); return () => { listeners.delete(l) } },
    load, move,
    dismiss: () => { if (state.notice) set({ notice: null }) },
  }
}

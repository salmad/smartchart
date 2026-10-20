/* The sidebar's list of pages and what happens to it: loading, and moving a page at once while the server catches up. No
   React in here, so it runs under test; usePageTree puts it on screen. */
import { canMove, NO_PAGE, slotKey, type PageRef, type PageSummary } from '@/engine/pages/tree'
import type { MoveTo, PageRepo } from '@/app/pages'

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
  /** Moves the page in the list at once, then asks the repo; a refusal puts it back and is returned as a sentence. */
  move(page: PageRef, to: MoveTo): Promise<string | null>
  dismiss(): void
}

const is = (a: PageRef, b: PageRef) => a.kind === b.kind && a.id === b.id

export function createPageTree(repo: PageRepo, workspaceId: string): PageTree {
  let state: TreeState = { pages: null, failed: false, notice: null }
  const listeners = new Set<() => void>()
  const set = (patch: Partial<TreeState>) => { state = { ...state, ...patch }; listeners.forEach((l) => l()) }
  // A list read that began before a move, or while one is unfinished, would put the old order back: it is dropped, and the
  // move reads the list again when it ends.
  let epoch = 0, moving = 0

  const load = async () => {
    const at = epoch
    try {
      const pages = await repo.list(workspaceId)
      if (at === epoch && !moving) set({ pages, failed: false })
    } catch { if (at === epoch && !moving) set({ failed: true }) }
  }

  const move = async (page: PageRef, to: MoveTo): Promise<string | null> => {
    const pages = state.pages
    const refuse = (why: string) => { set({ notice: why }); return why }
    if (!pages) return refuse(NO_PAGE)
    const ok = canMove(pages, page, to.parent)
    if (ok !== 'ok') return refuse(ok)
    const slot = slotKey(pages, page, to.parent, to)
    if ('refused' in slot) return refuse(slot.refused)
    const before = pages.find((p) => is(p, page))
    if (!before) return refuse(NO_PAGE)

    epoch++; moving++
    set({ notice: null, pages: pages.map((p) => (is(p, page) ? { ...p, parent: to.parent, sortKey: slot.key } : p)) })
    const why = await repo.move(page, to)
    moving--; epoch++
    if (why) set({ notice: why, pages: state.pages?.map((p) => (is(p, page) ? { ...p, parent: before.parent, sortKey: before.sortKey } : p)) ?? null })
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

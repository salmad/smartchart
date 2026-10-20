/* The sidebar's tree on screen: the workspace's pages, the open page's branch expanded, the rest as the viewer left it. */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { keyOf, type PageRef } from '@/engine/pages/tree'
import type { PageRepo } from '@/app/pages'
import { loadExpanded, saveExpanded, withRefs } from './expanded'
import { pathTo, visibleRows, withOpenDeck, type Row } from './flatten'
import { createPageTree } from './pageTree'

interface Options {
  repo: PageRepo
  workspaceId: string | null
  /** The signed-in user, so two people on one browser keep their own open branches. */
  viewer: string
  /** The page on screen, and the deck held in the editor (named live, listed before its first save, under its pending parent). */
  open: PageRef | null
  deck: { id: string | null; name: string; slides: number }
  pendingParent: PageRef | null
  /** Change to read the list again: a doc saved or renamed. */
  tick: number
}

export interface PageTreeView {
  /** Null while loading. */
  rows: Row[] | null
  failed: boolean
  /** Why the last move was refused. */
  notice: string | null
  toggle(ref: PageRef, open?: boolean): void
  move: ReturnType<typeof createPageTree>['move']
  /** Reads the list again (after a save, a rename, a delete). */
  reload(): Promise<void>
  dismiss(): void
}

export function usePageTree({ repo, workspaceId, viewer, open: openPage, deck, pendingParent, tick }: Options): PageTreeView {
  // The callers' objects are new on every render; what they say is kept by value.
  const open = useMemo(() => openPage, [openPage?.kind, openPage?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const parent = useMemo(() => pendingParent, [pendingParent?.kind, pendingParent?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const liveDeck = useMemo(() => ({ id: deck.id, name: deck.name, slides: deck.slides }), [deck.id, deck.name, deck.slides])
  const tree = useMemo(() => createPageTree(repo, workspaceId ?? ''), [repo, workspaceId])
  const state = useSyncExternalStore(tree.subscribe, tree.getState)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())
  const key = workspaceId ?? ''

  // Read again when the open page changes (a deck saved for the first time shows with its real place) or a doc was saved.
  const openKey = open ? keyOf(open) : ''
  useEffect(() => { if (workspaceId) void tree.load() }, [tree, workspaceId, openKey, tick])

  const pages = useMemo(() => state.pages && withOpenDeck(state.pages, liveDeck, parent), [state.pages, liveDeck, parent])

  // The open page's branch is expanded when the list first arrives and whenever another page opens; after that the
  // viewer's own collapsing is left alone.
  const shownFor = useRef('')
  useEffect(() => {
    if (!workspaceId) return
    const stored = loadExpanded(viewer, workspaceId)
    if (!pages) { setExpanded(stored); return }
    const at = `${viewer}|${workspaceId}|${openKey}`
    if (shownFor.current === at) return
    shownFor.current = at
    const next = withRefs(stored, open ? pathTo(pages, open) : [])
    setExpanded(next)
    saveExpanded(viewer, workspaceId, next)
  }, [pages, viewer, workspaceId, openKey, open])

  const toggle = useCallback((ref: PageRef, force?: boolean) => {
    setExpanded((was) => {
      const k = keyOf(ref), next = new Set(was), on = force ?? !was.has(k)
      if (on) next.add(k); else next.delete(k)
      saveExpanded(viewer, key, next)
      return next
    })
  }, [viewer, key])

  const rows = useMemo(() => pages && visibleRows(pages, expanded, open), [pages, expanded, open])
  return { rows, failed: state.failed, notice: state.notice, toggle, move: tree.move, reload: tree.load, dismiss: tree.dismiss }
}

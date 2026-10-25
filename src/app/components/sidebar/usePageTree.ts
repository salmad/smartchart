/* The sidebar's tree on screen: the workspace's pages, the open page's branch expanded, the rest as the viewer left it. */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { keyOf, type PageRef, type PageSummary } from '@/engine/pages/tree'
import type { PageRepo } from '@/app/pages'
import { cacheSet } from '@/app/cache'
import { overlay, type Op } from '@/app/optimistic'
import { loadExpanded, saveExpanded, withRefs } from './expanded'
import { pathTo, visibleRows, withOpenDeck, type Row } from './flatten'
import { pageList, type PageTree } from './pageTree'
import { pageTreeFor } from './sharedTree'

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
  /** Changes shown but not yet read back from the server (rename, delete, new doc), laid over the list. */
  ops: readonly Op<PageSummary>[]
  /** The signed-in account whose browser copy of the list shows first; none for the dev account. */
  account?: string
}

export interface PageTreeView {
  /** Null while loading. */
  rows: Row[] | null
  /** Every page, with the open deck in it: what Move to… offers. */
  pages: PageSummary[] | null
  failed: boolean
  /** Why the last move was refused. */
  notice: string | null
  toggle(ref: PageRef, open?: boolean): void
  move: PageTree['move']
  /** Reads the list again (after a save, a rename, a delete). */
  reload(): Promise<void>
  dismiss(): void
}

export function usePageTree({ repo, workspaceId, viewer, open: openPage, deck, pendingParent, tick, ops, account }: Options): PageTreeView {
  // The callers' objects are new on every render; what they say is kept by value.
  const open = useMemo(() => openPage, [openPage?.kind, openPage?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const parent = useMemo(() => pendingParent, [pendingParent?.kind, pendingParent?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const liveDeck = useMemo(() => ({ id: deck.id, name: deck.name, slides: deck.slides }), [deck.id, deck.name, deck.slides])
  const tree = useMemo(() => pageTreeFor(repo, workspaceId ?? '', account), [repo, workspaceId, account])
  const state = useSyncExternalStore(tree.subscribe, tree.getState)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())
  const key = workspaceId ?? ''

  // Read again when the open page changes (a deck saved for the first time shows with its real place) or a doc was saved.
  const openKey = open ? keyOf(open) : ''
  useEffect(() => { if (workspaceId) void tree.load() }, [tree, workspaceId, openKey, tick])

  // The list with the pending changes laid over it is what shows, and what is stored for the next visit.
  const shown = useMemo(() => state.pages && workspaceId ? overlay(pageList(workspaceId), state.pages, ops) : state.pages, [state.pages, workspaceId, ops])
  useEffect(() => { if (account && workspaceId && shown) void cacheSet(account, pageList(workspaceId), shown) }, [account, workspaceId, shown])
  const pages = useMemo(() => shown && withOpenDeck(shown, liveDeck, parent), [shown, liveDeck, parent])

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

  // A deck started under a page shows there as soon as it has a slide, with the branch open (it is not yet the page that opened).
  const parentKey = parent ? keyOf(parent) : '', shows = !!pages?.some((p) => p.kind === 'deck' && p.id === deck.id && p.parent)
  useEffect(() => {
    if (!workspaceId || !pages || !open || !parentKey || !shows) return
    setExpanded((was) => { const next = withRefs(was, [...pathTo(pages, open), ...(parent ? [parent] : [])]); saveExpanded(viewer, workspaceId, next); return next })
  }, [parentKey, shows]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = useCallback((ref: PageRef, force?: boolean) => {
    setExpanded((was) => {
      const k = keyOf(ref), next = new Set(was), on = force ?? !was.has(k)
      if (on) next.add(k); else next.delete(k)
      saveExpanded(viewer, key, next)
      return next
    })
  }, [viewer, key])

  const rows = useMemo(() => pages && visibleRows(pages, expanded, open), [pages, expanded, open])
  const move = useCallback((page: PageRef, to: Parameters<PageTree['move']>[1]) => tree.move(page, to, pages), [tree, pages])
  return { rows, pages, failed: state.failed, notice: state.notice, toggle, move, reload: tree.load, dismiss: tree.dismiss }
}

/* The path above the open page, from the shared tree: the pages it sits under, outermost first. Empty for a page at the top
   (or one not in the list yet), so the header shows no path. */
import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { keyOf, type PageRef } from '@/engine/pages/tree'
import type { PageRepo } from '@/app/pages'
import { pathTo } from './flatten'
import { pageTreeFor } from './sharedTree'

export interface Crumb { ref: PageRef; name: string }

/** The open page's name as the shared list has it: what the header shows before the page itself has been read. */
export function usePageName({ repo, workspaceId, account, open }: { repo: PageRepo; workspaceId: string | null; account?: string; open: PageRef | null }): string | undefined {
  const tree = useMemo(() => pageTreeFor(repo, workspaceId ?? '', account), [repo, workspaceId, account])
  const { pages } = useSyncExternalStore(tree.subscribe, tree.getState)
  return open ? pages?.find((p) => p.kind === open.kind && p.id === open.id)?.name : undefined
}

/** `saved`: the open deck has a slide, so the server has its row; read the list again when that turns true. `tick`: a doc was saved. */
export function usePageCrumbs({ repo, workspaceId, account, open, saved, tick }: { repo: PageRepo; workspaceId: string | null; account?: string; open: PageRef | null; saved: boolean; tick: number }): Crumb[] {
  const tree = useMemo(() => pageTreeFor(repo, workspaceId ?? '', account), [repo, workspaceId, account])
  const { pages } = useSyncExternalStore(tree.subscribe, tree.getState)
  const openKey = open ? keyOf(open) : ''
  const known = !!open && !!pages?.some((p) => keyOf(p) === openKey)
  // The sidebar keeps the list current while it is open; this reads it when nobody has, or when the open page isn't in it yet.
  useEffect(() => { if (workspaceId && open && !known) void tree.load() }, [tree, workspaceId, openKey, saved, tick]) // eslint-disable-line react-hooks/exhaustive-deps
  return useMemo(() => {
    if (!pages || !open || !known) return []
    return pathTo(pages, open).flatMap((ref) => { const p = pages.find((x) => keyOf(x) === keyOf(ref)); return p ? [{ ref, name: p.name }] : [] })
  }, [pages, openKey, known]) // eslint-disable-line react-hooks/exhaustive-deps
}

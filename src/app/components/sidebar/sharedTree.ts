/* One list of pages per repo and workspace, shared by everything on screen that reads the tree (the sidebar, the breadcrumb),
   so a move made in the sidebar shows in the breadcrumb at once. */
import type { PageRepo } from '@/app/pages'
import { createPageTree, type PageTree } from './pageTree'

const trees = new WeakMap<PageRepo, Map<string, PageTree>>()

export function pageTreeFor(repo: PageRepo, workspaceId: string, account?: string): PageTree {
  const mine = trees.get(repo) ?? new Map<string, PageTree>()
  trees.set(repo, mine)
  const have = mine.get(workspaceId) ?? createPageTree(repo, workspaceId, account)
  mine.set(workspaceId, have)
  return have
}

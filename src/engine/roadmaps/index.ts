import type { Issue } from './types.js'

const bySibling = (a: Issue, b: Issue) => {
  if (a.sortKey !== b.sortKey) return a.sortKey < b.sortKey ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/** Live issues indexed for tree walks (build once, reuse across rollups). */
export interface IssueIndex {
  byId: Map<string, Issue>
  children(parentId: string | null): Issue[]
}

export function buildIndex(issues: Issue[]): IssueIndex {
  const live = issues.filter((i) => i.deletedAt === null)
  const byId = new Map(live.map((i) => [i.id, i]))
  const kids = new Map<string | null, Issue[]>()
  for (const i of live) {
    const list = kids.get(i.parentId) ?? []
    list.push(i)
    kids.set(i.parentId, list)
  }
  for (const list of kids.values()) list.sort(bySibling)
  return {
    byId,
    children: (parentId) => kids.get(parentId) ?? [],
  }
}

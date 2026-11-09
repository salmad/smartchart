import { keyBetween } from '../pages/tree'
import type { Issue } from './types'
import { MAX_DEPTH } from './types'
import { dateSpan, progress } from './rollup'

export { dateSpan, progress }

export const NO_ISSUE = 'No such issue.'
export const ISSUE_CYCLE = 'An issue can’t go inside itself or its sub-issues.'
export const ISSUE_TOO_DEEP = `Issues nest ${MAX_DEPTH} levels deep at most.`

function live(issues: Issue[]): Issue[] {
  return issues.filter((i) => i.deletedAt === null)
}

const bySibling = (a: Issue, b: Issue) => {
  if (a.sortKey !== b.sortKey) return a.sortKey < b.sortKey ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

export interface IssueTree {
  roots: Issue[]
  children(id: string | null): Issue[]
  get(id: string): Issue | undefined
}

export function issueTree(issues: Issue[]): IssueTree {
  const list = live(issues)
  const children = (parentId: string | null) =>
    list.filter((i) => i.parentId === parentId).sort(bySibling)
  return {
    roots: children(null),
    children,
    get: (id) => list.find((i) => i.id === id),
  }
}

export function ancestors(issues: Issue[], id: string): Issue[] {
  const byId = new Map(live(issues).map((i) => [i.id, i]))
  const out: Issue[] = []
  let cur = byId.get(id)?.parentId ?? null
  while (cur) {
    const p = byId.get(cur)
    if (!p) break
    out.push(p)
    cur = p.parentId
  }
  return out
}

export function subtree(issues: Issue[], id: string): Issue[] {
  const tree = issueTree(issues)
  const root = tree.get(id)
  if (!root) return []
  const out: Issue[] = []
  const walk = (node: Issue) => {
    out.push(node)
    for (const c of tree.children(node.id)) walk(c)
  }
  walk(root)
  return out
}

function depthOf(issues: Issue[], id: string): number {
  return ancestors(issues, id).length + 1
}

function heightBelow(issues: Issue[], id: string): number {
  const kids = issueTree(issues).children(id)
  if (!kids.length) return 1
  return 1 + Math.max(...kids.map((k) => heightBelow(issues, k.id)))
}

export function canParent(issues: Issue[], id: string, parentId: string | null): 'ok' | string {
  const tree = issueTree(issues)
  const moving = tree.get(id)
  if (parentId === null) {
    if (moving) return 'ok'
    return 'ok'
  }
  const parent = tree.get(parentId)
  if (!parent) return NO_ISSUE
  if (moving && (id === parentId || subtree(issues, id).some((n) => n.id === parentId))) return ISSUE_CYCLE
  const parentDepth = depthOf(issues, parentId)
  const h = moving ? heightBelow(issues, id) : 1
  if (parentDepth + h > MAX_DEPTH) return ISSUE_TOO_DEEP
  return 'ok'
}

export function siblingKey(
  issues: Issue[],
  parentId: string | null,
  slot: { before?: string; after?: string },
  moving?: string,
): string {
  const sibs = issueTree(issues)
    .children(parentId)
    .filter((i) => i.id !== moving)
  const at = (target: string) => sibs.findIndex((i) => i.id === target)
  let i = sibs.length
  if (slot.after) {
    const j = at(slot.after)
    if (j >= 0) i = j + 1
  } else if (slot.before) {
    const j = at(slot.before)
    if (j >= 0) i = j
  }
  const a = sibs[i - 1]?.sortKey ?? null
  let b: string | null = null
  for (let j = i; j < sibs.length && b === null; j++) {
    const k = sibs[j].sortKey
    if (a === null || k > a) b = k
  }
  return keyBetween(a, b)
}

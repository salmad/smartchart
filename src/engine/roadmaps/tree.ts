import { keyBetween } from '../pages/tree.js'
import { buildIndex } from './index.js'
import type { Issue } from './types.js'
import { MAX_DEPTH } from './types.js'
import { dateSpan, progress } from './rollup.js'

export { buildIndex, dateSpan, progress }

export const NO_ISSUE = 'No such issue.'
export const ISSUE_CYCLE = 'An issue can’t go inside itself or its sub-issues.'
export const ISSUE_TOO_DEEP = `Issues nest ${MAX_DEPTH} levels deep at most.`

export interface IssueTree {
  roots: Issue[]
  children(id: string | null): Issue[]
  get(id: string): Issue | undefined
}

export function issueTree(issues: Issue[]): IssueTree {
  const idx = buildIndex(issues)
  return {
    roots: idx.children(null),
    children: (id) => idx.children(id),
    get: (id) => idx.byId.get(id),
  }
}

export function ancestors(issues: Issue[], id: string): Issue[] {
  const idx = buildIndex(issues)
  const out: Issue[] = []
  let cur = idx.byId.get(id)?.parentId ?? null
  while (cur) {
    const p = idx.byId.get(cur)
    if (!p) break
    out.push(p)
    cur = p.parentId
  }
  return out
}

export function subtree(issues: Issue[], id: string): Issue[] {
  const idx = buildIndex(issues)
  const root = idx.byId.get(id)
  if (!root) return []
  const out: Issue[] = []
  const walk = (node: Issue) => {
    out.push(node)
    for (const c of idx.children(node.id)) walk(c)
  }
  walk(root)
  return out
}

function depthOf(idx: ReturnType<typeof buildIndex>, id: string): number {
  let n = 0
  let cur = idx.byId.get(id)
  while (cur?.parentId) {
    n++
    cur = idx.byId.get(cur.parentId)
  }
  return n + 1
}

const heightCache = new WeakMap<Issue[], Map<string, number>>()

function heightBelow(issues: Issue[], id: string): number {
  let memo = heightCache.get(issues)
  if (!memo) {
    memo = new Map()
    heightCache.set(issues, memo)
  }
  const hit = memo.get(id)
  if (hit !== undefined) return hit
  const idx = buildIndex(issues)
  const kids = idx.children(id)
  const h = kids.length ? 1 + Math.max(...kids.map((k) => heightBelow(issues, k.id))) : 1
  memo.set(id, h)
  return h
}

export function canParent(issues: Issue[], id: string, parentId: string | null): 'ok' | string {
  if (parentId === null) return 'ok'
  const idx = buildIndex(issues)
  const moving = idx.byId.get(id)
  const parent = idx.byId.get(parentId)
  if (!parent) return NO_ISSUE
  if (moving && (id === parentId || subtree(issues, id).some((n) => n.id === parentId))) return ISSUE_CYCLE
  const parentDepth = depthOf(idx, parentId)
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

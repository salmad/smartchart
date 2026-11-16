import { buildIndex } from './index.js'
import type { Issue, Status } from './types.js'

function score(status: Status): number {
  if (status === 'done') return 1
  if (status === 'in_progress') return 0.25
  return 0
}

function leavesUnder(idx: ReturnType<typeof buildIndex>, id: string): Issue[] {
  const kids = idx.children(id)
  if (!kids.length) {
    const self = idx.byId.get(id)
    return self ? [self] : []
  }
  return kids.flatMap((k) => leavesUnder(idx, k.id))
}

/** 0..1, or null when every counted leaf is Cancelled. */
export function progress(issues: Issue[], id: string): number | null {
  const idx = buildIndex(issues)
  const leaves = leavesUnder(idx, id).filter((i) => i.status !== 'cancelled')
  if (!leaves.length) return null
  const sum = leaves.reduce((n, i) => n + score(i.status), 0)
  return sum / leaves.length
}

function isDescendantOf(idx: ReturnType<typeof buildIndex>, id: string, ancestorId: string): boolean {
  let cur = idx.byId.get(id)?.parentId ?? null
  while (cur !== null) {
    if (cur === ancestorId) return true
    cur = idx.byId.get(cur)?.parentId ?? null
  }
  return false
}

/** The counted leaves under ids (Cancelled left out). An id inside another id in the set is skipped. */
function leafPool(issues: Issue[], ids: string[]): Issue[] {
  const idx = buildIndex(issues)
  const pool: Issue[] = []
  for (const id of ids) {
    if (!idx.byId.has(id)) continue
    if (ids.some((other) => other !== id && isDescendantOf(idx, id, other))) continue
    pool.push(...leavesUnder(idx, id))
  }
  return pool.filter((i) => i.status !== 'cancelled')
}

export function progressUnder(issues: Issue[], ids: string[]): number | null {
  const leaves = leafPool(issues, ids)
  if (!leaves.length) return null
  const sum = leaves.reduce((n, i) => n + score(i.status), 0)
  return sum / leaves.length
}

/** How the leaves under ids split by status: done, in progress, blocked, and the rest still open. */
export interface StatusMix {
  done: number
  in_progress: number
  blocked: number
  open: number
}

export function statusMix(issues: Issue[], ids: string[]): StatusMix {
  const mix: StatusMix = { done: 0, in_progress: 0, blocked: 0, open: 0 }
  for (const leaf of leafPool(issues, ids)) {
    if (leaf.status === 'done' || leaf.status === 'in_progress' || leaf.status === 'blocked') mix[leaf.status]++
    else mix.open++
  }
  return mix
}

const dateMemo = new WeakMap<Issue[], Map<string, { start: string | null; due: string | null }>>()

export function dateSpan(issues: Issue[], id: string): { start: string | null; due: string | null } {
  let memo = dateMemo.get(issues)
  if (!memo) {
    memo = new Map()
    dateMemo.set(issues, memo)
  }
  const hit = memo.get(id)
  if (hit) return hit

  const idx = buildIndex(issues)
  const self = idx.byId.get(id)
  if (!self) {
    const empty = { start: null, due: null }
    memo.set(id, empty)
    return empty
  }
  if (self.start != null && self.due != null) {
    const span = { start: self.start, due: self.due }
    memo.set(id, span)
    return span
  }
  const kids = idx.children(id)
  let start: string | null = self.start ?? null
  let due: string | null = self.due ?? null
  for (const k of kids) {
    const span = dateSpan(issues, k.id)
    if (span.start != null && (start == null || span.start < start)) start = span.start
    if (span.due != null && (due == null || span.due > due)) due = span.due
  }
  const span = { start, due }
  memo.set(id, span)
  return span
}

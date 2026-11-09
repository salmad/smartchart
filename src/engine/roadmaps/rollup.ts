import { buildIndex } from './index'
import type { Issue, Status } from './types'

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
  if (self.start !== null && self.due !== null) {
    const span = { start: self.start, due: self.due }
    memo.set(id, span)
    return span
  }
  const kids = idx.children(id)
  let start: string | null = self.start
  let due: string | null = self.due
  for (const k of kids) {
    const span = dateSpan(issues, k.id)
    if (span.start !== null && (start === null || span.start < start)) start = span.start
    if (span.due !== null && (due === null || span.due > due)) due = span.due
  }
  const span = { start, due }
  memo.set(id, span)
  return span
}

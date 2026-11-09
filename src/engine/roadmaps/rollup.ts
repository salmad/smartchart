import type { Issue, Status } from './types'

function live(issues: Issue[]): Issue[] {
  return issues.filter((i) => i.deletedAt === null)
}

function childrenOf(issues: Issue[], parentId: string | null): Issue[] {
  return live(issues).filter((i) => i.parentId === parentId)
}

function score(status: Status): number {
  if (status === 'done') return 1
  if (status === 'in_progress') return 0.25
  return 0
}

/** Leaf issues under `id` (descendants with no live children). */
function leavesUnder(issues: Issue[], id: string): Issue[] {
  const out: Issue[] = []
  const walk = (parentId: string) => {
    const kids = childrenOf(issues, parentId)
    if (!kids.length) {
      const self = live(issues).find((i) => i.id === parentId)
      if (self) out.push(self)
      return
    }
    for (const k of kids) walk(k.id)
  }
  walk(id)
  return out
}

/** 0..1, or null when every counted leaf is Cancelled. */
export function progress(issues: Issue[], id: string): number | null {
  const leaves = leavesUnder(issues, id).filter((i) => i.status !== 'cancelled')
  if (!leaves.length) return null
  const sum = leaves.reduce((n, i) => n + score(i.status), 0)
  return sum / leaves.length
}

export function dateSpan(issues: Issue[], id: string): { start: string | null; due: string | null } {
  const self = live(issues).find((i) => i.id === id)
  if (!self) return { start: null, due: null }
  if (self.start !== null && self.due !== null) return { start: self.start, due: self.due }
  const kids = childrenOf(issues, id)
  let start: string | null = null
  let due: string | null = null
  for (const k of kids) {
    const span = dateSpan(issues, k.id)
    if (span.start !== null && (start === null || span.start < start)) start = span.start
    if (span.due !== null && (due === null || span.due > due)) due = span.due
  }
  if (self.start !== null) start = self.start
  if (self.due !== null) due = self.due
  return { start, due }
}

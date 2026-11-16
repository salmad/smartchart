import type { Issue, Status } from '@/engine/roadmaps/types'
import { dueQuarter } from '@/engine/roadmaps/matrix'
import { dateSpan } from '@/engine/roadmaps/rollup'

export function colAria(parts: { name: string }[]): string {
  return parts.map((p) => p.name).join(', ')
}

export function issueOverdue(issue: Issue, today: string): boolean {
  if (!issue.due || issue.due >= today) return false
  return issue.status !== 'done' && issue.status !== 'cancelled'
}

/** The quarter the last of these issues is due in, children counted. */
export function lastQuarter(issues: Issue[], picks: Issue[]): string | null {
  let last = ''
  for (const p of picks) {
    const due = dateSpan(issues, p.id).due
    if (due && due > last) last = due
  }
  return last ? dueQuarter(last) : null
}

/** The one person every issue is assigned to, or null when they differ or no one is. */
export function sharedAssignee(picks: Issue[]): string | null {
  const first = picks[0]?.assignee ?? null
  return picks.every((p) => p.assignee === first) ? first : null
}

/** One status for a cell of several issues: trouble first, then movement, then done only when all are. */
export function blendStatus(picks: Issue[]): Status {
  const has = (s: Status) => picks.some((p) => p.status === s)
  if (has('blocked')) return 'blocked'
  const counted = picks.filter((p) => p.status !== 'cancelled')
  if (counted.length && counted.every((p) => p.status === 'done')) return 'done'
  if (has('in_progress') || has('done')) return 'in_progress'
  return 'todo'
}

import type { Issue } from '@/engine/roadmaps/types'
import { dueQuarter } from '@/engine/roadmaps/matrix'
import { dateSpan, progress, progressUnder } from '@/engine/roadmaps/rollup'

const DONE = new Set(['done', 'cancelled'])

export function colAria(parts: { name: string }[]): string {
  return parts.map((p) => p.name).join(', ')
}

export function issueOverdue(issue: Issue, today: string): boolean {
  if (!issue.due || issue.due >= today) return false
  return !DONE.has(issue.status)
}

export function displayDueQuarter(issues: Issue[], ids: string[]): string | null {
  let bestIso = ''
  for (const id of ids) {
    const due = dateSpan(issues, id).due
    if (!due || (bestIso && due <= bestIso)) continue
    bestIso = due
  }
  return bestIso ? dueQuarter(bestIso) : null
}

export function sharedAssignee(issues: Issue[], ids: string[]): string | null | undefined {
  let cur: string | null | undefined
  for (const id of ids) {
    const issue = issues.find((i) => i.id === id)
    if (!issue) continue
    const a = issue.assignee
    if (cur === undefined) cur = a
    else if (cur !== a) return undefined
  }
  return cur
}

export function cellProgress(issues: Issue[], ids: string[], singleId: string | null): number | null {
  if (singleId) return progress(issues, singleId)
  return progressUnder(issues, ids)
}

import { CHECK_IDS, issueFailsCheck, type CheckId } from '../roadmaps/checks.js'
import { keyOf } from '../roadmaps/fields.js'
import { buildIndex } from '../roadmaps/index.js'
import type { FieldValue, Issue, Roadmap, Status } from '../roadmaps/types.js'

export function todayUtc(now: number): string {
  return new Date(now).toISOString().slice(0, 10)
}

export interface IssueView {
  id: string
  number: number
  key: string
  title: string
  status: Status
  assignee: string | null
  start: string | null
  due: string | null
  parentId: string | null
  sortKey: string
  fields: Record<string, FieldValue>
  checks: CheckId[]
  deletedAt?: number
}

export function checksFor(issues: readonly Issue[], issueId: string, today: string): CheckId[] {
  const idx = buildIndex([...issues])
  const issue = idx.byId.get(issueId)
  if (!issue) return []
  return CHECK_IDS.filter((id) => issueFailsCheck(id, issue, idx, today))
}

export function liveTree(issues: readonly Issue[]): Issue[] {
  const idx = buildIndex([...issues])
  const out: Issue[] = []
  const walk = (parentId: string | null) => {
    for (const child of idx.children(parentId)) {
      out.push(child)
      walk(child.id)
    }
  }
  walk(null)
  return out
}

export function issueView(roadmap: Roadmap, issues: readonly Issue[], issue: Issue, today: string): IssueView {
  const view: IssueView = {
    id: issue.id,
    number: issue.number,
    key: keyOf(roadmap, issue),
    title: issue.title,
    status: issue.status,
    assignee: issue.assignee,
    start: issue.start,
    due: issue.due,
    parentId: issue.parentId,
    sortKey: issue.sortKey,
    fields: issue.fields,
    checks: checksFor(issues, issue.id, today),
  }
  if (typeof issue.deletedAt === 'number') view.deletedAt = issue.deletedAt
  return view
}
import { CHECK_IDS, issueFailsCheck, type CheckId } from '../roadmaps/checks.js'
import { keyOf } from '../roadmaps/fields.js'
import { buildIndex, type IssueIndex } from '../roadmaps/index.js'
import type { FieldValue, Issue, Roadmap, Status } from '../roadmaps/types.js'
import { matchesChips, type Chip } from '../roadmaps/view.js'

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
  /** The first day of the sprint it is in. */
  sprint: string | null
  carried: number
  parentId: string | null
  sortKey: string
  fields: Record<string, FieldValue>
  checks: CheckId[]
  deletedAt?: number
}

function checksForIndex(idx: IssueIndex, issueId: string, today: string): CheckId[] {
  const issue = idx.byId.get(issueId)
  if (!issue) return []
  return CHECK_IDS.filter((id) => issueFailsCheck(id, issue, idx, today))
}

export function checksFor(issues: readonly Issue[], issueId: string, today: string): CheckId[] {
  return checksForIndex(buildIndex([...issues]), issueId, today)
}

export function checksTouched(issues: readonly Issue[], ids: readonly string[], today: string): { issueId: string; ids: CheckId[] }[] {
  const idx = buildIndex([...issues])
  return ids.map((issueId) => ({ issueId, ids: checksForIndex(idx, issueId, today) }))
}

export function matchingIssues(issues: readonly Issue[], chips: readonly Chip[], today: string, idx?: IssueIndex): Issue[] {
  const index = idx ?? buildIndex([...issues])
  const out: Issue[] = []
  const walk = (parentId: string | null) => {
    for (const child of index.children(parentId)) {
      if (matchesChips(child, [...chips], today, index)) out.push(child)
      walk(child.id)
    }
  }
  walk(null)
  return out
}

export function issueView(roadmap: Roadmap, issues: readonly Issue[], issue: Issue, today: string, idx?: IssueIndex): IssueView {
  const index = idx ?? buildIndex([...issues])
  const checks = typeof issue.deletedAt === 'number' ? [] : checksForIndex(index, issue.id, today)
  const view: IssueView = {
    id: issue.id,
    number: issue.number,
    key: keyOf(roadmap, issue),
    title: issue.title,
    status: issue.status,
    assignee: issue.assignee,
    start: issue.start,
    due: issue.due,
    sprint: issue.sprint,
    carried: issue.carried,
    parentId: issue.parentId,
    sortKey: issue.sortKey,
    fields: issue.fields,
    checks,
  }
  if (typeof issue.deletedAt === 'number') view.deletedAt = issue.deletedAt
  return view
}
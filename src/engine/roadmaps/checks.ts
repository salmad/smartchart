import type { IssueIndex } from './index.js'
import { buildIndex } from './index.js'
import type { Issue, Status } from './types.js'
import type { Chip } from './view.js'

export const CHECK_IDS = [
  'no_dates',
  'overdue',
  'blocked',
  'no_assignee',
  'long',
  'outside_parent',
  'done_open',
] as const

export type CheckId = (typeof CHECK_IDS)[number]

export const CHECK_THRESHOLDS = { longDays: 92 } as const

export const CHECK_COPY: Record<CheckId, { label: string; detail: string }> = {
  no_dates: { label: 'No dates', detail: 'Open, with no sub-issues, and no start or no due.' },
  overdue: { label: 'Overdue', detail: 'Due date has passed, and it isn’t Done or Cancelled.' },
  blocked: { label: 'Blocked', detail: 'Status is Blocked.' },
  no_assignee: { label: 'No assignee', detail: 'Open, with no sub-issues, and no one assigned.' },
  long: { label: 'Long', detail: 'Open, with no sub-issues, and longer than 3 months.' },
  outside_parent: { label: 'Outside its parent', detail: 'Starts before or ends after its parent’s own dates.' },
  done_open: { label: 'Done with open children', detail: 'Marked Done while work under it is still open.' },
}

export interface CheckCard {
  id: CheckId
  issueIds: readonly string[]
  count: number
}

export interface CheckReport {
  issues: number
  cards: readonly CheckCard[]
}

const DONE: Status[] = ['done', 'cancelled']
const OPEN: Status[] = ['backlog', 'todo', 'in_progress', 'blocked']

function isOpen(status: Status): boolean {
  return OPEN.includes(status)
}

function isLeaf(idx: IssueIndex, id: string): boolean {
  return idx.children(id).length === 0
}

function daySpan(start: string, due: string): number {
  const a = Date.parse(`${start}T00:00:00Z`)
  const b = Date.parse(`${due}T00:00:00Z`)
  return Math.floor((b - a) / 86_400_000)
}

function fieldRaw(issue: Issue, fieldId: string): string | undefined {
  if (!(fieldId in issue.fields)) return undefined
  return String(issue.fields[fieldId] ?? '')
}

function nonCheckChipMatches(issue: Issue, chip: Chip, today: string): boolean {
  switch (chip.on) {
    case 'check':
      return true
    case 'status': {
      const hit = chip.values.includes(issue.status)
      return chip.is ? hit : !hit
    }
    case 'assignee': {
      const hit = chip.values.includes(issue.assignee)
      return chip.is ? hit : !hit
    }
    case 'field': {
      const empty = !(chip.field in issue.fields)
      const val = empty ? null : fieldRaw(issue, chip.field) ?? ''
      const hit = chip.values.some((v) => (v === null ? empty : v === val))
      return chip.is ? hit : !hit
    }
    case 'dates': {
      const due = issue.due
      if (due === null) return false
      if (chip.when === 'overdue') {
        if (DONE.includes(issue.status)) return false
        return due < today
      }
      if (chip.date === undefined) return false
      if (chip.when === 'before') return due < chip.date
      return due > chip.date
    }
    default:
      return false
  }
}

function passesFilters(issue: Issue, chips: readonly Chip[], today: string): boolean {
  const active = chips.filter((c) => c.on !== 'check')
  if (!active.length) return true
  return active.every((c) => nonCheckChipMatches(issue, c, today))
}

function liveDescendants(idx: IssueIndex, id: string): Issue[] {
  const out: Issue[] = []
  const walk = (nodeId: string) => {
    for (const c of idx.children(nodeId)) {
      out.push(c)
      walk(c.id)
    }
  }
  walk(id)
  return out
}

export function issueFailsCheck(id: CheckId, issue: Issue, idx: IssueIndex, today: string): boolean {
  switch (id) {
    case 'no_dates':
      return isOpen(issue.status) && isLeaf(idx, issue.id) && (issue.start === null || issue.due === null)
    case 'overdue':
      return issue.due !== null && issue.due < today && !DONE.includes(issue.status)
    case 'blocked':
      return issue.status === 'blocked'
    case 'no_assignee':
      return isOpen(issue.status) && isLeaf(idx, issue.id) && issue.assignee === null
    case 'long':
      if (!isOpen(issue.status) || !isLeaf(idx, issue.id)) return false
      if (issue.start === null || issue.due === null) return false
      return daySpan(issue.start, issue.due) > CHECK_THRESHOLDS.longDays
    case 'outside_parent': {
      if (issue.status === 'cancelled') return false
      const parentId = issue.parentId
      if (!parentId) return false
      const parent = idx.byId.get(parentId)
      if (!parent) return false
      const parentStart = parent.start
      const parentDue = parent.due
      if (parentStart === null && parentDue === null) return false
      if (parentStart !== null && issue.start !== null && issue.start < parentStart) return true
      if (parentDue !== null && issue.due !== null && issue.due > parentDue) return true
      return false
    }
    case 'done_open': {
      if (issue.status !== 'done') return false
      for (const d of liveDescendants(idx, issue.id)) {
        if (d.status === 'cancelled') continue
        if (isOpen(d.status)) return true
      }
      return false
    }
    default:
      return false
  }
}

function treeOrder(ids: string[], idx: IssueIndex): string[] {
  const want = new Set(ids)
  const out: string[] = []
  const walk = (parentId: string | null) => {
    for (const c of idx.children(parentId)) {
      if (want.has(c.id)) out.push(c.id)
      walk(c.id)
    }
  }
  walk(null)
  return out
}

export function runChecks(
  issues: readonly Issue[],
  opts: { today: string; chips?: readonly Chip[] },
): CheckReport {
  const live = issues.filter((i) => i.deletedAt === null)
  const idx = buildIndex(live)
  const chips = opts.chips ?? []
  const filtered = live.filter((i) => passesFilters(i, chips, opts.today))

  const byCheck = new Map<CheckId, string[]>()
  for (const id of CHECK_IDS) byCheck.set(id, [])

  for (const issue of filtered) {
    for (const id of CHECK_IDS) {
      if (issueFailsCheck(id, issue, idx, opts.today)) byCheck.get(id)!.push(issue.id)
    }
  }

  const distinct = new Set<string>()
  const cards: CheckCard[] = CHECK_IDS.map((id) => {
    const issueIds = treeOrder(byCheck.get(id) ?? [], idx)
    for (const i of issueIds) distinct.add(i)
    return { id, issueIds, count: issueIds.length }
  })

  return { issues: distinct.size, cards }
}

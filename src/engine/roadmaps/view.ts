import { buildIndex } from './index'
import { progress } from './rollup'
import type { FieldDef, FieldValue, Issue, RoadmapState, Status } from './types'
import { STATUS_LABEL, STATUSES } from './types'

export type Chip =
  | { on: 'status'; is: boolean; values: Status[] }
  | { on: 'assignee'; is: boolean; values: (string | null)[] }
  | { on: 'field'; field: string; is: boolean; values: (string | null)[] }
  | { on: 'dates'; when: 'overdue' | 'before' | 'after'; date?: string }

export interface ViewSettings {
  chips: Chip[]
  groupBy: { on: 'status' | 'assignee' } | { on: 'field'; field: string } | null
  sort: 'order' | 'due' | 'start' | 'status' | 'updated'
  columns: string[]
  collapsed: string[]
}

export type TableRow =
  | { kind: 'group'; key: string; label: string; count: number; progress: number | null }
  | { kind: 'issue'; issue: Issue; depth: number; dim: boolean; hasChildren: boolean; open: boolean }

export const DEFAULT_VIEW: ViewSettings = {
  chips: [],
  groupBy: null,
  sort: 'order',
  columns: ['status', 'assignee', 'due', 'start'],
  collapsed: [],
}

const DONE: Status[] = ['done', 'cancelled']

function fieldRaw(issue: Issue, fieldId: string): FieldValue | undefined {
  return issue.fields[fieldId]
}

function fieldEmpty(issue: Issue, fieldId: string): boolean {
  return !(fieldId in issue.fields)
}

function chipMatches(issue: Issue, chip: Chip, today: string): boolean {
  switch (chip.on) {
    case 'status': {
      const hit = chip.values.includes(issue.status)
      return chip.is ? hit : !hit
    }
    case 'assignee': {
      const hit = chip.values.includes(issue.assignee)
      return chip.is ? hit : !hit
    }
    case 'field': {
      const empty = fieldEmpty(issue, chip.field)
      const val = empty ? null : String(fieldRaw(issue, chip.field) ?? '')
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
      return true
  }
}

function matchesFilters(issue: Issue, chips: Chip[], today: string): boolean {
  if (!chips.length) return true
  return chips.every((c) => chipMatches(issue, c, today))
}

function sortSiblings(list: Issue[], sort: ViewSettings['sort']): Issue[] {
  const out = [...list]
  const statusRank = new Map(STATUSES.map((s, i) => [s, i]))
  out.sort((a, b) => {
    let cmp = 0
    switch (sort) {
      case 'order':
        cmp = a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0
        break
      case 'due': {
        const ad = a.due
        const bd = b.due
        if (ad === null && bd === null) cmp = 0
        else if (ad === null) cmp = 1
        else if (bd === null) cmp = -1
        else cmp = ad < bd ? -1 : ad > bd ? 1 : 0
        break
      }
      case 'start': {
        const as = a.start
        const bs = b.start
        if (as === null && bs === null) cmp = 0
        else if (as === null) cmp = 1
        else if (bs === null) cmp = -1
        else cmp = as < bs ? -1 : as > bs ? 1 : 0
        break
      }
      case 'status':
        cmp = (statusRank.get(a.status) ?? 0) - (statusRank.get(b.status) ?? 0)
        break
      case 'updated':
        cmp = a.updatedAt - b.updatedAt
        break
    }
    if (cmp !== 0) return cmp
    if (a.sortKey !== b.sortKey) return a.sortKey < b.sortKey ? -1 : 1
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
  return out
}

function branchVisible(
  id: string,
  idx: ReturnType<typeof buildIndex>,
  chips: Chip[],
  today: string,
  collapsed: Set<string>,
): boolean {
  const node = idx.byId.get(id)
  if (!node) return false
  if (matchesFilters(node, chips, today)) return true
  if (collapsed.has(id)) {
    for (const k of idx.children(id)) {
      if (matchesFilters(k, chips, today)) return true
    }
    return false
  }
  for (const k of idx.children(id)) {
    if (branchVisible(k.id, idx, chips, today, collapsed)) return true
  }
  return false
}

function groupKey(
  issue: Issue,
  groupBy: ViewSettings['groupBy'],
  defs: FieldDef[],
): { key: string; label: string } {
  if (!groupBy) return { key: '', label: '' }
  if (groupBy.on === 'status') {
    return { key: issue.status, label: STATUS_LABEL[issue.status] }
  }
  if (groupBy.on === 'assignee') {
    const a = issue.assignee
    return { key: a ?? '', label: a ?? 'Unassigned' }
  }
  if (groupBy.on !== 'field') return { key: '', label: '' }
  const def = defs.find((d) => d.id === groupBy.field)
  const empty = fieldEmpty(issue, groupBy.field)
  const raw = fieldRaw(issue, groupBy.field)
  if (empty || raw === undefined) return { key: '', label: 'Empty' }
  const sid = String(raw)
  const opt = def?.type === 'choice' ? def.options?.find((o) => o.id === sid) : undefined
  return { key: sid, label: opt?.name ?? sid }
}

function appendIssues(
  out: TableRow[],
  issues: Issue[],
  idx: ReturnType<typeof buildIndex>,
  chips: Chip[],
  today: string,
  collapsed: Set<string>,
  sort: ViewSettings['sort'],
  depth: number,
): { count: number; progressSum: number; progressN: number } {
  let count = 0
  let progressSum = 0
  let progressN = 0
  const roots = sortSiblings(
    idx.children(null).filter((i) => branchVisible(i.id, idx, chips, today, collapsed)),
    sort,
  )
  void issues
  const walk = (node: Issue, d: number) => {
    const kids = idx.children(node.id)
    const hasChildren = kids.length > 0
    const open = !collapsed.has(node.id)
    const selfMatch = matchesFilters(node, chips, today)
    const dim = chips.length > 0 && !selfMatch
    out.push({ kind: 'issue', issue: node, depth: d, dim, hasChildren, open })
    count++
    const p = progress(issues, node.id)
    if (p !== null) {
      progressSum += p
      progressN++
    }
    if (!open) {
      for (const k of sortSiblings(kids, sort)) {
        if (matchesFilters(k, chips, today)) walk(k, d + 1)
      }
      return
    }
    for (const k of sortSiblings(kids.filter((c) => branchVisible(c.id, idx, chips, today, collapsed)), sort)) {
      walk(k, d + 1)
    }
  }
  for (const r of roots) walk(r, depth)
  return { count, progressSum, progressN }
}

export function liveChips(defs: FieldDef[], chips: Chip[]): Chip[] {
  const byId = new Map(defs.map((d) => [d.id, d]))
  const out: Chip[] = []
  for (const chip of chips) {
    if (chip.on === 'field') {
      const def = byId.get(chip.field)
      if (!def) continue
      let values = chip.values
      if (def.type === 'choice') {
        const opts = new Set(def.options?.map((o) => o.id))
        values = values.filter((v) => v === null || opts.has(v))
      }
      if (!values.length) continue
      out.push({ ...chip, values })
      continue
    }
    out.push(chip)
  }
  return out
}

export function tableRows(s: RoadmapState, v: ViewSettings, today: string): TableRow[] {
  const live = s.issues.filter((i) => i.deletedAt === null)
  const idx = buildIndex(live)
  const collapsed = new Set(v.collapsed)
  const chips = liveChips(s.roadmap.fields, v.chips)
  const out: TableRow[] = []

  if (!v.groupBy) {
    appendIssues(out, live, idx, chips, today, collapsed, v.sort, 0)
    return out
  }

  const tops = sortSiblings(
    idx.children(null).filter((i) => branchVisible(i.id, idx, chips, today, collapsed)),
    v.sort,
  )
  const buckets = new Map<string, { label: string; tops: Issue[] }>()
  for (const t of tops) {
    const { key, label } = groupKey(t, v.groupBy, s.roadmap.fields)
    const b = buckets.get(key) ?? { label, tops: [] }
    b.tops.push(t)
    buckets.set(key, b)
  }

  const keys = [...buckets.keys()].sort((a, b) => {
    const la = buckets.get(a)!.label
    const lb = buckets.get(b)!.label
    return la.localeCompare(lb)
  })

  for (const key of keys) {
    const bucket = buckets.get(key)!
    let count = 0
    let progressSum = 0
    let progressN = 0
    const groupIssues: TableRow[] = []
    for (const top of bucket.tops) {
      const partial = emitSubtree(groupIssues, live, idx, top, chips, today, collapsed, v.sort, 0)
      count += partial.count
      progressSum += partial.progressSum
      progressN += partial.progressN
    }
    const groupProgress = progressN ? progressSum / progressN : null
    out.push({ kind: 'group', key, label: bucket.label, count, progress: groupProgress })
    out.push(...groupIssues)
  }

  return out
}

function emitSubtree(
  out: TableRow[],
  issues: Issue[],
  idx: ReturnType<typeof buildIndex>,
  top: Issue,
  chips: Chip[],
  today: string,
  collapsed: Set<string>,
  sort: ViewSettings['sort'],
  depth: number,
): { count: number; progressSum: number; progressN: number } {
  let count = 0
  let progressSum = 0
  let progressN = 0
  const walk = (node: Issue, d: number) => {
    const kids = idx.children(node.id)
    const hasChildren = kids.length > 0
    const open = !collapsed.has(node.id)
    const selfMatch = matchesFilters(node, chips, today)
    const dim = chips.length > 0 && !selfMatch
    out.push({ kind: 'issue', issue: node, depth: d, dim, hasChildren, open })
    count++
    const p = progress(issues, node.id)
    if (p !== null) {
      progressSum += p
      progressN++
    }
    if (!open) {
      for (const k of sortSiblings(kids, sort)) {
        if (matchesFilters(k, chips, today)) walk(k, d + 1)
      }
      return
    }
    for (const k of sortSiblings(kids.filter((c) => branchVisible(c.id, idx, chips, today, collapsed)), sort)) {
      walk(k, d + 1)
    }
  }
  walk(top, depth)
  return { count, progressSum, progressN }
}

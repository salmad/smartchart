import type { Scale } from './gantt.js'
import { issueFailsCheck, type CheckId } from './checks.js'
import { buildIndex, type IssueIndex } from './index.js'
import { dateSpan, progress, progressUnder } from './rollup.js'
import type { FieldDef, FieldValue, Issue, RoadmapState, Status } from './types.js'
import { STATUS_LABEL, STATUSES } from './types.js'

export type Chip =
  | { on: 'status'; is: boolean; values: Status[] }
  | { on: 'assignee'; is: boolean; values: (string | null)[] }
  | { on: 'field'; field: string; is: boolean; values: (string | null)[] }
  | { on: 'dates'; when: 'overdue' | 'before' | 'after'; date?: string }
  | { on: 'check'; id: CheckId }

export interface MatrixSettings {
  cols: string[]
  pins: { fieldId: string; optionId: string }[]
  /** Rows whose children show. The matrix opens compact, and keeps this apart from the list's `collapsed`. */
  expanded: string[]
  /** Column groups (the first column field's options, by id) folded into one roll-up column. */
  foldedCols: string[]
  show: { progress: boolean; dates: boolean; assignee: boolean }
}

/** One level of grouping. The matrix uses only the field levels: its groups need a field's values. */
export type GroupKey = { on: 'status' } | { on: 'assignee' } | { on: 'field'; field: string }

export const MAX_GROUP_LEVELS = 2

export interface ViewSettings {
  chips: Chip[]
  /** The levels that group the rows in every view, outermost first (at most two). The issue tree sits inside the last. */
  groupBy: GroupKey[]
  /** Group rows folded shut, by their path (`ws=gtm/c=uk`), shared by every view: their issues hide, their roll-up stays. */
  folded: string[]
  sort: 'order' | 'due' | 'start' | 'status' | 'updated'
  columns: string[]
  collapsed: string[]
  layout: 'table' | 'gantt' | 'matrix' | 'checks'
  scale: Scale
  matrix: MatrixSettings
}

export const DEFAULT_MATRIX: MatrixSettings = {
  cols: [],
  pins: [],
  expanded: [],
  foldedCols: [],
  show: { progress: true, dates: true, assignee: false },
}

export type TableRow =
  /** `key` is the group's path; `tops` are the issues whose dates make its span (its leaves); `empty` is the group with no value. */
  | { kind: 'group'; key: string; label: string; count: number; progress: number | null; depth: number; open: boolean; empty: boolean; tops: string[] }
  /** `key` is unique on screen: under groups a parent can show more than once, so the key carries its group's path.
      `inset` is how many group levels sit above the row beyond the first, for its indent only. `part` is a parent's
      share inside its group (dates and progress of only that group's work), when the group holds less than all of it. */
  | {
      kind: 'issue'
      key: string
      issue: Issue
      depth: number
      dim: boolean
      hasChildren: boolean
      open: boolean
      inset?: number
      part?: { start: string | null; due: string | null; progress: number | null }
    }

export const DEFAULT_VIEW: ViewSettings = {
  chips: [],
  groupBy: [],
  folded: [],
  sort: 'order',
  columns: ['status', 'assignee', 'start', 'due'],
  collapsed: [],
  layout: 'table',
  scale: 'month',
  matrix: DEFAULT_MATRIX,
}

const DONE: Status[] = ['done', 'cancelled']

function fieldRaw(issue: Issue, fieldId: string): FieldValue | undefined {
  return issue.fields[fieldId]
}

function fieldEmpty(issue: Issue, fieldId: string): boolean {
  return !(fieldId in issue.fields)
}

function chipMatches(issue: Issue, chip: Chip, today: string, idx: IssueIndex): boolean {
  switch (chip.on) {
    case 'check':
      return issueFailsCheck(chip.id, issue, idx, today)
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
      return false
  }
}

export function matchesChips(issue: Issue, chips: Chip[], today: string, idx: IssueIndex): boolean {
  if (!chips.length) return true
  return chips.every((c) => chipMatches(issue, c, today, idx))
}

export function sortIssues(list: Issue[], sort: ViewSettings['sort']): Issue[] {
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
  if (matchesChips(node, chips, today, idx)) return true
  if (collapsed.has(id)) {
    for (const k of idx.children(id)) {
      if (matchesChips(k, chips, today, idx) || branchVisible(k.id, idx, chips, today, collapsed)) return true
    }
    return false
  }
  for (const k of idx.children(id)) {
    if (branchVisible(k.id, idx, chips, today, collapsed)) return true
  }
  return false
}

/** Fold or open one group, or, with `all`, every group at its level (`level` lists their keys): they all follow
    the one clicked. Works for the list's and the matrix's group paths alike. */
export function toggleFolded(folded: string[], key: string, level: string[], all: boolean): string[] {
  const shut = folded.includes(key)
  const keys = all ? level : [key]
  return shut ? folded.filter((k) => !keys.includes(k)) : [...new Set([...folded, ...keys])]
}

/** The earliest start and latest due across some issues. */
function spanOf(issues: Issue[], some: Issue[]): { start: string | null; due: string | null } {
  let start: string | null = null
  let due: string | null = null
  for (const i of some) {
    const sp = dateSpan(issues, i.id)
    if (sp.start !== null && (start === null || sp.start < start)) start = sp.start
    if (sp.due !== null && (due === null || sp.due > due)) due = sp.due
  }
  return { start, due }
}

/** "No workstream" for a field called Workstream; a name that opens with an acronym keeps its capitals. */
export function emptyLabel(name: string): string {
  const lower = /^[A-Z][a-z]/.test(name) ? name[0].toLowerCase() + name.slice(1) : name
  return `No ${lower}`
}

/** A level's part of a group path: `status=todo`, `assignee=u1`, `<field id>=<value>`; no value is an empty value. */
export function groupSegment(level: GroupKey, value: string | null): string {
  const on = level.on === 'field' ? level.field : level.on
  return `${on}=${value ?? ''}`
}

/** An issue's own value on a level, as its group key part; null when it has none. */
function ownValue(issue: Issue, level: GroupKey): string | null {
  if (level.on === 'status') return issue.status
  if (level.on === 'assignee') return issue.assignee
  const raw = fieldRaw(issue, level.field)
  return raw === undefined || raw === '' ? null : String(raw)
}

function levelLabel(level: GroupKey, value: string | null, defs: FieldDef[], names?: ReadonlyMap<string, string>): string {
  if (level.on === 'status') return value ? STATUS_LABEL[value as Status] ?? value : ''
  if (level.on === 'assignee') return value ? (names?.get(value) ?? value) : 'Unassigned'
  const def = defs.find((d) => d.id === level.field)
  if (value === null) return emptyLabel(def?.name ?? 'value')
  const opt = def?.type === 'choice' ? def.options?.find((o) => o.id === value) : undefined
  return def?.type === 'person' ? (names?.get(value) ?? value) : (opt?.name ?? value)
}

/** The grouping levels that still name something: a field that was deleted drops out. */
export function liveGroupBy(defs: FieldDef[], groupBy: GroupKey[]): GroupKey[] {
  const seen = new Set<string>()
  const out: GroupKey[] = []
  for (const g of groupBy) {
    const id = g.on === 'field' ? g.field : g.on
    if (seen.has(id) || (g.on === 'field' && !defs.some((d) => d.id === g.field))) continue
    seen.add(id)
    out.push(g)
  }
  return out.slice(0, MAX_GROUP_LEVELS)
}

function walkVisibleIssues(
  out: TableRow[],
  issues: Issue[],
  idx: ReturnType<typeof buildIndex>,
  chips: Chip[],
  today: string,
  collapsed: Set<string>,
  sort: ViewSettings['sort'],
  roots: Issue[],
  depth: number,
  keep?: (i: Issue) => boolean,
): { count: number; progressSum: number; progressN: number } {
  let count = 0
  let progressSum = 0
  let progressN = 0
  const walk = (node: Issue, d: number) => {
    const kids = idx.children(node.id)
    const nextKids = sortIssues(
      kids.filter((c) => branchVisible(c.id, idx, chips, today, collapsed) && (keep?.(c) ?? true)),
      sort,
    )
    const hasChildren = keep ? nextKids.length > 0 : kids.length > 0
    const open = !collapsed.has(node.id)
    const selfMatch = matchesChips(node, chips, today, idx)
    const dim = chips.length > 0 && !selfMatch
    out.push({ kind: 'issue', key: node.id, issue: node, depth: d, dim, hasChildren, open })
    count++
    const p = progress(issues, node.id)
    if (p !== null) {
      progressSum += p
      progressN++
    }
    for (const k of nextKids) walk(k, d + 1)
  }
  for (const r of roots) walk(r, depth)
  return { count, progressSum, progressN }
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
  const roots = sortIssues(
    idx.children(null).filter((i) => branchVisible(i.id, idx, chips, today, collapsed)),
    sort,
  )
  return walkVisibleIssues(out, issues, idx, chips, today, collapsed, sort, roots, depth)
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

/** `names` maps a person's id to their name, so an Assignee group reads and sorts by name, not by id. Rows group by
    up to two levels, each placed by its top issue's value; a folded group keeps its header, count and progress. */
export function tableRows(s: RoadmapState, v: ViewSettings, today: string, names?: ReadonlyMap<string, string>): TableRow[] {
  const live = s.issues.filter((i) => i.deletedAt === null)
  const idx = buildIndex(live)
  const collapsed = new Set(v.collapsed)
  const folded = new Set(v.folded)
  const chips = liveChips(s.roadmap.fields, v.chips)
  const levels = liveGroupBy(s.roadmap.fields, v.groupBy)
  const out: TableRow[] = []

  if (!levels.length) {
    appendIssues(out, live, idx, chips, today, collapsed, v.sort, 0)
    return out
  }

  const tops = sortIssues(
    idx.children(null).filter((i) => branchVisible(i.id, idx, chips, today, collapsed)),
    v.sort,
  )

  /* A field level places work the way the matrix does: a sub-issue with no value takes its parent's, and a parent
     shows under every group its work reaches, each time with only that part. Status and person place the top issue,
     and its sub-issues follow it. */
  const spreads = (g: GroupKey) => g.on === 'field'
  const effMemo = new Map<string, string | null>()
  const eff = (i: Issue, g: GroupKey): string | null => {
    const k = `${i.id}\u0000${groupSegment(g, null)}`
    if (effMemo.has(k)) return effMemo.get(k) ?? null
    const own = ownValue(i, g)
    const parent = i.parentId !== null ? idx.byId.get(i.parentId) : undefined
    const value = own ?? (spreads(g) && parent ? eff(parent, g) : null)
    effMemo.set(k, value)
    return value
  }
  type Ctx = { level: GroupKey; value: string | null }[]
  const leaf = (i: Issue) => idx.children(i.id).length === 0
  const fitsSelf = (i: Issue, ctx: Ctx) =>
    ctx.every((c) => !spreads(c.level) || ((leaf(i) || ownValue(i, c.level) !== null) && eff(i, c.level) === c.value))
  const subtreeOf = (i: Issue): Issue[] => [i, ...idx.children(i.id).flatMap(subtreeOf)]
  const matches = (i: Issue) => matchesChips(i, chips, today, idx)
  /** The work under a node (itself included) that the filters keep and that belongs in these groups. */
  const fitting = (i: Issue, ctx: Ctx) => subtreeOf(i).filter((m) => (!chips.length || matches(m)) && fitsSelf(m, ctx))
  const topFits = (t: Issue, ctx: Ctx) => ctx.every((c) => spreads(c.level) || ownValue(t, c.level) === c.value)
  const inGroup = (t: Issue, ctx: Ctx) => topFits(t, ctx) && fitting(t, ctx).length > 0

  const group = (level: number, ctx: Ctx, path: string) => {
    const by = levels[level]
    const members = tops.filter((t) => topFits(t, ctx))
    const seen = new Set<string | null>()
    for (const t of members) {
      if (!spreads(by)) { seen.add(ownValue(t, by)); continue }
      for (const m of fitting(t, ctx)) if (leaf(m) || ownValue(m, by) !== null) seen.add(eff(m, by))
    }
    const order = by.on === 'field' ? s.roadmap.fields.find((d) => d.id === by.field)?.options?.map((o) => o.id) : by.on === 'status' ? [...STATUSES] : undefined
    // A value the field no longer lists comes after the ones it does.
    const rank = (k: string) => (order ? (order.indexOf(k) + order.length + 1) % (order.length + 1) : 0)
    const label = (v: string | null) => levelLabel(by, v, s.roadmap.fields, names)
    const values = [...seen].sort((a, b) => {
      // The group with no value (Unassigned, No workstream) goes last.
      if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1
      if (order && rank(a) !== rank(b)) return rank(a) - rank(b)
      return label(a).localeCompare(label(b), undefined, { numeric: true })
    })
    for (const value of values) {
      const inner: Ctx = [...ctx, { level: by, value }]
      const groupTops = members.filter((t) => inGroup(t, inner))
      if (!groupTops.length) continue
      const key = path ? `${path}/${groupSegment(by, value)}` : groupSegment(by, value)
      const open = !folded.has(key)
      const rows: TableRow[] = []
      let count = 0
      const keep = (i: Issue) => fitting(i, inner).length > 0
      for (const top of groupTops) count += walkVisibleIssues(rows, live, idx, chips, today, collapsed, v.sort, [top], 0, keep).count
      const leavesIn = (i: Issue) => fitting(i, inner).filter(leaf)
      const groupLeaves = groupTops.flatMap(leavesIn)
      const shown = rows.map((r): TableRow => {
        if (r.kind !== 'issue') return r
        const own = { ...r, key: `${key}/${r.issue.id}`, ...(level > 0 ? { inset: level } : {}) }
        if (!r.hasChildren) return own
        const inside = leavesIn(r.issue)
        if (inside.length === subtreeOf(r.issue).filter(leaf).length) return own
        return { ...own, part: { ...spanOf(live, inside), progress: progressUnder(live, inside.map((i) => i.id)) } }
      })
      out.push({
        kind: 'group',
        key,
        label: label(value),
        count,
        progress: progressUnder(live, groupLeaves.map((i) => i.id)),
        depth: level,
        open,
        empty: value === null,
        tops: groupLeaves.length ? groupLeaves.map((i) => i.id) : groupTops.map((t) => t.id),
      })
      if (!open) continue
      if (level + 1 < levels.length) group(level + 1, inner, key)
      else out.push(...shown)
    }
  }

  group(0, [], '')
  return out
}

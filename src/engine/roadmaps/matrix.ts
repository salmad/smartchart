import { buildIndex } from './index.js'
import { progressUnder } from './rollup.js'
import type { FieldDef, FieldValue, Issue, RoadmapState, Status } from './types.js'
import {
  liveChips,
  matchesChips,
  sortIssues,
  type MatrixSettings,
  type ViewSettings,
} from './view.js'

export interface MatrixCol {
  key: string
  parts: { fieldId: string; optionId: string; name: string; emoji?: string }[]
}

export type MatrixCell =
  | { kind: 'empty' }
  | { kind: 'one'; issueId: string }
  | { kind: 'many'; issueIds: string[] }

export interface MatrixGroupCell {
  issueIds: string[]
  progress: number | null
  worst: boolean
}

export type MatrixRow =
  | { kind: 'group'; key: string; label: string; count: number; cells: MatrixGroupCell[] }
  | { kind: 'issue'; issue: Issue; depth: number; dim: boolean; hasChildren: boolean; open: boolean; cells: MatrixCell[] }

const DONE: Status[] = ['done', 'cancelled']

export function dueQuarter(iso: string): string {
  const [y, m] = iso.split('-').map(Number)
  const q = Math.floor((m - 1) / 3) + 1
  return `Q${q} ${y}`
}

export function liveMatrix(defs: FieldDef[], matrix: MatrixSettings): MatrixSettings {
  const byId = new Map(defs.map((d) => [d.id, d]))
  let rowField = matrix.rowField
  if (rowField) {
    const def = byId.get(rowField)
    if (!def || def.type !== 'choice') rowField = null
  }
  const cols: string[] = []
  for (const id of matrix.cols) {
    if (id === rowField) continue
    const def = byId.get(id)
    if (def?.type === 'choice') cols.push(id)
    if (cols.length >= 2) break
  }
  const pins = matrix.pins.filter((p) => {
    const def = byId.get(p.fieldId)
    if (!def || def.type !== 'choice') return false
    return def.options?.some((o) => o.id === p.optionId) ?? false
  })
  return { ...matrix, rowField, cols: cols.slice(0, 2), pins }
}

function fieldRaw(issue: Issue, fieldId: string): FieldValue | undefined {
  return issue.fields[fieldId]
}

function fieldChoiceId(issue: Issue, fieldId: string): string | null {
  if (!(fieldId in issue.fields)) return null
  return String(fieldRaw(issue, fieldId) ?? '')
}

function branchVisible(
  id: string,
  idx: ReturnType<typeof buildIndex>,
  chips: ViewSettings['chips'],
  today: string,
  collapsed: Set<string>,
): boolean {
  const node = idx.byId.get(id)
  if (!node) return false
  if (matchesChips(node, chips, today)) return true
  if (collapsed.has(id)) {
    for (const k of idx.children(id)) {
      if (matchesChips(k, chips, today) || branchVisible(k.id, idx, chips, today, collapsed)) return true
    }
    return false
  }
  for (const k of idx.children(id)) {
    if (branchVisible(k.id, idx, chips, today, collapsed)) return true
  }
  return false
}

function subtree(issueId: string, idx: ReturnType<typeof buildIndex>): Issue[] {
  const out: Issue[] = []
  const walk = (id: string) => {
    const node = idx.byId.get(id)
    if (!node) return
    out.push(node)
    for (const k of idx.children(id)) walk(k.id)
  }
  walk(issueId)
  return out
}

function columnMatches(issue: Issue, col: MatrixCol): boolean {
  for (const part of col.parts) {
    const val = fieldChoiceId(issue, part.fieldId)
    if (val !== part.optionId) return false
  }
  return true
}

function topMostInSubtree(
  hits: Issue[],
  idx: ReturnType<typeof buildIndex>,
  rootId: string,
): Issue[] {
  const hitIds = new Set(hits.map((h) => h.id))
  const inSubtree = new Set(subtree(rootId, idx).map((i) => i.id))
  return hits.filter((h) => {
    let p = idx.byId.get(h.id)?.parentId ?? null
    while (p !== null && inSubtree.has(p)) {
      if (hitIds.has(p)) return false
      p = idx.byId.get(p)?.parentId ?? null
    }
    return true
  })
}

function hitsInRowColumn(
  rootId: string,
  col: MatrixCol,
  idx: ReturnType<typeof buildIndex>,
  chips: ViewSettings['chips'],
  today: string,
): Issue[] {
  const candidates = subtree(rootId, idx)
    .filter((i) => matchesChips(i, chips, today) && columnMatches(i, col))
  return topMostInSubtree(candidates, idx, rootId)
}

function toCell(hits: Issue[]): MatrixCell {
  if (!hits.length) return { kind: 'empty' }
  if (hits.length === 1) return { kind: 'one', issueId: hits[0].id }
  return { kind: 'many', issueIds: hits.map((h) => h.id) }
}

function cellIssueIds(cell: MatrixCell): string[] {
  if (cell.kind === 'empty') return []
  if (cell.kind === 'one') return [cell.issueId]
  return cell.issueIds
}

function optionMeta(def: FieldDef, optionId: string): { name: string; emoji?: string } {
  const opt = def.options?.find((o) => o.id === optionId)
  return { name: opt?.name ?? optionId, emoji: opt?.emoji }
}

function colKey(parts: { fieldId: string; optionId: string }[]): string {
  return parts.map((p) => `${p.fieldId}:${p.optionId}`).join('|')
}

function buildColumns(
  defs: FieldDef[],
  live: Issue[],
  chips: ViewSettings['chips'],
  today: string,
  matrix: MatrixSettings,
): MatrixCol[] {
  if (!matrix.cols.length) return []
  const byId = new Map(defs.map((d) => [d.id, d]))
  const hits = live.filter((i) => matchesChips(i, chips, today))
  const pinSet = (fieldId: string) =>
    new Set(matrix.pins.filter((p) => p.fieldId === fieldId).map((p) => p.optionId))

  if (matrix.cols.length === 1) {
    const fieldId = matrix.cols[0]
    const def = byId.get(fieldId)
    if (!def?.options) return []
    const used = new Set<string>()
    for (const h of hits) {
      const v = fieldChoiceId(h, fieldId)
      if (v !== null) used.add(v)
    }
    const pinned = pinSet(fieldId)
    const out: MatrixCol[] = []
    for (const opt of def.options) {
      if (!used.has(opt.id) && !pinned.has(opt.id)) continue
      out.push({
        key: colKey([{ fieldId, optionId: opt.id }]),
        parts: [{ fieldId, optionId: opt.id, name: opt.name, emoji: opt.emoji }],
      })
    }
    return out
  }

  const [f0, f1] = matrix.cols
  const d0 = byId.get(f0)
  const d1 = byId.get(f1)
  if (!d0?.options || !d1?.options) return []

  const used0 = new Set<string>()
  const used1 = new Set<string>()
  for (const h of hits) {
    const v0 = fieldChoiceId(h, f0)
    const v1 = fieldChoiceId(h, f1)
    if (v0 !== null && v1 !== null) {
      used0.add(v0)
      used1.add(v1)
    }
  }
  const pinned0 = pinSet(f0)
  const pinned1 = pinSet(f1)
  for (const h of hits) {
    const v0 = fieldChoiceId(h, f0)
    const v1 = fieldChoiceId(h, f1)
    if (v0 !== null) used0.add(v0)
    if (v1 !== null) used1.add(v1)
  }

  const pairKeys = new Set<string>()
  for (const h of hits) {
    const v0 = fieldChoiceId(h, f0)
    const v1 = fieldChoiceId(h, f1)
    if (v0 !== null && v1 !== null) pairKeys.add(colKey([{ fieldId: f0, optionId: v0 }, { fieldId: f1, optionId: v1 }]))
  }

  const crossPin = (pinField: string, pinOpt: string, otherDef: FieldDef) => {
    const otherUsed = pinField === f0 ? used1 : used0
    const otherPinned = pinField === f0 ? pinned1 : pinned0
    for (const opt of otherDef.options ?? []) {
      if (!otherUsed.has(opt.id) && !otherPinned.has(opt.id)) continue
      const parts =
        pinField === f0
          ? [
              { fieldId: f0, optionId: pinOpt },
              { fieldId: f1, optionId: opt.id },
            ]
          : [
              { fieldId: f0, optionId: opt.id },
              { fieldId: f1, optionId: pinOpt },
            ]
      pairKeys.add(colKey(parts))
    }
  }

  for (const p of matrix.pins) {
    if (p.fieldId === f0) crossPin(f0, p.optionId, d1)
    else if (p.fieldId === f1) crossPin(f1, p.optionId, d0)
  }

  const out: MatrixCol[] = []
  for (const o0 of d0.options) {
    for (const o1 of d1.options) {
      const parts = [
        { fieldId: f0, optionId: o0.id, ...optionMeta(d0, o0.id) },
        { fieldId: f1, optionId: o1.id, ...optionMeta(d1, o1.id) },
      ]
      const key = colKey(parts)
      if (!pairKeys.has(key)) continue
      out.push({ key, parts })
    }
  }
  return out
}

export function cellWorst(issues: Issue[], ids: string[], today: string): boolean {
  const idx = buildIndex(issues)
  for (const id of ids) {
    const issue = idx.byId.get(id)
    if (!issue) continue
    if (issue.status === 'blocked') return true
    const due = issue.due
    if (due !== null && due < today && !DONE.includes(issue.status)) return true
  }
  return false
}

function groupCellsFromRoots(rootsCells: MatrixCell[][], live: Issue[], today: string): MatrixGroupCell[] {
  if (!rootsCells.length) return []
  const colCount = rootsCells[0]?.length ?? 0
  const out: MatrixGroupCell[] = []
  for (let j = 0; j < colCount; j++) {
    const finalIds: string[] = []
    for (const row of rootsCells) {
      for (const id of cellIssueIds(row[j] ?? { kind: 'empty' })) {
        if (!finalIds.includes(id)) finalIds.push(id)
      }
    }
    out.push({
      issueIds: finalIds,
      progress: progressUnder(live, finalIds),
      worst: cellWorst(live, finalIds, today),
    })
  }
  return out
}

type RowGroupBucket = { key: string; label: string; tops: Issue[] }

function rowFieldBuckets(
  tops: Issue[],
  rowField: string,
  defs: FieldDef[],
): RowGroupBucket[] {
  const def = defs.find((d) => d.id === rowField)
  if (!def?.options) return [{ key: '', label: '', tops }]
  const buckets = new Map<string, { label: string; tops: Issue[] }>()
  const emptyKey = '__empty__'
  for (const t of tops) {
    const val = fieldChoiceId(t, rowField)
    if (val === null) {
      const b = buckets.get(emptyKey) ?? { label: 'Empty', tops: [] }
      b.tops.push(t)
      buckets.set(emptyKey, b)
      continue
    }
    const meta = optionMeta(def, val)
    const b = buckets.get(val) ?? { label: meta.name, tops: [] }
    b.tops.push(t)
    buckets.set(val, b)
  }
  const out: RowGroupBucket[] = []
  for (const opt of def.options) {
    const b = buckets.get(opt.id)
    if (b) out.push({ key: opt.id, label: b.label, tops: b.tops })
  }
  const e = buckets.get(emptyKey)
  if (e) out.push({ key: '', label: e.label, tops: e.tops })
  return out
}

function issueRowCells(
  issueId: string,
  cols: MatrixCol[],
  idx: ReturnType<typeof buildIndex>,
  chips: ViewSettings['chips'],
  today: string,
): MatrixCell[] {
  return cols.map((col) => toCell(hitsInRowColumn(issueId, col, idx, chips, today)))
}

function walkMatrixIssues(
  out: MatrixRow[],
  idx: ReturnType<typeof buildIndex>,
  chips: ViewSettings['chips'],
  today: string,
  collapsed: Set<string>,
  sort: ViewSettings['sort'],
  cols: MatrixCol[],
  roots: Issue[],
  depth: number,
): number {
  let count = 0
  const walk = (node: Issue, d: number) => {
    const kids = idx.children(node.id)
    const hasChildren = kids.length > 0
    const open = !collapsed.has(node.id)
    const selfMatch = matchesChips(node, chips, today)
    const dim = chips.length > 0 && !selfMatch
    out.push({
      kind: 'issue',
      issue: node,
      depth: d,
      dim,
      hasChildren,
      open,
      cells: issueRowCells(node.id, cols, idx, chips, today),
    })
    count++
    const nextKids = sortIssues(
      kids.filter((c) => branchVisible(c.id, idx, chips, today, collapsed)),
      sort,
    )
    for (const k of nextKids) walk(k, d + 1)
  }
  for (const r of roots) walk(r, depth)
  return count
}

export function matrixGrid(
  state: RoadmapState,
  view: ViewSettings,
  today: string,
): { cols: MatrixCol[]; rows: MatrixRow[] } {
  const live = state.issues.filter((i) => i.deletedAt === null)
  const idx = buildIndex(live)
  const matrix = liveMatrix(state.roadmap.fields, view.matrix)
  const chips = liveChips(state.roadmap.fields, view.chips)
  const collapsed = new Set(view.collapsed)
  const cols = buildColumns(state.roadmap.fields, live, chips, today, matrix)
  const rows: MatrixRow[] = []

  const visibleTops = sortIssues(
    idx.children(null).filter((i) => branchVisible(i.id, idx, chips, today, collapsed)),
    view.sort,
  )

  const emitGroup = (bucket: RowGroupBucket, depth: number) => {
    const issueRows: MatrixRow[] = []
    const count = walkMatrixIssues(
      issueRows,
      idx,
      chips,
      today,
      collapsed,
      view.sort,
      cols,
      bucket.tops,
      depth,
    )
    const rootCells = bucket.tops.map((t) => issueRowCells(t.id, cols, idx, chips, today))
    rows.push({
      kind: 'group',
      key: bucket.key,
      label: bucket.label,
      count,
      cells: groupCellsFromRoots(rootCells, live, today),
    })
    rows.push(...issueRows)
  }

  if (!matrix.rowField) {
    walkMatrixIssues(rows, idx, chips, today, collapsed, view.sort, cols, visibleTops, 0)
    return { cols, rows }
  }

  for (const bucket of rowFieldBuckets(visibleTops, matrix.rowField, state.roadmap.fields)) {
    if (!bucket.tops.length) continue
    emitGroup(bucket, 0)
  }

  return { cols, rows }
}

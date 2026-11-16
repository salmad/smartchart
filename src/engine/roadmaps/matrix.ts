import { buildIndex } from './index.js'
import { progressUnder } from './rollup.js'
import type { FieldDef, Issue, RoadmapState } from './types.js'
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
}

export type MatrixRow =
  | { kind: 'group'; key: string; label: string; count: number; cells: MatrixGroupCell[] }
  | { kind: 'issue'; issue: Issue; depth: number; dim: boolean; hasChildren: boolean; open: boolean; cells: MatrixCell[] }

type Index = ReturnType<typeof buildIndex>

export function dueQuarter(iso: string): string {
  const [y, m] = iso.split('-').map(Number)
  const q = Math.floor((m - 1) / 3) + 1
  return `Q${q} ${y}`
}

/** The settings the grid really uses: stale fields and pins dropped, and a column field chosen whenever one exists.
    Any field can be an axis. Nothing picked yet: choice fields come first (their options are a ready list), so with two
    of them the first groups the rows and the second makes the columns. */
export function liveMatrix(defs: FieldDef[], matrix: MatrixSettings): MatrixSettings {
  const known = (id: string) => defs.some((d) => d.id === id)
  const choice = defs.filter((d) => d.type === 'choice')
  let rowField = matrix.rowField !== null && known(matrix.rowField) ? matrix.rowField : null
  let cols = [...new Set(matrix.cols)].filter((id) => id !== rowField && known(id)).slice(0, 2)
  if (!cols.length) {
    const untouched = matrix.rowField === null && matrix.cols.length === 0
    const ranked = [...choice, ...defs.filter((d) => d.type !== 'choice')].filter((d) => d.id !== rowField)
    if (untouched && choice.length > 1) {
      rowField = choice[0].id
      cols = [choice[1].id]
    } else if (ranked.length) {
      cols = [ranked[0].id]
    } else if (rowField !== null) {
      cols = [rowField]
      rowField = null
    }
  }
  const pins = matrix.pins.filter((p) => choice.find((d) => d.id === p.fieldId)?.options?.some((o) => o.id === p.optionId) ?? false)
  return { ...matrix, rowField, cols, pins }
}

/** How a value that is not a choice reads in a header: a person's name, a date the way the app writes dates. */
export interface AxisLabels {
  names?: ReadonlyMap<string, string>
  date?: (iso: string) => string
}

type AxisValue = { id: string; name: string; emoji?: string }

/** An issue's value on an axis, as the id its line is keyed by; null when it has none. */
function valueId(issue: Issue, fieldId: string): string | null {
  const raw = issue.fields[fieldId]
  return raw === undefined || raw === '' ? null : String(raw)
}

/** The lines a field makes. A choice gives its options, in its own order, when used or kept in view. Any other type
    gives one line per value in use, in order (numbers by size, the rest by how they read). */
function axisValues(def: FieldDef, used: ReadonlySet<string>, pinned: ReadonlySet<string>, labels: AxisLabels): AxisValue[] {
  if (def.type === 'choice') {
    return (def.options ?? []).filter((o) => used.has(o.id) || pinned.has(o.id)).map((o) => ({ id: o.id, name: o.name, emoji: o.emoji }))
  }
  const name = (id: string) => (def.type === 'person' ? labels.names?.get(id) ?? id : def.type === 'date' ? labels.date?.(id) ?? id : id)
  const out = [...used].map((id) => ({ id, name: name(id) }))
  if (def.type === 'number') return out.sort((a, b) => Number(a.id) - Number(b.id))
  if (def.type === 'date') return out.sort((a, b) => a.id.localeCompare(b.id))
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

function usedValues(issues: Issue[], fieldId: string): Set<string> {
  const out = new Set<string>()
  for (const i of issues) {
    const v = valueId(i, fieldId)
    if (v !== null) out.add(v)
  }
  return out
}

function subtree(issueId: string, idx: Index): Issue[] {
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
    if (valueId(issue, part.fieldId) !== part.optionId) return false
  }
  return true
}

function topMostInSubtree(
  hits: Issue[],
  idx: Index,
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
  idx: Index,
  chips: ViewSettings['chips'],
  today: string,
): Issue[] {
  const candidates = subtree(rootId, idx)
    .filter((i) => matchesChips(i, chips, today, idx) && columnMatches(i, col))
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

function colKey(parts: { fieldId: string; optionId: string }[]): string {
  return parts.map((p) => `${p.fieldId}:${p.optionId}`).join('|')
}

/** One column per value of the column field, or per pair of values in use when two fields make the columns. */
function buildColumns(
  defs: FieldDef[],
  live: Issue[],
  chips: ViewSettings['chips'],
  today: string,
  matrix: MatrixSettings,
  labels: AxisLabels,
): MatrixCol[] {
  const axes = matrix.cols.map((id) => defs.find((d) => d.id === id)).filter((d): d is FieldDef => d !== undefined)
  if (!axes.length || axes.length !== matrix.cols.length) return []
  const idx = buildIndex(live)
  const hits = live.filter((i) => matchesChips(i, chips, today, idx))
  const pinned = (fieldId: string) => new Set(matrix.pins.filter((p) => p.fieldId === fieldId).map((p) => p.optionId))
  const values = axes.map((d) => axisValues(d, usedValues(hits, d.id), pinned(d.id), labels))
  const part = (d: FieldDef, v: AxisValue) => ({ fieldId: d.id, optionId: v.id, name: v.name, emoji: v.emoji })

  if (axes.length === 1) {
    return values[0].map((v) => {
      const parts = [part(axes[0], v)]
      return { key: colKey(parts), parts }
    })
  }

  const [d0, d1] = axes
  // A pair is a column when an issue carries both values, or when one of its values is kept in view.
  const pairs = new Set<string>()
  const pair = (v0: string, v1: string) => colKey([{ fieldId: d0.id, optionId: v0 }, { fieldId: d1.id, optionId: v1 }])
  for (const h of hits) {
    const v0 = valueId(h, d0.id)
    const v1 = valueId(h, d1.id)
    if (v0 !== null && v1 !== null) pairs.add(pair(v0, v1))
  }
  for (const p of matrix.pins) {
    if (p.fieldId === d0.id) for (const v of values[1]) pairs.add(pair(p.optionId, v.id))
    else if (p.fieldId === d1.id) for (const v of values[0]) pairs.add(pair(v.id, p.optionId))
  }

  const out: MatrixCol[] = []
  for (const v0 of values[0]) {
    for (const v1 of values[1]) {
      const parts = [part(d0, v0), part(d1, v1)]
      const key = colKey(parts)
      if (pairs.has(key)) out.push({ key, parts })
    }
  }
  return out
}

type Bucket = { key: string; label: string; tops: Issue[] }

/** "No workstream" for a field called Workstream; a name that opens with an acronym keeps its capitals. */
function emptyLabel(name: string): string {
  const lower = /^[A-Z][a-z]/.test(name) ? name[0].toLowerCase() + name.slice(1) : name
  return `No ${lower}`
}

function rowBuckets(tops: Issue[], def: FieldDef, labels: AxisLabels): Bucket[] {
  const out: Bucket[] = axisValues(def, usedValues(tops, def.id), new Set(), labels).map((v) => ({
    key: v.id,
    label: v.name,
    tops: tops.filter((t) => valueId(t, def.id) === v.id),
  }))
  const rest = tops.filter((t) => valueId(t, def.id) === null)
  if (rest.length) out.push({ key: '', label: emptyLabel(def.name), tops: rest })
  return out
}

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

/** The matrix opens as the compact pivot: only the rows in `matrix.expanded` show their children. It keeps its own set,
    so the table and Gantt (`view.collapsed`) stay as they were. A filter keeps the rows and pivots the cells. */
export function matrixGrid(
  state: RoadmapState,
  view: ViewSettings,
  today: string,
  labels: AxisLabels = {},
): { cols: MatrixCol[]; rows: MatrixRow[] } {
  const live = state.issues.filter((i) => i.deletedAt === null)
  const idx = buildIndex(live)
  const matrix = liveMatrix(state.roadmap.fields, view.matrix)
  const chips = liveChips(state.roadmap.fields, view.chips)
  const expanded = new Set(matrix.expanded)
  const cols = buildColumns(state.roadmap.fields, live, chips, today, matrix, labels)
  const rows: MatrixRow[] = []

  const matches = (i: Issue) => matchesChips(i, chips, today, idx)
  const shown = (i: Issue) => subtree(i.id, idx).some(matches)
  const cellsOf = (id: string) => cols.map((col) => toCell(hitsInRowColumn(id, col, idx, chips, today)))

  const walk = (node: Issue, depth: number) => {
    const kids = sortIssues(idx.children(node.id).filter(shown), view.sort)
    const open = kids.length > 0 && expanded.has(node.id)
    rows.push({
      kind: 'issue',
      issue: node,
      depth,
      dim: chips.length > 0 && !matches(node),
      hasChildren: kids.length > 0,
      open,
      cells: cellsOf(node.id),
    })
    if (open) for (const k of kids) walk(k, depth + 1)
  }

  const tops = sortIssues(idx.children(null).filter(shown), view.sort)
  const rowDef = state.roadmap.fields.find((d) => d.id === matrix.rowField)
  if (!rowDef) {
    for (const t of tops) walk(t, 0)
    return { cols, rows }
  }

  for (const bucket of rowBuckets(tops, rowDef, labels)) {
    // A group that is one issue of the same name is that issue's row: no header above its twin.
    const twin = bucket.tops.length === 1 && sameName(bucket.tops[0].title, bucket.label)
    if (!twin) {
      const topCells = bucket.tops.map((t) => cellsOf(t.id))
      rows.push({
        kind: 'group',
        key: bucket.key,
        label: bucket.label,
        count: bucket.tops.reduce((n, t) => n + subtree(t.id, idx).filter(matches).length, 0),
        cells: cols.map((_, j) => {
          const issueIds = [...new Set(topCells.flatMap((cells) => cellIssueIds(cells[j])))]
          return { issueIds, progress: progressUnder(live, issueIds) }
        }),
      })
    }
    for (const t of bucket.tops) walk(t, 0)
  }

  return { cols, rows }
}

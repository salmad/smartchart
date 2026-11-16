import { buildIndex } from './index.js'
import { progressUnder, statusMix, type StatusMix } from './rollup.js'
import type { FieldDef, Issue, RoadmapState } from './types.js'
import {
  emptyLabel,
  liveChips,
  liveGroupBy,
  matchesChips,
  sortIssues,
  viewFilters,
  type MatrixSettings,
  type ViewSettings,
} from './view.js'
import { nameQuery } from './search.js'

/** A column: one option of each column field, or, when its group is folded, only the first field's option, so the
    column rolls up every issue under that option. */
export interface MatrixCol {
  key: string
  parts: { fieldId: string; optionId: string; name: string; emoji?: string }[]
  folded?: boolean
}

export type MatrixCell =
  | { kind: 'empty' }
  | { kind: 'one'; issueId: string }
  | { kind: 'many'; issueIds: string[] }

export interface MatrixGroupCell {
  issueIds: string[]
  progress: number | null
  /** The status split of the leaves under the cell, for the group's strip. */
  mix: StatusMix
}

/** `key` is unique on screen: an issue can show under several groups, so its key carries the groups above it. `empty`
    marks the group of issues with no value; `depth` is the group's level, outermost 0. */
export type MatrixRow =
  | { kind: 'group'; key: string; label: string; count: number; depth: number; empty: boolean; open: boolean; cells: MatrixGroupCell[] }
  | { kind: 'issue'; key: string; issue: Issue; depth: number; dim: boolean; hasChildren: boolean; open: boolean; cells: MatrixCell[] }

type Index = ReturnType<typeof buildIndex>

export function dueQuarter(iso: string): string {
  const [y, m] = iso.split('-').map(Number)
  const q = Math.floor((m - 1) / 3) + 1
  return `Q${q} ${y}`
}

/** What the grid really uses: the shared grouping's field levels as its rows, stale fields and pins dropped, and a
    column field chosen whenever one exists. Any field can be an axis. Nothing picked yet: a choice field the rows do
    not use makes the columns, the second when there are two (so the first stays free to group by). */
export function liveMatrix(defs: FieldDef[], view: Pick<ViewSettings, 'groupBy' | 'matrix'>): MatrixSettings & { rows: string[] } {
  const matrix = view.matrix
  const known = (id: string) => defs.some((d) => d.id === id)
  const choice = defs.filter((d) => d.type === 'choice')
  const rows = liveGroupBy(defs, view.groupBy).flatMap((g) => (g.on === 'field' ? [g.field] : []))
  let cols = [...new Set(matrix.cols)].filter((id) => !rows.includes(id) && known(id)).slice(0, 2)
  if (!cols.length) {
    const free = [...choice, ...defs.filter((d) => d.type !== 'choice')].filter((d) => !rows.includes(d.id))
    const pick = !rows.length && choice.length > 1 ? choice[1] : free[0]
    if (pick) cols = [pick.id]
  }
  const pins = matrix.pins.filter((p) => choice.find((d) => d.id === p.fieldId)?.options?.some((o) => o.id === p.optionId) ?? false)
  const foldedCols = cols.length === 2 ? matrix.foldedCols : []
  return { ...matrix, rows, cols, pins, foldedCols }
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

/** An issue's value on a field, or the nearest parent's when it has none: sub-issues inherit their parent's Workstream. */
function inherited(idx: Index): (issue: Issue, fieldId: string) => string | null {
  const memo = new Map<string, string | null>()
  const of = (issue: Issue, fieldId: string): string | null => {
    const key = `${issue.id}\u0000${fieldId}`
    const hit = memo.get(key)
    if (hit !== undefined) return hit
    const own = valueId(issue, fieldId)
    const parent = issue.parentId !== null ? idx.byId.get(issue.parentId) : undefined
    const value = own ?? (parent ? of(parent, fieldId) : null)
    memo.set(key, value)
    return value
  }
  return of
}

/** The groups a row sits in, outermost first: each a field and the value (or no value) it holds there. */
type Context = { fieldId: string; value: string | null }[]

type Effective = (issue: Issue, fieldId: string) => string | null

/** Whether an issue itself belongs in these groups. A leaf answers with its value, its own or inherited; a parent only
    with a value set on it, so a parent with no Country is placed by its sub-issues, never in "No country". */
function fitsSelf(issue: Issue, ctx: Context, idx: Index, eff: Effective): boolean {
  const leaf = idx.children(issue.id).length === 0
  return ctx.every((c) => (leaf || valueId(issue, c.fieldId) !== null) && eff(issue, c.fieldId) === c.value)
}

function columnMatches(issue: Issue, col: MatrixCol, eff: Effective): boolean {
  for (const part of col.parts) {
    if (eff(issue, part.fieldId) !== part.optionId) return false
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
  ctx: Context,
  idx: Index,
  eff: Effective,
  matches: (i: Issue) => boolean,
): Issue[] {
  const candidates = subtree(rootId, idx).filter((i) => matches(i) && columnMatches(i, col, eff) && (!ctx.length || fitsSelf(i, ctx, idx, eff)))
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
  matrix: MatrixSettings & { rows: string[] },
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
  const shut = new Set(matrix.foldedCols)
  for (const v0 of values[0]) {
    if (shut.has(v0.id)) {
      // Folded: one roll-up column, kept only when the group has a column to fold.
      if (values[1].some((v1) => pairs.has(pair(v0.id, v1.id)))) {
        const parts = [part(d0, v0)]
        out.push({ key: colKey(parts), parts, folded: true })
      }
      continue
    }
    for (const v1 of values[1]) {
      const parts = [part(d0, v0), part(d1, v1)]
      const key = colKey(parts)
      if (pairs.has(key)) out.push({ key, parts })
    }
  }
  return out
}

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

/** The matrix opens as the compact pivot: only the rows in `matrix.expanded` show their children. It keeps its own set,
    so the table and Gantt (`view.collapsed`) stay as they were. A filter keeps the rows and pivots the cells.
    Rows can sit in up to two levels of field groups. An issue shows under every group its work reaches, so a parent
    with sub-issues in the UK and France appears under both, each time with only that country's part. */
export function matrixGrid(
  state: RoadmapState,
  view: ViewSettings,
  today: string,
  labels: AxisLabels = {},
): { cols: MatrixCol[]; rows: MatrixRow[] } {
  const live = state.issues.filter((i) => i.deletedAt === null)
  const idx = buildIndex(live)
  const eff = inherited(idx)
  const matrix = liveMatrix(state.roadmap.fields, view)
  const chips = viewFilters(state.roadmap.fields, view)
  // A search opens the rows it found sub-issues under: the compact pivot would hide them behind their parent.
  const searching = nameQuery(view.search ?? '') !== null
  const expanded = new Set(matrix.expanded)
  const folded = new Set(view.folded)
  // The columns come from the chips alone, so typing a search never adds or drops a column under the cursor.
  const cols = buildColumns(state.roadmap.fields, live, liveChips(state.roadmap.fields, view.chips), today, matrix, labels)
  const rows: MatrixRow[] = []

  const matches = (i: Issue) => matchesChips(i, chips, today, idx)
  /** The issues under a node (itself included) that are both kept by the filter and in these groups. */
  const fitting = (id: string, ctx: Context) => subtree(id, idx).filter((m) => matches(m) && (!ctx.length || fitsSelf(m, ctx, idx, eff)))
  const shown = (i: Issue, ctx: Context) => fitting(i.id, ctx).length > 0
  const cellsOf = (id: string, ctx: Context) => cols.map((col) => toCell(hitsInRowColumn(id, col, ctx, idx, eff, matches)))
  const keyOfCtx = (ctx: Context) => ctx.map((c) => `${c.fieldId}=${c.value ?? ''}`).join('/')

  const walk = (node: Issue, depth: number, ctx: Context) => {
    const kids = sortIssues(idx.children(node.id).filter((k) => shown(k, ctx)), view.sort)
    const open = kids.length > 0 && (searching || expanded.has(node.id))
    rows.push({
      kind: 'issue',
      key: ctx.length ? `${keyOfCtx(ctx)}/${node.id}` : node.id,
      issue: node,
      depth,
      dim: chips.length > 0 && !matches(node),
      hasChildren: kids.length > 0,
      open,
      cells: cellsOf(node.id, ctx),
    })
    if (open) for (const k of kids) walk(k, depth + 1, ctx)
  }

  const roots = sortIssues(idx.children(null), view.sort)
  const levels = matrix.rows
    .map((id) => state.roadmap.fields.find((d) => d.id === id))
    .filter((d): d is FieldDef => d !== undefined)

  const group = (level: number, ctx: Context) => {
    const tops = roots.filter((t) => shown(t, ctx))
    if (level === levels.length) {
      // Issues sit one step inside their innermost group.
      for (const t of tops) walk(t, levels.length, ctx)
      return
    }
    const def = levels[level]
    // The values this level takes among the work in the groups above, in the field's own order; no value comes last.
    const seen = new Set<string | null>()
    for (const t of tops) for (const m of fitting(t.id, ctx)) if (idx.children(m.id).length === 0 || valueId(m, def.id) !== null) seen.add(eff(m, def.id))
    const values = axisValues(def, new Set([...seen].filter((v): v is string => v !== null)), new Set(), labels)
    const buckets: { value: string | null; label: string }[] = values.map((v) => ({ value: v.id, label: v.name }))
    if (seen.has(null)) buckets.push({ value: null, label: emptyLabel(def.name) })

    for (const b of buckets) {
      const inner: Context = [...ctx, { fieldId: def.id, value: b.value }]
      const members = roots.filter((t) => shown(t, inner))
      if (!members.length) continue
      const last = level === levels.length - 1
      // A group that is one issue of the same name is that issue's row: no header above its twin.
      const twin = last && members.length === 1 && sameName(members[0].title, b.label)
      const key = keyOfCtx(inner)
      const open = twin || !folded.has(key)
      if (!twin) {
        const topCells = members.map((t) => cellsOf(t.id, inner))
        rows.push({
          kind: 'group',
          key,
          label: b.label,
          count: members.reduce((n, t) => n + fitting(t.id, inner).length, 0),
          depth: level,
          empty: b.value === null,
          open,
          cells: cols.map((_, j) => {
            const issueIds = [...new Set(topCells.flatMap((cells) => cellIssueIds(cells[j])))]
            return { issueIds, progress: progressUnder(live, issueIds), mix: statusMix(live, issueIds) }
          }),
        })
      }
      if (open) group(level + 1, inner)
    }
  }

  group(0, [])
  return { cols, rows }
}

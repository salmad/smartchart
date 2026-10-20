/* Where a page dropped on the tree lands: a pure function from the rows in view and the pointer's place on a row, so the
   drag handlers only carry it out. A null drop is one the tree refuses or that changes nothing. */
import { canMove, keyOf, type PageRef, type PageSummary } from '@/engine/pages/tree'
import type { Row } from './flatten'
import type { KeyMove } from './treeKeys'

export type MoveTo = KeyMove['to']

export type Indicator =
  | { kind: 'line'; before: PageRef | 'end'; depth: number }
  | { kind: 'into'; row: PageRef }

export interface Drop { to: MoveTo; indicator: Indicator; expand?: PageRef }

const same = (a: PageRef | null, b: PageRef | null) => (a && b ? keyOf(a) === keyOf(b) : a === b)

/** Where `dragged` lands when released over `over` (a row, or 'end' for the blank space under the last row), `y` being 0..1 down
    that row. Top quarter: before the row. Middle half: last child. Bottom quarter: after the row, or first child of an open one. */
export function dropTarget(rows: Row[], pages: PageSummary[], dragged: PageRef, over: PageRef | 'end', y: number): Drop | null {
  const sibs = (parent: PageRef | null) => rows.filter((r) => same(r.parentRef, parent))
  let parent: PageRef | null, drop: Omit<Drop, 'to'>, to: MoveTo

  if (over === 'end') {
    const top = sibs(null)
    if (same(top.at(-1)?.ref ?? null, dragged)) return null
    parent = null; to = { parent }; drop = { indicator: { kind: 'line', before: 'end', depth: 1 } }
  } else {
    const i = rows.findIndex((r) => keyOf(r.ref) === keyOf(over)), row = rows[i]
    if (!row) return null
    if (y < 0.25) {
      parent = row.parentRef; to = { parent, before: row.ref }; drop = { indicator: { kind: 'line', before: row.ref, depth: row.depth } }
    } else if (y <= 0.75) {
      parent = row.ref; to = { parent }; drop = { indicator: { kind: 'into', row: row.ref }, expand: row.expanded ? undefined : row.ref }
      if (same(sibs(parent).at(-1)?.ref ?? null, dragged)) return null
    } else if (row.expanded && rows[i + 1]) {
      const first = rows[i + 1]
      parent = row.ref; to = { parent, before: first.ref }; drop = { indicator: { kind: 'line', before: first.ref, depth: first.depth } }
    } else {
      const next = rows[i + 1]
      parent = row.parentRef; to = { parent, after: row.ref }; drop = { indicator: { kind: 'line', before: next ? next.ref : 'end', depth: row.depth } }
    }
    // Before or after the page itself, or next to the neighbour it already has, leaves the order as it is.
    const list = sibs(parent), at = list.findIndex((r) => same(r.ref, dragged))
    if (at >= 0) {
      if (to.before && (same(to.before, dragged) || list[at + 1] && same(list[at + 1].ref, to.before))) return null
      if (to.after && (same(to.after, dragged) || (at > 0 && same(list[at - 1].ref, to.after)))) return null
    }
  }
  return canMove(pages, dragged, parent) === 'ok' ? { to, ...drop } : null
}

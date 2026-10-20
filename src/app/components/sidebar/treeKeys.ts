/* The tree's keyboard (WAI-ARIA tree pattern) as a pure function from the rows in view, so the component only carries it out. */
import { keyOf, type PageRef } from '@/engine/pages/tree'
import type { Row } from './flatten'

export type Step =
  | { focus: PageRef }
  | { toggle: PageRef; open: boolean }
  | { open: PageRef }
  | null

const same = (a: PageRef, b: PageRef) => keyOf(a) === keyOf(b)

/** What `key` does on the row `at`: move focus, expand or collapse, or open the page. */
export function step(rows: Row[], at: PageRef, key: string): Step {
  const i = rows.findIndex((r) => same(r.ref, at)), row = rows[i]
  if (!row) return rows[0] ? { focus: rows[0].ref } : null
  const to = (j: number): Step => (rows[j] && j !== i ? { focus: rows[j].ref } : null)
  switch (key) {
    case 'ArrowDown': return to(i + 1)
    case 'ArrowUp': return to(i - 1)
    case 'Home': return to(0)
    case 'End': return to(rows.length - 1)
    case 'ArrowRight':
      if (!row.hasChildren) return null
      return row.expanded ? to(i + 1) : { toggle: row.ref, open: true }
    case 'ArrowLeft': {
      if (row.expanded) return { toggle: row.ref, open: false }
      const parent = row.parentRef && rows.find((r) => same(r.ref, row.parentRef as PageRef))
      return parent ? { focus: parent.ref } : null
    }
    case 'Enter': case ' ': return { open: row.ref }
    default: return null
  }
}

/** The row a typed `text` jumps to: the next one whose name starts with it, wrapping round. One letter typed again moves on to
    the next row with that letter; a longer text keeps the row it is on if that still fits. */
export function typeahead(rows: Row[], at: PageRef | null, text: string): PageRef | null {
  const t = text.toLowerCase(), i = rows.findIndex((r) => at && same(r.ref, at))
  const first = t.length === 1 ? i + 1 : Math.max(i, 0)
  for (let n = 0; n < rows.length; n++) {
    const row = rows[(first + n) % rows.length]
    if (row.name.toLowerCase().startsWith(t)) return row.ref
  }
  return null
}

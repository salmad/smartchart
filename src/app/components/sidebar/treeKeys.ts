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

/** A move the keyboard asks for: the page, and where it goes. `expand` is the page that now has a new child to show. */
export interface KeyMove { to: { parent: PageRef | null; before?: PageRef; after?: PageRef }; expand?: PageRef }

/** What ⌘↑ and ⌘↓ (reorder among siblings), Tab (indent under the sibling above) and Shift-Tab (outdent, after the parent) do to
    the row `at`; null when there is nowhere to go, so the key keeps its usual job. */
export function moveStep(rows: Row[], at: PageRef, key: 'up' | 'down' | 'indent' | 'outdent'): KeyMove | null {
  const row = rows.find((r) => same(r.ref, at))
  if (!row) return null
  const sameParent = (a: PageRef | null, b: PageRef | null) => (a && b ? same(a, b) : a === b)
  const sibs = rows.filter((r) => sameParent(r.parentRef, row.parentRef)), i = sibs.indexOf(row)
  switch (key) {
    case 'up': return i > 0 ? { to: { parent: row.parentRef, before: sibs[i - 1].ref } } : null
    case 'down': return i < sibs.length - 1 ? { to: { parent: row.parentRef, after: sibs[i + 1].ref } } : null
    case 'indent': return i > 0 ? { to: { parent: sibs[i - 1].ref }, expand: sibs[i - 1].ref } : null
    case 'outdent': {
      const parent = row.parentRef && rows.find((r) => same(r.ref, row.parentRef as PageRef))
      return parent ? { to: { parent: parent.parentRef, after: parent.ref } } : null
    }
  }
}

/* The sidebar's rows from the flat list of pages: tree order, collapsed branches skipped, empty decks left out. Pure, so
   the tree component only draws what this says. */
import { appendKey, buildTree, keyOf, type PageRef, type PageSummary } from '@/engine/pages/tree'

/** Rows indent this many levels at most; deeper pages keep the last indent (the breadcrumb tells the rest). */
export const MAX_SHOWN_DEPTH = 4
export const shownDepth = (depth: number) => Math.min(depth, MAX_SHOWN_DEPTH)

export interface Row {
  ref: PageRef; name: string
  /** Level from the top: 1 at the top (aria-level). */
  depth: number
  hasChildren: boolean
  /** Whether its children are showing. */
  expanded: boolean
  /** The page on screen. */
  open: boolean
  parentRef: PageRef | null
  updated: number
  /** A deck's slide count (null for a doc). */
  slides: number | null
}

const same = (a: PageRef | null, b: PageRef | null) => !!a && !!b && a.kind === b.kind && a.id === b.id

/** The rows in view. A deck with no slides is left out unless it has pages inside it or is the one on screen. */
export function visibleRows(pages: PageSummary[], expanded: ReadonlySet<string>, openRef: PageRef | null): Row[] {
  const tree = buildTree(pages), hidden = new Map<string, boolean>()
  const shown = (n: PageSummary): boolean => {
    const k = keyOf(n), known = hidden.get(k)
    if (known !== undefined) return !known
    hidden.set(k, false) // a loop in the data ends here
    const empty = n.kind === 'deck' && n.slides === 0 && !same(n, openRef)
    const keep = !empty || kids(n).length > 0
    hidden.set(k, !keep)
    return keep
  }
  const kids = (n: PageRef) => tree.children(n).filter((c) => shown(c as PageSummary)) as PageSummary[]
  const rows: Row[] = []
  const walk = (list: PageSummary[], depth: number, parentRef: PageRef | null) => {
    for (const n of list) {
      const children = kids(n), open = expanded.has(keyOf(n))
      rows.push({ ref: { kind: n.kind, id: n.id }, name: n.name, depth, hasChildren: children.length > 0, expanded: open && children.length > 0,
        open: same(n, openRef), parentRef, updated: n.updated, slides: n.slides })
      if (open && children.length) walk(children, depth + 1, { kind: n.kind, id: n.id })
    }
  }
  walk(tree.roots.filter((n) => shown(n as PageSummary)) as PageSummary[], 1, null)
  return rows
}

/** The pages above `ref`, top first, `ref` itself left out: what to expand so it shows. A loop in the data ends the walk. */
export function pathTo(pages: PageSummary[], ref: PageRef): PageRef[] {
  const by = new Map(pages.map((p) => [keyOf(p), p])), seen = new Set([keyOf(ref)]), path: PageRef[] = []
  for (let at = by.get(keyOf(ref))?.parent; at && by.has(keyOf(at)) && !seen.has(keyOf(at)); at = by.get(keyOf(at))?.parent) {
    seen.add(keyOf(at)); path.unshift({ kind: at.kind, id: at.id })
  }
  return path
}

/** The pages with the deck held in the editor in them: under its live name, and before its first save as a row of its own,
    last under its pending parent (where the server will put it), so the real row arriving with the same id changes nothing. */
export function withOpenDeck(pages: PageSummary[], deck: { id: string | null; name: string; slides: number }, parent: PageRef | null, now = Date.now()): PageSummary[] {
  if (!deck.id || !deck.slides) return pages
  const id = deck.id, has = pages.some((p) => p.kind === 'deck' && p.id === id)
  if (has) return pages.map((p) => (p.kind === 'deck' && p.id === id ? { ...p, name: deck.name, slides: deck.slides } : p))
  const at = parent && pages.some((p) => keyOf(p) === keyOf(parent)) ? parent : null
  return [...pages, { kind: 'deck', id, name: deck.name, updated: now, slides: deck.slides, parent: at, sortKey: appendKey(pages, at) }]
}

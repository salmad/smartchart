/* Nested lists: small pure helpers over a ListBlock, shared by the parser, the checks and the editor's text view. */
import type { ListBlock } from './types.js'

/** How many levels the list has: 1 for a flat list. */
export const depthOf = (l: ListBlock): number => 1 + Math.max(0, ...(l.nested ?? []).map((n) => (n ? depthOf(n) : 0)))

/** Every item's text, depth first, in reading order. */
export const textsOf = (l: ListBlock): string[] => l.items.flatMap((x, i) => [x, ...(l.nested?.[i] ? textsOf(l.nested[i] as ListBlock) : [])])

/** The list without its empty items (and what was under them), at every level; null when nothing is left. The same
    object when nothing changed. A list with no nested list carries no `nested` field at all: equal lists stay equal. */
export function tidyList(l: ListBlock, blank: (text: string) => boolean): ListBlock | null {
  const keep = l.items.map((x, i) => (blank(x) ? -1 : i)).filter((i) => i >= 0)
  if (!keep.length) return null
  const nested = keep.map((i) => { const n = l.nested?.[i]; return n ? tidyList(n, blank) : null })
  const same = keep.length === l.items.length && keep.every((k, j) => nested[j] === (l.nested?.[k] ?? null))
  if (same) return l
  const { nested: _drop, ...rest } = l
  const items = keep.map((i) => l.items[i])
  return nested.some((n) => n) ? { ...rest, items, nested } : { ...rest, items }
}

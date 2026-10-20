import { describe, expect, it } from 'vitest'
import { dropTarget } from '@/app/components/sidebar/dropTarget'
import { visibleRows } from '@/app/components/sidebar/flatten'
import { keyOf, type PageRef, type PageSummary } from '@/engine/pages/tree'

const page = (kind: 'deck' | 'doc', id: string, parent: string | null, sortKey: string, slides: number | null = kind === 'deck' ? 3 : null): PageSummary =>
  ({ kind, id, name: id, updated: 0, slides, parent: parent ? { kind: 'doc', id: parent } : null, sortKey })
const doc = (id: string, parent: string | null, sortKey: string) => page('doc', id, parent, sortKey)
const ref = (id: string, kind: 'deck' | 'doc' = 'doc'): PageRef => ({ kind, id })

// A, B (open: B1, B2), C (closed: C1), D
const pages = [doc('A', null, 'a'), doc('B', null, 'b'), doc('B1', 'B', 'a'), doc('B2', 'B', 'b'), doc('C', null, 'c'), doc('C1', 'C', 'a'), doc('D', null, 'd')]
const rowsOf = (list: PageSummary[], open: string[] = ['doc:B']) => visibleRows(list, new Set(open), null)
const rows = rowsOf(pages)
const drop = (dragged: string, over: string | 'end', y: number, list = pages, r = rows) =>
  dropTarget(r, list, ref(dragged), over === 'end' ? 'end' : ref(over), y)

describe('drop target', () => {
  it('top quarter puts the page before the row, in the row’s parent', () => {
    const d = drop('A', 'C', 0.1)
    expect(d?.to).toEqual({ parent: null, before: ref('C') })
    expect(d?.indicator).toEqual({ kind: 'line', before: ref('C'), depth: 1 })
    expect(drop('D', 'B2', 0.1)?.to).toEqual({ parent: ref('B'), before: ref('B2') })
    expect(drop('D', 'B2', 0.1)?.indicator).toEqual({ kind: 'line', before: ref('B2'), depth: 2 })
  })
  it('middle half makes it the last child, and opens a closed parent', () => {
    const d = drop('A', 'C', 0.5)
    expect(d?.to).toEqual({ parent: ref('C') })
    expect(d?.indicator).toEqual({ kind: 'into', row: ref('C') })
    expect(d?.expand).toEqual(ref('C'))
    expect(drop('A', 'B', 0.5)?.expand).toBeUndefined()
  })
  it('bottom quarter puts the page after the row, the line before the next row', () => {
    const d = drop('A', 'C', 0.9)
    expect(d?.to).toEqual({ parent: null, after: ref('C') })
    expect(d?.indicator).toEqual({ kind: 'line', before: ref('D'), depth: 1 })
    expect(drop('A', 'D', 0.9)?.indicator).toEqual({ kind: 'line', before: 'end', depth: 1 })
  })
  it('bottom quarter of an open parent means first child, drawn at the child’s depth', () => {
    const d = drop('A', 'B', 0.9)
    expect(d?.to).toEqual({ parent: ref('B'), before: ref('B1') })
    expect(d?.indicator).toEqual({ kind: 'line', before: ref('B1'), depth: 2 })
  })
  it('the blank space drops last at the top level', () => {
    const d = drop('B1', 'end', 0)
    expect(d?.to).toEqual({ parent: null })
    expect(d?.indicator).toEqual({ kind: 'line', before: 'end', depth: 1 })
  })
  it('lets a deck go over a doc and the reverse', () => {
    const mixed = [doc('A', null, 'a'), page('deck', 'K', null, 'b'), page('deck', 'K2', 'A', 'a')]
    const r = rowsOf(mixed, [])
    expect(dropTarget(r, mixed, ref('K', 'deck'), ref('A'), 0.5)?.to).toEqual({ parent: ref('A') })
    expect(dropTarget(r, mixed, ref('A'), ref('K', 'deck'), 0.5)?.to).toEqual({ parent: ref('K', 'deck') })
  })
  it('refuses itself, its child and its grandchild', () => {
    const deep = [doc('P', null, 'a'), doc('Q', 'P', 'a'), doc('R', 'Q', 'a')]
    const r = rowsOf(deep, ['doc:P', 'doc:Q'])
    for (const over of ['P', 'Q', 'R']) expect(dropTarget(r, deep, ref('P'), ref(over), 0.5)).toBeNull()
    expect(dropTarget(r, deep, ref('P'), ref('Q'), 0.1)).toBeNull() // before its own child
    expect(dropTarget(r, deep, ref('P'), ref('R'), 0.9)).toBeNull()
  })
  it('refuses depth 7 and allows depth 6', () => {
    const chain = ['L1', 'L2', 'L3', 'L4', 'L5'].map((id, i, a) => doc(id, i ? a[i - 1] : null, 'a'))
    const all = [...chain, doc('X', null, 'z'), doc('Y', 'X', 'a')]
    const r = rowsOf(all, chain.map(keyOf))
    expect(dropTarget(r, all, ref('X'), ref('L5'), 0.5)).toBeNull() // X and Y below L5: 7 deep
    expect(dropTarget(r, all, ref('Y'), ref('L5'), 0.5)?.to).toEqual({ parent: ref('L5') }) // 6 deep
  })
  it('shows nothing for a drop that changes nothing', () => {
    expect(drop('A', 'A', 0.1)).toBeNull()
    expect(drop('A', 'A', 0.9)).toBeNull()
    expect(drop('A', 'B', 0.1)).toBeNull() // already right before B
    expect(drop('B', 'A', 0.9)).toBeNull() // already right after A
    expect(drop('B2', 'B', 0.5)).toBeNull() // already B's last child
    expect(drop('B1', 'B', 0.9)).toBeNull() // already B's first child
    expect(drop('D', 'end', 0)).toBeNull() // already last on top
  })
  it('never targets a page that is not in view', () => {
    expect(drop('A', 'C1', 0.5)).toBeNull() // inside the closed C
  })
})

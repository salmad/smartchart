import { describe, expect, it } from 'vitest'
import type { PageSummary } from '@/engine/pages/tree'
import { pathTo, shownDepth, visibleRows, withOpenDeck } from '@/app/components/sidebar/flatten'
import { loadExpanded, saveExpanded } from '@/app/components/sidebar/expanded'

const page = (kind: 'deck' | 'doc', id: string, over: Partial<PageSummary> = {}): PageSummary =>
  ({ kind, id, name: id, updated: 1, slides: kind === 'deck' ? 3 : null, parent: null, sortKey: null, ...over })
const ids = (rows: { ref: { id: string } }[]) => rows.map((r) => r.ref.id)

const pages = [
  page('doc', 'a', { sortKey: 'a' }),
  page('doc', 'a1', { parent: { kind: 'doc', id: 'a' }, sortKey: 'b' }),
  page('deck', 'a1x', { parent: { kind: 'doc', id: 'a1' }, sortKey: 'c' }),
  page('doc', 'a2', { parent: { kind: 'doc', id: 'a' }, sortKey: 'a' }),
  page('deck', 'b', { sortKey: 'b' }),
]
const open = (...keys: string[]) => new Set(keys)

describe('visibleRows', () => {
  it('lists the top level in order, collapsed', () => {
    const rows = visibleRows(pages, open(), null)
    expect(ids(rows)).toEqual(['a', 'b'])
    expect(rows[0]).toMatchObject({ depth: 1, hasChildren: true, expanded: false, parentRef: null })
    expect(rows[1].hasChildren).toBe(false)
  })
  it('shows a branch in order when it is expanded, and only that branch', () => {
    const rows = visibleRows(pages, open('doc:a'), null)
    expect(ids(rows)).toEqual(['a', 'a2', 'a1', 'b'])
    expect(rows[2]).toMatchObject({ depth: 2, hasChildren: true, expanded: false, parentRef: { kind: 'doc', id: 'a' } })
    expect(ids(visibleRows(pages, open('doc:a', 'doc:a1'), null))).toEqual(['a', 'a2', 'a1', 'a1x', 'b'])
  })
  it('does not show the inside of a branch whose ancestor is collapsed, even if it is marked open', () => {
    expect(ids(visibleRows(pages, open('doc:a1'), null))).toEqual(['a', 'b'])
  })
  it('marks the open page', () => {
    const rows = visibleRows(pages, open('doc:a'), { kind: 'doc', id: 'a2' })
    expect(rows.filter((r) => r.open).map((r) => r.ref.id)).toEqual(['a2'])
  })
  it('tells a deck from a doc with the same id', () => {
    const both = [page('doc', 'x'), page('deck', 'x', { sortKey: 'a' }), page('doc', 'kid', { parent: { kind: 'deck', id: 'x' } })]
    const rows = visibleRows(both, open('deck:x'), { kind: 'doc', id: 'x' })
    expect(rows.map((r) => `${r.ref.kind}:${r.ref.id}`)).toEqual(['doc:x', 'deck:x', 'doc:kid'])
    expect(rows.filter((r) => r.open).map((r) => r.ref.kind)).toEqual(['doc'])
  })
  it('hides an empty deck with no pages inside, but not one with a page inside', () => {
    const list = [page('deck', 'empty', { slides: 0 }), page('deck', 'holder', { slides: 0, sortKey: 'b' }), page('doc', 'kid', { parent: { kind: 'deck', id: 'holder' } })]
    expect(ids(visibleRows(list, open(), null))).toEqual(['holder'])
    expect(ids(visibleRows(list, open('deck:holder'), null))).toEqual(['holder', 'kid'])
  })
  it('does not draw a chevron for an empty deck that is hidden inside its parent', () => {
    const list = [page('doc', 'p'), page('deck', 'ghost', { slides: 0, parent: { kind: 'doc', id: 'p' } })]
    const rows = visibleRows(list, open('doc:p'), null)
    expect(ids(rows)).toEqual(['p'])
    expect(rows[0].hasChildren).toBe(false)
  })
  it('keeps an empty deck that is open on screen', () => {
    expect(ids(visibleRows([page('deck', 'new', { slides: 0 })], open(), { kind: 'deck', id: 'new' }))).toEqual(['new'])
  })
  it('shows a page whose parent is missing at the top', () => {
    expect(ids(visibleRows([page('doc', 'lost', { parent: { kind: 'doc', id: 'gone' } })], open(), null))).toEqual(['lost'])
  })
  it('caps the indent at four levels but keeps the real depth', () => {
    expect([1, 2, 3, 4, 5, 6].map(shownDepth)).toEqual([1, 2, 3, 4, 4, 4])
    const chain = ['l1', 'l2', 'l3', 'l4', 'l5', 'l6'].map((id, i, all) => page('doc', id, { parent: i ? { kind: 'doc', id: all[i - 1] } : null }))
    const rows = visibleRows(chain, new Set(chain.map((p) => `doc:${p.id}`)), null)
    expect(rows.map((r) => r.depth)).toEqual([1, 2, 3, 4, 5, 6])
  })
})

describe('pathTo', () => {
  it('lists the ancestors, top first', () => {
    expect(pathTo(pages, { kind: 'deck', id: 'a1x' })).toEqual([{ kind: 'doc', id: 'a' }, { kind: 'doc', id: 'a1' }])
    expect(pathTo(pages, { kind: 'doc', id: 'a' })).toEqual([])
  })
  it('stops at a missing parent and at a loop', () => {
    expect(pathTo([page('doc', 'lost', { parent: { kind: 'doc', id: 'gone' } })], { kind: 'doc', id: 'lost' })).toEqual([])
    const loop = [page('doc', 'x', { parent: { kind: 'doc', id: 'y' } }), page('doc', 'y', { parent: { kind: 'doc', id: 'x' } })]
    expect(pathTo(loop, { kind: 'doc', id: 'x' })).toEqual([{ kind: 'doc', id: 'y' }])
  })
})

describe('withOpenDeck', () => {
  it('gives the open deck its live name and slide count', () => {
    const out = withOpenDeck(pages, { id: 'b', name: 'Live', slides: 7 }, null)
    expect(out.find((p) => p.id === 'b')).toMatchObject({ name: 'Live', slides: 7 })
    expect(out).toHaveLength(pages.length)
  })
  it('lists a deck before its first save, last under its pending parent', () => {
    const out = withOpenDeck(pages, { id: 'fresh', name: 'Fresh', slides: 1 }, { kind: 'doc', id: 'a' })
    const rows = visibleRows(out, open('doc:a'), { kind: 'deck', id: 'fresh' })
    expect(ids(rows)).toEqual(['a', 'a2', 'a1', 'fresh', 'b'])
    expect(rows.find((r) => r.ref.id === 'fresh')).toMatchObject({ depth: 2, open: true })
  })
  it('puts it at the top when the pending parent is not listed, and adds nothing without slides or an id', () => {
    expect(withOpenDeck(pages, { id: 'fresh', name: 'F', slides: 1 }, { kind: 'doc', id: 'gone' }).at(-1)?.parent).toBeNull()
    expect(withOpenDeck(pages, { id: 'fresh', name: 'F', slides: 0 }, null)).toBe(pages)
    expect(withOpenDeck(pages, { id: null, name: 'F', slides: 2 }, null)).toBe(pages)
  })
  it('does not list the deck twice when its real row arrives', () => {
    const first = withOpenDeck(pages, { id: 'fresh', name: 'Fresh', slides: 1 }, null)
    const arrived = [...pages, page('deck', 'fresh', { name: 'Old name', sortKey: 'z' })]
    expect(withOpenDeck(arrived, { id: 'fresh', name: 'Fresh', slides: 1 }, null).filter((p) => p.id === 'fresh')).toHaveLength(1)
    expect(first.filter((p) => p.id === 'fresh')).toHaveLength(1)
  })
})

describe('expanded branches in storage', () => {
  const fake = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) } } }
  it('keeps them per viewer and workspace', () => {
    const s = fake()
    saveExpanded('u1', 'w1', new Set(['doc:a']), s)
    expect([...loadExpanded('u1', 'w1', s)]).toEqual(['doc:a'])
    expect(loadExpanded('u2', 'w1', s).size).toBe(0)
    expect(loadExpanded('u1', 'w2', s).size).toBe(0)
  })
  it('reads nothing from junk and survives storage that throws', () => {
    const s = fake()
    s.setItem('smartchart.tree.open.v1.u1.w1', '{not json')
    expect(loadExpanded('u1', 'w1', s).size).toBe(0)
    const broken = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('full') } }
    expect(loadExpanded('u1', 'w1', broken).size).toBe(0)
    expect(() => saveExpanded('u1', 'w1', new Set(['doc:a']), broken)).not.toThrow()
  })
})

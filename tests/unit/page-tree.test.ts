import { describe, expect, it } from 'vitest'
import { buildTree, canMove, CYCLE, depthOf, descendants, heightBelow, isKey, keyBetween, MAX_DEPTH, NO_PAGE, TOO_DEEP, type PageKind, type PageNode, type PageRef } from '../../src/engine/pages/tree'

const ref = (kind: PageKind, id: string): PageRef => ({ kind, id })
const node = (kind: PageKind, id: string, parent: PageRef | null = null, sortKey: string | null = null): PageNode => ({ kind, id, parent, sortKey })
/** A chain of `n` pages, each under the one before; the first at the top. */
const chain = (n: number): PageNode[] => Array.from({ length: n }, (_, i) => node('doc', `p${i}`, i ? ref('doc', `p${i - 1}`) : null))

describe('keyBetween', () => {
  it('makes a key between two keys, before the first and after the last', () => {
    const mid = keyBetween('V', 'W'), first = keyBetween(null, 'V'), last = keyBetween('V', null), only = keyBetween(null, null)
    expect(mid > 'V' && mid < 'W').toBe(true)
    expect(first < 'V').toBe(true)
    expect(last > 'V').toBe(true)
    for (const k of [mid, first, last, only]) expect(isKey(k)).toBe(true)
  })
  it('keeps room: 200 inserts at one spot stay in order and short', () => {
    const keys = ['V', 'W']
    for (let i = 0; i < 200; i++) keys.splice(1, 0, keyBetween(keys[0], keys[1]))
    expect([...keys].sort()).toEqual(keys)
    expect(new Set(keys).size).toBe(keys.length)
    expect(Math.max(...keys.map((k) => k.length))).toBeLessThan(40)
  })
  it('keeps room before the first and after the last, too', () => {
    const keys = ['V']
    for (let i = 0; i < 100; i++) { keys.unshift(keyBetween(null, keys[0])); keys.push(keyBetween(keys[keys.length - 1], null)) }
    expect([...keys].sort()).toEqual(keys)
    expect(new Set(keys).size).toBe(keys.length)
  })
  it('finds room under a key that has none beside it', () => {
    expect(keyBetween('0001V', '0002V') > '0001V').toBe(true)
    const k = keyBetween(null, '1')
    expect(k < '1' && isKey(k)).toBe(true)
  })
  it('refuses keys it could not have made and keys out of order', () => {
    expect(() => keyBetween('V0', null)).toThrow()
    expect(() => keyBetween('', null)).toThrow()
    expect(() => keyBetween('W', 'V')).toThrow()
    expect(() => keyBetween('V', 'V')).toThrow()
  })
})

describe('buildTree', () => {
  it('orders siblings by key, then kind and id, and a page with no key comes first', () => {
    const t = buildTree([node('doc', 'b', null, 'W'), node('deck', 'a', null, 'W'), node('doc', 'c', null, 'V'), node('deck', 'n', null, null)])
    expect(t.roots.map((n) => `${n.kind}:${n.id}`)).toEqual(['deck:n', 'doc:c', 'deck:a', 'doc:b'])
  })
  it('nests a deck under a doc and a doc under a deck, and tells a deck from a doc with the same id', () => {
    const t = buildTree([node('doc', 'x'), node('deck', 'x'), node('deck', 'k', ref('doc', 'x')), node('doc', 'j', ref('deck', 'x'))])
    expect(t.children(ref('doc', 'x')).map((n) => n.id)).toEqual(['k'])
    expect(t.children(ref('deck', 'x')).map((n) => n.id)).toEqual(['j'])
  })
  it('puts a page whose parent is missing at the top', () => {
    const t = buildTree([node('doc', 'a', ref('doc', 'gone'))])
    expect(t.roots.map((n) => n.id)).toEqual(['a'])
  })
})

describe('depth and subtree', () => {
  it('counts levels from the top, a page at the top being level 1', () => {
    const nodes = chain(3)
    expect([0, 1, 2].map((i) => depthOf(nodes, ref('doc', `p${i}`)))).toEqual([1, 2, 3])
    expect(heightBelow(nodes, ref('doc', 'p0'))).toBe(3)
    expect(heightBelow(nodes, ref('doc', 'p2'))).toBe(1)
  })
  it('lists everything below a page and nothing else', () => {
    const nodes = [...chain(3), node('deck', 'side')]
    expect(descendants(nodes, ref('doc', 'p0')).map((n) => n.id)).toEqual(['p1', 'p2'])
  })
  it('stops on a loop in the data instead of running on', () => {
    const loop = [node('doc', 'a', ref('doc', 'b')), node('doc', 'b', ref('doc', 'a'))]
    expect(depthOf(loop, ref('doc', 'a'))).toBe(2)
    expect(descendants(loop, ref('doc', 'a')).map((n) => n.id)).toEqual(['b'])
    expect(heightBelow(loop, ref('doc', 'a'))).toBe(2)
  })
})

describe('canMove', () => {
  it('allows a move to the top and under a page that is not below it', () => {
    const nodes = [...chain(3), node('deck', 'side')]
    expect(canMove(nodes, ref('doc', 'p2'), null)).toBe('ok')
    expect(canMove(nodes, ref('deck', 'side'), ref('doc', 'p2'))).toBe('ok')
  })
  it('refuses a page under itself, its child and its grandchild', () => {
    const nodes = chain(3)
    for (const under of ['p0', 'p1', 'p2']) expect(canMove(nodes, ref('doc', 'p0'), ref('doc', under))).toBe(CYCLE)
  })
  it('allows the sixth level and refuses the seventh', () => {
    const nodes = [...chain(MAX_DEPTH - 1), node('doc', 'extra')]
    expect(canMove(nodes, ref('doc', 'extra'), ref('doc', `p${MAX_DEPTH - 2}`))).toBe('ok')
    const full = [...chain(MAX_DEPTH), node('doc', 'extra')]
    expect(canMove(full, ref('doc', 'extra'), ref('doc', `p${MAX_DEPTH - 1}`))).toBe(TOO_DEEP)
  })
  it('counts the moved subtree: a page with children can\u2019t go as deep as a leaf', () => {
    const nodes = [...chain(4), node('doc', 'top'), node('doc', 'kid', ref('doc', 'top'))]
    expect(canMove(nodes, ref('doc', 'kid'), ref('doc', 'p3'))).toBe('ok')
    expect(canMove(nodes, ref('doc', 'top'), ref('doc', 'p3'))).toBe('ok')
    const deeper = [...nodes, node('doc', 'grand', ref('doc', 'kid'))]
    expect(canMove(deeper, ref('doc', 'top'), ref('doc', 'p3'))).toBe(TOO_DEEP)
  })
  it('says there is no such page for a page or a parent that is not there', () => {
    expect(canMove(chain(2), ref('doc', 'nope'), null)).toBe(NO_PAGE)
    expect(canMove(chain(2), ref('doc', 'p0'), ref('doc', 'nope'))).toBe(NO_PAGE)
  })
  it('does not mistake a deck for the doc with its id', () => {
    const nodes = [node('doc', 'x'), node('deck', 'x', ref('doc', 'x'))]
    expect(canMove(nodes, ref('doc', 'x'), ref('deck', 'x'))).toBe(CYCLE)
    expect(canMove(nodes, ref('deck', 'x'), null)).toBe('ok')
  })
})

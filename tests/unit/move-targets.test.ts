import { describe, expect, it } from 'vitest'
import type { PageSummary } from '@/engine/pages/tree'
import { CYCLE, TOO_DEEP } from '@/engine/pages/tree'
import { moveTargets } from '@/app/components/sidebar/moveTargets'
import { moveStep } from '@/app/components/sidebar/treeKeys'
import type { Row } from '@/app/components/sidebar/flatten'

const page = (id: string, parent: string | null, key: string, over: Partial<PageSummary> = {}): PageSummary =>
  ({ kind: 'doc', id, name: id, updated: 0, slides: null, parent: parent ? { kind: 'doc', id: parent } : null, sortKey: key, ...over })

describe('moveTargets', () => {
  const pages = [page('a', null, 'a'), page('b', 'a', 'a'), page('c', 'b', 'a'), page('d', null, 'b')]
  const reasons = (id: string) => moveTargets(pages, { kind: 'doc', id }).map((t) => [t.name, t.depth, t.reason])

  it('lists pages in tree order with their depth', () => {
    expect(moveTargets(pages, { kind: 'doc', id: 'd' }).map((t) => [t.name, t.depth])).toEqual([['a', 1], ['b', 2], ['c', 3], ['d', 1]])
  })
  it('greys the page and what is inside it', () => {
    expect(reasons('a')).toEqual([['a', 1, CYCLE], ['b', 2, CYCLE], ['c', 3, CYCLE], ['d', 1, null]])
  })
  it('greys a place too deep for the page and its subpages', () => {
    const deep = [page('p1', null, 'a'), page('p2', 'p1', 'a'), page('p3', 'p2', 'a'), page('p4', 'p3', 'a'), page('p5', 'p4', 'a'), page('p6', 'p5', 'a'), page('x', null, 'b'), page('y', 'x', 'a')]
    const why = Object.fromEntries(moveTargets(deep, { kind: 'doc', id: 'x' }).map((t) => [t.name, t.reason]))
    expect(why.p5).toBe(TOO_DEEP) // x and y below p5 would be 7 levels
    expect(why.p4).toBeNull()
  })
  it('leaves out an empty deck', () => {
    const list = [page('a', null, 'a'), page('e', null, 'b', { kind: 'deck', slides: 0 })]
    expect(moveTargets(list, { kind: 'doc', id: 'a' }).map((t) => t.name)).toEqual(['a'])
  })
})

describe('moveStep', () => {
  const row = (id: string, parent: string | null): Row => ({ ref: { kind: 'doc', id }, name: id, depth: parent ? 2 : 1, hasChildren: false, expanded: false, open: false,
    parentRef: parent ? { kind: 'doc', id: parent } : null, updated: 0, slides: null })
  const rows = [row('a', null), row('a1', 'a'), row('a2', 'a'), row('b', null)]
  const ref = (id: string) => ({ kind: 'doc' as const, id })

  it('reorders among siblings and stops at the ends', () => {
    expect(moveStep(rows, ref('a2'), 'up')).toEqual({ to: { parent: ref('a'), before: ref('a1') } })
    expect(moveStep(rows, ref('a1'), 'down')).toEqual({ to: { parent: ref('a'), after: ref('a2') } })
    expect(moveStep(rows, ref('a1'), 'up')).toBeNull()
    expect(moveStep(rows, ref('b'), 'down')).toBeNull()
  })
  it('indents under the sibling above, last, and opens it', () => {
    expect(moveStep(rows, ref('b'), 'indent')).toEqual({ to: { parent: ref('a') }, expand: ref('a') })
    expect(moveStep(rows, ref('a'), 'indent')).toBeNull()
  })
  it('outdents to just after its parent', () => {
    expect(moveStep(rows, ref('a2'), 'outdent')).toEqual({ to: { parent: null, after: ref('a') } })
    expect(moveStep(rows, ref('b'), 'outdent')).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import { canParent, dateSpan, issueTree, progress } from '../../src/engine/roadmaps/tree'
import { issue } from './roadmap-builders'

const t = [
  issue({ id: 'u', parentId: null }),
  issue({ id: 'f', parentId: 'u' }),
  issue({ id: 'a', parentId: 'f', status: 'done' }),
  issue({ id: 'b', parentId: 'f', status: 'done' }),
  issue({ id: 'c', parentId: 'f', status: 'in_progress' }),
  issue({ id: 'x', parentId: 'u', status: 'cancelled' }),
]

/** A chain of `n` nested issues; the deepest id is `n{n}`. */
const chain = (n: number) =>
  Array.from({ length: n }, (_, i) => {
    const id = `n${i + 1}`
    return issue({ id, parentId: i ? `n${i}` : null, sortKey: String.fromCharCode(97 + i) })
  })

describe('roadmap tree', () => {
  it('rolls progress over the issues with no sub-issues, Linear-style', () => {
    expect(progress(t, 'f')).toBeCloseTo(0.75)
    expect(progress(t, 'u')).toBeCloseTo(0.75)
    expect(progress(t, 'a')).toBe(1)
    expect(progress([issue({ id: 'z', status: 'cancelled' })], 'z')).toBeNull()
  })

  it('refuses a parent inside its own subtree, a missing parent, and depth over 12', () => {
    expect(canParent(t, 'u', 'a')).toMatch(/inside itself/)
    expect(canParent(t, 'a', 'nope')).toMatch(/No such issue/)
    expect(canParent(chain(12), 'leaf-extra', 'n12')).toMatch(/12 levels/)
    expect(canParent(t, 'c', null)).toBe('ok')
  })

  it('takes the children’s span when a parent has no dates', () => {
    const d = [
      issue({ id: 'p' }),
      issue({ id: 'k1', parentId: 'p', start: '2026-11-02', due: '2026-12-01' }),
      issue({ id: 'k2', parentId: 'p', start: '2026-11-20', due: '2027-02-26' }),
    ]
    expect(dateSpan(d, 'p')).toEqual({ start: '2026-11-02', due: '2027-02-26' })
    expect(dateSpan([...d.slice(1), issue({ id: 'p', start: '2026-10-01', due: '2026-10-31' })], 'p')).toEqual({
      start: '2026-10-01',
      due: '2026-10-31',
    })
  })

  it('ignores deleted issues everywhere', () => {
    expect(issueTree([...t, issue({ id: 'd', parentId: 'u', deletedAt: 1 })]).children('u').map((i) => i.id)).toEqual(['f', 'x'])
  })

})

import { describe, expect, it } from 'vitest'
import { progressUnder } from '../../src/engine/roadmaps/rollup'
import { issue } from './roadmap-builders'

describe('progressUnder', () => {
  it('pools leaves under top-most ids as 2/3 for two Done and one To do', () => {
    const issues = [
      issue({ id: 'a', parentId: null, sortKey: 'a' }),
      issue({ id: 'a1', parentId: 'a', status: 'done', sortKey: 'a' }),
      issue({ id: 'a2', parentId: 'a', status: 'done', sortKey: 'b' }),
      issue({ id: 'b', parentId: null, status: 'todo', sortKey: 'b' }),
    ]
    expect(progressUnder(issues, ['a', 'b'])).toBeCloseTo(2 / 3)
  })

  it('skips an id nested inside another id in the set', () => {
    const issues = [
      issue({ id: 'p', parentId: null, sortKey: 'a' }),
      issue({ id: 'c', parentId: 'p', status: 'done', sortKey: 'a' }),
      issue({ id: 'q', parentId: null, status: 'todo', sortKey: 'b' }),
    ]
    expect(progressUnder(issues, ['p', 'c', 'q'])).toBeCloseTo(0.5)
    expect(progressUnder(issues, ['p', 'c'])).toBeCloseTo(1)
  })

  it('returns null when every counted leaf is cancelled', () => {
    const issues = [
      issue({ id: 'a', parentId: null, sortKey: 'a' }),
      issue({ id: 'a1', parentId: 'a', status: 'cancelled', sortKey: 'a' }),
    ]
    expect(progressUnder(issues, ['a'])).toBeNull()
  })
})

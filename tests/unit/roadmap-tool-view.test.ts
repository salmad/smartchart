import { describe, expect, it } from 'vitest'
import { CHECK_IDS } from '../../src/engine/roadmaps/checks'
import { issue } from './roadmap-builders'
import { checksFor, matchingIssues, todayUtc } from '../../src/engine/tools/roadmap-view'

describe('roadmap tool view', () => {
  it('todayUtc is the UTC date, and a due date the day before is overdue', () => {
    const now = Date.parse('2026-01-02T00:30:00.000Z')
    expect(todayUtc(now)).toBe('2026-01-02')
    const issues = [
      issue({ id: 'late', start: '2026-01-01', due: '2026-01-01', status: 'todo' }),
      issue({ id: 'today', start: '2026-01-02', due: '2026-01-02', status: 'todo' }),
    ]
    expect(checksFor(issues, 'late', todayUtc(now))).toContain('overdue')
    expect(checksFor(issues, 'today', todayUtc(now))).not.toContain('overdue')
    expect(checksFor(issues, 'late', todayUtc(now))).toEqual(expect.arrayContaining(['no_assignee', 'overdue']))
    expect(checksFor(issues, 'late', todayUtc(now))).not.toContain('no_dates')
    for (const id of checksFor(issues, 'late', todayUtc(now))) expect(CHECK_IDS).toContain(id)
  })

  it('matchingIssues ANDs chips and skips a parent that does not match', () => {
    const today = '2026-01-02'
    const issues = [
      issue({ id: 'd', title: 'D', status: 'todo' }),
      issue({ id: 'p', title: 'P', status: 'todo', start: '2026-01-01', due: '2026-01-03' }),
      issue({ id: 'a', parentId: 'p', title: 'A', status: 'todo' }),
      issue({ id: 'c', parentId: 'a', title: 'C', status: 'todo' }),
      issue({ id: 'b', parentId: 'p', title: 'B', status: 'done' }),
    ]
    const chips = [{ on: 'status' as const, is: true, values: ['todo' as const] }, { on: 'check' as const, id: 'no_dates' as const }]
    expect(matchingIssues(issues, chips, today).map((i) => i.id)).toEqual(['d', 'c'])
  })
})
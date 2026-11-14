import { describe, expect, it } from 'vitest'
import { CHECK_IDS } from '../../src/engine/roadmaps/checks'
import { issue } from './roadmap-builders'
import { checksFor, todayUtc } from '../../src/engine/tools/roadmap-view'

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
})
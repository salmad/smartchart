import { describe, expect, it } from 'vitest'
import { checkRhythm, currentSprint, nextSprint, sprintAt, sprintEnded, sprintLabel, sprintOf } from '../../src/engine/roadmaps/sprints'

const r = { start: '2026-11-02', weeks: 2, rolled: null }

describe('sprint maths', () => {
  it('finds the sprint holding a date', () => {
    expect(sprintOf(r, '2026-11-02')).toEqual({ n: 1, start: '2026-11-02', end: '2026-11-15' })
    expect(sprintOf(r, '2026-11-15')?.n).toBe(1)
    expect(sprintOf(r, '2026-11-16')).toEqual({ n: 2, start: '2026-11-16', end: '2026-11-29' })
    expect(sprintOf(r, '2026-11-01')).toBeNull()
  })

  it('knows the current, next and numbered sprints', () => {
    expect(currentSprint(r, '2026-11-17')?.n).toBe(2)
    expect(currentSprint(r, '2026-10-01')).toBeNull()
    expect(nextSprint(r, '2026-11-17').n).toBe(3)
    expect(nextSprint(r, '2026-10-01').n).toBe(1)
    expect(sprintAt(r, 3)?.start).toBe('2026-11-30')
    expect(sprintAt(r, 0)).toBeNull()
    expect(sprintLabel(sprintAt(r, 14) as NonNullable<ReturnType<typeof sprintAt>>)).toBe('Sprint 14')
  })

  it('puts a stored date in whichever new sprint contains it after a rhythm change', () => {
    expect(sprintOf({ start: '2026-11-02', weeks: 3, rolled: null }, '2026-11-16')?.n).toBe(1)
  })

  it('crosses month and year ends', () => {
    expect(sprintOf({ start: '2026-12-28', weeks: 1, rolled: null }, '2027-01-04')).toEqual({ n: 2, start: '2027-01-04', end: '2027-01-10' })
  })

  it('checks a rhythm', () => {
    expect(checkRhythm({ start: '2026-11-02', weeks: 8 })).toBe('ok')
    expect(checkRhythm({ start: '2026-11-02', weeks: 9 })).not.toBe('ok')
    expect(checkRhythm({ start: '2026-11-02', weeks: 0 })).not.toBe('ok')
    expect(checkRhythm({ start: '2026-11-02', weeks: 1.5 })).not.toBe('ok')
    expect(checkRhythm({ start: '2026-02-30', weeks: 2 })).not.toBe('ok')
  })

  it('says when a sprint has ended', () => {
    expect(sprintEnded(r, '2026-11-02', '2026-11-16')).toBe(true)
    expect(sprintEnded(r, '2026-11-16', '2026-11-17')).toBe(false)
    expect(sprintEnded(r, '2026-11-15', '2026-11-15')).toBe(false)
    expect(sprintEnded(r, '2026-10-01', '2026-11-17')).toBe(false)
  })
})

describe('sprintHeading', () => {
  const s = { n: 14, start: '2026-11-23', end: '2026-12-06' }
  it('counts the days left, and names the last day', async () => {
    const { sprintHeading } = await import('../../src/app/components/roadmap/dates')
    expect(sprintHeading(s, '2026-11-27')).toBe('Sprint 14 · 23 Nov – 6 Dec · 9 days left')
    expect(sprintHeading(s, '2026-12-05')).toBe('Sprint 14 · 23 Nov – 6 Dec · 1 day left')
    expect(sprintHeading(s, '2026-12-06')).toBe('Sprint 14 · 23 Nov – 6 Dec · Last day')
  })
  it('says when a sprint starts, and shows only the dates of one that is over', async () => {
    const { sprintHeading } = await import('../../src/app/components/roadmap/dates')
    expect(sprintHeading(s, '2026-11-01')).toBe('Sprint 14 · starts 23 Nov')
    expect(sprintHeading(s, '2026-12-07')).toBe('Sprint 14 · 23 Nov – 6 Dec')
  })
})

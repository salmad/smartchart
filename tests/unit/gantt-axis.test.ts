import { describe, expect, it } from 'vitest'
import { makeAxis } from '../../src/app/components/roadmap/ganttAxis'

describe('gantt axis dayAt', () => {
  const range = { from: '2026-12-01', to: '2026-12-31' }
  const axis = makeAxis(range, 6)

  it('maps the left edge of a day to that day', () => {
    expect(axis.dayAt(0)).toBe('2026-12-01')
    expect(axis.dayAt(6)).toBe('2026-12-02')
  })

  it('keeps the right half of a day column on the same day (floor, not round)', () => {
    expect(axis.dayAt(3)).toBe('2026-12-01')
    expect(axis.dayAt(5)).toBe('2026-12-01')
    expect(axis.dayAt(8)).toBe('2026-12-02')
  })

  it('clamps past the range end', () => {
    expect(axis.dayAt(999)).toBe('2026-12-31')
  })
})

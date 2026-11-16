import { describe, expect, it } from 'vitest'
import { isoDate } from '../../api/_lib/db-roadmaps'

describe('isoDate', () => {
  // The driver parses a `date` column as midnight in the server's time zone; ahead of UTC that instant is the day before in UTC.
  it('keeps the stored day for a date the driver gave back as local midnight', () => {
    expect(isoDate(new Date(2026, 10, 16))).toBe('2026-11-16')
    expect(isoDate(new Date(2026, 0, 1))).toBe('2026-01-01')
  })
  it('passes strings and nothing through', () => {
    expect(isoDate('2026-11-16')).toBe('2026-11-16')
    expect(isoDate(null)).toBeNull()
  })
})

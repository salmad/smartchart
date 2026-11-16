import { describe, expect, it } from 'vitest'
import {
  DROP_DAYS,
  PX_PER_DAY,
  addDays,
  daysBetween,
  dragDates,
  dropDates,
  ganttRange,
  markFor,
  placeLabel,
  ticks,
} from '../../src/engine/roadmaps/gantt'
import { dateSpan } from '../../src/engine/roadmaps/rollup'
import { issue } from './roadmap-builders'

const today = '2026-11-09'

function utcDay(iso: string): number {
  return new Date(`${iso}T00:00:00.000Z`).getUTCDay()
}

describe('roadmap gantt engine', () => {
  describe('addDays and daysBetween', () => {
    it('steps across year boundaries', () => {
      expect(addDays('2026-12-30', 3)).toBe('2027-01-02')
    })

    it('steps across DST without drift', () => {
      expect(addDays('2026-03-28', 2)).toBe('2026-03-30')
    })

    it('counts whole days between ISO dates', () => {
      expect(daysBetween('2026-11-01', '2026-11-09')).toBe(8)
    })
  })

  describe('ganttRange', () => {
    it('defaults around today on month scale when nothing is dated', () => {
      expect(ganttRange([], today, 'month')).toEqual({ from: '2026-10-01', to: '2027-05-31' })
    })

    it('extends to the month after the latest due date', () => {
      const issues = [issue({ due: '2028-11-20' })]
      expect(ganttRange(issues, today, 'month').to).toBe('2028-12-31')
    })

    it('snaps week range to Monday through Sunday', () => {
      const range = ganttRange([], today, 'week')
      expect(utcDay(range.from)).toBe(1)
      expect(utcDay(range.to)).toBe(0)
      expect(daysBetween(range.from, range.to)).toBeGreaterThanOrEqual(7 * 8)
    })

    it('snaps quarter range to quarter boundaries', () => {
      expect(ganttRange([], today, 'quarter')).toEqual({ from: '2026-07-01', to: '2027-09-30' })
    })
  })

  describe('ticks', () => {
    const range = { from: '2026-10-01', to: '2027-05-31' }

    it('places month ticks with labels and pixel offsets', () => {
      const monthTicks = ticks(range, 'month', today)
      expect(monthTicks[0]).toEqual({ iso: '2026-10-01', label: 'Oct', x: 0 })
      const jan = monthTicks.find((t) => t.iso === '2027-01-01')
      expect(jan?.label).toBe("Jan '27")
      const nov = monthTicks.find((t) => t.iso === '2026-11-01')
      expect(nov?.x).toBe(31 * PX_PER_DAY.month)
    })

    it('labels week ticks with the Monday date', () => {
      const weekRange = ganttRange([], today, 'week')
      const weekTicks = ticks(weekRange, 'week', today)
      expect(weekTicks.length).toBeGreaterThan(0)
      for (const t of weekTicks) {
        expect(utcDay(t.iso)).toBe(1)
      }
      const sample = weekTicks.find((t) => t.iso === '2026-11-02')
      expect(sample?.label).toBe('2 Nov')
    })

    it('labels quarter ticks in Qn YYYY style', () => {
      const qRange = ganttRange([], today, 'quarter')
      const qTicks = ticks(qRange, 'quarter', today)
      const q4 = qTicks.find((t) => t.iso.startsWith('2026-10-01'))
      expect(q4?.label).toBe('Q4')
      const q1next = qTicks.find((t) => t.iso === '2027-01-01')
      expect(q1next?.label).toBe("Q1 '27")
    })
  })

  describe('markFor', () => {
    it('draws a bar for a leaf with start and due', () => {
      const issues = [issue({ id: 'leaf', start: '2026-11-01', due: '2026-11-20' })]
      const m = markFor(issues, 'leaf', today)
      expect(m).toMatchObject({ kind: 'bar', start: '2026-11-01', due: '2026-11-20' })
    })

    it('draws a milestone when start equals due', () => {
      const issues = [issue({ id: 'ms', title: 'UK launch', start: '2027-04-01', due: '2027-04-01' })]
      const m = markFor(issues, 'ms', today)
      expect(m).toEqual({
        kind: 'milestone',
        day: '2027-04-01',
        done: false,
        alert: false,
        overdue: false,
        label: null,
      })
    })

    it('draws a milestone on the single date when only one is set', () => {
      const issues = [issue({ id: 'due-only', title: 'Due only', due: '2026-12-01' })]
      const m = markFor(issues, 'due-only', today)
      expect(m).toMatchObject({ kind: 'milestone', day: '2026-12-01' })
    })

    it('brackets children span when parent has no own dates', () => {
      const issues = [
        issue({ id: 'p' }),
        issue({ id: 'c', parentId: 'p', start: '2026-11-02', due: '2026-11-30' }),
      ]
      const m = markFor(issues, 'p', today)
      expect(m).toEqual({
        kind: 'bracket',
        start: '2026-11-02',
        due: '2026-11-30',
        own: false,
        alert: false,
        overdue: false,
        label: null,
      })
    })

    it('brackets own dates when parent has both', () => {
      const issues = [
        issue({ id: 'p', start: '2026-10-01', due: '2026-10-31' }),
        issue({ id: 'c', parentId: 'p', start: '2026-11-02', due: '2026-11-30' }),
      ]
      const m = markFor(issues, 'p', today)
      expect(m).toMatchObject({
        kind: 'bracket',
        start: '2026-10-01',
        due: '2026-10-31',
        own: true,
      })
    })

    it('returns none when nothing below is dated', () => {
      const issues = [issue({ id: 'p' }), issue({ id: 'c', parentId: 'p' })]
      expect(markFor(issues, 'p', today)).toEqual({ kind: 'none' })
      expect(markFor(issues, 'c', today)).toEqual({ kind: 'none' })
    })

    describe('alerts', () => {
      it('flags overdue todo with day count', () => {
        const issues = [issue({ id: 'late', start: '2026-10-01', due: '2026-10-31', status: 'todo' })]
        const m = markFor(issues, 'late', today)
        expect(m).toMatchObject({ alert: true, overdue: true, label: 'Overdue 9 days' })
      })

      it('shows blocked on future due', () => {
        const issues = [issue({ id: 'blk', start: '2026-11-01', due: '2026-12-01', status: 'blocked' })]
        const m = markFor(issues, 'blk', today)
        expect(m).toMatchObject({ alert: true, overdue: false, label: 'Blocked' })
      })

      it('combines overdue and blocked', () => {
        const issues = [issue({ id: 'both', start: '2026-10-01', due: '2026-10-31', status: 'blocked' })]
        const m = markFor(issues, 'both', today)
        expect(m).toMatchObject({ alert: true, label: 'Overdue 9 days · blocked' })
      })

      it('clears alert on done even when due passed', () => {
        const issues = [issue({ id: 'done', start: '2026-10-01', due: '2026-10-31', status: 'done' })]
        const m = markFor(issues, 'done', today)
        expect(m).toMatchObject({ kind: 'bar', done: true, alert: false, label: null })
      })

      it('ignores cancelled past due', () => {
        const issues = [issue({ id: 'cx', start: '2026-10-01', due: '2026-10-31', status: 'cancelled' })]
        const m = markFor(issues, 'cx', today)
        expect(m).toMatchObject({ alert: false })
      })
    })
  })

  describe('placeLabel', () => {
    const bar = { x: 200, w: 60 }

    it('sits right of the mark when there is room', () => {
      expect(placeLabel(bar, 80, 500, 1000)).toEqual({ side: 'right', x: 268 })
    })

    it('moves left when the right side would cross today', () => {
      expect(placeLabel(bar, 80, 300, 1000)).toEqual({ side: 'left', x: 192 })
    })

    it('moves left when the right side would leave the timeline', () => {
      expect(placeLabel({ x: 900, w: 60 }, 80, 100, 1000)).toEqual({ side: 'left', x: 892 })
    })

    it('gives up when neither side is clear', () => {
      expect(placeLabel({ x: 40, w: 60 }, 80, 130, 1000)).toBeNull()
      expect(placeLabel(bar, 80, 150, 300)).toBeNull()
    })
  })

  describe('dragDates', () => {
    it('moves both ends together', () => {
      expect(dragDates('2026-11-02', '2026-11-10', 'move', 3)).toEqual({
        start: '2026-11-05',
        due: '2026-11-13',
      })
    })

    it('clamps start so it never passes due', () => {
      expect(dragDates('2026-11-02', '2026-11-10', 'start', 20)).toEqual({
        start: '2026-11-10',
        due: '2026-11-10',
      })
    })

    it('clamps end so it never precedes start', () => {
      expect(dragDates('2026-11-02', '2026-11-10', 'end', -20)).toEqual({
        start: '2026-11-02',
        due: '2026-11-02',
      })
    })
  })

  describe('dropDates', () => {
    it(`spans ${DROP_DAYS} days from the drop day`, () => {
      expect(dropDates('2026-11-09')).toEqual({ start: '2026-11-09', due: '2026-11-22' })
    })
  })

  describe('undefined issue dates', () => {
    it('dateSpan rolls up children when parent start/due are undefined', () => {
      const issues = [
        issue({ id: 'p', start: undefined, due: undefined }),
        issue({ id: 'c', parentId: 'p', start: '2026-11-02', due: '2026-11-30' }),
      ]
      expect(dateSpan(issues, 'p')).toEqual({ start: '2026-11-02', due: '2026-11-30' })
    })

    it('markFor treats undefined dates as undated', () => {
      const issues = [issue({ id: 'leaf', start: undefined, due: undefined })]
      expect(markFor(issues, 'leaf', today)).toEqual({ kind: 'none' })
    })
  })
})

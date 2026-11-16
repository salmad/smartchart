import { describe, expect, it } from 'vitest'
import { barDraggable, barHitMode } from '@/app/components/roadmap/ganttBarDrag'
import { makeAxis } from '@/app/components/roadmap/ganttAxis'

const axis = makeAxis({ from: '2026-10-01', to: '2027-05-31' }, 6)

describe('ganttBarDrag', () => {
  it('hits start, move and end zones on a bar', () => {
    const mark = { kind: 'bar' as const, start: '2026-12-01', due: '2026-12-10', done: false, alert: false, overdue: false, label: null }
    const barX = axis.xOf('2026-12-01')
    const w = 10 * 6
    expect(barHitMode(barX + 3, '2026-12-01', '2026-12-10', axis, mark)).toBe('start')
    expect(barHitMode(barX + w - 3, '2026-12-01', '2026-12-10', axis, mark)).toBe('end')
    expect(barHitMode(barX + w / 2, '2026-12-01', '2026-12-10', axis, mark)).toBe('move')
    expect(barHitMode(barX - 1, '2026-12-01', '2026-12-10', axis, mark)).toBeNull()
  })

  it('treats a milestone as move only on the diamond', () => {
    const mark = { kind: 'milestone' as const, day: '2026-12-15', done: false, alert: false, overdue: false, label: 'Day' }
    const cx = axis.xOf('2026-12-15') + 3
    expect(barHitMode(cx, '2026-12-15', '2026-12-15', axis, mark)).toBe('move')
    expect(barDraggable(mark)).toBe(true)
  })

  it('skips derived brackets', () => {
    const mark = { kind: 'bracket' as const, start: '2026-12-01', due: '2026-12-10', own: false, alert: false, overdue: false, label: null }
    expect(barDraggable(mark)).toBe(false)
    expect(barHitMode(0, '2026-12-01', '2026-12-10', axis, mark)).toBeNull()
  })
})

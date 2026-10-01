import { test, expect } from 'vitest'
import { timelineLines } from '@/engine/slides/charts/timeline-rows'
import type { TimelineRow } from '@/engine/types'

const rows: TimelineRow[] = [
  { label: 'A' },
  { label: 'a1', level: 1, start: 1, end: 2 },
  { label: 'a2', level: 1, start: 3, end: 4 },
  { label: 'B', start: 0, end: 1, focus: true },
]

test('a group spans its children; a plain row keeps its own dates', () => {
  expect(timelineLines(rows).map((l) => [l.group, l.level, l.start, l.end, l.focus])).toEqual([
    [true, 0, 1, 4, false], [false, 1, 1, 2, false], [false, 1, 3, 4, false], [false, 0, 0, 1, true]])
})

test('a level-0 row with no children after it is not a group', () => {
  expect(timelineLines([{ label: 'x', start: 2, end: 3 }])[0]).toMatchObject({ group: false, start: 2, end: 3 })
})

test('a group whose children have no dates falls back to 0', () => {
  expect(timelineLines([{ label: 'g' }, { label: 'c', level: 1 }])[0]).toMatchObject({ group: true, start: 0, end: 0 })
})

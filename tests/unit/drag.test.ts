import { test, expect } from 'vitest'
import { axisOf, dropIndex } from '@/app/edit/drag'

const row = (n: number) => Array.from({ length: n }, (_, i) => ({ left: i * 100, right: i * 100 + 90, top: 0, bottom: 50 }))
const col = (n: number) => Array.from({ length: n }, (_, i) => ({ left: 0, right: 200, top: i * 60, bottom: i * 60 + 50 }))

test('the axis is the way the items are laid out', () => {
  expect(axisOf(row(3))).toBe('x')
  expect(axisOf(col(3))).toBe('y')
  expect(axisOf(row(1))).toBe('y')
})

test('the drop index counts the other items that sit before the pointer', () => {
  // Dragging item 0 of 4 to the right of item 2 puts it at index 2 (after items 1 and 2).
  expect(dropIndex(row(4), 0, { x: 260, y: 20 }, 'x')).toBe(2)
  expect(dropIndex(row(4), 0, { x: 5, y: 20 }, 'x')).toBe(0)
  expect(dropIndex(row(4), 3, { x: 5, y: 20 }, 'x')).toBe(0)
  expect(dropIndex(row(4), 1, { x: 999, y: 20 }, 'x')).toBe(3)
  expect(dropIndex(col(3), 2, { x: 50, y: 10 }, 'y')).toBe(0)
  expect(dropIndex(col(3), 0, { x: 50, y: 95 }, 'y')).toBe(1)
})

import { dropPlace } from '@/app/edit/drag'
const rowBox = (top: number) => ({ top, bottom: top + 40 })
const labelBox = { left: 40, width: 200 }

test('the drop place is the row boundary under the pointer; the level is the side of the label', () => {
  const boxes = [rowBox(0), rowBox(40), rowBox(80)]
  expect(dropPlace(boxes, { x: 60, y: 10 }, labelBox)).toEqual({ before: 0, level: 0 })
  expect(dropPlace(boxes, { x: 60, y: 70 }, labelBox)).toEqual({ before: 2, level: 0 })
  expect(dropPlace(boxes, { x: 200, y: 70 }, labelBox)).toEqual({ before: 2, level: 1 })
  expect(dropPlace(boxes, { x: 60, y: 500 }, labelBox)).toEqual({ before: 3, level: 0 })
})

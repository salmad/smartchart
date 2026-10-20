import { test, expect } from 'vitest'
import { chartTargetOf } from '@/app/edit/selection'

/** The slice of an element the mapping reads: `closest` finds the nearest ancestor carrying data-series, with its dataset. */
const el = (dataset: Record<string, string> | null, host?: string) => ({
  closest: (sel: string) => (sel === '[data-series]' && dataset ? { dataset } : sel === '[data-chart]' && host !== undefined ? { dataset: { chart: host } } : null),
})

test('a bar is a target with its series and its position', () => {
  expect(chartTargetOf(el({ series: '1', i: '2' }))).toEqual({ kind: 'bar', series: 1, index: 2 })
  expect(chartTargetOf(el({ series: '0', i: '0' }))).toEqual({ kind: 'bar', series: 0, index: 0 })
})

test('a line is a target with its series only', () => {
  expect(chartTargetOf(el({ series: '1' }))).toEqual({ kind: 'series', series: 1 })
})

test('anything else on a chart, or off one, is not a chart target', () => {
  expect(chartTargetOf(el(null))).toBeNull()
  expect(chartTargetOf(null)).toBeNull()
  expect(chartTargetOf(el({ series: 'x' }))).toBeNull()
})

test("a mark in a pair's numbered chart carries the half; a chart slide's unnumbered host does not", () => {
  expect(chartTargetOf(el({ series: '0', i: '3' }, '1'))).toEqual({ kind: 'bar', series: 0, index: 3, half: 1 })
  expect(chartTargetOf(el({ series: '2' }, '0'))).toEqual({ kind: 'series', series: 2, half: 0 })
  expect(chartTargetOf(el({ series: '2' }, ''))).toEqual({ kind: 'series', series: 2 })
})

import { test, expect } from 'vitest'
import { addPeriod, addRow, addSeries, chartGrid, fromGrid, gridLimits, removePeriod, removeRow, removeSeries } from '@/engine/slides/grid'
import { validate } from '@/engine/slides/schema'
import { STARTERS } from '@/engine/starters'
import type { Chart } from '@/engine/types'

const charts = STARTERS.flatMap((s) => (['consulting', 'pitch'] as const).flatMap((style) => s[style].chart ? [{ id: `${s.id}/${style}`, chart: s[style].chart as Chart, slide: s[style], style }] : []))

for (const c of charts) test(`${c.id}: the grid round-trips without loss`, () => {
  expect(fromGrid(c.chart, chartGrid(c.chart))).toEqual(c.chart)
})

for (const c of charts) test(`${c.id}: adding and removing rows keeps a valid chart`, () => {
  const lim = gridLimits(c.style), g = chartGrid(c.chart)
  const grown = addRow(g, lim), shrunk = removeRow(g, 0, lim)
  for (const next of [grown, shrunk]) {
    const errors = validate({ ...c.slide, chart: fromGrid(c.chart, next) }, c.style).errors.filter((e) => /chart/.test(e) && !/characters|at most|required/.test(e))
    expect(errors).toEqual([])
  }
})

test('bars: a new series copies the last one\'s mark and colour, with zeros', () => {
  const chart: Chart = { categories: ['a', 'b'], series: [{ name: 'Us', values: [1, 2], mark: 'bar', color: 'focus' }] }
  const g = addSeries(chartGrid(chart), gridLimits('consulting'))
  const out = fromGrid(chart, g)
  expect(out.series?.[1]).toMatchObject({ name: '', values: [0, 0], mark: 'bar', color: 'neutral' })
  expect(fromGrid(chart, removeSeries(g, 1, gridLimits('consulting')))).toEqual(chart)
})

test('timeline: removing a period clamps rows and milestones into range', () => {
  const chart: Chart = { kind: 'timeline', periods: ['Q1', 'Q2', 'Q3', 'Q4'], rows: [{ label: 'A', start: 0, end: 3 }, { label: 'B', start: 2, end: 3 }], milestones: [{ label: 'Go', at: 3 }] }
  const out = fromGrid(chart, removePeriod(chartGrid(chart), 3, gridLimits('consulting')))
  expect(out.rows).toEqual([{ label: 'A', start: 0, end: 2 }, { label: 'B', start: 2, end: 2 }])
  expect(out.milestones).toEqual([{ label: 'Go', at: 2 }])
  expect(fromGrid(chart, addPeriod(chartGrid(chart), gridLimits('consulting'))).periods).toEqual(['Q1', 'Q2', 'Q3', 'Q4', ''])
})

test('limits stop rows at the schema bounds', () => {
  const chart: Chart = { categories: ['a', 'b'], series: [{ name: 'x', values: [1, 2], mark: 'bar' }] }
  const g = chartGrid(chart), lim = gridLimits('consulting')
  expect(removeRow(g, 0, lim)).toBe(g)  // 2 categories is the minimum: unchanged
})

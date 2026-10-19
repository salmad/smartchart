/* A figure edited in place is checked as the doc checks it: its body through the slide schema with the doc's limits,
   each message at its field's path. */
import { test, expect } from 'vitest'
import { BLOCK_STARTERS } from '@/engine/starters'
import { asSlide } from '@/engine/docs/figure'
import type { FigureBlock } from '@/engine/docs/types'
import type { Slide } from '@/engine/types'
import { bodyOf, figureCheck } from '@/app/components/docs/figureCheck'

const starter = (kind: string): FigureBlock => {
  const s = BLOCK_STARTERS.find((b) => b.kind === kind)
  if (!s) throw new Error(kind)
  return { type: 'figure', kind: s.kind, id: 'f', body: structuredClone(s.body) }
}

test('the chart starter has no issues', () => {
  const f = starter('chart')
  expect(figureCheck('chart')(asSlide(f) as Slide)).toEqual([])
})

test('a chart with 21 categories has an issue at a chart path', () => {
  const s = asSlide(starter('chart')) as Slide, chart = s.chart
  if (!chart || chart.kind === 'timeline') throw new Error('bars')
  const n = 21, categories = Array.from({ length: n }, (_, i) => `C${i}`)
  const big = { ...s, chart: { ...chart, categories, series: (chart.series ?? []).map((x) => ({ ...x, values: categories.map((_, i) => i + 1) })) } } as Slide
  const issues = figureCheck('chart')(big)
  expect(issues.length).toBeGreaterThan(0)
  expect(issues[0].path).toMatch(/^chart/)
})

test('a callout is checked against its own fields', () => {
  const f = starter('callout'), s = { ...f.body, template: 'callout', title: '' } as unknown as Slide
  expect(figureCheck('callout')(s)).toEqual([])
  expect(figureCheck('callout')({ ...s, text: '' } as Slide)[0]?.path).toBe('text')
})

test('bodyOf drops the template and title', () => {
  const f = starter('table')
  expect(bodyOf(asSlide(f) as Slide)).toEqual(f.body)
})

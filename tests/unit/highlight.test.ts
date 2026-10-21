import { test, expect } from 'vitest'
import { applyPatch } from '@/engine/agent/patch'
import { focusCount } from '@/engine/agent/checks'
import { seriesSlots } from '@/engine/slides/colours'
import { failed, sheetFor, type Patch } from '@/engine/slides/sheet'
import { validate } from '@/engine/slides/schema'
import type { Chart, Slide } from '@/engine/types'

const must = <T>(v: T | null | undefined): T => { if (v === null || v === undefined) throw new Error('missing'); return v }
const chart = (over: Partial<Chart> = {}): Slide => ({ template: 'chart', title: 'T', chart: { categories: ['A', 'B', 'C', 'D'], format: '£{v}m', series: [
  { name: 'Us', values: [10, 14, 20, 25], mark: 'bar', color: 'neutral' }, { name: 'Them', values: [6, 8, 9, 12], mark: 'bar', color: 'neutral' }], highlight: { series: 0, index: 1 }, ...over } })
const errors = (s: Slide) => validate(s, 'consulting').errors
const apply = (s: Slide, p: Patch | { error: string } | null | undefined): Slide => { if (!p || failed(p)) throw new Error('no patch'); return must(applyPatch(s, p).slide) }
const model = (s: Slide) => must(sheetFor(s, 'consulting'))

test('validate: a highlight in range is accepted; every other shape is refused and names chart.highlight', () => {
  expect(errors(chart())).toEqual([])
  expect(errors(chart({ highlight: { series: 0, index: 4 } })).join('\n')).toMatch(/chart\.highlight/)
  expect(errors(chart({ highlight: { series: 2, index: 0 } })).join('\n')).toMatch(/chart\.highlight/)
  const withFocus = chart(); must(withFocus.chart?.series)[1].color = 'focus'
  expect(errors(withFocus).join('\n')).toMatch(/chart\.highlight/)
  const lines = chart(); must(lines.chart?.series).forEach((s) => { s.mark = 'line' })
  expect(errors(lines).join('\n')).toMatch(/chart\.highlight/)
  const water: Slide = { template: 'chart', title: 'T', chart: { kind: 'waterfall', highlight: { series: 0, index: 0 }, items: [{ label: 'A', value: 4 }, { label: 'B', value: -1 }, { label: 'C', total: true }] } }
  expect(errors(water).join('\n')).toMatch(/chart\.highlight/)
})

test('seriesSlots: no series is focus when a bar is highlighted', () => {
  const s = must(chart().chart)
  expect(seriesSlots(s).slots).not.toContain('focus')
})

test('focusCount: a highlighted bar is the one focus, stacked or not', () => {
  expect(focusCount(chart())).toBe(1)
  expect(focusCount(chart({ stacking: 'stacked' }))).toBe(1)
})

test('sheet: inserting, removing and moving a category keeps highlight on the same bar', () => {
  const s = chart(), m = model(s)
  expect(apply(s, m.insertRow(0)).chart?.highlight).toEqual({ series: 0, index: 2 })
  expect(apply(s, m.insertRow(3)).chart?.highlight).toEqual({ series: 0, index: 1 })
  expect(apply(s, m.removeRows(0, 0)).chart?.highlight).toEqual({ series: 0, index: 0 })
  expect(apply(s, m.removeRows(1, 1)).chart?.highlight).toBeUndefined()
  expect(apply(s, must(m.moveRow)(1, 3)).chart?.highlight).toEqual({ series: 0, index: 3 })
  expect(apply(s, must(m.moveRow)(0, 2)).chart?.highlight).toEqual({ series: 0, index: 0 })
})

test('sheet: inserting, removing and moving a series keeps highlight on the same bar', () => {
  const s = chart({ highlight: { series: 1, index: 2 } }), m = model(s)
  expect(apply(s, must(m.insertCol)(1)).chart?.highlight).toEqual({ series: 2, index: 2 })
  expect(apply(s, must(m.removeCols)(1, 1)).chart?.highlight).toEqual({ series: 0, index: 2 })
  expect(apply(s, must(m.removeCols)(2, 2)).chart?.highlight).toBeUndefined()
  expect(apply(s, must(m.moveCol)(2, 1)).chart?.highlight).toEqual({ series: 0, index: 2 })
})

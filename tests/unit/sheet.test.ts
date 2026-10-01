import { test, expect } from 'vitest'
import { applyPatch } from '@/engine/agent/patch'
import { failed, parseNum, parseTsv, pasteInto, sheetFor, toTsv, type Patch } from '@/engine/slides/sheet'
import type { Slide } from '@/engine/types'

const must = <T>(v: T | null | undefined): T => { if (v === null || v === undefined) throw new Error('missing'); return v }
const BARS: Slide = { template: 'chart', title: 'T', chart: { categories: ['FY24', 'FY25', 'FY26'], format: '£{v}m', series: [
  { name: 'Revenue', values: [10, 14, 20], mark: 'bar', color: 'focus' }, { name: 'Cost', values: [6, 8, 9], mark: 'line', color: 'contrast' }], annotations: [{ type: 'cagr', from: 0, to: 2 }] } }
const WATER: Slide = { template: 'chart', title: 'T', chart: { kind: 'waterfall', items: [{ label: 'Revenue', value: 42 }, { label: 'Cost', value: -9 }, { label: 'Margin', total: true }] } }
const sheet = (s: Slide) => must(sheetFor(s, 'consulting'))
const apply = (s: Slide, p: Patch | { error: string } | null | undefined): Slide => { if (!p || failed(p)) throw new Error('no patch'); return must(applyPatch(s, p).slide) }

test('numbers read the way people type them', () => {
  expect(parseNum('1,200')).toBe(1200)
  expect(parseNum('(3.1)')).toBe(-3.1)
  expect(parseNum('−5')).toBe(-5)
  expect(parseNum('12%')).toBe(12)
  expect(parseNum('£1.2m')).toBe(1.2)
  expect(parseNum(' 7 ')).toBe(7)
  expect(parseNum('')).toBeNull()
  expect(parseNum('abc')).toBeNull()
})

test('tab-separated text: quotes, CRLF and a trailing newline', () => {
  expect(parseTsv('a\tb\r\nc\t"d\te"\r\n')).toEqual([['a', 'b'], ['c', 'd\te']])
  expect(parseTsv('x')).toEqual([['x']])
  expect(toTsv([['a', 'b c'], ['1', '2']])).toBe('a\tb c\n1\t2')
})

test('bars: cells read and write on the real paths', () => {
  const m = sheet(BARS)
  expect([m.rows, m.cols.map((c) => c.header)]).toEqual([3, ['', 'Revenue', 'Cost']])
  expect(m.get(1, 1)).toBe(14)
  expect(m.path(1, 2)).toBe('chart.series[1].values[1]')
  const s = apply(BARS, m.set(1, 1, '16'))
  expect(s.chart?.series?.[0].values).toEqual([10, 16, 20])
  expect(failed(m.set(0, 1, 'abc'))).toBe(true)
  expect(failed(m.set(0, 1, ''))).toBe(true)
  expect(apply(BARS, m.set(0, 0, 'FY23')).chart?.categories?.[0]).toBe('FY23')
  expect(apply(BARS, m.setHeader(2, 'Costs')).chart?.series?.[1].name).toBe('Costs')
})

test('bars: moving a series keeps its own mark and colour; rows and columns follow the limits', () => {
  const m = sheet(BARS)
  const moved = apply(BARS, m.moveCol?.(1, 2))
  expect(moved.chart?.series?.map((s) => [s.name, s.mark, s.color])).toEqual([['Cost', 'line', 'contrast'], ['Revenue', 'bar', 'focus']])
  const added = apply(BARS, m.insertRow(1))
  expect(added.chart?.categories).toEqual(['FY24', '', 'FY25', 'FY26'])
  expect(added.chart?.series?.[1].values).toEqual([6, 0, 8, 9])
  const removed = apply(BARS, m.removeRows(2, 2))
  expect(removed.chart?.categories).toEqual(['FY24', 'FY25'])
  expect(removed.chart?.annotations).toEqual([])       // pointed at the removed category
  const two = apply(BARS, m.removeRows(2, 2))
  expect(sheet(two).removeRows(1, 1)).toBeNull()        // 2 categories is the minimum
  expect(m.removeCols?.(1, 1)).not.toBeNull()
  expect(apply(BARS, m.insertCol?.(3)).chart?.series?.[2]).toMatchObject({ name: '', values: [0, 0, 0], mark: 'line' })
  expect(apply(BARS, m.moveRow(0, 2)).chart?.series?.[0].values).toEqual([14, 20, 10])
})

test('waterfall: a total has no value; un-totalling gives it one', () => {
  const m = sheet(WATER)
  expect(m.cols.map((c) => c.type)).toEqual(['text', 'number', 'flag'])
  expect(m.readOnly?.(2, 1)).toBe(true)
  const total = apply(WATER, m.set(1, 2, 'true'))
  expect(total.chart?.items?.[1]).toEqual({ label: 'Cost', total: true })
  const back = apply(total, sheet(total).set(1, 2, 'false'))
  expect(back.chart?.items?.[1]).toMatchObject({ label: 'Cost', value: 0 })
  expect(apply(WATER, m.insertRow(1)).chart?.items?.map((i) => i.label)).toEqual(['Revenue', '', 'Cost', 'Margin'])
  expect(apply(WATER, m.moveRow(0, 1)).chart?.items?.map((i) => i.label)).toEqual(['Cost', 'Revenue', 'Margin'])
})

test('paste: text from a spreadsheet fills cells, grows rows up to the limit and says what it kept', () => {
  const r = pasteInto(BARS, 'consulting', { r: 1, c: 0 }, [['FY27', '30', '12'], ['FY28', '1,200', '(3)']])
  const chart = must(r.slide.chart)
  expect(chart.categories).toEqual(['FY24', 'FY27', 'FY28'])
  expect(chart.series?.[0].values.slice(1, 3)).toEqual([30, 1200])
  expect(chart.series?.[1].values.slice(1, 3)).toEqual([12, -3])
  const big = pasteInto(BARS, 'consulting', { r: 0, c: 0 }, Array.from({ length: 30 }, (_, i) => [`c${i}`, String(i), String(i)]))
  expect(big.slide.chart?.categories?.length).toBeLessThan(30)
  expect(big.note).toMatch(/of 30 rows/)
  const text = pasteInto(BARS, 'consulting', { r: 0, c: 1 }, [['abc']])
  expect(text.slide.chart?.series?.[0].values[0]).toBe(10)
  expect(text.note).toMatch(/not a number/)
})

import { replaceFromTable } from '@/engine/slides/sheet'

test('a pasted table becomes the chart: the header row names the series, the first column the categories', () => {
  const r = replaceFromTable(BARS, 'consulting', [['', 'North', 'South', 'West'], ['Q1', '10', '12', '1'], ['Q2', '11', '13', '2'], ['Q3', '1,200', '(3)', '3']])
  const c = must(r.slide.chart)
  expect(c.categories).toEqual(['Q1', 'Q2', 'Q3'])
  expect(c.series?.map((s) => s.name)).toEqual(['North', 'South', 'West'])
  expect(c.series?.[0].values).toEqual([10, 11, 1200])
  expect(c.series?.[1].values).toEqual([12, 13, -3])
  // The first two series keep their own look; a new one copies the last.
  expect(c.series?.[0]).toMatchObject({ mark: 'bar', color: 'focus' })
  expect(c.series?.[2]).toMatchObject({ mark: 'line' })
  expect(c.annotations).toEqual([{ type: 'cagr', from: 0, to: 2 }])   // still points at categories that exist
  expect(r.note).toBeUndefined()
})

test('without a header row the series are named for the columns; text cells become 0 and are reported', () => {
  const r = replaceFromTable(BARS, 'consulting', [['a', '1', 'x'], ['b', '2', '3']])
  expect(r.slide.chart?.series?.map((s) => s.name)).toEqual(['Series 1', 'Series 2'])
  expect(r.slide.chart?.series?.[1].values).toEqual([0, 3])
  expect(r.note).toMatch(/not a number/)
})

test('too many rows or columns keep what fits and say so', () => {
  const rows = [['', ...Array.from({ length: 12 }, (_, j) => `S${j}`)], ...Array.from({ length: 30 }, (_, i) => [`c${i}`, ...Array.from({ length: 12 }, () => '1')])]
  const r = replaceFromTable(BARS, 'consulting', rows)
  expect((r.slide.chart?.categories?.length ?? 99)).toBeLessThan(30)
  expect(r.note).toMatch(/of 30 rows/)
  expect(r.note).toMatch(/of 12 columns/)
})

test('a waterfall takes label, value and an optional total column', () => {
  const r = replaceFromTable(WATER, 'consulting', [['Revenue', '100', ''], ['Cost', '-30', ''], ['Margin', '', 'total']])
  expect(r.slide.chart?.items).toEqual([{ label: 'Revenue', value: 100 }, { label: 'Cost', value: -30 }, { label: 'Margin', total: true }])
})

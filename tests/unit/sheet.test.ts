import { test, expect } from 'vitest'
import { applyPatch } from '@/engine/agent/patch'
import { addColumn, moveColumn, removeColumn } from '@/engine/slides/edit'
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
  expect(parseNum('1,5')).toBe(1.5)
  expect(parseNum('1,500')).toBe(1500)
  expect(parseNum('12,345,678')).toBe(12345678)
  expect(parseNum('0x10')).toBeNull()
  expect(parseNum('Infinity')).toBeNull()
  expect(parseNum('1e3')).toBe(1000)
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

const TBL: Slide = { template: 'table', title: 'T', table: { columns: [{ label: 'Plan' }, { label: 'Price', bold: true }, { label: 'Seats' }], rows: [{ cells: ['Starter', '£9', '1'] }, { cells: ['Team', { value: '£29', note: 'per seat' }, '5'], style: 'total' }] } }

test('table: cells, headers, rows and columns through the same model', () => {
  const m = sheet(TBL)
  expect([m.kind, m.rows, m.cols.map((c) => c.header)]).toEqual(['table', 2, ['Plan', 'Price', 'Seats']])
  expect(m.get(1, 1)).toBe('£29')
  expect(m.path(1, 1)).toBe('table.rows[1].cells[1].value')        // an object cell is edited on its value, its note stays
  expect(m.path(0, 1)).toBe('table.rows[0].cells[1]')
  expect(apply(TBL, m.set(1, 1, '£31')).table?.rows[1].cells[1]).toEqual({ value: '£31', note: 'per seat' })
  expect(apply(TBL, m.setHeader(0, 'Tier')).table?.columns[0].label).toBe('Tier')
  expect(apply(TBL, m.insertRow(1)).table?.rows.map((r) => r.cells[0])).toEqual(['Starter', '', 'Team'])
  expect(apply(TBL, m.moveRow(0, 1)).table?.rows[0].style).toBe('total')
  expect(apply(TBL, m.moveCol?.(1, 2)).table?.columns.map((c) => [c.label, c.bold])).toEqual([['Plan', undefined], ['Seats', undefined], ['Price', true]])
  expect(apply(TBL, m.insertCol?.(0)).table?.columns).toHaveLength(4)
  expect(sheet(apply(TBL, m.removeCols?.(2, 2))).removeCols?.(1, 1)).toBeNull()     // 2 columns is the minimum
})

test('a pasted table replaces a table slide: the first row is the header', () => {
  const r = replaceFromTable(TBL, 'consulting', [['Tier', 'Cost'], ['Free', '£0'], ['Pro', '£12'], ['Max', '£40']])
  expect(r.slide.table?.columns.map((c) => c.label)).toEqual(['Tier', 'Cost'])
  expect(r.slide.table?.rows.map((x) => x.cells)).toEqual([['Free', '£0'], ['Pro', '£12'], ['Max', '£40']])
  const big = replaceFromTable(TBL, 'consulting', [['a', 'b'], ...Array.from({ length: 20 }, (_, i) => [`r${i}`, 'x'])])
  expect(big.slide.table?.rows.length).toBe(8)
  expect(big.note).toMatch(/of 20 rows/)
})

test('annotations follow their categories and series when rows and columns change', () => {
  const ann = (s: Slide) => s.chart?.annotations?.[0]
  const m = sheet(BARS)
  expect(ann(apply(BARS, m.insertRow(0)))).toMatchObject({ from: 1, to: 3 })
  expect(ann(apply(BARS, m.insertRow(1)))).toMatchObject({ from: 0, to: 3 })
  expect(ann(apply(BARS, m.moveRow(2, 0)))).toMatchObject({ from: 1, to: 0 })
  expect(ann(apply(BARS, m.moveRow(0, 2)))).toMatchObject({ from: 2, to: 1 })
  expect(apply(BARS, m.removeRows(2, 2)).chart?.annotations).toEqual([])
  expect(ann(apply(BARS, m.removeRows(0, 0)))).toBeUndefined()
  const three = apply(BARS, { 'chart.annotations': [{ type: 'cagr', from: 1, to: 2 }] })
  expect(ann(apply(three, sheet(three).removeRows(0, 0)))).toMatchObject({ from: 0, to: 1 })
  const withSeries = apply(BARS, { 'chart.annotations': [{ type: 'cagr', from: 0, to: 2, series: 1 }] })
  const w = sheet(withSeries)
  expect(ann(apply(withSeries, w.moveCol?.(2, 1)))).toMatchObject({ series: 0 })
  expect(ann(apply(withSeries, w.insertCol?.(1)))).toMatchObject({ series: 2 })
  expect(apply(withSeries, w.removeCols?.(2, 2)).chart?.annotations).toEqual([])
})

const RANKED: Slide = { template: 'chart', title: 'T', chart: { kind: 'ranked', format: '{v}%', ranking: [{ label: 'Limit', value: 46, focus: true }, { label: 'Fee', value: 38 }] } }
const MATRIX: Slide = { template: 'chart', title: 'T', chart: { kind: 'matrix', axes: { x: 'Rewards', y: 'Limit' }, points: [{ label: 'Acme', x: 82, y: 82, focus: true }, { label: 'Bank', x: 22, y: 30 }] } }

test('ranked bars edit as label and value; a new row starts at 0', () => {
  const m = sheet(RANKED)
  expect(m.kind).toBe('ranked')
  expect(m.cols.map((c) => c.header)).toEqual(['Item', 'Value'])
  expect(m.get(0, 1)).toBe(46)
  const edited = apply(RANKED, m.set(1, 1, '41%')), s = apply(edited, sheet(edited).insertRow(2))
  expect(s.chart?.ranking).toEqual([{ label: 'Limit', value: 46, focus: true }, { label: 'Fee', value: 41 }, { label: '', value: 0 }])
})

test('matrix points edit as label, across and up; a new point starts in the middle', () => {
  const m = sheet(MATRIX)
  expect(m.cols.map((c) => c.header)).toEqual(['Point', 'Across (0–100)', 'Up (0–100)'])
  expect(m.path(1, 2)).toBe('chart.points[1].y')
  expect(apply(MATRIX, m.insertRow(2)).chart?.points?.[2]).toEqual({ label: '', x: 50, y: 50 })
  expect(failed(m.set(0, 1, 'x'))).toBe(true)
})

test('table sheet: a group row shows its heading in the first cell, the rest read-only; edits keep bullets, notes and status', () => {
  const s: Slide = { template: 'table', title: 'T', table: { columns: [{ label: 'P' }, { label: 'Stage' }, { label: 'Why' }], rows: [
    { cells: ['Launch'], style: 'group' },
    { cells: ['Bank', { value: 'Live', status: true }, { value: 'Slow', bullets: ['a', 'b'] }] },
  ] } }
  const m = sheetFor(s, 'consulting')
  if (!m) throw new Error('no sheet')
  expect(m.get(0, 0)).toBe('Launch'); expect(m.get(0, 1)).toBe(''); expect(m.readOnly?.(0, 1)).toBe(true)
  expect(m.set(0, 1, 'x')).toEqual({ error: 'A group heading has one cell.' })
  const p = m.set(1, 2, 'Slower')
  if (!p || failed(p)) throw new Error('no patch')
  const out = applyPatch(s, p).slide?.table?.rows[1].cells[2]
  expect(out).toEqual({ value: 'Slower', bullets: ['a', 'b'] })
  const st = m.set(1, 1, 'Pilot')
  if (!st || failed(st)) throw new Error('no patch')
  expect(applyPatch(s, st).slide?.table?.rows[1].cells[1]).toEqual({ value: 'Pilot', status: true })
})

test('column operations leave a group row alone', () => {
  const s: Slide = { template: 'table', title: 'T', table: { columns: [{ label: 'P' }, { label: 'A' }, { label: 'B' }], rows: [
    { cells: ['Fees'], style: 'group' }, { cells: ['Bank', '1', '2'] } ] } }
  expect(addColumn(s, 1).table?.rows[0].cells).toEqual(['Fees'])
  expect(removeColumn(s, 0).table?.rows[0].cells).toEqual(['Fees'])
  expect(moveColumn(s, 0, 2).table?.rows[0].cells).toEqual(['Fees'])
  expect(addColumn(s, 1).table?.rows[1].cells).toEqual(['Bank', '', '1', '2'])
})

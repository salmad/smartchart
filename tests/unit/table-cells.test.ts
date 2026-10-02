import { test, expect } from 'vitest'
import { validate } from '@/engine/slides/schema'
import { columnAlign } from '@/engine/slides/align'
import type { Cell, Slide, Table } from '@/engine/types'

const T = (columns: Table['columns'], rows: Table['rows'], extra: Partial<Slide> = {}): Slide => ({ template: 'table', title: 'Acme leads on every criterion SMEs ask for', table: { columns, rows }, ...extra })
const cols = (n: number, extra: Partial<Table['columns'][number]> = {}) => [{ label: 'Provider' }, ...Array.from({ length: n - 1 }, (_, i) => ({ label: `C${i}`, ...extra }))]
const row = (...cells: Cell[]) => ({ cells })
const errs = (s: Slide, style: 'consulting' | 'pitch' = 'consulting') => validate(s, style).errors.join('\n')
const warns = (s: Slide, style: 'consulting' | 'pitch' = 'consulting') => validate(s, style).warnings.join('\n')

test('old cells unchanged: strings and { value, note } still validate', () => {
  expect(validate(T(cols(3), [row('Bank', '£25k', { value: '£120', note: 'per year' })])).errors).toEqual([])
})

test('a mark may carry a note', () => {
  expect(validate(T(cols(3), [row('Bank', { value: '✓', note: 'from Q2' }, '✗')])).errors).toEqual([])
})

test('bullets in a cell: 1–3 of at most 50 characters, not with a note, one column, at most 4 columns', () => {
  expect(validate(T(cols(3), [row('Bank', 'Branches', { value: 'Slow', bullets: ['Underwrites on filed accounts', 'Caps at £25k'] })])).errors).toEqual([])
  expect(errs(T(cols(3), [row('Bank', 'x', { bullets: ['a', 'b', 'c', 'd'] })]))).toMatch(/cells\[2\]\.bullets: 1–3 bullets/)
  expect(errs(T(cols(3), [row('Bank', 'x', { bullets: ['x'.repeat(51)] })]))).toMatch(/cells\[2\]\.bullets\[0\]: 51 characters, limit 50/)
  expect(errs(T(cols(3), [row('Bank', 'x', { value: 'a', note: 'n', bullets: ['b'] })]))).toMatch(/bullets or a note, not both/)
  expect(errs(T(cols(3), [row('Bank', { bullets: ['a'] }, { bullets: ['b'] })]))).toMatch(/bullets in 2 columns; at most one column/)
  expect(errs(T(cols(5), [row('Bank', 'a', 'b', 'c', { bullets: ['d'] })]))).toMatch(/5 columns; a table with bullets in cells takes at most 4/)
  expect(warns(T(cols(3), [row('Bank', 'x', { bullets: ['a'] })], { subtitle: 'A claim.' }), 'pitch')).toMatch(/pitch hides bullets in cells/)
})

test('a cell object takes only value, note, bullets, status', () => {
  expect(errs(T(cols(2), [row('Bank', { value: 'x', colour: 'red' } as unknown as Cell)]))).toMatch(/cells\[1\]\.colour: not a cell field\. Allowed: value, note, bullets, status/)
  expect(errs(T(cols(2), [row('Bank', { note: 'n' })]))).toMatch(/cells\[1\]\.value: required/)
})

test('status labels: a boolean flag; more than 4 distinct values in a column warns', () => {
  const st = (v: string): Cell => ({ value: v, status: true })
  expect(validate(T(cols(2), [row('A', st('Live')), row('B', st('Pilot'))])).errors).toEqual([])
  expect(warns(T(cols(2), ['Live', 'Pilot', 'Planned', 'Paused', 'Closed'].map((v, i) => row(`R${i}`, st(v)))))).toMatch(/columns\[1\]: 5 different status labels/)
})

test('header icons: every column after the first, or none; never the label column; not on numbers', () => {
  expect(validate(T(cols(3, { icon: 'zap' }), [row('Bank', '✓', '✗')])).errors).toEqual([])
  const some = T([{ label: 'Provider' }, { label: 'A', icon: 'zap' }, { label: 'B' }], [row('Bank', '✓', '✗')])
  expect(errs(some)).toMatch(/table\.columns: 1 of 2 columns have an icon/)
  expect(errs(T([{ label: 'P', icon: 'zap' }, { label: 'A' }], [row('Bank', '✓')]))).toMatch(/columns\[0\]\.icon: the label column has no icon/)
  expect(errs(T(cols(2, { icon: 'not-an-icon' }), [row('Bank', '✓')]))).toMatch(/icon: "not-an-icon" is not allowed/)
  expect(warns(T(cols(2, { icon: 'coins' }), [row('Bank', '£25k'), row('Neo', '£5k')]))).toMatch(/columns\[1\]\.icon: an icon on a column of numbers/)
})

test('group rows: one cell, exempt from the column count, warn below 6 rows or with a group of 1, not counted in the 8-row cap', () => {
  const g = (h: string) => ({ cells: [h], style: 'group' as const })
  const data = (n: number) => Array.from({ length: n }, (_, i) => row(`R${i}`, '1', '2'))
  expect(validate(T(cols(3), [g('Fees'), ...data(3), g('Limits'), ...data(3)])).errors).toEqual([])
  expect(validate(T(cols(3), [g('Fees'), ...data(3), g('Limits'), ...data(3)])).warnings).toEqual([])
  expect(errs(T(cols(3), [{ cells: ['Fees', 'x'], style: 'group' }, ...data(6)]))).toMatch(/rows\[0\]\.cells: a group row has one cell, its heading \(got 2\)/)
  expect(warns(T(cols(3), [g('Fees'), ...data(2), g('Limits'), ...data(2)]))).toMatch(/group headings with 4 rows; use them only with 6 or more/)
  expect(warns(T(cols(3), [g('Fees'), ...data(5), g('Limits'), ...data(1)]))).toMatch(/rows\[6\]: a group of 1 row; a group needs at least 2/)
  expect(errs(T(cols(3), [g('A'), ...data(4), g('B'), ...data(4)]))).not.toMatch(/at most 8/)
  expect(errs(T(cols(3), data(9)))).toMatch(/table\.rows: 9 rows; at most 8/)
})

test('budget: bullets rows, group rows and header icons cost lines', () => {
  // 7 rows with 3 one-line bullets each = 7 × (1.2 + 3 × 0.75) = 24.15 > 10.5
  const heavy = Array.from({ length: 7 }, (_, i) => row(`R${i}`, 'x', { value: 'y', bullets: ['a', 'b', 'c'] }))
  expect(errs(T(cols(3), heavy))).toMatch(/costs 24\.15 rows, budget 10\.5/)
  // A 50-character bullet wraps to 2 lines in a 4-column table: 4 such rows = 4 × 2.7 = 10.8 > 10.5
  const wide = Array.from({ length: 4 }, (_, i) => row(`R${i}`, 'x', 'y', { value: 'z', bullets: ['x'.repeat(50)] }))
  expect(errs(T(cols(4), wide))).toMatch(/costs 10\.8 rows/)
  // The same 45-character bullet stays on one line in a 3-column table: 4 × 1.95 = 7.8
  expect(errs(T(cols(3), Array.from({ length: 4 }, (_, i) => row(`R${i}`, 'x', { value: 'z', bullets: ['x'.repeat(45)] }))))).not.toMatch(/costs/)
  expect(errs(T(cols(3), heavy, { subtitle: 'A claim.' }), 'pitch')).not.toMatch(/costs/)
})

test('columnAlign: group rows are skipped; status and bullet cells make a text column', () => {
  const t: Table = { columns: cols(3), rows: [{ cells: ['Fees'], style: 'group' }, row('A', '£5', { value: 'Live', status: true }), row('B', '£7', { value: 'Pilot', status: true })] }
  expect(columnAlign(t)).toEqual(['text', 'num', 'text'])
})

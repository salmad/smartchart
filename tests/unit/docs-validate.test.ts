/* Doc validation: every figure through the slide schema (doc limits), plus the doc's own rules. */
import { test, expect } from 'vitest'
import { validateDoc } from '@/engine/docs/validate'
import { validate } from '@/engine/slides/schema'
import { STARTERS } from '@/engine/starters'
import type { Doc, FigureBody } from '@/engine/docs/types'
import type { Slide, Table } from '@/engine/types'

/** A starter slide as a figure body: its frame fields dropped. */
const bodyOf = (id: string): FigureBody => {
  const { template: _t, title: _ti, kicker: _k, subtitle: _s, ...body } = STARTERS.find((s) => s.id === id)?.consulting as Slide
  return body
}
const doc = (blocks: Doc['blocks'], title = 'T'): Doc => ({ title, blocks })
const rows = (n: number): Table['rows'] => Array.from({ length: n }, (_, i) => ({ cells: [`Country ${i + 1}`, 'Licensed'] }))

test('a valid doc has no errors', () => {
  const r = validateDoc(doc([
    { type: 'heading', level: 2, id: 'growth', text: 'Growth' },
    { type: 'figure', kind: 'chart', id: 'rev', body: bodyOf('chart-notes') },
    { type: 'figure', kind: 'callout', id: 'c', body: { tone: 'decision', text: 'We launch in **Ireland** first.' } },
  ]))
  expect(r.errors).toEqual([])
})

test('figure errors carry the figure id', () => {
  const columns = Array.from({ length: 6 }, (_, i) => ({ label: `C${i}` }))
  const r = validateDoc(doc([{ type: 'figure', kind: 'table', id: 'cmp', body: { table: { columns, rows: [{ cells: columns.map(() => 'x') }] } } }]))
  expect(r.errors.some((e) => e.startsWith('#cmp.table.columns'))).toBe(true)
})

test('a doc table takes 20 rows, a slide table 8', () => {
  const table = { columns: [{ label: 'Country' }, { label: 'Status' }], rows: rows(12) }
  const r = validateDoc(doc([{ type: 'figure', kind: 'table', id: 'reg', body: { caption: 'Regulation by country', table } }]))
  expect(r.errors).toEqual([])
  expect(validate({ template: 'table', kicker: 'K', title: 'Twelve markets regulate SME credit cards in four different ways', table }).errors.join(' ')).toMatch(/at most 8/)
  const over = validateDoc(doc([{ type: 'figure', kind: 'table', id: 'reg', body: { table: { ...table, rows: rows(21) } } }]))
  expect(over.errors.join(' ')).toMatch(/#reg\.table/)
})

test('caption is allowed on any figure', () => {
  const r = validateDoc(doc([{ type: 'figure', kind: 'cards', id: 'sw', body: { caption: 'Revolut, strengths and weaknesses', ...bodyOf('cards-framed') } }]))
  expect(r.errors.filter((e) => /not a field/.test(e))).toEqual([])
})

test('title, duplicate ids and dead links', () => {
  const r = validateDoc(doc([
    { type: 'heading', level: 2, id: 'a', text: 'A' },
    { type: 'heading', level: 2, id: 'a', text: 'A again' },
    { type: 'paragraph', text: 'See [the chart](#nowhere).' },
  ], ''))
  expect(r.errors).toContain('title: required. The doc\'s title, in the front matter.')
  expect(r.errors).toContain('#a: used by more than one heading or figure.')
  expect(r.warnings).toContain('link #nowhere: no heading or figure has this id.')
})

test('callouts are checked', () => {
  const r = validateDoc(doc([{ type: 'figure', kind: 'callout', id: 'c', body: { tone: 'urgent' as 'risk', text: 'x' } }]))
  expect(r.errors.some((e) => e.startsWith('#c.tone'))).toBe(true)
})

test('theme and accent are checked', () => {
  const r = validateDoc({ ...doc([]), theme: 'neon' as 'ink', accent: 'blue' })
  expect(r.errors.some((e) => e.startsWith('theme:'))).toBe(true)
  expect(r.errors.some((e) => e.startsWith('accent:'))).toBe(true)
})

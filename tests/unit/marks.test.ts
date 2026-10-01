import { test, expect } from 'vitest'
import { markKinds, markOf } from '@/engine/slides/marks'
import { slideHTML } from '@/engine/slides/render'
import { validate } from '@/engine/slides/schema'
import { actionsFor } from '@/engine/slides/actions'
import type { Slide, Table } from '@/engine/types'

const table = (cells: string[][]): Table => ({ columns: [{ label: 'Provider' }, ...cells[0].map((_, j) => ({ label: `C${j + 1}` }))], rows: cells.map((r, i) => ({ cells: [`Row ${i + 1}`, ...r] })) })
const slide = (t: Table, extra: Partial<Slide> = {}): Slide => ({ template: 'table', title: 'Only Acme scores well on all four things SMEs ask for', table: t, ...extra })

test('a cell holding only a Harvey ball, tick or cross is a mark; anything else is text', () => {
  expect(markOf('◑')).toEqual({ kind: 'ball', v: 2 })
  expect(markOf(' ● ')).toEqual({ kind: 'ball', v: 4 })
  expect(markOf('[[✓]]')).toEqual({ kind: 'tick' })
  expect(markOf('✗')).toEqual({ kind: 'cross' })
  expect(markOf('✓ yes')).toBeNull()
  expect(markOf('—')).toBeNull()
})

test('marks draw as one set; a table of balls gets the key under it', () => {
  const html = slideHTML(slide(table([['◔', '✓']])), { page: 1, section: 0, kicker: '', footer: '' }, { style: 'consulting', theme: 'ink' })
  expect(html).toContain('<td class="al-sym score" data-path="table.rows[0].cells[1]" data-kind="md"><svg class="mk-ball"')
  expect(html).toContain('<span class="mk-txt">◔</span>')
  expect(html).toContain('<span class="mk-tick">✓</span>')
  expect(html).toContain('<div class="mk-key">')
  expect(slideHTML(slide(table([['✓', '✗']])), { page: 1, section: 0, kicker: '', footer: '' }, { style: 'consulting', theme: 'ink' })).not.toContain('mk-key')
})

test('mixing Harvey balls and ticks in one table is a warning, not an error', () => {
  expect(markKinds(table([['◔', '✓']]))).toEqual(new Set(['balls', 'ticks']))
  const r = validate(slide(table([['◔', '✓'], ['●', '✗']])))
  expect(r.errors).toEqual([])
  expect(r.warnings.join()).toMatch(/mixes Harvey balls and ticks/)
  expect(validate(slide(table([['◔', '●'], ['○', '◕']]))).warnings).toEqual([])
})

test('the Harvey-ball key costs a row in consulting, none in pitch', () => {
  const rows = Array.from({ length: 8 }, () => ['◔', '●'])
  // 8 rows + takeaway 1.5 = 9.5; the key makes it 10.5, still in budget; a caption on top goes over.
  expect(validate(slide(table(rows), { takeaway: 'So what.' })).errors).toEqual([])
  expect(validate(slide(table(rows), { takeaway: 'So what.', caption: 'Cards scored' })).errors.join()).toMatch(/Harvey-ball key = 1/)
})

test('scores by hand: the selected body cells take a mark, and a checked mark clears them', () => {
  const s = slide(table([['a', 'b'], ['c', '◑']]))
  const acts = actionsFor({ kind: 'cells', r0: 0, c0: 1, r1: 1, c1: 2 }, s, 'consulting').filter((a) => a.group === 'mark')
  expect(acts.map((a) => a.id)).toEqual(['mark-ball-0', 'mark-ball-1', 'mark-ball-2', 'mark-ball-3', 'mark-ball-4', 'mark-tick', 'mark-cross'])
  expect(acts.find((a) => a.id === 'mark-tick')?.run().set).toEqual({ 'table.rows[0].cells[1]': '✓', 'table.rows[0].cells[2]': '✓', 'table.rows[1].cells[1]': '✓', 'table.rows[1].cells[2]': '✓' })
  const half = actionsFor({ kind: 'cells', r0: 1, c0: 2, r1: 1, c1: 2 }, s, 'consulting').find((a) => a.id === 'mark-ball-2')
  expect(half?.checked).toBe(true)
  expect(half?.run().set).toEqual({ 'table.rows[1].cells[2]': '' })
  // The label column and the header row take no marks.
  expect(actionsFor({ kind: 'cells', r0: 0, c0: 0, r1: 0, c1: 0 }, s, 'consulting').some((a) => a.group === 'mark')).toBe(false)
  expect(actionsFor({ kind: 'cells', r0: -1, c0: 1, r1: -1, c1: 1 }, s, 'consulting').some((a) => a.group === 'mark')).toBe(false)
})

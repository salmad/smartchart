import { test, expect } from 'vitest'
import { columnAlign, placeOf } from '@/engine/slides/align'
import { tableHTML } from '@/engine/components/table'
import { validate } from '@/engine/slides/schema'
import { STARTERS, starterSlide } from '@/engine/starters'
import type { Slide, Table } from '@/engine/types'

const must = <T>(v: T | undefined): T => { if (v === undefined) throw new Error('missing'); return v }
const table = (align?: string): Table => ({
  columns: [{ label: 'Plan' }, { label: 'Notes', ...(align ? { align } : {}) } as Table['columns'][number]],
  rows: [{ cells: ['Starter', 'Self-serve only'] }, { cells: ['Growth', 'Phone support'] }],
})
const withAlign = (align: string): Slide => {
  const s = starterSlide(must(STARTERS.find((x) => x.id === 'table')), 'consulting'), t = must(s.table)
  return { ...s, table: { ...t, columns: t.columns.map((c, j) => (j === 1 ? { ...c, align } : c)) } } as Slide
}

test('placeOf reads an explicit alignment and is null for auto or none', () => {
  expect(placeOf({ label: 'A', align: 'right' } as Table['columns'][number])).toBe('right')
  expect(placeOf({ label: 'A', align: 'auto' } as Table['columns'][number])).toBeNull()
  expect(placeOf({ label: 'A' })).toBeNull()
  expect(placeOf(undefined)).toBeNull()
})

test('an explicit align does not change the column kind', () => {
  expect(columnAlign(table('right'))[1]).toBe('text')
})

test('validate accepts left, centre, right and auto, and refuses anything else, naming align', () => {
  for (const a of ['left', 'centre', 'right', 'auto']) expect(validate(withAlign(a)).errors).toEqual([])
  expect(validate(withAlign('middle')).errors.some((e) => e.includes('align'))).toBe(true)
})

test('the render gives an aligned column its place class on cells and header, and no other column', () => {
  const html = tableHTML(table('centre'), 'table')
  expect((html.match(/pl-centre/g) ?? []).length).toBe(3)
  expect(tableHTML(table(), 'table')).not.toContain('pl-')
})

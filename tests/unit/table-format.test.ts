// @vitest-environment jsdom
import { test, expect } from 'vitest'
import { slideHTML } from '@/engine/slides/render'
import { validate } from '@/engine/slides/schema'
import type { Slide } from '@/engine/types'

const CTX = { page: 1, section: 0, kicker: '', footer: '' }
const base = (columns: object[], cells: string[]): Slide => ({ template: 'table', title: 'Table', table: { columns, rows: [{ cells }] } } as Slide)
const html = (s: Slide) => slideHTML(s, CTX, { style: 'consulting', theme: 'ink' })

test('a cell can carry bold and focus text', () => {
  const out = html(base([{ label: 'Plan' }, { label: 'Price' }], ['**Pro**', 'from [[£9]] a month']))
  expect(out).toContain('<strong>Pro</strong>')
  expect(out).toContain('<span class="hl-focus">£9</span>')
  expect(validate(base([{ label: 'Plan' }, { label: 'Price' }], ['**Pro**', 'from [[£9]]']), 'consulting').errors).toEqual([])
})

test('a column can be bold, italic and muted, each on its own', () => {
  const s = base([{ label: 'Plan', bold: true, italic: true }, { label: 'Price', muted: true }], ['a', 'b'])
  expect(validate(s, 'consulting').errors).toEqual([])
  const host = document.createElement('div')
  host.innerHTML = html(s)
  const [th0, th1] = [...host.querySelectorAll('th')], [td0, td1] = [...host.querySelectorAll('td')]
  for (const el of [th0, td0]) { expect(el.className).toMatch(/\bbold\b/); expect(el.className).toMatch(/\bitalic\b/) }
  for (const el of [th1, td1]) expect(el.className).toMatch(/\bmuted\b/)
})

test('a column is muted or focus, not both', () => {
  const errors = validate(base([{ label: 'A' }, { label: 'B', muted: true, focus: true }], ['a', 'b']), 'consulting').errors
  expect(errors.some((e) => /muted or focus/.test(e))).toBe(true)
})

test('a cell\'s length counts its words, not its marks', () => {
  const cell = `**${'x'.repeat(38)}**`
  expect(validate(base([{ label: 'A' }, { label: 'B' }], ['a', cell]), 'consulting').errors.filter((e) => /characters/.test(e))).toEqual([])
})

test('choosing focus for a column frees the other focus column; normal clears both', async () => {
  const { tonePatch } = await import('@/app/edit/ColumnFormat')
  const s = base([{ label: 'A' }, { label: 'B', focus: true }, { label: 'C', muted: true }], ['a', 'b', 'c'])
  expect(tonePatch(s, 2, 'focus')).toEqual({ 'table.columns[2].muted': null, 'table.columns[2].focus': true, 'table.columns[1].focus': null })
  expect(tonePatch(s, 1, 'normal')).toEqual({ 'table.columns[1].muted': null, 'table.columns[1].focus': null })
})

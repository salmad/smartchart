import { test, expect } from 'vitest'
import { slideHTML } from '@/engine/slides/render'
import type { Slide, Table } from '@/engine/types'

const CTX = { page: 1, section: 0, kicker: '', footer: '' }
const html = (table: Table, style: 'consulting' | 'pitch' = 'consulting') => slideHTML({ template: 'table', title: 'T', table } as Slide, CTX, { style, theme: 'ink' })

test('old cells unchanged: a plain mark keeps its path on the cell', () => {
  const h = html({ columns: [{ label: 'P' }, { label: 'A' }], rows: [{ cells: ['Bank', '✓'] }] })
  expect(h).toContain('score" data-path="table.rows[0].cells[1]" data-kind="md"><span class="mk-tick">')
})

test('a mark with a note draws the mark and the note under it', () => {
  const h = html({ columns: [{ label: 'P' }, { label: 'A' }], rows: [{ cells: ['Bank', { value: '✓', note: 'from Q2' }] }] })
  expect(h).toContain('score has-note"><span data-path="table.rows[0].cells[1].value" data-kind="md"><span class="mk-tick">')
  expect(h).toContain('<small data-path="table.rows[0].cells[1].note" data-kind="esc">from Q2</small>')
})

test('header icons sit above the label, which keeps its own path', () => {
  const h = html({ columns: [{ label: 'P' }, { label: 'Speed', icon: 'zap' }], rows: [{ cells: ['Bank', '✓'] }] })
  expect(h).toContain('has-ic"><i data-lucide="zap"></i><span data-path="table.columns[1].label" data-kind="esc">Speed</span></th>')
})

test('bullets, status labels and group rows', () => {
  const h = html({ columns: [{ label: 'P' }, { label: 'Stage' }, { label: 'Why' }], rows: [
    { cells: ['Launch'], style: 'group' },
    { cells: ['Bank', { value: 'Live', status: true }, { value: 'Slow', bullets: ['Filed accounts', 'Caps at £25k'] }] },
  ] })
  // A short heading sits in a first column beside its rows: an item of its own, on the first row of its group.
  expect(h).toContain('<table class="tbl by-group"><colgroup><col class="grp">')
  expect(h).toContain('<tr class="grp-end" data-item="table.rows[1]"><td class="grp" data-item="table.rows[0]"><span data-path="table.rows[0].cells[0]" data-kind="md">Launch</span></td>')
  expect(h).toContain('status"><span class="pill" data-path="table.rows[1].cells[1].value" data-kind="esc">Live</span></td>')
  expect(h).toContain('has-bul"><span data-path="table.rows[1].cells[2].value" data-kind="md">Slow</span><ul class="bullets"><li data-item="table.rows[1].cells[2].bullets[0]" data-path="table.rows[1].cells[2].bullets[0]" data-kind="md">Filed accounts</li>')
})

test('a group heading too long for the column is a heading row, one cell per column', () => {
  const h = html({ columns: [{ label: 'P' }, { label: 'Stage' }, { label: 'Why' }], rows: [
    { cells: ['Launched in the first quarter'], style: 'group' },
    { cells: ['Bank', 'Live', 'Slow'] },
  ] })
  expect(h).not.toContain('by-group')
  expect(h).toContain('<tr class="group" data-item="table.rows[0]"><td data-path="table.rows[0].cells[0]" data-kind="md">Launched in the first quarter</td><td></td><td></td></tr>')
})

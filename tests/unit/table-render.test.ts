import { test, expect } from 'vitest'
import { slideHTML } from '@/engine/slides/render'
import type { Slide, Table } from '@/engine/types'

const CTX = { page: 1, section: 0, kicker: '', footer: '' }
const html = (table: Table, style: 'consulting' | 'pitch' = 'consulting') => slideHTML({ template: 'table', title: 'T', table } as Slide, CTX, { style, theme: 'ink' })

test('old cells unchanged: a plain mark keeps its path on the cell', () => {
  const h = html({ columns: [{ label: 'P' }, { label: 'A' }], rows: [{ cells: ['Bank', '✓'] }] })
  expect(h).toContain('score" data-path="table.rows[0].cells[1]" data-kind="md"><span class="mk-tick">')
})

test('in a column of marks, a mark with a note draws the mark and the note under it', () => {
  const h = html({ columns: [{ label: 'P' }, { label: 'A' }], rows: [{ cells: ['Bank', { value: '✓', note: 'from Q2' }] }, { cells: ['Card', '✗'] }] })
  expect(h).toContain('score has-note"><span data-path="table.rows[0].cells[1].value" data-kind="md"><span class="mk-tick">')
  expect(h).toContain('<small data-path="table.rows[0].cells[1].note" data-kind="esc">from Q2</small>')
})

test('a verdict column (ticks, pros and cons: every cell a mark with its reason) leads each reason with its mark, left-aligned', () => {
  const h = html({ columns: [{ label: '' }, { label: 'Occam', focus: true }], rows: [{ cells: ['Layout', { value: '✓', note: 'Set once, by rules' }] }, { cells: ['Charts', { value: '✗', note: 'Pasted in' }] }] })
  expect(h).toContain('<td class="al-text verdict focus"><span class="vd" data-path="table.rows[0].cells[1].value" data-kind="md"><span class="mk-tick">')
  expect(h).toContain('<span data-path="table.rows[0].cells[1].note" data-kind="esc">Set once, by rules</span></td>')
  expect(h).toContain('<th class="al-text verdict focus"')
})

test('row icons sit beside each row name, in the first column', () => {
  const h = html({ columns: [{ label: '' }, { label: 'Occam', focus: true }], rows: [{ cells: [{ value: 'Layout', icon: 'layers' }, { value: '✓', note: 'Set once, by rules' }] }, { cells: [{ value: 'Charts', icon: 'chart-column' }, { value: '✗', note: 'Pasted in' }] }] })
  expect(h).toContain('<td class="al-text has-ric"><span class="ric"><i data-lucide="layers"></i><span data-path="table.rows[0].cells[0].value" data-kind="md">Layout</span></span></td>')
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

test('a target on a bars column states where its line goes and focuses the bars on the better side', () => {
  const h = html({ columns: [{ label: 'Group' }, { label: 'Months', bars: true, target: { value: 20, label: '20-month hurdle', better: 'below' } }],
    rows: [{ cells: ['A', '5'] }, { cells: ['B', '19'] }, { cells: ['C', '48'] }] })
  expect(h).toContain('class="tbl-target" style="--at:41.7"')
  expect(h).toContain('<span data-path="table.columns[1].target.label" data-kind="esc">20-month hurdle</span>')
  expect(h.match(/has-bar pass/g)?.length).toBe(2)
})

test('a target with better above focuses the bars at or over it', () => {
  const h = html({ columns: [{ label: 'Group' }, { label: 'Score', bars: true, target: { value: 50, label: 'Pass mark', better: 'above' } }],
    rows: [{ cells: ['A', '40'] }, { cells: ['B', '50'] }, { cells: ['C', '80'] }] })
  expect(h.match(/has-bar pass/g)?.length).toBe(2)
})

const GRID = { columns: [{ label: 'Limit' }, { label: '19.9%', heat: true, outline: true }, { label: '29.9%', heat: true }, { label: '39.9%', heat: true }],
  rows: [{ cells: ['£2.5k', { value: '£18', struck: true }, '£53', '£34'] }, { cells: ['£15k', { value: '−£121', struck: true }, '£366', '[[£632]]'] }] } as Table

test('heat columns share one scale; struck cells are muted with a cross and never shaded', () => {
  const h = html(GRID)
  expect(h).toMatch(/<td class="[^"]*\bheat h1\b[^"]*"[^>]*>£53/)
  expect(h).toMatch(/<td class="[^"]*\bheat h4\b[^"]*"[^>]*>£366/)
  expect(h).toContain('<span class="strike-x" aria-hidden="true">✗</span>')
  expect(h).not.toMatch(/struck[^"]*h\d/)
  expect(h.match(/\bstruck\b/g)?.length).toBe(2)
})

test('heat skips non-figures and negatives', () => {
  const h = html({ columns: [{ label: 'L' }, { label: 'A', heat: true }], rows: [{ cells: ['a', '—'] }, { cells: ['b', '−£61'] }, { cells: ['c', '£40'] }] })
  expect(h).not.toContain('NaN')
  expect(h.match(/heat h\d/g)).toEqual(['heat h5'])
})

test('a [[focus]] heat cell is drawn solid as the best cell', () => {
  expect(html(GRID)).toMatch(/<td class="[^"]*\bheat best\b[^"]*"/)
})

test('the outlined column and the key render only when written', () => {
  const h = html({ ...GRID, key: { focus: 'Our offer', struck: 'Fails a test', outline: 'Most lenders' } })
  expect(h).toContain('<col class="outline">')
  expect(h).toMatch(/<td class="[^"]*\boutline\b[^"]*outline-end/)
  expect(h).toContain('<p class="heat-key"><span class="k-focus" data-path="table.key.focus" data-kind="esc">Our offer</span><span class="k-struck" data-path="table.key.struck" data-kind="esc">Fails a test</span><span class="k-outline" data-path="table.key.outline" data-kind="esc">Most lenders</span></p>')
  expect(html(GRID)).not.toContain('heat-key')
})

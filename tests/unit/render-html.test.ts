import { test, expect } from 'vitest'
import { slideHTML } from '@/engine/slides/render'
import type { Slide } from '@/engine/types'

test('a table column without a label renders an empty header, not "undefined"', () => {
  const s: Slide = { template: 'table', title: 'Plans', table: { columns: [{}, { label: 'Starter' }], rows: [{ cells: ['Price', '£29'] }] } }
  const html = slideHTML(s, { page: 1, section: 0, kicker: '', footer: '' }, { style: 'consulting', theme: 'ink' })
  expect(html).not.toContain('undefined')
})

const CTX = { page: 1, section: 0, kicker: '', footer: '' }
const CHART_NOTES: Slide = { template: 'chart', title: 'Margin', chart: { kind: 'waterfall', items: [{ label: 'Revenue', value: 42 }, { label: 'Cost', value: -9 }, { label: 'Margin', total: true }] },
  notes: [{ title: 'A' }, { title: 'B' }, { title: 'C' }] }

test('a caption sits over the chart; the unit after " · " is set quieter', () => {
  const html = slideHTML({ ...CHART_NOTES, notes: undefined, caption: 'Revenue to gross margin, year 4 · £m' }, CTX, { style: 'consulting', theme: 'ink' })
  expect(html).toContain('<p class="cap " data-path="caption" data-kind="cap">Revenue to gross margin, year 4<span> · £m</span></p><div class="chart full grow"')
})

test('with a notes heading, caption and heading share one header row (a missing caption stays blank); a caption alone leaves the notes full height', () => {
  const both = slideHTML({ ...CHART_NOTES, caption: 'Margin walk', notesTitle: 'Notes' }, CTX, { style: 'pitch', theme: 'ink' })
  expect(both).toContain('class="split grow has-head"><p class="cap " data-path="caption" data-kind="cap">Margin walk</p><p class="cap notes-h" data-path="notesTitle" data-kind="cap">Notes</p><div class="main">')
  const headOnly = slideHTML({ ...CHART_NOTES, notesTitle: 'Notes' }, CTX, { style: 'pitch', theme: 'ink' })
  expect(headOnly).toContain('<p class="cap blank "></p><p class="cap notes-h" data-path="notesTitle" data-kind="cap">Notes</p>')
  const capOnly = slideHTML({ ...CHART_NOTES, caption: 'Margin walk' }, CTX, { style: 'pitch', theme: 'ink' })
  expect(capOnly).toContain('class="split grow has-head cap-only"><p class="cap " data-path="caption" data-kind="cap">Margin walk</p><div class="main">')
  expect(slideHTML(CHART_NOTES, CTX, { style: 'pitch', theme: 'ink' })).not.toContain('class="cap')
})

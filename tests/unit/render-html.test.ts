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

test('a summary numbers its points and marks each field for hand editing', () => {
  const s: Slide = { template: 'summary', title: 'The answer', points: [{ title: 'A **claim**', text: 'Evidence.' }, { title: 'Another', text: 'More.' }] }
  const html = slideHTML(s, CTX, { style: 'consulting', theme: 'ink' })
  expect(html).toContain('<div class="sum grow"><div class="row" data-item="points[0]"><span class="n">01</span>')
  expect(html).toContain('<span class="lead" data-path="points[0].title" data-kind="md">A <strong>claim</strong></span>')
  expect(html).toContain('<span class="n">02</span>')
})

test('a highlighted row carries the focus class next to its style', () => {
  const s: Slide = { template: 'table', title: 'T', table: { columns: [{ label: 'A' }, { label: 'B' }], rows: [{ cells: ['a', 'b'], style: 'total', focus: true }, { cells: ['c', 'd'] }] } }
  const html = slideHTML(s, CTX, { style: 'consulting', theme: 'ink' })
  expect(html).toContain('<tr class="total focus" data-item="table.rows[0]">')
  expect(html).toContain('<tr class="" data-item="table.rows[1]">')
})

test('[words](https://…) in a source or footnote is the words with an arrow, linking out; nothing else becomes a link', () => {
  const s: Slide = { template: 'text', title: 'Cards', source: 'ONS, [FCA report](https://www.fca.org.uk/a?x=1&y=2)', footnote: 'See [notes](https://acme.com/notes). Bare https://acme.com stays text.' } as Slide
  const html = slideHTML(s, CTX, { style: 'consulting', theme: 'ink' })
  expect(html).toContain('<a href="https://www.fca.org.uk/a?x=1&amp;y=2" target="_blank" rel="noopener noreferrer">FCA report<svg class="ext"')
  expect(html).toContain('<a href="https://acme.com/notes" target="_blank" rel="noopener noreferrer">notes<svg')
  expect(html).toContain('Bare https://acme.com stays text.')
  expect(html.match(/<a href/g)).toHaveLength(2)
  expect(slideHTML({ ...s, footnote: '', source: '[x](javascript:alert(1)) and <b>x</b>' }, CTX, { style: 'consulting', theme: 'ink' })).not.toContain('<a href')
})

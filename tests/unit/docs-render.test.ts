/* The doc page as HTML: head, contents, sections that fold, figures on a canvas with their furniture. */
import { test, expect } from 'vitest'
import { docHTML } from '@/engine/docs/render'
import { figureHTML } from '@/engine/docs/figure'
import type { Doc, FigureBlock } from '@/engine/docs/types'

const chart: FigureBlock = { type: 'figure', kind: 'chart', id: 'rev', body: {
  caption: 'Revenue · £m', source: 'Company filings', takeaway: 'Revolut grew **3.1×**.',
  chart: { kind: 'bars', categories: ['2024', '2025'], series: [{ name: 'Revolut', values: [1800, 2500], mark: 'bar' }] },
  notes: [{ title: 'Fastest', text: 'Why it grew' }, { title: 'Second', text: 'More' }, { title: 'Third', text: 'And more' }],
} }
const doc: Doc = { title: 'Research', subtitle: 'Five issuers', blocks: [
  { type: 'paragraph', text: 'Intro' },
  { type: 'heading', level: 2, id: 'a', text: 'A' },
  { type: 'paragraph', text: 'Inside A' },
  { type: 'heading', level: 3, id: 'a-1', text: 'A one' },
  chart,
  { type: 'heading', level: 2, id: 'b', text: 'B' },
  { type: 'figure', kind: 'table', id: 't', body: { table: { columns: [{ label: 'Plan' }, { label: 'Price' }], rows: [{ cells: ['Starter', '£9'] }] } } },
] }

test('sections wrap their blocks', () => {
  const html = docHTML(doc)
  const inA = html.indexOf('Inside A'), aBody = html.indexOf('id="a-body"'), b = html.indexOf('id="b"')
  expect(aBody).toBeGreaterThan(-1)
  expect(inA).toBeGreaterThan(aBody)
  expect(inA).toBeLessThan(b)
  expect(html.indexOf('Intro')).toBeLessThan(html.indexOf('class="doc-sec"'))
})

test('the TOC lists headings in order', () => {
  const nav = docHTML(doc).match(/<nav class="doc-toc"[\s\S]*?<\/nav>/)?.[0] ?? ''
  expect(nav.indexOf('href="#a"')).toBeLessThan(nav.indexOf('href="#b"'))
  expect(nav).toContain('<li class="l3"><a href="#a-1">A one</a></li>')
})

test('a figure is a canvas with its furniture', () => {
  const html = figureHTML(chart, 'paper')
  for (const s of ['class="fig style-consulting theme-paper k-chart"', 'data-chart', 'class="split grow', 'class="notes"', 'class="fig-notes"', 'class="fig-take"', 'Source:'])
    expect(html).toContain(s)
  expect(figureHTML(chart, 'paper', false)).not.toContain('class="split')
})

test('figure paths are the slide paths', () => {
  expect(docHTML(doc)).toContain('data-path="table.rows[0].cells[0]"')
})

test('a doc theme reaches the canvas', () => {
  const html = docHTML({ ...doc, theme: 'ink' })
  expect(html).toContain('class="doc theme-ink"')
  expect(html).not.toContain('theme-paper')
})

test('a figure with failed code checks has a badge that lists them; a clean one has none', () => {
  const clean: FigureBlock = { type: 'figure', kind: 'chart', id: 'ok', body: { caption: 'Revenue · £m', source: 'Filings', chart: { categories: ['2024', '2025'], format: '£{v}m', series: [{ name: 'R', mark: 'bar', color: 'focus', values: [18, 25] }] } } }
  const noSource: FigureBlock = { ...clean, id: 'no', body: { ...clean.body, source: undefined } }
  const html = docHTML({ title: 'T', blocks: [{ type: 'heading', level: 2, id: 'a', text: 'A' }, clean, noSource, { type: 'figure', kind: 'callout', id: 'c', body: { tone: 'note', text: 'x' } }] })
  expect(html.match(/class="fig-checks"/g)).toHaveLength(1)
  expect(html).toMatch(/<details class="fig-checks"><summary>1 check<\/summary><ul><li><b>R8<\/b> Figures with no source/)
  expect(html.indexOf('fig-checks')).toBeGreaterThan(html.indexOf('id="no"'))
})

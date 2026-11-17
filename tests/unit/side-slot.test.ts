/* The side column of a ⅔·⅓ slide: notes or a flow, on the right or (a flow) on the left. */
import { test, expect } from 'vitest'
import { slideHTML } from '@/engine/slides/render'
import { MENU, validate } from '@/engine/slides/schema'
import type { Slide, Style } from '@/engine/types'

const CTX = { page: 1, section: 0, kicker: '', footer: '' }
const html = (s: object, style: Style = 'consulting') => slideHTML(s as Slide, CTX, { style, theme: 'ink' })
const errs = (s: object, style: Style = 'consulting') => validate(s, style).errors
const warns = (s: object, style: Style = 'consulting') => validate(s, style).warnings

import { S3, S4 } from '../fixtures/finbridge'

test('a table with a flow renders split, the flow in the side column and no notes', () => {
  const h = html(S3)
  expect(h).toContain('class="slide t-table v-split ')
  expect(h).toMatch(/<div class="split with-table [^"]*">.*<div class="main">.*<\/div><div class="flow">/s)
  expect(h).not.toContain('class="notes"')
  expect(h).toContain('data-path="flow.tiers[1].boxes[0].text"')
})

test('flowSide left renders split-flip, the split marked flip', () => {
  const h = html(S4)
  expect(h).toContain('class="slide t-table v-split-flip ')
  expect(h).toMatch(/<div class="split with-table flip [^"]*">/)
})

test('a chart takes no flow yet (its card is at its token budget), though the renderer would draw one', () => {
  const s = { template: 'chart', title: 'Spend grows four times by year 4', notesTitle: 'How spend is built', flow: { tiers: [{ boxes: [{ text: 'Cards' }] }, { boxes: [{ text: 'Spend' }] }] },
    chart: { categories: ['Y1', 'Y2', 'Y3', 'Y4'], format: '£{v}m', series: [{ name: 'Spend', mark: 'bar', color: 'focus', values: [1, 2, 3, 4] }] } }
  expect(errs(s).some((e) => e.startsWith('flow:'))).toBe(true)
  expect(MENU.chart.variant(s as Slide)).toBe('split')
  expect(html(s)).toContain('<div class="flow">')
})

test('the FinBridge slides 3 and 4 validate in consulting', () => {
  expect(errs(S3)).toEqual([])
  expect(errs(S4)).toEqual([])
  expect(warns(S3)).toEqual([])
})

test('flow and notes together is an error; flowSide needs a flow; a flow in consulting wants its heading', () => {
  expect(errs({ ...S3, notes: [{ title: 'a' }, { title: 'b' }, { title: 'c' }] }).some((e) => /notes or a flow/.test(e))).toBe(true)
  const { flow: _f, ...noFlow } = S3
  expect(errs({ ...noFlow, flowSide: 'left' }).some((e) => e.startsWith('flowSide'))).toBe(true)
  const { notesTitle: _n, ...noHead } = S3
  expect(warns(noHead).some((w) => w.startsWith('notesTitle'))).toBe(true)
})

test('a table takes a 6th column only when every cell after the first is a short figure, beside a side column or not', () => {
  const { flow: _f, flowSide: _s, notesTitle: _n, ...full } = S4
  expect(errs(full)).toEqual([])
  const wordy = { ...full, table: { ...full.table, rows: full.table.rows.map((r, i) => (i === 0 ? { cells: [r.cells[0], 'far too long', ...r.cells.slice(2)] } : r)) } }
  expect(errs(wordy).some((e) => e.startsWith('table.columns: 6 columns') && /8 characters/.test(e))).toBe(true)
})

test('beside a flow or notes a table takes 6 columns when every cell after the first is at most 8 characters, else 4', () => {
  expect(errs(S4).some((e) => /columns/.test(e))).toBe(false)
  const wide = { ...S4, table: { ...S4.table, rows: S4.table.rows.map((r, i) => (i === 0 ? { cells: [r.cells[0], 'far too long', ...r.cells.slice(2)] } : r)) } }
  expect(errs(wide).some((e) => e.startsWith('table.columns: 6 columns') && /8 characters/.test(e))).toBe(true)
})

test('the flow budget applies on the slide, with its path', () => {
  expect(errs(S3, 'pitch').some((e) => e.startsWith('flow: this flow costs 5.45'))).toBe(true)
})

/* The divider between the columns: a line on every split and pair slide (CSS), and an arrow where the left produces
   the right: a flow on the left, or a pair with link "arrow". */
const ARROW = '<span class="divider-arrow" aria-hidden="true">'
test('a split with a flow on the left draws the arrow in the exhibit column; a flow on the right or notes do not', () => {
  expect(html(S4).match(new RegExp(ARROW, 'g'))?.length).toBe(1)
  expect(html(S4)).toMatch(/<div class="main"><span class="divider-arrow"/)
  expect(html(S3)).not.toContain(ARROW)
})

test('a pair with link arrow draws one, in its first half; without it none', async () => {
  const bars = { categories: ['2024', '2025'], format: '£{v}m', series: [{ name: 'A', mark: 'bar', color: 'neutral', values: [1, 2] }] }
  const p = { template: 'pair', title: 'Spend in, share out: the market grows while Acme takes its share', halves: [{ caption: 'Market · £bn', chart: bars }, { caption: 'Share · %', chart: { ...bars, series: [{ ...bars.series[0], color: 'focus' }] } }] }
  expect(errs({ ...p, link: 'arrow' })).toEqual([])
  expect(html({ ...p, link: 'arrow' })).toMatch(/<div class="half"[^>]*data-grid="0">.*?<span class="divider-arrow"/s)
  expect(html(p)).not.toContain(ARROW)
  expect(errs({ ...p, link: 'line' }).some((e) => e.startsWith('link'))).toBe(true)
})

import { test, expect } from 'vitest'
import { validate, describe as card } from '@/engine/slides/schema'
import { slideHTML } from '@/engine/slides/render'
import { applyPatch } from '@/engine/agent/patch'
import { failed, pasteInto, replaceFromTable, sheetFor } from '@/engine/slides/sheet'
import type { Cell, Chart, Slide } from '@/engine/types'

const bars = (n: number, extra: Partial<Chart> = {}): Chart => ({ categories: Array.from({ length: n }, (_, i) => `Y${i + 1}`), format: '£{v}m', series: [{ name: 'Market', mark: 'bar', color: 'neutral', values: Array.from({ length: n }, (_, i) => i + 1) }], ...extra })
const pair = (a: Chart, b: Chart, extra: Partial<Slide> = {}): Slide => ({ template: 'pair', title: 'The market grows a third by 2030 while Acme takes 7% of it',
  halves: [{ caption: 'Market · £bn', chart: a }, { caption: 'Share · %', chart: { ...b, series: (b.series ?? []).map((s) => ({ ...s, color: 'focus' as const })) } }], ...extra })
const errs = (s: Slide, style: 'consulting' | 'pitch' = 'consulting') => validate(s, style).errors.join('\n')

test('two chart halves: each needs a caption, and the half-width limits hold', () => {
  expect(validate(pair(bars(6), bars(5))).errors).toEqual([])
  expect(errs({ ...pair(bars(3), bars(3)), halves: [{ chart: bars(3) }, { caption: 'B', chart: bars(3) }] } as Slide)).toMatch(/halves\[0\]\.caption: required with a chart or table/)
  expect(errs(pair(bars(7), bars(3)))).toMatch(/halves\[0\]\.chart\.categories: 7 categories; half a slide takes 6/)
  const three = bars(3, { series: ['a', 'b', 'c'].map((name) => ({ name, mark: 'bar' as const, values: [1, 2, 3] })) })
  expect(errs(pair(three, bars(3)))).toMatch(/3 series; half a slide takes 2/)
  const tl = errs(pair({ kind: 'timeline', periods: ['Q1', 'Q2', 'Q3'], rows: [{ label: 'a', start: 0, end: 1 }, { label: 'b', start: 1, end: 2 }] }, bars(3)))
  expect(tl).toMatch(/halves\[0\]\.chart\.kind: "timeline" is not allowed. Use one of: bars, waterfall, ranked/)
  const half = card('pair').fields.halves.of?.fields?.chart.fields ?? {}
  expect(Object.keys(half).sort()).toEqual(['categories', 'format', 'items', 'kind', 'ranking', 'series', 'stacking'])
  const wf = (n: number): Chart => ({ kind: 'waterfall', format: '£{v}m', items: [{ label: 'Start', value: 10 }, ...Array.from({ length: n - 2 }, () => ({ label: 'Step', value: 1 })), { label: 'End', total: true }] })
  expect(errs({ ...pair(wf(6), bars(3)), subtitle: 'A claim.' }, 'pitch')).toMatch(/6 items; half a slide takes 5/)
})

test('chart halves: bullets are one line, at most 1 each with a takeaway; only under a chart', () => {
  const s = pair(bars(3), bars(3), { takeaway: 'So what.' })
  s.halves?.forEach((h) => { h.bullets = ['One', 'Two'] })
  expect(errs(s)).toMatch(/halves\[0\]\.bullets: with a takeaway at most 1 per chart/)
  expect(card('pair').fields.halves.of?.fields?.bullets.of?.maxChars).toBe(55)
  expect(errs({ ...pair(bars(3), bars(3)), halves: [{ caption: 'A', chart: bars(3) }, { points: ['One point here', 'Another one'], bullets: ['x'] }] } as Slide)).toMatch(/halves\[1\]\.bullets: only under a chart/)
})

test('a half has exactly one body: chart, table, number or points', () => {
  const tbl = { columns: [{ label: 'Year' }, { label: 'Share' }], rows: [{ cells: ['2026', '0.5%'] }, { cells: ['2030', '7%'], focus: true }] }
  const ok: Slide = { template: 'pair', title: 'T', halves: [{ caption: 'Market · £bn', chart: bars(3) }, { caption: 'Share · %', table: tbl }] }
  expect(validate(ok).errors).toEqual([])
  expect(validate({ template: 'pair', title: 'T', halves: [{ number: { value: '7%', caption: 'Acme’s share of spend by 2030.' } }, { points: ['**Cards** replace transfers', 'Spend grows 13% a year'] }] }).errors).toEqual([])
  expect(errs({ template: 'pair', title: 'T', halves: [{ caption: 'A', chart: bars(3), table: tbl }, { points: ['a b', 'c d'] }] })).toMatch(/halves\[0\]: has chart and table; give exactly one of chart, table, number, points/)
  expect(errs({ template: 'pair', title: 'T', halves: [{ caption: 'A' }, { points: ['a b', 'c d'] }] })).toMatch(/halves\[0\]: has no body; give exactly one of chart, table, number, points/)
})

test('a half table: at most 3 columns and 5 rows, no bullets, no group rows, no icons', () => {
  const t = (cols: number, rows: number, cell: Cell = '1') => ({ columns: Array.from({ length: cols }, (_, i) => ({ label: `C${i}` })), rows: Array.from({ length: rows }, () => ({ cells: Array.from({ length: cols }, () => cell) })) })
  const s = (table: unknown) => ({ template: 'pair', title: 'T', halves: [{ caption: 'A', chart: bars(3) }, { caption: 'B', table }] }) as Slide
  expect(errs(s(t(4, 2)))).toMatch(/halves\[1\]\.table\.columns: at most 3 items/)
  expect(errs(s(t(2, 6)))).toMatch(/halves\[1\]\.table\.rows: at most 5 items/)
  expect(errs(s(t(2, 2, { value: 'x', bullets: ['y'] })))).toMatch(/halves\[1\]\.table: bullets in cells do not fit half a slide/)
  expect(errs(s({ ...t(2, 2), columns: [{ label: 'A' }, { label: 'B', icon: 'zap' }] }))).toMatch(/halves\[1\]\.table\.columns\[1\]\.icon: not a field here/)
})

test('an old `charts` field names `halves`', () => {
  expect(errs({ template: 'pair', title: 'T', charts: [] } as unknown as Slide)).toMatch(/charts: `charts` is now `halves`/)
})

test('two halves render as two numbered hosts, each with its caption and bullets', () => {
  const s = pair(bars(3), bars(3))
  s.halves?.forEach((c, i) => { c.bullets = [`Point ${i}`] })
  const html = slideHTML(s, { page: 1, section: 0, kicker: '', footer: '' }, { style: 'consulting', theme: 'ink' })
  expect(html).toContain('<div class="chart" data-chart="0"></div>')
  expect(html).toContain('<div class="chart" data-chart="1"></div>')
  expect(html).toContain('data-path="halves[1].caption"')
  expect(html).toContain('data-path="halves[1].bullets[0]"')
})

test('the data grid edits the chart that was picked, writing under halves[i]', () => {
  const s = pair(bars(3), bars(3)), m = sheetFor(s, 'consulting', 1)
  expect(m?.path(0, 1)).toBe('halves[1].chart.series[0].values[0]')
  const p = m?.set(0, 1, '9')
  if (!p || failed(p)) throw new Error('no patch')
  expect(p).toEqual({ 'halves[1].chart.series[0].values[0]': 9 })
  expect(applyPatch(s, p).slide?.halves?.[1].chart?.series?.[0].values[0]).toBe(9)
  expect(applyPatch(s, p).slide?.halves?.[0].chart?.series?.[0].values[0]).toBe(1)
  // Pasting rows past the end adds categories to that chart only.
  const pasted = pasteInto(s, 'consulting', { r: 2, c: 0 }, [['Y3', '7'], ['Y4', '8']], 1).slide
  expect(pasted.halves?.[1].chart?.categories).toEqual(['Y1', 'Y2', 'Y3', 'Y4'])
  expect(pasted.halves?.[0].chart?.categories).toEqual(['Y1', 'Y2', 'Y3'])
  const replaced = replaceFromTable(s, 'consulting', [['', 'Share'], ['2026', '1'], ['2027', '3']], 0).slide
  expect(replaced.halves?.[0].chart?.categories).toEqual(['2026', '2027'])
  expect(replaced.halves?.[1].chart?.categories).toEqual(['Y1', 'Y2', 'Y3'])
})

test('halves render by body: chart host, table, number, points; the caption row stays for alignment', () => {
  const s: Slide = { template: 'pair', title: 'T', halves: [
    { number: { value: '7%', caption: 'Acme’s share by 2030.' } },
    { caption: 'Share · %', table: { columns: [{ label: 'Year' }, { label: 'Share' }], rows: [{ cells: ['2026', '◑'] }] } },
  ] }
  const html = slideHTML(s, { page: 1, section: 0, kicker: '', footer: '' }, { style: 'consulting', theme: 'ink' })
  expect(html).toContain('<div class="half" data-item="halves[0]" data-grid="0"><p class="cap blank "></p><div class="half-num"><div class="big-v" data-path="halves[0].number.value" data-kind="esc">7%</div>')
  expect(html).toContain('data-path="halves[1].table.rows[0].cells[0]"')
  // The Harvey-ball key appears once, under the pair, not inside the half.
  expect(html.match(/class="mk-key"/g)).toHaveLength(1)
  expect(html.indexOf('class="mk-key"')).toBeGreaterThan(html.lastIndexOf('class="half'))
  const pts = slideHTML({ template: 'pair', title: 'T', halves: [{ caption: 'A', points: ['One', 'Two'] }, { caption: 'B', points: ['Three', 'Four'] }] }, { page: 1, section: 0, kicker: '', footer: '' }, { style: 'consulting', theme: 'ink' })
  expect(pts).toContain('<ul class="bullets points"><li data-item="halves[0].points[0]" data-path="halves[0].points[0]" data-kind="md">One</li>')
})

test('an old `charts` slide renders empty halves, never throws', () => {
  expect(() => slideHTML({ template: 'pair', title: 'T', charts: [{ caption: 'A', chart: bars(3) }] } as unknown as Slide, { page: 1, section: 0, kicker: '', footer: '' }, { style: 'consulting', theme: 'ink' })).not.toThrow()
})

test('the sheet edits a half table under halves[i].table; number and points halves have no sheet', () => {
  const s: Slide = { template: 'pair', title: 'T', halves: [{ caption: 'A', chart: bars(3) }, { caption: 'B', table: { columns: [{ label: 'Year' }, { label: 'Share' }], rows: [{ cells: ['2026', '1%'] }] } }] }
  const m = sheetFor(s, 'consulting', 1)
  expect(m?.path(0, 1)).toBe('halves[1].table.rows[0].cells[1]')
  expect(m?.set(0, 1, '2%')).toEqual({ 'halves[1].table.rows[0].cells[1]': '2%' })
  expect(sheetFor({ ...s, halves: [{ points: ['a b', 'c d'] }, s.halves?.[1] ?? {}] }, 'consulting', 0)).toBeNull()
  const replaced = replaceFromTable(s, 'consulting', [['Year', 'Share'], ['2030', '7%']], 1).slide
  expect(replaced.halves?.[1].table?.rows[0].cells).toEqual(['2030', '7%'])
})

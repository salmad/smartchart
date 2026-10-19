import { test, expect } from 'vitest'
import { deckCheck } from '@/app/edit/check'
import { STARTERS } from '@/engine/starters'
import { validate } from '@/engine/slides/schema'
import type { Measurer } from '@/app/measure'
import type { Deck, Slide } from '@/engine/types'

const stub = (over: Partial<Measurer> = {}): Measurer => ({ measure: () => [], lines: 1, warnings: [], located: [], ...over })
const deckOf = (slide: Slide): Deck => ({ style: 'consulting', theme: 'paper', footer: 'Occam', slides: [slide] } as unknown as Deck)

function barsWithNotes(): Slide {
  const s = STARTERS.find((x) => x.id === 'chart-notes')?.consulting
  if (!s) throw new Error('no chart-notes starter')
  return s
}

test('a 9-category bars chart with notes carries the schema error at its path', () => {
  const s = barsWithNotes() as Slide & { chart: { categories: string[]; series: { values: number[] }[] } }
  const nine = { ...s, chart: { ...s.chart, categories: Array.from({ length: 9 }, (_, i) => `C${i + 1}`), series: s.chart.series.map((x) => ({ ...x, values: Array.from({ length: 9 }, (_, i) => i + 1) })) } }
  const issues = deckCheck(deckOf(nine), 0, 'consulting', () => stub())(nine)
  const hit = issues.find((i) => i.path === 'chart.categories')
  expect(hit?.msg).toMatch(/categories/)
})

test('limits, then fit, then rules: what edit mode showed before the move', () => {
  const s = barsWithNotes()
  const located = [{ msg: 'title: overflows', path: 'title' }]
  const issues = deckCheck(deckOf(s), 0, 'consulting', () => stub({ located }))(s)
  const limits = validate(s, 'consulting').errors.length
  expect(issues.slice(limits, limits + 1)).toEqual(located)
  expect(issues.slice(limits + 1).every((i) => /^[\w-]+: /.test(i.msg) && i.path === undefined)).toBe(true)
})

test('a measurer that throws becomes one could-not-render issue', () => {
  const s = barsWithNotes()
  const issues = deckCheck(deckOf(s), 0, 'consulting', () => stub({ measure: () => { throw new Error('boom') } }))(s)
  expect(issues.some((i) => i.msg === 'slide could not be rendered: boom')).toBe(true)
})

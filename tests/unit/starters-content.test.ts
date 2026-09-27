import { test, expect } from 'vitest'
import { STARTERS, FOOTER } from '@/engine/starters'
import { shares } from '@/engine/slides/charts/chart-math'

const DENY = /finbridge|amex|american express|barclaycard|barclays|lloyds|natwest|hsbc|santander|monzo|revolut|starling|\btide\b|shopify|stripe|\bvisa\b|mastercard|british business bank|uk finance|ondeck|kabbage|silvr|capital on tap|youlend/i
const strings = (v: unknown): string[] => typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : []
test('no real brands in any starter string', () => {
  const hits = [...strings(STARTERS), FOOTER].filter((s) => DENY.test(s))
  expect(hits).toEqual([])
})
// The mix chart holds money; with stacked "100" the engine draws the shares, which must add to 100.
test('100% stacked shares sum to 100 in every category', () => {
  const mix = STARTERS.find((s) => s.id === 'chart-mix')?.consulting.chart
  if (!mix) throw new Error('chart-mix missing')
  expect(mix.stacked).toBe('100')
  const rows = shares(mix), n = mix.categories?.length ?? 0
  for (let i = 0; i < n; i++) expect(rows.reduce((t, r) => t + r[i], 0)).toBeCloseTo(100, 9)
})
test('red and green are rare: none in titles or subtitles, no red or green big numbers', () => {
  for (const s of STARTERS) for (const st of [s.consulting, s.pitch]) {
    expect(`${st.title} ${st.subtitle ?? ''}`, s.id).not.toMatch(/\[-|\[\+/)
    expect(['neg', 'pos'], s.id).not.toContain(st.number?.tone)
  }
})

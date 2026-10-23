import { test, expect } from 'vitest'
import { applyPatch } from '@/engine/agent/patch'
import { settingsFor, type Setting } from '@/engine/slides/settings'
import type { Target } from '@/engine/slides/actions'
import { validate } from '@/engine/slides/schema'
import { STARTERS, starterSlide } from '@/engine/starters'
import type { Slide, Style } from '@/engine/types'

const must = <T>(v: T | undefined | null): T => { if (v === undefined || v === null) throw new Error('missing'); return v }
const starter = (id: string, style: Style = 'consulting') => starterSlide(must(STARTERS.find((s) => s.id === id)), style)
const settings = (t: Target, s: Slide, style: Style = 'consulting') => settingsFor(t, s, style)
const byId = (xs: Setting[], id: string) => must(xs.find((x) => x.id === id))
const choice = (x: Setting) => { if (x.kind !== 'choice') throw new Error('not a choice'); return x }
const flag = (x: Setting) => { if (x.kind !== 'flag') throw new Error('not a flag'); return x }
const labels = (x: Setting) => choice(x).options.map((o) => o.label)

test('a line series: Emphasis (Highlight, Normal, Contrast), Dashed and the fill are settings', () => {
  const s = starter('chart-lines'), i = 1
  const got = settings({ kind: 'series', series: i }, s)
  expect(choice(byId(got, 'emphasis')).options.map((o) => o.value)).toEqual(['focus', 'neutral', 'contrast'])
  expect(labels(byId(got, 'emphasis'))).toEqual(['Highlight', 'Normal', 'Contrast'])
  expect(got.map((x) => x.label)).toEqual(expect.arrayContaining(['Dashed', 'Fill under the line']))
  expect(flag(byId(got, 'area')).on).toBe(true)
  expect(flag(byId(got, 'area')).set(false)).toEqual({ [`chart.series[${i}].area`]: false })
  expect(flag(byId(got, 'area')).set(true)).toEqual({ [`chart.series[${i}].area`]: null })
  expect(flag(byId(got, 'dashed')).set(true)).toEqual({ [`chart.series[${i}].dashed`]: true })
})

test('a bar: Highlight this bar writes chart.highlight, and a focus series gives way in the same patch', () => {
  const s = starter('chart-notes')
  const bare = { ...s, chart: { ...must(s.chart), series: must(s.chart?.series).map((x) => ({ ...x, color: 'neutral' as const })) } } as Slide
  const hl = flag(byId(settings({ kind: 'bar', series: 0, index: 1 }, bare), 'highlight'))
  expect(hl.on).toBe(false)
  expect(hl.set(true)).toEqual({ 'chart.highlight': { series: 0, index: 1 } })
  expect(hl.set(false)).toEqual({ 'chart.highlight': null })
  const on = must(applyPatch(bare, hl.set(true)).slide)
  expect(flag(byId(settings({ kind: 'bar', series: 0, index: 1 }, on), 'highlight')).on).toBe(true)
  // The starter has a focus series: highlighting a bar demotes it, so the slide stays valid.
  const withFocus = flag(byId(settings({ kind: 'bar', series: 0, index: 1 }, s), 'highlight'))
  const after = must(applyPatch(s, withFocus.set(true)).slide)
  expect(validate(after, 'consulting').errors).toEqual(validate(s, 'consulting').errors)
  expect(after.chart?.series?.some((x) => x.color === 'focus')).toBe(false)
})

test('a table column: Emphasis folds focus and muted, with Alignment, Bold, Italic and Bars', () => {
  const s = starter('table'), j = 1, t: Target = { kind: 'cells', r0: -1, c0: j, r1: 3, c1: j }
  const got = settings(t, s)
  const em = choice(byId(got, 'emphasis'))
  expect(em.options.map((o) => o.label)).toEqual(['Highlight', 'Normal', 'Mute'])
  expect(em.set('focus')).toEqual({ [`table.columns[${j}].focus`]: true, [`table.columns[${j}].muted`]: null })
  expect(em.set('muted')).toEqual({ [`table.columns[${j}].focus`]: null, [`table.columns[${j}].muted`]: true })
  expect(labels(byId(got, 'align'))).toEqual(['Left', 'Centre', 'Right', 'Auto'])
  expect(got.map((x) => x.label)).toEqual(expect.arrayContaining(['Alignment', 'Bold', 'Italic']))
})

test('a card offers its tone as Emphasis; Highlight on a step moves the highlight', () => {
  expect(settings({ kind: 'item', item: 'cards[0]' }, starter('cards-icon')).map((x) => x.id)).toContain('emphasis')
  const steps = starter('steps')
  expect(choice(byId(settings({ kind: 'item', item: 'steps[0]' }, steps), 'emphasis')).set('focus')).toEqual({ 'steps[0].focus': true, 'steps[1].focus': null })
})

test('every choice offered applies cleanly and adds no validator error', () => {
  const cases: [Slide, Target][] = [
    [starter('chart-lines'), { kind: 'series', series: 0 }], [starter('chart-lines'), { kind: 'slide' }], [starter('chart-mix'), { kind: 'series', series: 1 }],
    [starter('table'), { kind: 'cells', r0: -1, c0: 2, r1: 3, c1: 2 }], [starter('table'), { kind: 'cells', r0: 1, c0: 0, r1: 1, c1: 1 }],
    [starter('cards-icon'), { kind: 'item', item: 'cards[1]' }], [starter('steps'), { kind: 'item', item: 'steps[1]' }], [starter('waterfall'), { kind: 'item', item: 'chart.items[1]' }],
  ]
  for (const [s, t] of cases) {
    const base = validate(s, 'consulting').errors
    for (const x of settings(t, s)) {
      const patches = x.kind === 'choice' ? x.options.map((o) => x.set(o.value)) : [x.set(true), x.set(false)]
      for (const p of patches) {
        const r = applyPatch(s, p)
        expect(r.errors, JSON.stringify(p)).toBeUndefined()
        expect(validate(must(r.slide), 'consulting').errors.filter((e) => !base.includes(e)), JSON.stringify(p)).toEqual([])
      }
    }
  }
})

test('a setting the slide cannot take is left out', () => {
  const mix = settings({ kind: 'series', series: 0 }, starter('chart-mix')), ids = mix.map((x) => x.id)
  expect(ids).not.toContain('area')
  const bar = must(starter('chart-mix').chart?.series).findIndex((x) => x.mark === 'bar')
  expect(settings({ kind: 'series', series: bar }, starter('chart-mix')).map((x) => x.id)).not.toContain('dashed')
  const t = starter('table'), words = must(t.table?.columns).findIndex((_c, k) => k === 0)
  expect(settings({ kind: 'cells', r0: -1, c0: words, r1: 3, c1: words }, t).map((x) => x.id)).not.toContain('bars')
})

test('never offers kind, icon, logo or free text', () => {
  const all = [settings({ kind: 'cells', r0: -1, c0: 1, r1: 3, c1: 1 }, starter('table')), settings({ kind: 'slide' }, starter('chart-notes')), settings({ kind: 'item', item: 'cards[0]' }, starter('cards-icon'))].flat()
  for (const x of all) expect(x.path).not.toMatch(/\.(kind|icon|logo|label|name|title|text|format)$/)
})

test("a pair half's chart: a series writes under halves[n].chart; Highlight this bar is left out (the half takes no highlight)", () => {
  const s = starter('pair'), half = 1
  expect(settings({ kind: 'bar', series: 0, index: 1, half }, s).map((x) => x.id)).not.toContain('highlight')
  const em = choice(byId(settings({ kind: 'series', series: 0, half }, s), 'emphasis'))
  expect(em.path).toBe(`halves[${half}].chart.series[0].color`)
  const base = validate(s, 'consulting').errors
  for (const o of em.options) {
    const r = applyPatch(s, em.set(o.value))
    expect(r.errors).toBeUndefined()
    expect(validate(must(r.slide), 'consulting').errors.filter((e) => !base.includes(e))).toEqual([])
  }
})

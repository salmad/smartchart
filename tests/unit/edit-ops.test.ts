import { test, expect } from 'vitest'
import { getAt, issuePath, listOf, listOps, newItem, removeItem, switchTemplate } from '@/engine/slides/edit'
import { applyPatch } from '@/engine/agent/patch'
import { autofix } from '@/engine/agent/autofix'
import { OFFERED, validate } from '@/engine/slides/schema'
import { STARTERS, starterSlide } from '@/engine/starters'
import type { Slide, Style } from '@/engine/types'

const must = <T>(v: T | undefined): T => { if (v === undefined) throw new Error('missing'); return v }
const starter = (id: string, style: Style = 'consulting') => starterSlide(must(STARTERS.find((s) => s.id === id)), style)
const patched = (s: Slide, set: Record<string, unknown>) => { const r = applyPatch(s, set); if (!r.slide) throw new Error(r.errors.join('; ')); return r.slide }
const fill = (v: unknown): unknown => typeof v === 'string' ? (v === '' ? 'Filled in' : v) : Array.isArray(v) ? v.map(fill) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fill(x)])) : v

test('getAt reads a path', () => {
  expect(getAt(starter('cards-icon'), 'cards[1].title')).toBe(must(starter('cards-icon').cards)[1].title)
  expect(getAt(starter('cards-icon'), 'cards[9].title')).toBeUndefined()
})

test('listOps finds every list the user can grow, with the schema limits, and never chart data or table columns', () => {
  const ops = listOps(starter('cards-icon'), 'consulting')
  expect(ops.find((o) => o.path === 'cards')).toMatchObject({ min: 2, max: 4, required: true })
  expect(ops.some((o) => o.path.startsWith('chart') || o.path === 'table.columns' || o.path.endsWith('.cells'))).toBe(false)
  expect(listOps(starter('chart-notes'), 'consulting').find((o) => o.path === 'notes')).toMatchObject({ min: 2, max: 4, required: false })
})

test('listOf maps an item path to its list', () => {
  const ops = listOps(starter('cards-icon'), 'consulting')
  expect(listOf(ops, 'cards[2]')).toMatchObject({ op: { path: 'cards' }, index: 2 })
  expect(listOf(ops, 'title')).toBeNull()
})

for (const st of STARTERS) for (const style of ['consulting', 'pitch'] as const) {
  test(`${st.id} (${style}): a new item on every list validates once its text is filled in`, () => {
    const slide = starterSlide(st, style)
    for (const op of listOps(slide, style)) {
      if (op.length >= op.max) continue
      const next = autofix(fill(patched(slide, newItem(slide, style, op, op.length))) as Slide, style).slide
      const errors = validate(next, style).errors.filter((e) => !/characters|at most|budget/.test(e))
      expect(errors, `${op.path}`).toEqual([])
    }
  })
}

test('a new card copies its neighbour\'s shape: icon "auto", default tone, empty text', () => {
  const s = starter('cards-icon'), op = must(listOps(s, 'consulting').find((o) => o.path === 'cards'))
  const set = newItem(s, 'consulting', op, 1)
  expect(Object.keys(set)).toEqual(['cards'])
  const card = (set.cards as Record<string, unknown>[])[1]
  expect(card.icon).toBe('auto')
  expect(card.title).toBe('')
  expect(card.tone ?? 'neutral').toBe('neutral')
})

test('removeItem drops one item above the minimum, the whole optional list at it', () => {
  expect(removeItem({ path: 'notes', min: 2, max: 4, length: 3, required: false }, 1)).toEqual({ 'notes[1]': null })
  expect(removeItem({ path: 'notes', min: 2, max: 4, length: 2, required: false }, 1)).toEqual({ notes: null })
})

test('switchTemplate keeps the frame, takes the body from the starter, names what goes', () => {
  const from = starter('chart-notes'), r = switchTemplate(from, 'steps', 'consulting')
  expect(r.slide.template).toBe('steps')
  expect(r.slide.title).toBe(from.title)
  expect(r.keeps).toContain('title')
  expect(r.drops).toContain('chart')
  expect(r.drops).toContain(`${must(from.notes).length} notes`)
  expect(r.samples.every((p) => p.startsWith('steps'))).toBe(true)
})

test('switchTemplate to and from cover keeps only title and subtitle', () => {
  const r = switchTemplate(starter('chart-notes'), 'cover', 'consulting')
  expect(Object.keys(r.slide).sort()).toEqual(['subtitle', 'template', 'title'])
})

for (const from of OFFERED) for (const to of OFFERED) for (const style of ['consulting', 'pitch'] as const) {
  if (from === to) continue
  test(`switchTemplate ${from} → ${to} (${style}) validates`, () => {
    const src = starterSlide(must(STARTERS.find((s) => s[style].template === from)), style)
    const r = switchTemplate(src, to, style)
    expect(validate(autofix(r.slide, style).slide, style).errors.filter((e) => !/characters|at most|budget|wraps/.test(e))).toEqual([])
  })
}

test('issuePath reads the leading path of a validate message', () => {
  expect(issuePath('cards[2].title: 31 characters, limit 24 (7 too many). Shorten this field only.')).toBe('cards[2].title')
  expect(issuePath('title wraps to 3 lines (max 2); shorten it')).toBeUndefined()
})

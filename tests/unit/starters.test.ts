import { test, expect } from 'vitest'
import { STARTERS, GROUPS, starterSlide } from '@/engine/starters'
import { validateDeck, MIXED_HALVES } from '@/engine/slides/schema'
import { stressFor } from '../fixtures/stress'

test('count lock: 27 starters, unique ids, known groups', () => {
  expect(STARTERS).toHaveLength(27)
  expect(new Set(STARTERS.map((s) => s.id)).size).toBe(27)
  for (const s of STARTERS) expect(GROUPS.map((g) => g.id)).toContain(s.group)
})
// Two more with mixed halves on (a chart beside a table, a number beside points).
const STRESS = 49 + (MIXED_HALVES ? 2 : 0)
test('stress fixture keeps its slides per style', () => {
  expect(stressFor('consulting')).toHaveLength(STRESS)
  expect(stressFor('pitch')).toHaveLength(STRESS)
})
test('every starter validates with no errors or warnings, both styles', () => {
  for (const style of ['consulting', 'pitch'] as const) {
    const r = validateDeck({ style, slides: STARTERS.map((s) => starterSlide(s, style)) })
    expect(r.errors).toEqual([]); expect(r.warnings).toEqual([])
  }
})
test('starterSlide returns a copy', () => {
  const a = starterSlide(STARTERS[0], 'consulting'); a.title = 'changed'
  expect(starterSlide(STARTERS[0], 'consulting').title).not.toBe('changed')
})

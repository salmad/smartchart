import { test, expect } from 'vitest'
import { STARTERS, GROUPS, starterSlide } from '@/engine/starters'
import { validateDeck } from '@/engine/slides/schema'
import { stressFor } from '../fixtures/stress'

test('count lock: 24 starters, unique ids, known groups', () => {
  expect(STARTERS).toHaveLength(24)
  expect(new Set(STARTERS.map((s) => s.id)).size).toBe(24)
  for (const s of STARTERS) expect(GROUPS.map((g) => g.id)).toContain(s.group)
})
test('stress fixture keeps 36 slides per style', () => {
  expect(stressFor('consulting')).toHaveLength(36)
  expect(stressFor('pitch')).toHaveLength(36)
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

import { test, expect } from 'vitest'
import { pickIcon } from '@/app/edit/icon'
import type { Slide } from '@/engine/types'

const slide: Slide = { template: 'cards', title: 'Why now', cards: [{ icon: 'zap', title: 'Fast', text: 'Approved in five minutes' }, { icon: 'wallet', title: 'Cheap', text: 'Lower fees on every payment' }] }

test('asks once, about the one card, from its own words, and returns the icon', async () => {
  const asked: string[] = []
  const jev = (async (prompt: string, qs: Record<string, { instructions: string }>) => {
    asked.push(...Object.values(qs).map((q) => q.instructions), prompt)
    return { icon1: { choice: 'banknote', p: 0.9, probabilities: {} }, _ms: 1 }
  }) as never
  expect(await pickIcon(slide, 1, 'consulting', jev)).toBe('banknote')
  expect(asked.filter((a) => a.includes('Which icon'))).toHaveLength(1)
  expect(asked.join(' ')).toContain('Lower fees on every payment')
})

test('a model that cannot be reached is an error, not a made-up icon', async () => {
  const jev = (async () => { throw new Error('offline') }) as never
  await expect(pickIcon(slide, 0, 'consulting', jev)).rejects.toThrow('offline')
})

test('a card with no icon lead has nothing to pick', async () => {
  const s: Slide = { template: 'cards', title: 'T', cards: [{ value: '5 min', title: 'x' }, { value: '9%', title: 'y' }] }
  await expect(pickIcon(s, 0, 'consulting', (async () => ({})) as never)).rejects.toThrow(/icon/)
})

test('every icon in the curated set has a glyph for the picker', async () => {
  const { glyph } = await import('@/app/edit/IconPicker')
  const { ICONS } = await import('@/engine/slides/schema')
  expect(ICONS.filter((n) => !glyph(n))).toEqual([])
})

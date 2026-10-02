import { test, expect } from 'vitest'
import { describe, validate, MENU, MIXED_HALVES } from '@/engine/slides/schema'
import type { Slide, Style, TemplateId } from '@/engine/types'

const frame = (id: TemplateId, style: Style) => ({ template: id, title: 'Title', ...(style === 'pitch' ? { subtitle: 'A claim.' } : {}) })

test('every capability sample validates in the styles it declares', () => {
  for (const id of Object.keys(MENU) as TemplateId[]) for (const style of ['consulting', 'pitch'] as const) {
    for (const cap of MENU[id].capabilities ?? []) {
      if (cap.styles && !cap.styles.includes(style)) continue
      const r = validate({ ...frame(id, style), ...cap.sample } as Slide, style)
      expect(r.errors, `${id} / ${cap.name} / ${style}`).toEqual([])
    }
  }
})

test('guidance only where there is a choice; at most 7 entries; use and avoid one sentence each', () => {
  const withCaps = (Object.keys(MENU) as TemplateId[]).filter((id) => MENU[id].capabilities?.length)
  expect(withCaps.sort()).toEqual(['cards', 'chart', 'pair', 'steps', 'table'])
  for (const id of withCaps) {
    const caps = MENU[id].capabilities ?? []
    expect(caps.length, id).toBeLessThanOrEqual(7)
    for (const c of caps) { expect(c.use.split(/\.\s/).length, `${id}/${c.name} use`).toBeLessThanOrEqual(2); expect(c.avoid.split(/\.\s/).length, `${id}/${c.name} avoid`).toBeLessThanOrEqual(2); expect(c.avoid.length).toBeGreaterThan(0) }
  }
})

test('the card carries capabilities and shapes, filtered by style', () => {
  const t = describe('table', 'consulting')
  expect(t.capabilities?.map((c) => c.name)).toContain('Scoring')
  expect(t.shapes?.length).toBe(4)
  expect(describe('pair', 'pitch').shapes?.length).toBe(MIXED_HALVES ? 6 : 1)
  expect(describe('cover', 'consulting').capabilities).toBeUndefined()
  expect(describe('chart', 'consulting').capabilities?.map((c) => c.name)).toEqual(expect.arrayContaining(['Waterfall', 'Ranked', 'Matrix', 'Timeline']))
  expect(describe('table', 'pitch').capabilities?.map((c) => c.name)).not.toContain('Bullets in a cell')
})

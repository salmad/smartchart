import { describe, expect, it } from 'vitest'
import { checkInput } from '../../src/engine/tools/input'
import { dataFromDoc, docFromData, insertIndex, slideAt, storylineRows } from '../../src/engine/tools/doc'
import { estimate } from '../../src/engine/tools/estimate'
import { writeSlide } from '../../src/engine/tools/write'
import { STARTERS, starterSlide } from '../../src/engine/starters'
import { fakeJev } from './fakes'
import { ctxFor } from './tool-ctx'

const schema = { type: 'object', additionalProperties: false, required: ['deckId'], properties: {
  deckId: { type: 'string' }, on: { type: 'boolean' }, style: { type: 'string', enum: ['consulting', 'pitch'] },
  set: { type: 'object', additionalProperties: true } } }

describe('checkInput', () => {
  it('accepts a good input', () => expect(checkInput(schema, { deckId: 'd', on: true, set: { 'a[0]': 1 } })).toEqual([]))
  it('names missing, extra, wrong type and enum', () => {
    expect(checkInput(schema, { on: 'yes', style: 'fancy', extra: 1 })).toEqual([
      'deckId: required', 'on: must be a boolean', 'style: must be one of consulting, pitch', 'extra: not a known field (known: deckId, on, style, set)'])
  })
})

describe('deck document', () => {
  const slide = starterSlide(STARTERS[0], 'consulting')
  const data = { style: 'consulting', theme: 'ink', accent: null, current: 0, updated: 5,
    items: [{ id: 's_a', slide, status: 'ok', errors: [], warnings: [], checks: [] }], history: [], working: [] }
  it('round-trips the app’s saved data', () => {
    const doc = docFromData('d_1', 'Deck', data)
    expect(doc.slides[0]).toMatchObject({ id: 's_a', issues: [] })
    expect(dataFromDoc(doc, data)).toMatchObject({ current: 0, items: [{ id: 's_a', status: 'ok', errors: [] }] })
  })
  it('storyline and lookups', () => {
    const doc = docFromData('d_1', 'Deck', data)
    expect(storylineRows(doc)[0]).toMatchObject({ slideId: 's_a', n: 1 })
    expect(() => slideAt(doc, 's_zz')).toThrow(/valid ids: s_a/)
    expect(insertIndex(doc, 'start')).toBe(0)
    expect(insertIndex(doc, 's_a')).toBe(1)
    expect(insertIndex(doc, undefined)).toBe(1)
  })
})

describe('estimate and write', () => {
  it('estimates title lines from characters', () => {
    const m = estimate('consulting')({ template: 'chart', title: 'x'.repeat(100) } as never)
    expect(m.lines).toBe(2)
    expect(m.issues).toEqual([])
  })
  it('writeSlide runs the write path and splits rule checks from warnings', async () => {
    const ctx = ctxFor({ jev: fakeJev() })
    const w = await writeSlide(ctx, starterSlide(STARTERS[0], 'consulting'), 'make it')
    expect(w.slide.template).toBe(STARTERS[0].consulting.template)
    expect(w.warnings.every((x) => !/^R\d+:/.test(x))).toBe(true)
  })
  it('writeSlide refuses archived templates and bad shapes with the fix', async () => {
    const ctx = ctxFor({ jev: fakeJev() })
    await expect(writeSlide(ctx, { template: 'number', title: 'x' }, '')).rejects.toMatchObject({ code: 'refused' })
    await expect(writeSlide(ctx, { template: 'chart' }, '')).rejects.toMatchObject({ code: 'bad_input' })
  })
})

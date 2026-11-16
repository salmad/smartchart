import { describe, expect, it } from 'vitest'
import { readSlideSource, slideSource } from '@/app/edit/source'
import { parseDoc } from '@/engine/docs/parse'
import { serializeDoc } from '@/engine/docs/serialize'
import type { Slide } from '@/engine/types'

describe('slide source', () => {
  const slide = { template: 'quote', quote: 'No bank would give us a real limit.', who: 'Founder' } as Slide

  it('reads back the slide it wrote', () => {
    const r = readSlideSource(slideSource(slide), 'consulting')
    expect(r.error).toBeNull()
    expect(r.slide).toEqual(slide)
  })

  it('says where JSON breaks, and gives no slide', () => {
    const r = readSlideSource('{ "template": "quote", }', 'consulting')
    expect(r.slide).toBeNull()
    expect(r.error).toMatch(/^Not valid JSON/)
  })

  it('refuses a template that does not exist', () => {
    const r = readSlideSource('{ "template": "nope" }', 'consulting')
    expect(r.slide).toBeNull()
    expect(r.error).toMatch(/nope/)
  })

  it('lets errors the slide already had through', () => {
    const had = { ...slide, colour: 'red' } as Slide
    const r = readSlideSource(slideSource(had), 'consulting', had)
    expect(r.slide).toEqual(had)
    expect(r.notes.some((n) => n.startsWith('colour:'))).toBe(true)
  })

  it('lists schema errors and holds the slide back until they are fixed', () => {
    const r = readSlideSource(JSON.stringify({ ...slide, colour: 'red' }), 'consulting')
    expect(r.slide).toBeNull()
    expect(r.notes.some((n) => n.startsWith('colour:'))).toBe(true)
  })
})

describe('doc source', () => {
  it('round-trips a doc file without changing it', () => {
    const text = '---\ntitle: Plan\n---\n\n## Goals {#goals}\n\nGrow revenue.\n\n- One\n  - Under one\n- Two\n'
    const doc = parseDoc(text).doc
    expect(serializeDoc(parseDoc(serializeDoc(doc)).doc)).toBe(serializeDoc(doc))
  })
})

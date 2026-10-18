/* The doc starters, in the one gallery: each parses, validates and round-trips. */
import { test, expect } from 'vitest'
import { DOC_STARTERS, starterDoc } from '@/engine/starters'
import { parseDoc } from '@/engine/docs/parse'
import { serializeDoc } from '@/engine/docs/serialize'
import { validateDoc } from '@/engine/docs/validate'

test('the three doc starters exist', () => {
  expect(DOC_STARTERS.map((s) => s.id)).toEqual(['competitor-teardown', 'prd', 'legal-memo'])
})

test('every doc starter parses, validates and round-trips', () => {
  for (const s of DOC_STARTERS) {
    const { doc, errors } = parseDoc(s.markdown.join('\n'))
    expect(errors, s.id).toEqual([])
    expect(validateDoc(doc).errors, s.id).toEqual([])
    expect(validateDoc(doc).warnings, s.id).toEqual([])
    expect(parseDoc(serializeDoc(doc)).doc, s.id).toEqual(doc)
    expect(starterDoc(s)).toEqual(doc)
  }
})

test('every starter has a subsection, a link to a figure, and captions on its figures', () => {
  for (const s of DOC_STARTERS) {
    const doc = starterDoc(s), figures = doc.blocks.filter((b) => b.type === 'figure')
    expect(doc.blocks.some((b) => b.type === 'heading' && b.level === 3), s.id).toBe(true)
    expect(s.markdown.join('\n'), s.id).toMatch(new RegExp(`\\]\\(#(${figures.map((f) => f.id).join('|')})\\)`))
    for (const f of figures) if (f.kind !== 'callout') expect(f.body.caption, `${s.id} #${f.id}`).toBeTruthy()
  }
})

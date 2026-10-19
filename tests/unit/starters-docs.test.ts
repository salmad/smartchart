/* The doc starters, in the one gallery: each parses, validates and round-trips. */
import { test, expect } from 'vitest'
import { BLOCK_STARTERS, DOC_STARTERS, starterDoc } from '@/engine/starters'
import { parseDoc } from '@/engine/docs/parse'
import { serializeDoc } from '@/engine/docs/serialize'
import { validateDoc } from '@/engine/docs/validate'
import { FIGURE_KINDS } from '@/engine/docs/types'

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

test('the figure starters are the eight kinds, in menu order', () => {
  expect(BLOCK_STARTERS.map((s) => s.id)).toEqual(['chart', 'table', 'number', 'cards', 'steps', 'summary', 'pair', 'callout'])
  expect(BLOCK_STARTERS.map((s) => s.kind)).toEqual(['chart', 'table', 'number', 'cards', 'steps', 'summary', 'pair', 'callout'])
})

test('every figure starter validates as a figure, with ids unique and kinds real', () => {
  const ids = BLOCK_STARTERS.map((s) => s.id)
  expect(new Set(ids).size).toBe(ids.length)
  for (const s of BLOCK_STARTERS) {
    expect(FIGURE_KINDS, s.id).toContain(s.kind)
    expect(s.label && s.blurb, s.id).toBeTruthy()
    const v = validateDoc({ title: 'x', blocks: [{ type: 'figure', kind: s.kind, id: 'f', body: s.body }] })
    expect(v.errors, s.id).toEqual([])
    expect(v.warnings, s.id).toEqual([])
    if (s.kind !== 'callout') expect(s.body.source ?? s.body.footnote, s.id).toBeTruthy()
    expect(JSON.stringify(s.body), s.id).not.toMatch(/!|\b(red|green)\b/i)
  }
})

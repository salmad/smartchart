/* The editor's document and the file: opening a doc and saving it writes the same bytes, for every starter; and what
   the editor can hold is exactly what the format can. */
import { expect, test } from 'vitest'
import { DOC_STARTERS, starterDoc } from '@/engine/starters'
import { parseDoc } from '@/engine/docs/parse'
import { serializeDoc } from '@/engine/docs/serialize'
import { fromProse, inline, markupOf, toProse, type ProseNode } from '@/engine/docs/prose'
import type { Block, Doc } from '@/engine/docs/types'

const roundTrip = (doc: Doc, withOriginals = true): Doc => {
  const h = fromProse(toProse({ title: doc.title, subtitle: doc.subtitle ?? '', blocks: doc.blocks }), withOriginals ? doc.blocks : [])
  return { ...doc, title: h.title, subtitle: h.subtitle || undefined, blocks: h.blocks }
}

for (const s of DOC_STARTERS) {
  test(`${s.id}: through the editor's document and back, the file is the same bytes`, () => {
    const doc = starterDoc(s)
    expect(serializeDoc(roundTrip(doc))).toBe(serializeDoc(doc))
    // Without the originals, the words still come back as they were written (the starters hold only canonical markup).
    expect(serializeDoc(roundTrip(doc, false))).toBe(serializeDoc(doc))
  })
}

test('all five marks and both kinds of link survive', () => {
  const text = 'a **bold** [[focus]] [-red-] [+green+] [site](https://example.com/x) [part](#goals) **[[both]]**'
  const nodes = inline(text)
  expect(nodes.map((n) => n.marks?.map((m) => m.type).join('+') ?? '')).toEqual(['', 'bold', '', 'focus', '', 'neg', '', 'pos', '', 'link', '', 'link', '', 'bold+focus'])
  expect(markupOf(nodes)).toBe(text)
})

test('blocks before the first section, an empty doc, code, raw, nested lists, a quote and a divider', () => {
  const doc = parseDoc(['---', 'title: T', 'subtitle: S', '---', '', 'Before any section.', '', '- a', '  1. b', '', '> quoted', '', '---', '', '```ts', 'let x = 1', '```', '', '## One {#one}', '', 'Inside.', '', '### Sub {#sub}', ''].join('\n')).doc
  expect(serializeDoc(roundTrip(doc, false))).toBe(serializeDoc(doc))
  const empty: Doc = { title: 'Only a title', blocks: [] }
  expect(serializeDoc(roundTrip(empty, false))).toBe(serializeDoc(empty))
})

test('the shape is what the editor expects: title, subtitle, loose blocks, then sections of head and body', () => {
  const doc = parseDoc(['---', 'title: T', '---', '', 'Loose.', '', '## One {#one}', '', 'Inside.', ''].join('\n')).doc
  const p = toProse({ title: doc.title, subtitle: '', blocks: doc.blocks })
  expect(p.content?.map((n) => n.type)).toEqual(['docTitle', 'docSubtitle', 'paragraph', 'section'])
  expect((p.content?.[3] as ProseNode).content?.map((n) => n.type)).toEqual(['sectionHead', 'sectionBody'])
})

test('a changed block is rebuilt from its words; an unchanged one is the same Block as before', () => {
  const doc = parseDoc(['---', 'title: T', '---', '', 'One.', '', 'Two.', ''].join('\n')).doc
  const p = toProse({ title: 'T', subtitle: '', blocks: doc.blocks })
  const second = p.content?.[3] as ProseNode
  second.content = [{ type: 'text', text: 'Two, changed.' }]
  const h = fromProse(p, doc.blocks)
  expect(h.blocks[0]).toBe(doc.blocks[0])
  expect((h.blocks[1] as Extract<Block, { type: 'paragraph' }>).text).toBe('Two, changed.')
})

test('markup that is not in the format\'s own order is kept as written when the block is unchanged', () => {
  const doc = parseDoc(['---', 'title: T', '---', '', '[[**x**]] y.', ''].join('\n')).doc
  const out = roundTrip(doc)
  expect(out.blocks[0]).toBe(doc.blocks[0])
})

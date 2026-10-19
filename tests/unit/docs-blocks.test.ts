/* Blocks keyed in memory: the ops on text blocks, blockHTML, ids and the file round trip. */
import { test, expect } from 'vitest'
import { blockHTML, docHTML } from '@/engine/docs/render'
import { giveIds, parseDoc } from '@/engine/docs/parse'
import { serializeDoc } from '@/engine/docs/serialize'
import { insertAfter, keyed, mergeBack, moveBlock, splitText, unkeyed } from '@/engine/docs/blocks'
import { DOC_STARTERS, starterDoc } from '@/engine/starters'
import type { Block, Doc } from '@/engine/docs/types'

const p = (text: string): Block => ({ type: 'paragraph', text })
const texts = (blocks: Block[]) => blocks.map((b) => ('text' in b ? b.text : b.type))

test('blockHTML of a paragraph is the <p> docHTML writes', () => {
  const b = p('Hello **bold**')
  expect(docHTML({ title: 'T', blocks: [b] })).toContain(blockHTML(b, 'paper'))
  expect(blockHTML({ type: 'heading', level: 2, id: 'a', text: 'A' }, 'paper')).toBe('<h2 id="a">A</h2>')
})

test('splitText cuts at a plain-text offset and never opens a mark', () => {
  const r = splitText(keyed([p('Hello **bold** world')]), 'b1', 6)
  expect(texts(unkeyed(r.list))).toEqual(['Hello ', '**bold** world'])
  expect(r.key).not.toBe('b1')
  const mid = splitText(keyed([p('a **bold** z')]), 'b1', 4)
  expect(texts(unkeyed(mid.list))).toEqual(['a **bo**', '**ld** z'])
})

test('mergeBack after a figure is null; two paragraphs join with the caret between', () => {
  const fig: Block = { type: 'figure', kind: 'number', id: 'n', body: {} }
  expect(mergeBack(keyed([fig, p('x')]), 'b2')).toBeNull()
  const r = mergeBack(keyed([p('Hello '), p('world')]), 'b2')
  expect(r && texts(unkeyed(r.list))).toEqual(['Hello world'])
  expect(r?.at).toBe(6)
  expect(r?.key).toBe('b1')
})

test('insertAfter(null) puts the block first; moveBlock keeps every key', () => {
  const list = keyed([p('a'), p('b'), p('c')])
  const r = insertAfter(list, null, p('z'))
  expect(texts(unkeyed(r.list))[0]).toBe('z')
  expect(new Set(r.list.map((k) => k.key)).size).toBe(4)
  const moved = moveBlock(list, 'b1', 2)
  expect(moved.map((k) => k.key).sort()).toEqual(['b1', 'b2', 'b3'])
  expect(texts(unkeyed(moved))).toEqual(['b', 'c', 'a'])
})

test.each(DOC_STARTERS.map((s) => [s.id, starterDoc(s)] as const))('starter %s survives keying and the file', (_id, doc: Doc) => {
  expect(parseDoc(serializeDoc({ ...doc, blocks: unkeyed(keyed(doc.blocks)) })).doc).toEqual(doc)
})

test('a paragraph that looks like Markdown stays a paragraph', () => {
  for (const text of ['## not a heading', '- not a list', '1. not either', '> not a quote', '```js', '---', '\\already']) {
    const doc: Doc = { title: 'T', blocks: [p(text)] }
    expect(parseDoc(serializeDoc(doc)).doc.blocks).toEqual([p(text)])
  }
})

test('giveIds slugs new headings, numbers repeats, and keeps an id that no longer matches', () => {
  const h = (text: string, id = ''): Block => ({ type: 'heading', level: 2, id, text })
  const out = giveIds([h('Pricing'), h('Pricing'), h('Costs', 'old-name')])
  expect(out.map((b) => (b.type === 'heading' ? b.id : ''))).toEqual(['pricing', 'pricing-2', 'old-name'])
})

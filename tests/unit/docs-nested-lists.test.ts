/* Nested lists: two spaces under an item, any mix of bullets and numbers, three levels at most; the file, the page and
   the checks all read them the same way. */
import { expect, test } from 'vitest'
import { parseDoc } from '@/engine/docs/parse'
import { serializeDoc } from '@/engine/docs/serialize'
import { validateDoc } from '@/engine/docs/validate'
import { blockHTML } from '@/engine/docs/render'
import { tidy } from '@/engine/docs/tidy'
import { identify, writeText } from '@/engine/docs/ops'
import type { Block, ListBlock } from '@/engine/docs/types'

const file = (body: string) => `---\ntitle: T\n---\n\n${body}\n`
const first = (body: string): Block => parseDoc(file(body)).doc.blocks[0]

test('an indented item is the list under the item above', () => {
  const b = first('- one\n  - one a\n  - one b\n- two') as ListBlock
  expect(b.items).toEqual(['one', 'two'])
  expect(b.nested?.[0]).toEqual({ type: 'bullets', items: ['one a', 'one b'] })
  expect(b.nested?.[1]).toBeNull()
})

test('numbers hold bullets, and the other way round, three levels down', () => {
  const b = first('1. Step\n   - detail\n     1. fine point\n2. Next') as ListBlock
  expect(b.type).toBe('numbered')
  const mid = b.nested?.[0] as ListBlock
  expect(mid.type).toBe('bullets')
  expect(mid.nested?.[0]).toEqual({ type: 'numbered', items: ['fine point'] })
})

test('a nested list round-trips, written with two spaces a level and numbers counted in their own list', () => {
  const text = file('1. Step\n   - detail\n   - more\n2. Next\n   1. a\n   2. b')
  const out = serializeDoc(parseDoc(text).doc)
  expect(out).toBe(file('1. Step\n  - detail\n  - more\n2. Next\n  1. a\n  2. b'))
  expect(serializeDoc(parseDoc(out).doc)).toBe(out)
})

test('an indented line that is no item still continues the item before it', () => {
  const b = first('- one\n  keeps going\n- two') as ListBlock
  expect(b.items).toEqual(['one keeps going', 'two'])
  expect(b.nested).toBeUndefined()
})

test('a list without nesting is the list it was: no nested field', () => {
  expect(first('- a\n- b')).toEqual({ type: 'bullets', items: ['a', 'b'] })
})

test('four levels is an error, three is fine', () => {
  expect(validateDoc(parseDoc(file('- a\n  - b\n    - c')).doc).errors).toEqual([])
  expect(validateDoc(parseDoc(file('- a\n  - b\n    - c\n      - d')).doc).errors[0]).toMatch(/nests 4 levels; 3 at most/)
})

test('the page draws the list inside its item', () => {
  expect(blockHTML(first('- one\n  - a'), 'paper')).toBe('<ul class="doc-list"><li>one<ul class="doc-list"><li>a</li></ul></li></ul>')
  expect(blockHTML(first('1. one\n   - a'), 'paper')).toBe('<ol class="doc-list"><li><span>one</span><ul class="doc-list"><li>a</li></ul></li></ol>')
})

test('tidy drops an empty item with the list under it, and an emptied nested list', () => {
  const b = first('- one\n  - a\n  - b\n- two\n  - c') as ListBlock
  const edited: ListBlock = { ...b, items: ['one', ' ', 'two'], nested: [{ type: 'bullets', items: ['a', ''] }, { type: 'bullets', items: ['x'] }, { type: 'bullets', items: [''] }] }
  expect(tidy([edited])).toEqual([{ type: 'bullets', items: ['one', 'two'], nested: [{ type: 'bullets', items: ['a'] }, null] }])
  expect(tidy([b])[0]).toBe(b)
})

test('an agent writes a nested list in Markdown and gets it back as one block', () => {
  const { doc } = parseDoc(file('A paragraph.'))
  const id = identify(doc)[0].id, edit = writeText(doc, id, '- a\n  - b\n  - c\n- d')
  expect(typeof edit).not.toBe('string')
  if (typeof edit === 'string') return
  expect(edit.doc.blocks).toHaveLength(1)
  expect((edit.doc.blocks[0] as ListBlock).nested?.[0]?.items).toEqual(['b', 'c'])
})

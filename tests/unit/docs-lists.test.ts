/* The editor's ops on list items, paste, links and the tidy before Save: no text is lost, no empty block is saved. */
import { test, expect } from 'vitest'
import { keyed, unkeyed } from '@/engine/docs/blocks'
import { endList, insertChunks, joinOntoList, mergeItem, splitItem, tidy } from '@/engine/docs/lists'
import { setLink } from '@/engine/slides/markup'
import type { Block } from '@/engine/docs/types'

const p = (text: string): Block => ({ type: 'paragraph', text })
const ul = (...items: string[]): Block => ({ type: 'bullets', items })

test('splitItem cuts an item in two at the caret, keeping its marks closed', () => {
  const r = splitItem(keyed([ul('one **two** three')]), 'b1', 0, 6)
  expect(unkeyed(r.list)).toEqual([ul('one **tw**', '**o** three')])
  expect(r).toMatchObject({ key: 'b1', item: 1 })
})

test('Enter on an empty last item ends the list with a paragraph after it', () => {
  const r = endList(keyed([ul('a', 'b', '')]), 'b1', 2)
  expect(unkeyed(r.list)).toEqual([ul('a', 'b'), p('')])
  expect(r.list[1].key).toBe(r.key)
})

test('Enter on an empty middle item splits the list around a paragraph', () => {
  const r = endList(keyed([ul('a', '', 'c')]), 'b1', 1)
  expect(unkeyed(r.list)).toEqual([ul('a'), p(''), ul('c')])
})

test('Enter on the only empty item turns the list into a paragraph', () => {
  expect(unkeyed(endList(keyed([ul('')]), 'b1', 0).list)).toEqual([p('')])
})

test('Backspace at an item’s start joins it onto the item before', () => {
  const r = mergeItem(keyed([ul('ab', 'cd')]), 'b1', 1)
  expect(unkeyed(r.list)).toEqual([ul('abcd')])
  expect(r).toMatchObject({ key: 'b1', item: 0, at: 2 })
})

test('Backspace at the first item’s start lifts it out as a paragraph', () => {
  const r = mergeItem(keyed([ul('ab', 'cd')]), 'b1', 0)
  expect(unkeyed(r.list)).toEqual([p('ab'), ul('cd')])
  expect(r.item).toBeUndefined()
  expect(r.at).toBe(0)
  expect(unkeyed(mergeItem(keyed([ul('only')]), 'b1', 0).list)).toEqual([p('only')])
})

test('Backspace at a paragraph’s start after a list joins it onto the last item', () => {
  const r = joinOntoList(keyed([ul('a', 'b'), p('c')]), 'b2')
  expect(r && unkeyed(r.list)).toEqual([ul('a', 'bc')])
  expect(r).toMatchObject({ key: 'b1', item: 1, at: 1 })
  expect(joinOntoList(keyed([p('a'), p('c')]), 'b2')).toBeNull()
})

test('a paste of one line goes in at the caret, over the selection', () => {
  const r = insertChunks(keyed([p('Hello world')]), 'b1', undefined, 6, 11, ['there'])
  expect(unkeyed(r.list)).toEqual([p('Hello there')])
  expect(r).toMatchObject({ key: 'b1', at: 11 })
})

test('a paste of paragraphs splits the block: head, new paragraphs, tail', () => {
  const r = insertChunks(keyed([p('AB')]), 'b1', undefined, 1, 1, ['x', 'y', 'z'])
  expect(unkeyed(r.list)).toEqual([p('Ax'), p('y'), p('zB')])
  expect(r.key).toBe(r.list[2].key)
  expect(r.at).toBe(1)
})

test('a paste of lines into a list item makes items', () => {
  const r = insertChunks(keyed([ul('AB')]), 'b1', 0, 1, 1, ['x', 'y'])
  expect(unkeyed(r.list)).toEqual([ul('Ax', 'yB')])
  expect(r).toMatchObject({ key: 'b1', item: 1, at: 1 })
})

test('tidy drops empty text blocks and items, nothing with words', () => {
  const blocks: Block[] = [p(''), p(' '), { type: 'heading', level: 2, id: '', text: '' }, ul('a', ''), ul(''), { type: 'quote', text: 'q' }, { type: 'divider' }]
  expect(tidy(blocks)).toEqual([ul('a'), { type: 'quote', text: 'q' }, { type: 'divider' }])
})

test('setLink puts a link over a range and takes it off', () => {
  const on = setLink('Read the report now', 9, 15, 'https://example.com')
  expect(on).toBe('Read the [report](https://example.com) now')
  expect(setLink(on, 9, 15, null)).toBe('Read the report now')
  expect(setLink('**bold** word', 0, 4, 'https://a.b')).toBe('**[bold](https://a.b)** word')
})

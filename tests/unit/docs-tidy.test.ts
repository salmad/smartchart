/* The tidy before Save, and links over a range: no text is lost, no empty block is saved. */
import { test, expect } from 'vitest'
import { tidy } from '@/engine/docs/tidy'
import { setLink } from '@/engine/slides/markup'
import type { Block } from '@/engine/docs/types'

const p = (text: string): Block => ({ type: 'paragraph', text })
const ul = (...items: string[]): Block => ({ type: 'bullets', items })

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

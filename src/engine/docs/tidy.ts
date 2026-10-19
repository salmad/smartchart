/* Before Save: text blocks and list items with no words go; a list with no items goes. Nothing with words changes. */
import { plainOf } from '../slides/markup.js'
import { tidyList } from './nest.js'
import type { Block } from './types.js'

const blank = (text: string) => plainOf(text).trim() === ''

export function tidy(blocks: Block[]): Block[] {
  return blocks.flatMap((b): Block[] => {
    if (b.type === 'paragraph' || b.type === 'quote' || b.type === 'heading') return blank(b.text) ? [] : [b]
    if (b.type === 'bullets' || b.type === 'numbered') { const l = tidyList(b, blank); return l ? [l] : [] }
    return [b]
  })
}

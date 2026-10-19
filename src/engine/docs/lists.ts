/* The editor's ops on list items, on paste, and the tidy before Save. Pure, like blocks.ts: each returns a new list and
   where the caret goes (`item` set when it is in a list item). Text is cut and joined through markup.ts. */
import { parse, plainOf, serialize, type Char } from '../slides/markup.js'
import { newKey, type Keyed } from './blocks.js'
import { tidyList } from './nest.js'
import type { Block } from './types.js'

export interface Caret { list: Keyed[]; key: string; item?: number; at: number }
type List = Extract<Block, { type: 'bullets' | 'numbered' }>

const at = (list: Keyed[], key: string) => list.findIndex((k) => k.key === key)
const isList = (b: Block | undefined): b is List => b?.type === 'bullets' || b?.type === 'numbered'
const plain = (text: string): Char[] => text.split('').map((ch) => ({ ch, marks: [] }))
const join = (a: string, b: string) => serialize([...parse(a), ...parse(b)])
const swap = (list: Keyed[], i: number, by: Keyed[]) => [...list.slice(0, i), ...by, ...list.slice(i + 1)]

/** Enter in an item: the item is cut at the caret, and the caret goes to the new one. */
export function splitItem(list: Keyed[], key: string, item: number, offset: number): Caret {
  const i = at(list, key), b = list[i]?.block
  if (!isList(b)) return { list, key, item, at: offset }
  const chars = parse(b.items[item] ?? ''), items = [...b.items]
  items.splice(item, 1, serialize(chars.slice(0, offset)), serialize(chars.slice(offset)))
  return { list: swap(list, i, [{ key, block: { ...b, items } }]), key, item: item + 1, at: 0 }
}

/** Enter on an empty item: the list ends there. The items before and after stay lists, a paragraph between them. */
export function endList(list: Keyed[], key: string, item: number): Caret {
  const i = at(list, key), b = list[i]?.block
  if (!isList(b)) return { list, key, at: 0 }
  const before = b.items.slice(0, item), after = b.items.slice(item + 1), p = newKey(list)
  const by: Keyed[] = [
    ...(before.length ? [{ key, block: { ...b, items: before } }] : []),
    { key: p, block: { type: 'paragraph', text: '' } },
    ...(after.length ? [{ key: before.length ? newKey([...list, { key: p, block: b }]) : key, block: { ...b, items: after } }] : []),
  ]
  return { list: swap(list, i, by), key: p, at: 0 }
}

/** Backspace at an item's start: onto the item before, or, for the first, out of the list as a paragraph. */
export function mergeItem(list: Keyed[], key: string, item: number): Caret {
  const i = at(list, key), b = list[i]?.block
  if (!isList(b)) return { list, key, at: 0 }
  if (item > 0) {
    const items = [...b.items], head = items[item - 1]
    items.splice(item - 1, 2, join(head, b.items[item]))
    return { list: swap(list, i, [{ key, block: { ...b, items } }]), key, item: item - 1, at: parse(head).length }
  }
  const rest = b.items.slice(1), p: Keyed = { key: rest.length ? newKey(list) : key, block: { type: 'paragraph', text: b.items[0] ?? '' } }
  return { list: swap(list, i, rest.length ? [p, { key, block: { ...b, items: rest } }] : [p]), key: p.key, at: 0 }
}

/** Backspace at the start of a paragraph after a list: its text joins the last item. Null when the block before is no list. */
export function joinOntoList(list: Keyed[], key: string): Caret | null {
  const i = at(list, key), b = list[i]?.block, prev = list[i - 1]
  if (i < 1 || b?.type !== 'paragraph' || !isList(prev.block)) return null
  const items = [...prev.block.items], last = items.length - 1, head = items[last] ?? ''
  items[last] = join(head, b.text)
  return { list: [...list.slice(0, i - 1), { key: prev.key, block: { ...prev.block, items } }, ...list.slice(i + 1)], key: prev.key, item: last, at: parse(head).length }
}

/** Pasted text over [from, to): one chunk goes in place; several split the block, the middle ones new paragraphs (new
    items in a list). Pasted text is plain: it takes no marks. */
export function insertChunks(list: Keyed[], key: string, item: number | undefined, from: number, to: number, chunks: string[]): Caret {
  const i = at(list, key), b = list[i]?.block
  if (!b || !chunks.length) return { list, key, item, at: from }
  const source = isList(b) ? b.items[item ?? 0] ?? '' : 'text' in b ? b.text : null
  if (source === null) return { list, key, item, at: from }
  const chars = parse(source), head = chars.slice(0, from), tail = chars.slice(to), last = chunks[chunks.length - 1]
  if (chunks.length === 1) {
    const text = serialize([...head, ...plain(last), ...tail])
    const block: Block = isList(b) ? { ...b, items: b.items.map((x, n) => (n === (item ?? 0) ? text : x)) } : { ...b, text } as Block
    return { list: swap(list, i, [{ key, block }]), key, item, at: from + last.length }
  }
  const first = serialize([...head, ...plain(chunks[0])]), end = serialize([...plain(last), ...tail]), middle = chunks.slice(1, -1)
  if (isList(b)) {
    const n = item ?? 0, items = [...b.items]
    items.splice(n, 1, first, ...middle, end)
    return { list: swap(list, i, [{ key, block: { ...b, items } }]), key, item: n + chunks.length - 1, at: last.length }
  }
  const made: Keyed[] = []
  for (const text of [...middle, end]) made.push({ key: newKey([...list, ...made]), block: { type: 'paragraph', text } })
  return { list: swap(list, i, [{ key, block: { ...b, text: first } as Block }, ...made]), key: made[made.length - 1].key, at: last.length }
}

const blank = (text: string) => plainOf(text).trim() === ''

/** Before Save: text blocks and list items with no words go; a list with no items goes. Nothing with words changes. */
export function tidy(blocks: Block[]): Block[] {
  return blocks.flatMap((b): Block[] => {
    if (b.type === 'paragraph' || b.type === 'quote' || b.type === 'heading') return blank(b.text) ? [] : [b]
    if (isList(b)) { const l = tidyList(b, blank); return l ? [l] : [] }
    return [b]
  })
}

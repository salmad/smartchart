/* Blocks in memory while editing: each carries a key that is never written to the file (the file has ids on headings
   and figures only). The ops are pure, return a new list, and work on text through markup.ts so a mark is never cut open. */
import { parse, serialize } from '../slides/markup.js'
import { textsOf } from './nest.js'
import type { Block } from './types.js'

export interface Keyed { key: string; block: Block }
export type TextTarget = 'paragraph' | 'heading2' | 'heading3' | 'bullets' | 'numbered' | 'quote'

export const keyed = (blocks: Block[]): Keyed[] => blocks.map((block, i) => ({ key: `b${i + 1}`, block }))
export const unkeyed = (list: Keyed[]): Block[] => list.map((k) => k.block)
export function newKey(list: Keyed[]): string {
  return `b${Math.max(0, ...list.map((k) => Number(k.key.slice(1)) || 0)) + 1}`
}

const at = (list: Keyed[], key: string) => list.findIndex((k) => k.key === key)
type Text = Extract<Block, { type: 'paragraph' | 'quote' | 'heading' }>
const isText = (b: Block): b is Text => b.type === 'paragraph' || b.type === 'quote' || b.type === 'heading'

/** `key` null inserts first. */
export function insertAfter(list: Keyed[], key: string | null, block: Block): { list: Keyed[]; key: string } {
  const k = newKey(list), i = key === null ? 0 : at(list, key) + 1
  return { list: [...list.slice(0, i), { key: k, block }, ...list.slice(i)], key: k }
}

export const removeBlock = (list: Keyed[], key: string): Keyed[] => list.filter((k) => k.key !== key)

export function moveBlock(list: Keyed[], key: string, to: number): Keyed[] {
  const from = at(list, key)
  if (from < 0) return list
  const rest = list.filter((k) => k.key !== key)
  return [...rest.slice(0, to), list[from], ...rest.slice(to)]
}

export const replaceBlock = (list: Keyed[], key: string, block: Block): Keyed[] => list.map((k) => (k.key === key ? { key, block } : k))

/** Splits a paragraph, quote or heading at a plain-text offset; the head stays, the tail is a new paragraph (its key is returned). */
export function splitText(list: Keyed[], key: string, offset: number): { list: Keyed[]; key: string } {
  const i = at(list, key), b = list[i]?.block
  if (!b || !isText(b)) return { list, key }
  const chars = parse(b.text), cut = Math.max(0, Math.min(offset, chars.length)), k = newKey(list)
  const tail: Block = { type: 'paragraph', text: serialize(chars.slice(cut)) }
  const next = [...list]
  next[i] = { key, block: { ...b, text: serialize(chars.slice(0, cut)) } }
  next.splice(i + 1, 0, { key: k, block: tail })
  return { list: next, key: k }
}

/** Joins a text block onto the previous text block; `at` is the caret offset in the result. Null when either is not text. */
export function mergeBack(list: Keyed[], key: string): { list: Keyed[]; key: string; at: number } | null {
  const i = at(list, key), here = list[i]?.block, prev = list[i - 1]
  if (i < 1 || !here || !isText(here) || !isText(prev.block)) return null
  const head = parse(prev.block.text), tail = parse(here.text)
  const joined: Keyed = { key: prev.key, block: { ...prev.block, text: serialize([...head, ...tail]) } }
  return { list: [...list.slice(0, i - 1), joined, ...list.slice(i + 1)], key: prev.key, at: head.length }
}

const textOf = (b: Block): string | null => (isText(b) ? b.text : b.type === 'bullets' || b.type === 'numbered' ? textsOf(b).join(' ') : null)

/** Turns a text or list block into another kind of text block. A new heading has no id until Save (giveIds); a heading kept at its level keeps it. */
export function convert(list: Keyed[], key: string, to: TextTarget): Keyed[] {
  const i = at(list, key), b = list[i]?.block, text = b ? textOf(b) : null
  if (!b || text === null) return list
  const level = to === 'heading2' ? 2 : 3
  const block: Block = to === 'paragraph' || to === 'quote' ? { type: to, text }
    : to === 'bullets' || to === 'numbered' ? { type: to, items: b.type === 'bullets' || b.type === 'numbered' ? b.items : [text] }
    : { type: 'heading', level, id: b.type === 'heading' && b.level === level ? b.id : '', text }
  return replaceBlock(list, key, block)
}

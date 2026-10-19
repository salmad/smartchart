/* What an agent can do to a doc, as pure functions: each takes a Doc and returns the new Doc, or a sentence saying why
   not (never a throw, never a partial change). Blocks are addressed by id. Headings and figures carry theirs in the file;
   any other block has a read-time id made from its words, so it is never written to the file and changes when the words do. */
import { applyPatch } from '../agent/patch.js'
import { hash } from '../versions.js'
import type { Slide, Theme } from '../types.js'
import { giveIds, parseDoc } from './parse.js'
import { serializeDoc } from './serialize.js'
import { validateDoc } from './validate.js'
import type { Block, Doc, FigureBody, FigureKind } from './types.js'

/** The new doc and the ids of the blocks the edit made or changed, or why not. */
export type Edit = { doc: Doc; ids: string[] } | string

/** Every block with its id, in doc order: the id in the file for a heading or figure, else `t_` and a hash of the block,
    numbered `-2`, `-3` when two blocks are equal. */
export function identify(doc: Doc): { id: string; block: Block }[] {
  const seen = new Map<string, number>()
  return doc.blocks.map((block) => {
    if (block.type === 'heading' || block.type === 'figure') return { id: block.id, block }
    const base = `t_${hash(JSON.stringify(block))}`, n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    return { id: n === 1 ? base : `${base}-${n}`, block }
  })
}

const GONE = (id: string) => `No block ${id} in this doc. Read the doc again (get_doc): a text block's id changes when its words do.`

/** The blocks a Markdown fragment is, or why it is not text. New headings get their ids. */
export function parseText(markdown: string): Block[] | string {
  if (!markdown.trim()) return 'markdown: write at least one block.'
  const { doc, errors } = parseDoc(`---\ntitle: x\n---\n\n${markdown}\n`)
  if (errors.length) return `markdown: ${errors[0]}`
  if (doc.blocks.some((b) => b.type === 'figure' || b.type === 'raw')) return 'markdown: a figure is not text. Add figures with create_block and its figure field.'
  return doc.blocks
}

const indexOf = (doc: Doc, id: string) => identify(doc).findIndex((x) => x.id === id)
const slot = (doc: Doc, after: string): number | string => {
  if (after === 'start') return 0
  if (after === 'end') return doc.blocks.length
  const i = indexOf(doc, after)
  return i < 0 ? GONE(after) : i + 1
}

/** Accepts the new doc unless it adds an error the old one did not have, or would not survive saving as written. */
function accept(before: Doc, next: Doc, ids: (d: Doc) => string[]): Edit {
  let fresh: string | undefined
  try {
    const was = new Set(validateDoc(before).errors)
    fresh = validateDoc(next).errors.find((e) => !was.has(e))
  } catch {
    // A value of the wrong type can stop the schema check itself: the write is refused, not thrown.
    return 'A figure now holds a value of the wrong type for its fields. Check each value against get_template.'
  }
  if (fresh) return fresh
  if (JSON.stringify(parseDoc(serializeDoc(next)).doc) !== JSON.stringify(next)) return 'That text would not survive being saved as written; rewrite it.'
  return { doc: next, ids: ids(next) }
}
const idsAt = (from: number, n: number) => (d: Doc) => identify(d).slice(from, from + n).map((x) => x.id)

export function writeText(doc: Doc, blockId: string, markdown: string): Edit {
  const i = indexOf(doc, blockId)
  if (i < 0) return GONE(blockId)
  if (doc.blocks[i].type === 'figure') return `${blockId} is a figure. Change it with update_block.`
  const blocks = parseText(markdown)
  if (typeof blocks === 'string') return blocks
  return accept(doc, { ...doc, blocks: giveIds([...doc.blocks.slice(0, i), ...blocks, ...doc.blocks.slice(i + 1)]) }, idsAt(i, blocks.length))
}

export function createText(doc: Doc, after: string, markdown: string): Edit {
  const at = slot(doc, after), blocks = parseText(markdown)
  if (typeof at === 'string') return at
  if (typeof blocks === 'string') return blocks
  return accept(doc, { ...doc, blocks: giveIds([...doc.blocks.slice(0, at), ...blocks, ...doc.blocks.slice(at)]) }, idsAt(at, blocks.length))
}

export function createFigure(doc: Doc, after: string, kind: FigureKind, body: FigureBody, id?: string): Edit {
  const at = slot(doc, after)
  if (typeof at === 'string') return at
  const block: Block = { type: 'figure', kind, id: id ?? '', body }
  return accept(doc, { ...doc, blocks: giveIds([...doc.blocks.slice(0, at), block, ...doc.blocks.slice(at)]) }, idsAt(at, 1))
}

export function updateFigure(doc: Doc, blockId: string, set: Record<string, unknown>): Edit {
  const i = indexOf(doc, blockId), b = doc.blocks[i]
  if (i < 0) return GONE(blockId)
  if (b.type !== 'figure') return `${blockId} is text. Change it with write_doc_text.`
  const p = applyPatch(b.body as Slide, set)
  if (p.errors) return p.errors.join(' | ')
  const blocks = doc.blocks.map((x, j) => (j === i ? { ...b, body: p.slide as FigureBody } : x))
  return accept(doc, { ...doc, blocks }, () => [blockId])
}

export function moveBlock(doc: Doc, blockId: string, after: string): Edit {
  const i = indexOf(doc, blockId)
  if (i < 0) return GONE(blockId)
  if (after === blockId) return 'after: a block cannot go after itself.'
  const rest = { ...doc, blocks: doc.blocks.filter((_, j) => j !== i) }, at = after === 'start' ? 0 : after === 'end' ? rest.blocks.length : indexOf(rest, after) + 1
  if (after !== 'start' && after !== 'end' && at === 0) return GONE(after)
  const blocks = [...rest.blocks.slice(0, at), doc.blocks[i], ...rest.blocks.slice(at)]
  return accept(doc, { ...doc, blocks }, idsAt(at, 1))
}

export function deleteBlock(doc: Doc, blockId: string): Edit {
  const i = indexOf(doc, blockId)
  if (i < 0) return GONE(blockId)
  return accept(doc, { ...doc, blocks: doc.blocks.filter((_, j) => j !== i) }, () => [])
}

export function setLook(doc: Doc, look: { title?: string; subtitle?: string | null; theme?: Theme; accent?: string | null }): Edit {
  const next: Doc = { ...doc }
  if (look.title !== undefined) next.title = look.title.trim()
  if (look.subtitle !== undefined) { if (look.subtitle === null || !look.subtitle.trim()) delete next.subtitle; else next.subtitle = look.subtitle.trim() }
  if (look.theme) next.theme = look.theme
  if (look.accent !== undefined) { if (look.accent === null) delete next.accent; else next.accent = look.accent }
  return accept(doc, next, () => [])
}

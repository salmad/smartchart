/* What an agent can do to a doc, as pure functions: each takes a Doc and returns the new Doc, or a sentence saying why
   not (never a throw, never a partial change). Blocks are addressed by id. Headings and figures carry theirs in the file;
   any other block has a read-time id made from its words, so it is never written to the file and changes when the words do. */
import { applyPatch } from '../agent/patch.js'
import { plain } from '../slides/schema.js'
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

export const ROUND_TRIP = 'That text would not survive being saved as written; rewrite it.'
const TYPE_ERR = 'A figure now holds a value of the wrong type for its fields. Check each value against get_template.'

/** Fields the doc file does not store (look lives on the workspace). */
const fileDoc = (d: Doc): Doc => {
  const { theme: _t, accent: _a, ...rest } = d
  return rest
}

const stable = (v: unknown): string => {
  if (v === null || typeof v !== 'object') return JSON.stringify(v)
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`
  return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(',')}}`
}

const blockEqual = (a: Block, b: Block): boolean => {
  if (a.type !== b.type) return false
  if (a.type === 'figure' && b.type === 'figure') return a.kind === b.kind && a.id === b.id && stable(a.body) === stable(b.body)
  return stable(a) === stable(b)
}

const docEqual = (a: Doc, b: Doc): boolean =>
  a.title === b.title && a.subtitle === b.subtitle && a.blocks.length === b.blocks.length && a.blocks.every((x, i) => blockEqual(x, b.blocks[i]!))

const blockHint = (b: Block): string => {
  if (b.type === 'heading') return `the section “${plain(b.text).slice(0, 60)}”`
  if (b.type === 'figure') return `figure #${b.id || b.kind}`
  if (b.type === 'paragraph') return `the paragraph starting “${plain(b.text).slice(0, 60)}”`
  if (b.type === 'bullets' || b.type === 'numbered') return `a list starting “${plain(b.items[0] ?? '').slice(0, 60)}”`
  if (b.type === 'quote') return `the quote “${plain(b.text).slice(0, 60)}”`
  return 'a block near where you edited'
}

/** When save-as-written would change the doc, a sentence that names where to look (agents refuse; people see it as a warning). */
export function roundTripHint(want: Doc, got: Doc): string {
  if (want.title !== got.title) {
    return 'The title would save differently. If you meant plain text, avoid **bold**, [[focus]], [-red-], or [text](links) in the title unless you use the editor’s formatting.'
  }
  if (want.blocks.length !== got.blocks.length) {
    return got.blocks.length < want.blocks.length
      ? 'Save would drop one or more blocks. A line that starts with #, -, a number., >, ---, or ``` is treated as structure—put a blank line before it, or start the line with \\, to keep it as text.'
      : 'Save would split what you wrote into extra blocks. Try merging lines into one paragraph or simplifying nested lists where you edited.'
  }
  for (let i = 0; i < want.blocks.length; i++) {
    if (!blockEqual(want.blocks[i]!, got.blocks[i]!)) {
      return `${blockHint(want.blocks[i]!)} would not round-trip. Lines that look like Markdown (headings, lists, quotes) need a blank line above them or a \\ at the start when you meant plain text.`
    }
  }
  return ROUND_TRIP
}

/** Whether the doc would change on write; null when the file would round-trip. */
export function hardSaveRefusal(next: Doc): string | null {
  try {
    const want = fileDoc(next)
    const got = fileDoc(parseDoc(serializeDoc(want)).doc)
    if (docEqual(want, got)) return null
    return roundTripHint(want, got)
  } catch {
    return TYPE_ERR
  }
}

/** Every new schema error, and (when there are none) a round-trip sentence for agents. */
export function freshValidationErrors(before: Doc, next: Doc): string[] {
  try {
    const was = new Set(validateDoc(before).errors)
    return validateDoc(next).errors.filter((e) => !was.has(e))
  } catch {
    return [TYPE_ERR]
  }
}

/** Every reason the new doc must not be written that the old one did not already have. The agent refuses; people may still Save. */
export function freshErrors(before: Doc, next: Doc): string[] {
  const out = freshValidationErrors(before, next)
  if (!out.length) {
    const hard = hardSaveRefusal(next)
    if (hard) out.push(hard)
  }
  return out
}

/** Why the new doc must not be written, or null. */
export function refusal(before: Doc, next: Doc): string | null {
  return freshErrors(before, next)[0] ?? null
}

/** Accepts the new doc unless the gate refuses it. */
function accept(before: Doc, next: Doc, ids: (d: Doc) => string[]): Edit {
  return refusal(before, next) ?? { doc: next, ids: ids(next) }
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
  const { theme: _rt, accent: _ra, ...base } = doc
  const next: Doc = { ...base }
  if (look.title !== undefined) next.title = look.title.trim()
  if (look.subtitle !== undefined) { if (look.subtitle === null || !look.subtitle.trim()) delete next.subtitle; else next.subtitle = look.subtitle.trim() }
  return accept(doc, next, () => [])
}

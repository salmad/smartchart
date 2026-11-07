/* Proposals: validate content-preserving edits, then apply them through the same ops as agents. */
import { numbersIn } from '../agent/checks.js'
import { plain } from '../slides/schema.js'
import { ToolError } from '../tools/types.js'
import { createFigure, createText, identify, parseText } from './ops.js'
import { giveIds } from './parse.js'
import { validateDoc } from './validate.js'
import type { Block, Doc, FigureBody, FigureKind } from './types.js'

export const MAX_DOC_PROPOSALS = 20

export type ProposalMode = 'replace' | 'insert'
export type ProposalOp = { add: DocProposal } | { dismiss: string }
export interface DocProposal {
  id: string
  blockIds: string[]
  mode: ProposalMode
  figure?: { kind: FigureKind; body: FigureBody }
  markdown?: string
  label: string
  why: string
  by: string
  at: number
  rev: number
}

export interface Keeps { keeps: 'all' | 'facts' | 'drops'; dropped: string[] }

const STOP = new Set(['a', 'an', 'the', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'of', 'per', 'is', 'was', 'are', 'be', 'as', 'it', 'its'])
const WORD = /\b[a-z0-9']+\b/gi
const QUOTE = /"([^"]+)"/g
const NAME = /\b[A-Z][a-z]{2,}\b/g

const wordsOf = (text: string) => plain(text).toLowerCase().match(WORD)?.filter((w) => !STOP.has(w)) ?? []

const factsOf = (text: string) => {
  const nums = numbersIn(plain(text)).map(String)
  const quotes = [...plain(text).matchAll(QUOTE)].map((m) => m[1])
  const names = [...plain(text).matchAll(NAME)].map((m) => m[0])
  return [...nums, ...quotes, ...names]
}

const bodyText = (p: Pick<DocProposal, 'figure' | 'markdown'>) =>
  p.markdown ?? (p.figure ? JSON.stringify(p.figure.body) : '')

export function keepCheck(original: string, proposal: Pick<DocProposal, 'figure' | 'markdown'>): Keeps {
  const origWords = wordsOf(original), nextWords = new Set(wordsOf(bodyText(proposal)))
  if (origWords.every((w) => nextWords.has(w))) return { keeps: 'all', dropped: [] }
  const origFacts = factsOf(original), nextPlain = plain(bodyText(proposal))
  const missing = origFacts.filter((f) => f.length > 1 && !nextPlain.includes(f))
  if (!missing.length) return { keeps: 'facts', dropped: [] }
  return { keeps: 'drops', dropped: missing }
}

const blockText = (b: Block | undefined): string => {
  if (!b) return ''
  switch (b.type) {
    case 'paragraph': case 'quote': case 'heading': return b.text
    case 'bullets': case 'numbered': return b.items.join('\n')
    case 'figure': return plain(String(b.body.caption ?? ''))
    default: return ''
  }
}

const originalOf = (doc: Doc, blockIds: string[]) => {
  const byId = new Map(identify(doc).map((x) => [x.id, x.block]))
  return blockIds.map((id) => blockText(byId.get(id))).filter(Boolean).join('\n\n')
}

const adjacent = (doc: Doc, blockIds: string[]): number[] | null => {
  const idents = identify(doc)
  const is = blockIds.map((id) => idents.findIndex((x) => x.id === id))
  if (is.some((i) => i < 0)) return null
  for (let k = 1; k < is.length; k++) if (is[k] !== is[k - 1]! + 1) return null
  return is
}

export function checkProposal(doc: Doc, p: DocProposal): { ok: true; keeps: Keeps; mode: ProposalMode } | { ok: false; error: string } {
  if (p.label.length > 40) return { ok: false, error: 'label: at most 40 characters.' }
  if (p.why.length > 160) return { ok: false, error: 'why: at most 160 characters.' }
  if (!!p.figure === !!p.markdown) return { ok: false, error: 'Give exactly one of figure or markdown.' }
  const is = adjacent(doc, p.blockIds)
  if (!is) return { ok: false, error: 'blockIds must name adjacent blocks that exist.' }
  const original = originalOf(doc, p.blockIds)
  const keeps = keepCheck(original, p)
  if (p.markdown && keeps.keeps !== 'all') return { ok: false, error: 'A text suggestion keeps every word.' }
  let mode = p.mode
  if (p.figure && p.mode === 'replace' && keeps.keeps === 'drops') mode = 'insert'
  const probe = { title: 'x', blocks: [] as Block[] }
  const trial = p.figure
    ? createFigure(probe, 'start', p.figure.kind, p.figure.body)
    : createText(probe, 'start', p.markdown ?? '')
  if (typeof trial === 'string') return { ok: false, error: trial }
  const errs = validateDoc(trial.doc).errors
  if (errs.length) return { ok: false, error: errs[0] }
  if (p.markdown && typeof parseText(p.markdown) === 'string') return { ok: false, error: 'markdown did not parse.' }
  return { ok: true, keeps, mode }
}

export function applyProposal(doc: Doc, p: DocProposal): Doc {
  const checked = checkProposal(doc, p)
  if (!checked.ok) throw new ToolError('bad_input', checked.error, 'Fix the proposal and try again.')
  const is = adjacent(doc, p.blockIds)
  if (!is) throw new ToolError('not_found', 'No such block.', 'get_doc shows the blocks.')
  const start = is[0]!, end = is[is.length - 1]!
  const inserted: Block[] = p.figure
    ? [{ type: 'figure', kind: p.figure.kind, id: '', body: p.figure.body }]
    : (parseText(p.markdown ?? '') as Block[])
  const blocks = checked.mode === 'insert'
    ? [...doc.blocks.slice(0, start), ...inserted, ...doc.blocks.slice(start)]
    : [...doc.blocks.slice(0, start), ...inserted, ...doc.blocks.slice(end + 1)]
  const next = { ...doc, blocks: giveIds(blocks) }
  const errs = validateDoc(next).errors
  if (errs.length) throw new ToolError('bad_input', errs[0], 'Fix the proposal and try again.')
  return next
}

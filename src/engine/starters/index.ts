/* The starters: the one approved gallery, slides and docs. The landing, Add slide, the agent's worked examples, the
   review pages and the tests all read this file; there is no other example set. */
import { validateDeck } from '../slides/schema.js'
import type { Slide, Style } from '../types.js'
import data from './starters.json' with { type: 'json' }
import { parseDoc } from '../docs/parse.js'
import { validateDoc } from '../docs/validate.js'
import type { Doc, FigureBody, FigureKind } from '../docs/types.js'
import { FIGURE_KINDS } from '../docs/types.js'

/** Starters are grouped by what the slide has to do for the person making it, not by what it is drawn with. */
export type Group = 'trend' | 'change' | 'compare' | 'number' | 'case' | 'plan' | 'open'
/** Deck order: the title and chapter slides open a deck, so they come first everywhere starters are listed. */
export const GROUPS: readonly { id: Group; label: string }[] = [
  { id: 'open', label: 'Open the deck' }, { id: 'trend', label: 'Show a trend' }, { id: 'change', label: 'Explain a change' }, { id: 'compare', label: 'Compare options' },
  { id: 'number', label: 'Land one number' }, { id: 'case', label: 'Make the case' }, { id: 'plan', label: 'Lay out a plan' },
]
export interface Starter { id: string; group: Group; label: string; blurb: string; consulting: Slide; pitch: Slide }
export const FOOTER = 'Occam'

// JSON has no literal types: the schema check below is what makes these Slides.
export const STARTERS: readonly Starter[] = data.slides as unknown as Starter[]
for (const style of ['consulting', 'pitch'] as const) {
  const { errors } = validateDeck({ style, slides: STARTERS.map((s) => s[style]) })
  if (errors.length) throw new Error(`starters.json (${style}): ${errors.join('; ')}`)
}
for (const s of STARTERS) if (!GROUPS.some((g) => g.id === s.group)) throw new Error(`starters.json: ${s.id} has unknown group ${s.group}`)

/** A deep copy of the starter in one style, safe to put in a deck. */
export function starterSlide(s: Starter, style: Style): Slide {
  return structuredClone(s[style])
}

/** A doc starter: its Markdown as lines, so the file reads as the doc does. */
export interface DocStarter { id: string; label: string; blurb: string; markdown: string[] }
export const DOC_STARTERS: readonly DocStarter[] = data.docs
/** The starter as a fresh Doc, safe to edit. */
export const starterDoc = (s: DocStarter): Doc => parseDoc(s.markdown.join('\n')).doc
for (const s of DOC_STARTERS) {
  const { doc, errors } = parseDoc(s.markdown.join('\n')), all = [...errors, ...validateDoc(doc).errors]
  if (all.length) throw new Error(`starters.json (doc ${s.id}): ${all.join('; ')}`)
}

/** A figure starter: what the slash menu inserts. The body is the figure's JSON, as in a doc file. */
export interface BlockStarter { id: string; kind: FigureKind; label: string; blurb: string; body: FigureBody }
export const BLOCK_STARTERS: readonly BlockStarter[] = data.blocks as unknown as BlockStarter[]
for (const s of BLOCK_STARTERS) {
  const errors = FIGURE_KINDS.includes(s.kind) ? validateDoc({ title: 'x', blocks: [{ type: 'figure', kind: s.kind, id: 'f', body: s.body }] }).errors : [`unknown kind ${s.kind}`]
  if (errors.length) throw new Error(`starters.json (block ${s.id}): ${errors.join('; ')}`)
}

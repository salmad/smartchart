/* The slash menu's choices and what each does to the paragraph it was typed in. Text kinds turn the paragraph into that
   kind; a divider or a figure takes its place (a figure from the figure starters, the one gallery). Code is left out:
   its block draws on a canvas and has no editor yet. */
import { ChartBarBig, ChartColumn, ChartGantt, ChartNoAxesGantt, ChartScatter, ChartLine, Columns2, Hash, Heading2, Heading3, LayoutGrid, List, ListChecks, ListOrdered, Milestone, Minus, Quote, StickyNote, Table2, type LucideIcon } from 'lucide-react'
import { insertAfter, replaceBlock, type Keyed } from '@/engine/docs/blocks'
import { BLOCK_STARTERS } from '@/engine/starters'
import type { Block, FigureKind } from '@/engine/docs/types'
import type { Where } from './editor/structure'

export interface SlashChoice { id: string; group: 'Text' | 'Figures'; label: string; blurb: string; icon: LucideIcon; block: () => Block
  /** What else it is found by: a figure's kind (every chart form answers to "chart"). */
  also?: string }

/** Icons by kind; a chart starter that draws differently has its own, by id. */
const BY_ID: Record<string, LucideIcon> = { 'line-chart': ChartLine, 'horizontal-bars': ChartBarBig, waterfall: ChartNoAxesGantt, timeline: ChartGantt, matrix: ChartScatter }
const ICONS: Partial<Record<FigureKind, LucideIcon>> = { chart: ChartColumn, table: Table2, number: Hash, cards: LayoutGrid, steps: Milestone, summary: ListChecks, pair: Columns2, callout: StickyNote }
const figure = (id: string): (() => Block) => () => {
  const s = BLOCK_STARTERS.find((x) => x.id === id)
  return s ? { type: 'figure', kind: s.kind, id: '', body: structuredClone(s.body) } : { type: 'paragraph', text: '' }
}
const callout = BLOCK_STARTERS.find((s) => s.kind === 'callout')

export const CHOICES: readonly SlashChoice[] = [
  { id: 'heading2', group: 'Text', label: 'Heading', blurb: 'A section, listed in the contents', icon: Heading2, block: () => ({ type: 'heading', level: 2, id: '', text: '' }) },
  { id: 'heading3', group: 'Text', label: 'Subheading', blurb: 'A part of a section', icon: Heading3, block: () => ({ type: 'heading', level: 3, id: '', text: '' }) },
  { id: 'bullets', group: 'Text', label: 'Bullets', blurb: 'A list in no order', icon: List, block: () => ({ type: 'bullets', items: [''] }) },
  { id: 'numbered', group: 'Text', label: 'Numbered list', blurb: 'A list in order', icon: ListOrdered, block: () => ({ type: 'numbered', items: [''] }) },
  { id: 'quote', group: 'Text', label: 'Quote', blurb: 'Words set apart, in someone’s voice', icon: Quote, block: () => ({ type: 'quote', text: '' }) },
  { id: 'divider', group: 'Text', label: 'Divider', blurb: 'A line between two parts', icon: Minus, block: () => ({ type: 'divider' }) },
  ...(callout ? [{ id: callout.id, group: 'Text' as const, label: callout.label, blurb: callout.blurb, icon: StickyNote, block: figure(callout.id) }] : []),
  ...BLOCK_STARTERS.filter((s) => s.kind !== 'callout').map((s) => ({ id: s.id, group: 'Figures' as const, label: s.label, blurb: s.blurb, also: s.kind, icon: BY_ID[s.id] ?? ICONS[s.kind] ?? LayoutGrid, block: figure(s.id) })),
]

/** The choices whose name (or id) has a word starting with the query; all of them for an empty query. */
export function matching(query: string): SlashChoice[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...CHOICES]
  return CHOICES.filter((c) => [c.label, c.id, c.also ?? ''].some((s) => s.toLowerCase().split(/[\s-]+/).some((w) => w.startsWith(q)) || s.toLowerCase().startsWith(q)))
}

/** The paragraph `key` becomes the choice. Text gets the cursor; a figure is selected, with a paragraph after it when it ends the doc. */
export function pick(list: Keyed[], key: string, c: SlashChoice): { list: Keyed[]; focus: Where } {
  const block = c.block(), next = replaceBlock(list, key, block), last = next[next.length - 1]?.key === key
  if (block.type === 'bullets' || block.type === 'numbered') return { list: next, focus: { key, item: 0, at: 0 } }
  if (block.type === 'heading' || block.type === 'quote' || block.type === 'paragraph') return { list: next, focus: { key, at: 0 } }
  if (block.type === 'divider') { const r = insertAfter(next, key, { type: 'paragraph', text: '' }); return { list: r.list, focus: { key: r.key, at: 0 } } }
  return { list: last ? insertAfter(next, key, { type: 'paragraph', text: '' }).list : next, focus: { key, select: true } }
}

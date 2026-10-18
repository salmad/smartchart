/* A doc: front matter, then blocks. Text blocks are Markdown; a figure is a shared component whose body is the slide
   schema's JSON (no title, subtitle, kicker or talk), plus its furniture (caption, notes, source, footnote, takeaway). */
import type { Callout, Slide, Theme } from '../types.js'

export const FIGURE_KINDS = ['chart', 'table', 'number', 'cards', 'steps', 'summary', 'pair', 'image', 'team', 'logos', 'callout'] as const
export type FigureKind = (typeof FIGURE_KINDS)[number]
export type FigureBody = Omit<Partial<Slide>, 'template' | 'title' | 'subtitle' | 'kicker' | 'talk'> & Partial<Callout>

export type Block =
  | { type: 'heading'; level: 2 | 3; id: string; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'bullets' | 'numbered'; items: string[] }
  | { type: 'quote'; text: string }
  | { type: 'divider' }
  | { type: 'code'; lang: string; text: string }
  | { type: 'figure'; kind: FigureKind; id: string; body: FigureBody }
  /** A component block that did not parse: kept verbatim, so a typo never loses content. */
  | { type: 'raw'; text: string }
export type FigureBlock = Extract<Block, { type: 'figure' }>
export type CodeBlock = Extract<Block, { type: 'code' }>

export interface Doc { title: string; subtitle?: string; theme?: Theme; accent?: string; blocks: Block[] }
/** `errors` read "line 12: …", counting from the file's first line. */
export interface Parsed { doc: Doc; errors: string[] }

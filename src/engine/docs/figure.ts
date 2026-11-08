/* A doc figure: a shared component on a canvas at half size (DOC_SCALE), as wide as its frame allows, laid out by the
   slide's own fitters (mount.ts). With notes, the canvas holds the slide's own split; on a narrow frame the notes leave
   the canvas and follow it as a list in the doc's text. Paths inside are the body's own ("table.rows[0]…"); the block
   is named by data-block. */
import type { Callout, Slide, Theme } from '../types.js'
import { MENU } from '../slides/schema.js'
import { at, capHTML, md } from '../components/text.js'
import { tableHTML } from '../components/table.js'
import { cardsHTML } from '../components/cards.js'
import { splitHTML } from '../components/notes.js'
import { stepsHTML, summaryHTML } from '../components/rows.js'
import { pairHTML } from '../components/pair.js'
import { imgHTML, teamHTML, wallHTML } from '../components/pictures.js'
import { numberHTML } from '../components/number.js'
import { calloutHTML } from '../components/callout.js'
import { codeHTML } from '../components/code.js'
import type { CodeBlock, FigureBlock, FigureKind } from './types.js'

/** One scale for every figure: its words keep the doc's sizes (components.css, "Doc figures") at any width, and the canvas
    takes whatever width that gives its frame, so a table wraps rather than shrinks. */
export const DOC_SCALE = 0.5
export const isText = (kind: string): boolean => kind === 'callout' || kind === 'code'
/** The narrowest canvas a slide's layout holds together in (a pair, three summary columns, a five-column table). Under a
    frame of MIN_CANVAS × DOC_SCALE (600px: a phone) the canvas stops narrowing and shrinks instead, and the figure expands. */
export const MIN_CANVAS = 1200
/** The canvas's design width for a frame; words (a callout, code) always reflow at the doc's size. */
export const widthOf = (kind: string, frame: number): number => (isText(kind) ? frame / DOC_SCALE : Math.max(MIN_CANVAS, frame / DOC_SCALE))
/** The extra split class per kind, as the slide body sets it. */
const SPLIT: Partial<Record<FigureKind, string>> = { chart: 'grow', table: 'with-table', image: 'grow with-pic', pair: 'grow' }

/** The figure as the slide it would be (no head): what the variants, the colour allocator and the charts read. */
export function asSlide(f: FigureBlock): Slide | null {
  return f.kind === 'callout' ? null : ({ ...f.body, template: f.kind, title: '' } as Slide)
}

function component(f: FigureBlock): string {
  const b = f.body, s = asSlide(f)
  switch (f.kind) {
    case 'chart': return '<div class="chart full grow" data-chart></div>'
    case 'table': { const t = b.table ?? { columns: [], rows: [] }; return tableHTML(t, 'table', true, 'full', true) }
    case 'number': return numberHTML(b.number ?? { value: '', caption: '' }, '', true)
    case 'cards': return cardsHTML(b.cards ?? [], s ? MENU.cards.variant(s) : 'icon', b.arrange, '')
    case 'steps': return stepsHTML(b.steps ?? [], '')
    case 'summary': return summaryHTML(b.points ?? [], '')
    case 'pair': return pairHTML(b.halves ?? [], '')
    case 'image': return imgHTML(b.image, 'pic grow', 'image')
    case 'team': return teamHTML(b.people ?? [], s ? MENU.team.variant(s) : 'row', '')
    case 'logos': return wallHTML(b.logos ?? [], '')
    case 'callout': return calloutHTML(b as Callout, '')
  }
}

/** The canvas's contents: with `beside` and notes, the slide's split; otherwise the caption, then the component. */
export function figureCanvasHTML(f: FigureBlock, beside: boolean): string {
  const b = f.body, main = component(f)
  if (beside && b.notes?.length) return splitHTML(b, main, SPLIT[f.kind] ?? '', '')
  return `${b.caption ? capHTML(b.caption, '', 'caption') : ''}${main}`
}

export const canvas = (kind: string, theme: Theme, inner: string): string => `<div class="fig-frame"><div class="fig style-consulting theme-${theme} k-${kind}">${inner}</div></div>`

/** `after` is more furniture for the foot of the figure (the checks badge). */
export function figureHTML(f: FigureBlock, theme: Theme, beside = true, after = ''): string {
  const b = f.body
  const notes = b.notes?.length ? `<ol class="fig-notes">${b.notes.map((n) => `<li><span><b>${md(n.title)}</b>${n.text ? ` ${md(n.text)}` : ''}</span></li>`).join('')}</ol>` : ''
  const take = b.takeaway ? `<p class="fig-take"${at('takeaway', 'md')}>${md(b.takeaway)}</p>` : ''
  const src = [b.footnote && `<span${at('footnote', 'md')}>${md(b.footnote)}</span>`, b.source && `<span>Source: <span${at('source', 'md')}>${md(b.source)}</span></span>`].filter(Boolean).join(' ')
  return `<figure class="doc-fig" id="${f.id}" data-block="${f.id}" data-kind="${f.kind}">${canvas(f.kind, theme, figureCanvasHTML(f, beside))}${notes}${take}${src ? `<p class="fig-src">${src}</p>` : ''}${after}</figure>`
}

/** Code is a figure without an id: the shared code component on a canvas. */
export const codeFigureHTML = (c: CodeBlock, theme: Theme): string => `<figure class="doc-fig doc-code" data-kind="code">${canvas('code', theme, codeHTML(c.text, c.lang))}</figure>`

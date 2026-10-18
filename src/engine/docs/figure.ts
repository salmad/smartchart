/* A doc figure: a shared component on a canvas as wide as a slide's body, so it lays out exactly as on a slide, then
   scaled to its frame (mount.ts). With notes, the canvas holds the slide's own split; on a narrow frame the notes leave
   the canvas and follow it as a list in the doc's text. Paths inside are the body's own ("table.rows[0]…"); the block
   is named by data-block. */
import type { Callout, Slide, Theme } from '../types.js'
import { MENU } from '../slides/schema.js'
import { roomOf } from '../slides/groups.js'
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

/** The slide body's width (1920 − 2 × 128): a figure is laid out as it would be on a slide. */
export const FIG_WIDTH = 1664
/** A callout or code sits in the text column, so its canvas is narrower: at full width both scale alike (720 / 1152 =
    1040 / 1664), and their words read at a figure's size. */
export const TEXT_WIDTH = 1152
export const widthOf = (kind: string): number => (kind === 'callout' || kind === 'code' ? TEXT_WIDTH : FIG_WIDTH)
/** Design heights for the kinds that fill a box (a slide body gives a chart about 640px); the rest take their content's. */
export const FIXED_HEIGHT: Partial<Record<FigureKind, number>> = { chart: 640, pair: 640, image: 640 }
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
    case 'table': { const t = b.table ?? { columns: [], rows: [] }; return tableHTML(t, 'table', true, roomOf(t, false)) }
    case 'number': return numberHTML(b.number ?? { value: '', caption: '' }, '')
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

export function figureHTML(f: FigureBlock, theme: Theme, beside = true): string {
  const b = f.body
  const notes = b.notes?.length ? `<ol class="fig-notes">${b.notes.map((n) => `<li><b>${md(n.title)}</b>${n.text ? ` ${md(n.text)}` : ''}</li>`).join('')}</ol>` : ''
  const take = b.takeaway ? `<p class="fig-take"${at('takeaway', 'md')}>${md(b.takeaway)}</p>` : ''
  const src = [b.footnote && `<span${at('footnote', 'md')}>${md(b.footnote)}</span>`, b.source && `<span>Source: <span${at('source', 'md')}>${md(b.source)}</span></span>`].filter(Boolean).join(' ')
  return `<figure class="doc-fig" id="${f.id}" data-block="${f.id}" data-kind="${f.kind}">${canvas(f.kind, theme, figureCanvasHTML(f, beside))}${notes}${take}${src ? `<p class="fig-src">${src}</p>` : ''}</figure>`
}

/** Code is a figure without an id: the shared code component on a canvas. */
export const codeFigureHTML = (c: CodeBlock, theme: Theme): string => `<figure class="doc-fig doc-code" data-kind="code">${canvas('code', theme, codeHTML(c.text, c.lang))}</figure>`

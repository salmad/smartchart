export type Style = 'consulting' | 'pitch'
export type Theme = 'ink' | 'paper'
export type TemplateId = 'chart' | 'pair' | 'table' | 'number' | 'quote' | 'steps' | 'cards' | 'summary' | 'cover' | 'section'
export type Tone = 'neutral' | 'focus' | 'neg' | 'pos'
export type SeriesColor = 'focus' | 'neutral' | 'contrast'

export interface Series { name: string; values: number[]; mark: 'bar' | 'line' | 'auto'; color?: SeriesColor; format?: string; area?: boolean; dashed?: boolean }
export interface Annotation { type: 'cagr' | 'difference' | 'target'; from?: number; to?: number; series?: number; relative?: boolean; value?: number; label?: string }
export interface WaterfallItem { label: string; value?: number; total?: boolean; focus?: boolean; tone?: 'neg' | 'pos' }
export interface TimelineRow { label: string; start?: number; end?: number; level?: 0 | 1; focus?: boolean }
export interface Milestone { label: string; at: number }
export interface RankItem { label: string; value: number; focus?: boolean }
export interface MatrixPoint { label: string; x: number; y: number; focus?: boolean }
export interface Chart {
  kind?: 'bars' | 'waterfall' | 'timeline' | 'ranked' | 'matrix'
  stacking?: 'none' | 'stacked' | 'percent' | 'auto'
  categories?: string[]; format?: string; series?: Series[]; annotations?: Annotation[]
  items?: WaterfallItem[]
  periods?: string[]; rows?: TimelineRow[]; milestones?: Milestone[]
  ranking?: RankItem[]
  axes?: { x: string; y: string }; quadrants?: string[]; points?: MatrixPoint[]
}
export interface Note { title: string; text?: string; point?: { series: number; index: number } }
export type Cell = string | { value?: string; note?: string; bullets?: string[]; status?: boolean }
export interface Table { columns: { label?: string; icon?: string; focus?: boolean; muted?: boolean; bold?: boolean; italic?: boolean }[]; rows: { cells: Cell[]; style?: 'muted' | 'total' | 'group'; focus?: boolean }[] }
export interface Card { icon?: string; value?: string; label?: string; title: string; bullets?: string[]; text?: string; tone?: Tone; facts?: { label: string; text: string }[] }
export interface Step { when: string; title: string; text: string; focus?: boolean }
export interface Point { title: string; text: string }
/** One half of a pair: a caption and exactly one body (a chart with optional bullets, a table, a number or points). */
export interface Half { caption?: string; chart?: Chart; bullets?: string[]; table?: Table; number?: { value: string; caption: string; tone?: Tone }; points?: string[] }

export interface Slide {
  template: TemplateId
  title: string
  subtitle?: string; kicker?: string; takeaway?: string; footnote?: string; source?: string
  focus?: 'auto'
  chart?: Chart; notes?: Note[]
  table?: Table; caption?: string; notesTitle?: string
  number?: { value: string; caption: string; tone?: Tone }
  quote?: string; who?: string
  steps?: Step[]
  framed?: boolean; cards?: Card[]
  points?: Point[]
  halves?: Half[]
}

export interface Deck { style: Style; theme: Theme; accent?: string | null; footer: string; slides: Slide[] }
export interface SlideContext { page: number; section: number; kicker: string; footer: string }
export interface Validation { errors: string[]; warnings: string[] }

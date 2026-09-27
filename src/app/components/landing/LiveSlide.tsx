import { contexts } from '@/engine/slides/render'
import { STARTERS, starterSlide } from '@/engine/starters'
import type { Style, Theme } from '@/engine/types'
import { cn } from '@/app/lib/utils'
import { SlideView } from '../SlideView'

interface Props { id: string; deckStyle?: Style; theme?: Theme; className?: string }

/** A starter from starters.json, drawn live by the engine: the site shows only real slides. */
export function LiveSlide({ id, deckStyle: style = 'consulting', theme = 'ink', className }: Props) {
  const starter = STARTERS.find((s) => s.id === id)
  if (!starter) throw new Error(`no starter ${id}`)
  const slide = starterSlide(starter, style)
  const ctx = contexts({ footer: 'Acme', slides: [slide] })[0]
  return <SlideView slide={slide} deck={{ style, theme, accent: null }} ctx={{ ...ctx, section: Math.max(ctx.section, 1) }}
    className={cn('relative aspect-video w-full overflow-hidden', className)} />
}

/** One starter per template, in menu order (distinct from the slides shown elsewhere on the page). Big number is
    left out while its starter is archived, until it gets its own layout. */
export const MENU: { id: string; name: string }[] = [
  { id: 'chart-lines', name: 'Chart' }, { id: 'table-notes', name: 'Table' },
  { id: 'steps', name: 'Steps' }, { id: 'cards-icon', name: 'Cards' }, { id: 'cover', name: 'Cover' }, { id: 'section', name: 'Section' },
]

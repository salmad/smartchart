import { contexts } from '@/engine/slides/render'
import { starterSlide, type Starter } from '@/engine/starters'
import type { Style, Theme } from '@/engine/types'
import { cn } from '@/app/lib/utils'
import { SlideView } from './SlideView'

interface Props { starter: Starter; deckStyle: Style; theme: Theme; accent: string | null; onPick: (s: Starter) => void; size?: 'grid' | 'film'; selected?: boolean }

/** A starter as a live slide with its label and blurb; the whole tile is the button. */
export function Tile({ starter, deckStyle: style, theme, accent, onPick, size = 'grid', selected = false }: Props) {
  const slide = starterSlide(starter, style)
  const ctx = contexts({ footer: 'Acme', slides: [slide] })[0]
  // A section starter is numbered as the deck's first section, so its thumbnail reads like the real thing.
  return (
    <button type="button" data-starter={starter.id} aria-label={starter.label} aria-pressed={size === 'film' ? selected : undefined} onClick={() => onPick(starter)}
      className={cn('group grid cursor-pointer gap-2.5 text-left', size === 'film' ? 'w-[180px] flex-none gap-1.5' : 'min-w-0')}>
      <SlideView slide={slide} deck={{ style, theme, accent }} ctx={{ ...ctx, section: Math.max(ctx.section, 1) }}
        className={cn('relative aspect-video w-full overflow-hidden rounded-lg shadow-[0_0_0_1px_theme(colors.line)] transition-shadow',
          'group-hover:shadow-[0_0_0_1px_theme(colors.ink-3)] group-focus-visible:shadow-[0_0_0_2px_theme(colors.ink)]',
          size === 'film' && 'rounded-md', selected && 'shadow-[0_0_0_2px_theme(colors.ink)] group-hover:shadow-[0_0_0_2px_theme(colors.ink)]')} />
      <span className={cn('grid gap-0.5', size === 'film' && 'hidden')}>
        <b className="text-[13px] font-medium text-ink">{starter.label}</b>
        <span className="text-[12.5px] text-ink-3">{starter.blurb}</span>
      </span>
      {size === 'film' && <span className="truncate font-mono text-[11px] font-medium leading-none text-ink-3">{starter.label}</span>}
    </button>
  )
}

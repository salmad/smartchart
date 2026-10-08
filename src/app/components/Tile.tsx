import { contexts } from '@/engine/slides/render'
import { starterSlide, type Starter } from '@/engine/starters'
import type { Style, Theme } from '@/engine/types'
import { cn } from '@/app/lib/utils'
import { SlideView } from './SlideView'

interface Props { starter: Starter; deckStyle: Style; theme: Theme; accent: string | null; onPick: (s: Starter) => void; selected?: boolean
  /** A double click: pick and use at once. */
  onConfirm?: (s: Starter) => void }

/** A starter in the filmstrip: a live slide in the deck's look, with its label; the whole tile is the button. */
export function Tile({ starter, deckStyle: style, theme, accent, onPick, onConfirm, selected = false }: Props) {
  const slide = starterSlide(starter, style)
  const ctx = contexts({ footer: 'Occam', slides: [slide] })[0]
  // A section starter is numbered as the deck's first section, so its thumbnail reads like the real thing.
  return (
    <button type="button" data-starter={starter.id} aria-label={starter.label} aria-pressed={selected} onClick={() => onPick(starter)} onDoubleClick={onConfirm && (() => onConfirm(starter))}
      className="group grid w-[180px] flex-none cursor-pointer gap-1.5 text-left">
      <SlideView slide={slide} deck={{ style, theme, accent }} ctx={{ ...ctx, section: Math.max(ctx.section, 1) }}
        className={cn('relative aspect-video w-full overflow-hidden rounded-md shadow-[0_0_0_1px_theme(colors.line)] transition-shadow',
          'group-hover:shadow-[0_0_0_1px_theme(colors.ink-3)] group-focus-visible:shadow-[0_0_0_2px_theme(colors.app-bg),0_0_0_4px_theme(colors.ink)]',
          selected && 'shadow-[0_0_0_2px_theme(colors.app-bg),0_0_0_4px_theme(colors.ink)] group-hover:shadow-[0_0_0_2px_theme(colors.app-bg),0_0_0_4px_theme(colors.ink)]')} />
      <span className="truncate text-[12px] leading-none text-ink-2 group-aria-pressed:text-ink">{starter.label}</span>
    </button>
  )
}

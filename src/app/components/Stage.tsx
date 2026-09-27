import { contexts } from '@/engine/slides/render'
import type { Deck } from '@/engine/types'
import { cn } from '@/app/lib/utils'
import { SlideView } from './SlideView'

interface Props { deck: Deck; current: number; busy: boolean; onPresent: () => void }

/** The current slide at the largest size that leaves room for the checks and the strip; a click presents. */
export function Stage({ deck, current, busy, onPresent }: Props) {
  const slide = deck.slides[current]
  return (
    <div className="grid min-h-0 place-items-center px-8 pb-4 pt-7 max-[900px]:order-1 max-[900px]:px-4 max-[900px]:pb-3 max-[900px]:pt-4">
      <div onClick={() => slide && onPresent()} title="Present (F)"
        className={cn('relative aspect-video w-[min(100%,calc((100vh_-_56px_-_44px_-_250px)*16/9))] overflow-hidden rounded-[10px] bg-panel shadow-[0_0_0_1px_theme(colors.line),0_24px_60px_rgba(0,0,0,.5)] max-[900px]:w-full max-[900px]:rounded-lg',
          slide && 'cursor-zoom-in',
          busy && 'after:absolute after:inset-0 after:bg-[rgba(10,10,11,.35)] after:content-[""]')}>
        {slide
          ? <SlideView slide={slide} deck={deck} ctx={contexts(deck)[current]} className="absolute inset-0" />
          : <div className="absolute inset-0 grid place-content-center gap-1.5 text-center">
              <p className="text-[17px] font-medium">Your slide appears here.</p>
              <span className="text-ink-3">Pick a style, then describe what the slide should say.</span>
            </div>}
      </div>
    </div>
  )
}

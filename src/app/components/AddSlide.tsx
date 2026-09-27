import { useEffect, useState } from 'react'
import { contexts } from '@/engine/slides/render'
import { GROUPS, STARTERS, starterSlide, type Group, type Starter } from '@/engine/starters'
import type { Deck, TemplateId } from '@/engine/types'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/app/lib/utils'
import { SlideView } from './SlideView'
import { Tile } from './Tile'

interface Props { deck: Deck; current: number; onUse: (s: Starter) => void; onCancel: () => void }

const GROUP_OF: Record<TemplateId, Group> = { chart: 'charts', table: 'tables', cards: 'cards', number: 'numbers', steps: 'numbers', cover: 'structure', section: 'structure' }

/** Add slide: one featured starter at full size in the deck's own look, a filmstrip of every starter below. */
export function AddSlide({ deck, current, onUse, onCancel }: Props) {
  const start = GROUP_OF[deck.slides[current]?.template ?? 'chart']
  const [group, setGroup] = useState<Group>(start)
  const [featured, setFeatured] = useState<Starter>(() => STARTERS.find((s) => s.group === start) ?? STARTERS[0])

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [onCancel])

  // The featured slide is shown where it would land (after the current slide), so its numbering is the real one.
  const slide = starterSlide(featured, deck.style), at = Math.min(current + 1, deck.slides.length)
  const preview = { ...deck, slides: [...deck.slides.slice(0, at), slide, ...deck.slides.slice(at)] }

  return (
    <div className="grid min-h-0 grid-rows-[1fr_auto] max-[900px]:order-1 max-[900px]:flex max-[900px]:flex-col">
      <div className="grid min-h-0 content-center justify-items-center gap-4 px-8 pb-3 pt-7 max-[900px]:px-4 max-[900px]:pt-4">
        <div data-featured className="w-[min(100%,calc((100vh_-_56px_-_44px_-_300px)*16/9))] max-[900px]:w-full">
          <SlideView slide={slide} deck={deck} ctx={contexts(preview)[at]}
            className="relative aspect-video w-full overflow-hidden rounded-[10px] shadow-[0_0_0_1px_theme(colors.line),0_24px_60px_rgba(0,0,0,.5)]" />
        </div>
        <div className="flex w-[min(100%,calc((100vh_-_56px_-_44px_-_300px)*16/9))] items-center gap-3 max-[900px]:w-full max-[900px]:flex-wrap">
          <p className="mr-auto text-ink-2"><b className="font-medium text-ink">{featured.label}.</b> {featured.blurb}.</p>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={() => onUse(featured)}>Use this slide</Button>
        </div>
      </div>
      <div className="grid gap-3 border-t border-line px-8 pb-5 pt-4 max-[900px]:px-4">
        <div role="tablist" aria-label="Slide groups" className="flex gap-1">
          {GROUPS.map((g) => (
            <button key={g.id} type="button" role="tab" aria-selected={g.id === group} onClick={() => setGroup(g.id)}
              className={cn('rounded-md px-2.5 py-1 text-[12.5px] transition-colors', g.id === group ? 'bg-raise text-ink shadow-[0_0_0_1px_theme(colors.line-2)]' : 'text-ink-3 hover:text-ink-2')}>
              {g.label}
            </button>
          ))}
        </div>
        <div role="tabpanel" className="flex gap-3 overflow-x-auto px-0.5 pb-1 pt-0.5">
          {STARTERS.filter((s) => s.group === group).map((s) => (
            <Tile key={s.id} starter={s} deckStyle={deck.style} theme={deck.theme} accent={deck.accent ?? null} size="film" selected={s.id === featured.id} onPick={setFeatured} />
          ))}
        </div>
      </div>
    </div>
  )
}

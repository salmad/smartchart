import { useEffect, useRef, useState } from 'react'
import { contexts } from '@/engine/slides/render'
import { GROUPS, STARTERS, starterSlide, type Group, type Starter } from '@/engine/starters'
import type { Deck, TemplateId } from '@/engine/types'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/app/lib/utils'
import { useEdgeFade } from '@/app/fade'
import { SlideView } from './SlideView'
import { Tile } from './Tile'

interface Props {
  deck: Deck; current: number; onUse: (s: Starter) => void
  /** Leaves Add slide; absent for a new deck, where this is the first screen and there is nothing to go back to. */
  onCancel?: () => void
}

// Add slide opens on the group of the slide you are on: its likeliest neighbour.
const GROUP_OF: Record<TemplateId, Group> = { chart: 'trend', pair: 'trend', table: 'compare', cards: 'case', number: 'number', quote: 'case', steps: 'plan', summary: 'open', image: 'case', team: 'case', logos: 'case', agenda: 'open', cover: 'trend', section: 'trend' }
const GROUPED = GROUPS.map((g) => ({ ...g, starters: STARTERS.filter((s) => s.group === g.id) })).filter((g) => g.starters.length)

/** Add slide, and a new deck's first screen: pick a starter from the filmstrip (nothing is picked at first), see it
    full size in the deck's own look where it would land, then add it. A double click adds straight away; a group's
    tab scrolls the strip to it. In a new deck the empty frame also points at the chat, where the slide can be described. */
export function AddSlide({ deck, current, onUse, onCancel }: Props) {
  const start = GROUP_OF[deck.slides[current]?.template ?? 'chart']
  const film = useRef<HTMLDivElement | null>(null)
  const [picked, setPicked] = useState<Starter | null>(null), [group, setGroup] = useState<Group>(start)
  const fadeTabs = useEdgeFade(), fadeFilm = useEdgeFade()

  const pickGroup = (g: Group) => { setGroup(g); scrollTo(film.current, g, true) }
  const pick = (s: Starter) => { setPicked(s); setGroup(s.group) }
  // Opens scrolled to the likeliest group, with the groups before it one scroll away.
  useEffect(() => scrollTo(film.current, start, false), [start])

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel?.()
      if (e.key === 'Enter' && picked && !(e.target instanceof HTMLButtonElement)) onUse(picked)
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [onCancel, onUse, picked])

  // The picked slide is shown where it would land (after the current slide), so its numbering is the real one.
  const at = Math.min(current + 1, deck.slides.length), slide = picked && starterSlide(picked, deck.style)
  const preview = slide && { ...deck, slides: [...deck.slides.slice(0, at), slide, ...deck.slides.slice(at)] }
  const frame = 'relative aspect-video w-full overflow-hidden rounded-[10px]', first = !deck.slides.length

  return (
    <div className="grid min-h-0 grid-rows-[1fr_auto] max-[900px]:order-1 max-[900px]:flex max-[900px]:flex-col">
      <div className="grid min-h-0 content-center justify-items-center gap-4 px-8 pb-3 pt-7 max-[900px]:px-4 max-[900px]:pt-4">
        <div data-add-preview className="w-[min(100%,calc((100vh_-_56px_-_44px_-_300px)*16/9))] max-[900px]:w-full">
          {slide && preview
            ? <div data-featured><SlideView slide={slide} deck={deck} ctx={contexts(preview)[at]} className={cn(frame, 'shadow-[0_0_0_1px_theme(colors.line),0_24px_60px_rgba(0,0,0,.5)]')} /></div>
            : <div className={cn(frame, 'grid place-content-center gap-1.5 border border-dashed border-line-2 text-center')}>
                <p className="text-[17px] font-medium">{first ? 'Your slide appears here.' : 'Add a slide'}</p>
                {!first && <span className="text-ink-3">Pick one below to preview it here, in your deck’s look.</span>}
              </div>}
        </div>
        <div className="flex w-[min(100%,calc((100vh_-_56px_-_44px_-_300px)*16/9))] items-center gap-3 max-[900px]:w-full max-[900px]:flex-wrap">
          <p className="mr-auto text-ink-2">
            {picked ? <><b className="font-medium text-ink">{picked.label}.</b> {picked.blurb}. <span className="text-ink-3">Change it in your own words once it’s in.</span></> : <span className="text-ink-3">{first ? 'Pick a starting slide to preview it.' : `Goes in after slide ${current + 1}.`}</span>}
          </p>
          {onCancel && <Button variant="outline" onClick={onCancel}>Cancel</Button>}
          <Button onClick={() => picked && onUse(picked)} disabled={!picked}>{first ? 'Start with this slide' : `Add as slide ${at + 1}`}</Button>
        </div>
      </div>
      <div className="grid gap-3 border-t border-line px-8 pb-5 pt-4 max-[900px]:px-4">
        <div ref={fadeTabs} role="tablist" aria-label="Slide groups" className="edge-fade flex gap-1 overflow-x-auto [scrollbar-width:none]">
          {GROUPED.map((g) => (
            <button key={g.id} type="button" role="tab" aria-selected={g.id === group} onClick={() => pickGroup(g.id)}
              className={cn('shrink-0 rounded-md px-2.5 py-1 text-[12.5px] transition-colors', g.id === group ? 'bg-raise text-ink shadow-[0_0_0_1px_theme(colors.line-2)]' : 'text-ink-3 hover:text-ink-2')}>
              {g.label}
            </button>
          ))}
        </div>
        <div ref={(el) => { film.current = el; fadeFilm(el) }} role="tabpanel" className="edge-fade relative flex gap-6 overflow-x-auto px-0.5 pb-3 pt-0.5">
          {GROUPED.map((g) => (
            <div key={g.id} data-group={g.id} className="flex flex-none gap-3">
              {g.starters.map((s) => (
                <Tile key={s.id} starter={s} deckStyle={deck.style} theme={deck.theme} accent={deck.accent ?? null} selected={s.id === picked?.id} onPick={pick} onConfirm={onUse} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Scrolls the filmstrip so a group's first tile sits just inside its left edge, clear of the edge fade, with the
    group before it peeking into the fade. */
function scrollTo(strip: HTMLDivElement | null, g: Group, smooth: boolean) {
  const el = strip?.querySelector<HTMLElement>(`[data-group="${g}"]`)
  if (strip && el) strip.scrollTo({ left: Math.max(0, el.offsetLeft - 40), behavior: smooth && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto' })
}

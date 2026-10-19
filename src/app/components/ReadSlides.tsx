/* A deck to read: every slide full width, top to bottom; a click presents from that slide, and a link to another
   slide scrolls to it. Used by a deck shared by link and by a deck opened as a viewer. */
import { forwardRef, useImperativeHandle, useRef } from 'react'
import type { Deck } from '@/engine/types'
import { contexts } from '@/engine/slides/render'
import { slideLinkOf } from '@/app/slide-link'
import { SlideView } from './SlideView'

/** Scrolls to the slide with this id, if the deck has it. */
export interface ReadSlidesHandle { show(id: string): void }

export const ReadSlides = forwardRef<ReadSlidesHandle, { deck: Deck; ids: string[]; onPresent: (from: number) => void }>(function ReadSlides({ deck, ids, onPresent }, ref) {
  const slideRefs = useRef<(HTMLButtonElement | null)[]>([])
  const ctx = contexts(deck)
  useImperativeHandle(ref, () => ({ show: (id) => { slideRefs.current[ids.indexOf(id)]?.scrollIntoView({ block: 'center' }) } }), [ids])
  return (
    <main data-links className="mx-auto grid w-full max-w-[1200px] gap-8 px-8 pb-16 pt-10 max-[900px]:gap-4 max-[900px]:px-4 max-[900px]:pb-10 max-[900px]:pt-4">
      {deck.slides.map((slide, i) => (
        <button key={i} ref={(el) => { slideRefs.current[i] = el }} type="button" onClick={(e) => {
          const to = slideLinkOf(e.target)
          if (to) { e.preventDefault(); slideRefs.current[ids.indexOf(to)]?.scrollIntoView({ block: 'center', behavior: 'smooth' }); return }
          if (!(e.target as Element).closest('a')) onPresent(i)
        }} aria-label={`Present from slide ${i + 1}`}
          className="relative mx-auto block aspect-video w-[min(100%,calc((100vh_-_56px_-_64px)*16/9))] cursor-zoom-in overflow-hidden rounded-[10px] bg-panel shadow-[0_0_0_1px_theme(colors.line),0_24px_60px_rgba(0,0,0,.5)] outline-none focus-visible:shadow-[0_0_0_2px_theme(colors.ink-3)] max-[900px]:w-full max-[900px]:rounded-lg">
          <SlideView slide={slide} deck={deck} ctx={ctx[i]} className="absolute inset-0" />
        </button>
      ))}
      {deck.slides.length === 0 && <p className="py-24 text-center text-ink-3">This deck has no slides yet.</p>}
    </main>
  )
})

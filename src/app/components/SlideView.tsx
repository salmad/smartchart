import { useLayoutEffect, useRef } from 'react'
import { mountSlide } from '@/engine/slides/render'
import type { Deck, Slide, SlideContext } from '@/engine/types'

/** `id`: the slide's id on its frame, so a link to it can land there (a printed PDF keeps it). */
interface Props { slide: Slide; deck: Pick<Deck, 'style' | 'theme' | 'accent'>; ctx: SlideContext; className?: string; id?: string }

/** One slide drawn by the engine into a frame, scaled to the frame's width (1920 px = 1). */
export function SlideView({ slide, deck, ctx, className, id }: Props) {
  const frame = useRef<HTMLDivElement>(null)
  const { style, theme, accent } = deck, { page, section, kicker, footer, sections, pages } = ctx
  // The agenda draws the deck's chapters: a retitled divider redraws it.
  const chapters = JSON.stringify(sections ?? [])
  // Links to slides show each slide's page: a reorder redraws them.
  const order = JSON.stringify(pages ?? null)

  useLayoutEffect(() => {
    const el = frame.current
    if (!el) return
    const s = mountSlide(el, slide, { page, section, kicker, footer, sections: JSON.parse(chapters), ...(order !== 'null' ? { pages: JSON.parse(order) as Record<string, number> } : {}) }, { style, theme, accent })
    const fit = () => s.style.setProperty('--s', String(el.clientWidth / 1920))
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [slide, style, theme, accent, page, section, kicker, footer, chapters, order])

  return <div ref={frame} id={id} className={className} />
}

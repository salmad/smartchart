import { useLayoutEffect, useRef } from 'react'
import { mountSlide } from '@/engine/slides/render'
import type { Deck, Slide, SlideContext } from '@/engine/types'
import { cn } from '@/app/lib/utils'

interface Props { slide: Slide; deck: Pick<Deck, 'style' | 'theme' | 'accent'>; ctx: SlideContext; className?: string }

/** One slide drawn by the engine into a frame, scaled to the frame's width (1920 px = 1). */
export function SlideView({ slide, deck, ctx, className }: Props) {
  const frame = useRef<HTMLDivElement>(null)
  const { style, theme, accent } = deck, { page, section, kicker, footer } = ctx

  useLayoutEffect(() => {
    const el = frame.current
    if (!el) return
    const s = mountSlide(el, slide, { page, section, kicker, footer }, { style, theme, accent })
    const fit = () => s.style.setProperty('--s', String(el.clientWidth / 1920))
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [slide, style, theme, accent, page, section, kicker, footer])

  return <div ref={frame} className={cn('slide-frame', className)} />
}

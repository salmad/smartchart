import { useMemo } from 'react'
import { contexts } from '@/engine/slides/render'
import { GROUPS, STARTERS, starterSlide } from '@/engine/starters'
import type { Style, Theme } from '@/engine/types'
import { cn } from '@/app/lib/utils'
import { SlideView } from '../SlideView'

interface Props { id: string; deckStyle?: Style; theme?: Theme; withoutNotes?: boolean; className?: string }

/** A starter from starters.json, drawn live by the engine: the site shows only real slides.
    `withoutNotes` draws it as a first draft, before the reasons were asked for (the solution demo). */
export function LiveSlide({ id, deckStyle: style = 'consulting', theme = 'ink', withoutNotes = false, className }: Props) {
  // Memoised: SlideView remounts the slide whenever the object changes, and the demo re-renders its parent often.
  const { slide, ctx } = useMemo(() => {
    const starter = STARTERS.find((s) => s.id === id)
    if (!starter) throw new Error(`no starter ${id}`)
    const slide = starterSlide(starter, style)
    if (withoutNotes) delete slide.notes
    return { slide, ctx: contexts({ footer: 'Acme', slides: [slide] })[0] }
  }, [id, style, withoutNotes])
  return <SlideView slide={slide} deck={{ style, theme, accent: null }} ctx={{ ...ctx, section: Math.max(ctx.section, 1) }}
    className={cn('relative aspect-video w-full overflow-hidden', className)} />
}

/** Every starter in deck order: the title and chapter slides first, then by what the slide has to do. */
export const MENU: { id: string; name: string; groupId: string; group: string }[] = GROUPS.flatMap((g) =>
  STARTERS.filter((s) => s.group === g.id).map((s) => ({ id: s.id, name: s.label, groupId: g.id, group: g.label })))

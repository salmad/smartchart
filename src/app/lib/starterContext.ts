import { contexts } from '@/engine/slides/render'
import { FOOTER, type Starter } from '@/engine/starters'
import type { Slide, SlideContext } from '@/engine/types'

/** How a starter is drawn on its own (landing, filmstrip): a chapter divider numbered as a deck's first, and an agenda
    listing its sample chapters, none covered yet. */
export function starterContext(s: Starter, slide: Slide): SlideContext {
  const ctx = contexts({ footer: FOOTER, slides: [slide] })[0]
  return s.chapters ? { ...ctx, sections: s.chapters } : { ...ctx, section: Math.max(ctx.section, 1) }
}

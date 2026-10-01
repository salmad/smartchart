/* Measures a slide at 1920×1080 in a hidden frame: layout issues, the title's line count and layout warnings. */
import { contexts, mountSlide } from '@/engine/slides/render'
import { fitIssuesAt, layoutLints, type Located } from '@/engine/slides/lints'
import type { Deck, Slide } from '@/engine/types'

export interface Measurer { measure(slide: Slide, deck: Deck, index: number): string[]; lines: number; warnings: string[]; located: Located[] }

/** `lines` and `warnings` describe the last slide measured. */
export function createMeasurer(frame: HTMLElement): Measurer {
  const m: Measurer = {
    lines: 1,
    warnings: [],
    located: [],
    measure(slide, deck, index) {
      const d = { ...deck, slides: deck.slides.slice() }
      d.slides[index] = slide
      const el = mountSlide(frame, slide, contexts(d)[index] || { page: index + 1, section: 0, kicker: '', footer: deck.footer }, d)
      const t = el.querySelector<HTMLElement>('.title')
      m.lines = t ? Math.round(t.clientHeight / parseFloat(getComputedStyle(t).lineHeight)) : 1
      const lint = layoutLints(el, deck.style)
      m.warnings = lint.warnings
      m.located = [...fitIssuesAt(el, deck.style), ...lint.issues.map((msg) => ({ msg }))]
      return m.located.map((x) => x.msg)
    },
  }
  return m
}

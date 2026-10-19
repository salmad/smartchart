/* A doc figure edited in place: its checks (the doc's own, for this one figure, each message at its field's path), its
   body back from the slide the edit tools work on, and how that slide is drawn (the read view's canvas and fitters). */
import { validateDoc } from '@/engine/docs/validate'
import { issuePath } from '@/engine/slides/edit'
import { figureHTML } from '@/engine/docs/figure'
import { mountFigure } from '@/engine/docs/mount'
import type { FigureBody, FigureBlock, FigureKind } from '@/engine/docs/types'
import type { Slide, Theme } from '@/engine/types'
import type { Issue } from '@/app/edit/useSlideEdit'
import type { SurfaceRender } from '@/app/edit/EditSurface'

/** The figure's body: the slide without the head the edit tools need. */
export function bodyOf(s: Slide): FigureBody {
  const { template: _t, title: _h, ...body } = s
  return body as FigureBody
}

const ID = 'f', PREFIX = `#${ID}.`

/** The figure's issues as `validateDoc` gives them, errors only: a figure with one can't be closed, as a slide can't be saved. */
export function figureCheck(kind: FigureKind): (draft: Slide) => Issue[] {
  return (draft) => validateDoc({ title: 'x', blocks: [{ type: 'figure', kind, id: ID, body: bodyOf(draft) }] }).errors
    .map((e) => (e.startsWith(PREFIX) ? e.slice(PREFIX.length) : e))
    .map((msg) => ({ msg, path: issuePath(msg) }))
}

/** The figure as the edit tools see it: the read view's figure (canvas, takeaway and source), laid out and scaled as when
    read. `fit` rescales it to the surface and gives the box the figure's height, which the surface itself can't know. */
export function figureRender(f: Pick<FigureBlock, 'kind' | 'id'>, theme: Theme, accent: string | undefined, box: () => HTMLElement | null): SurfaceRender {
  return (el, shown) => {
    const block: FigureBlock = { type: 'figure', kind: f.kind, id: f.id, body: bodyOf(shown) }
    el.innerHTML = figureHTML(block, theme)
    const node = el.firstElementChild as HTMLElement, frame = node.querySelector<HTMLElement>(':scope > .fig-frame')
    const fit = () => {
      if (frame) mountFigure(frame, block, theme, accent)
      box()?.style.setProperty('--fig-h', `${node.offsetHeight}px`)
    }
    fit()
    return { node, fit }
  }
}

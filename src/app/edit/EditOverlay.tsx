/* Over the slide while editing: a quiet underline in the `warn` colour under each field with an issue (its reason on hover), and
   +/× on the list item under the pointer. Positions are read from the slide's own elements (spec 4.2, 4.5). */
import { useEffect, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { listOf, listOps, newItem, removeItem } from '@/engine/slides/edit'
import type { Style } from '@/engine/types'
import type { SlideEdit } from './useSlideEdit'

interface Box { l: number; t: number; w: number; h: number }
const boxIn = (el: Element, host: Element): Box => { const a = el.getBoundingClientRect(), b = host.getBoundingClientRect(); return { l: a.left - b.left, t: a.top - b.top, w: a.width, h: a.height } }
/** Sets a box as CSS variables on a marker: the classes read them (no inline style objects). */
const place = (el: HTMLElement | null, b: Box) => { if (!el) return; for (const [k, v] of Object.entries(b)) el.style.setProperty(`--${k}`, `${v}px`) }
const MARK = 'absolute left-[var(--l)] top-[var(--t)] w-[var(--w)] h-[var(--h)]'

export function EditOverlay({ edit, slide, deckStyle: style, onChart }: { edit: SlideEdit; slide: HTMLElement | null; deckStyle: Style; onChart: () => void }) {
  const host = useRef<HTMLDivElement>(null), [hover, setHover] = useState<HTMLElement | null>(null), [, setTick] = useState(0)

  useEffect(() => {
    if (!slide) return
    const move = (e: PointerEvent) => setHover((e.target instanceof Element ? e.target.closest<HTMLElement>('[data-item]') : null))
    const click = (e: MouseEvent) => { if (e.target instanceof Element && e.target.closest('[data-chart]')) onChart() }
    const ro = new ResizeObserver(() => setTick((n) => n + 1))
    slide.addEventListener('pointermove', move); slide.addEventListener('click', click); ro.observe(slide)
    return () => { slide.removeEventListener('pointermove', move); slide.removeEventListener('click', click); ro.disconnect() }
  }, [slide, onChart])

  if (!slide || !host.current?.parentElement) return <div ref={host} className="pointer-events-none absolute inset-0" />
  const frame = host.current.parentElement, ops = listOps(edit.draft, style)
  const hit = hover && listOf(ops, hover.dataset.item ?? '')
  const flagged = edit.issues.flatMap((x) => { const el = x.path ? slide.querySelector(`[data-path="${x.path}"]`) : null; return el ? [{ el, msg: x.msg }] : [] })
  const keep = (e: { preventDefault(): void }) => e.preventDefault()

  return (
    <div ref={host} className="pointer-events-none absolute inset-0">
      {flagged.map(({ el, msg }, i) => (
        <span key={i} title={msg} ref={(m) => { const b = boxIn(el, frame); place(m, { ...b, t: b.t + b.h - 2, h: 2 }) }}
          className={`${MARK} pointer-events-auto rounded-full bg-warn/70`} />
      ))}
      {hit && hover && (
        <span ref={(m) => place(m, boxIn(hover, frame))} className={`${MARK} pointer-events-none rounded-md ring-1 ring-line-2`}>
          <span className="pointer-events-auto absolute left-full top-1/2 ml-1.5 flex -translate-y-1/2 flex-col gap-1">
            {hit.op.length < hit.op.max && <button type="button" aria-label="Add after" onMouseDown={keep} onClick={() => edit.patch(newItem(edit.draft, style, hit.op, hit.index + 1), `${hit.op.path}[${hit.index + 1}]`)}
              className="grid size-6 place-items-center rounded-full bg-raise text-ink shadow-[0_0_0_1px_theme(colors.line-2)]"><Plus className="size-3.5" /></button>}
            {(hit.op.length > hit.op.min || !hit.op.required) && <button type="button" aria-label="Remove" onMouseDown={keep} onClick={() => { setHover(null); edit.patch(removeItem(hit.op, hit.index)) }}
              className="grid size-6 place-items-center rounded-full bg-raise text-ink shadow-[0_0_0_1px_theme(colors.line-2)]"><X className="size-3.5" /></button>}
          </span>
        </span>
      )}
    </div>
  )
}

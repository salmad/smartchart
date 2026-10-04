/* Over the slide while editing: a quiet underline in the `warn` colour under each field with an issue (its reason on hover), and
   +/× on the list item under the pointer. Positions are read from the slide's own elements (spec 4.2, 4.5). */
import { useEffect, useRef, useState } from 'react'
import { GripHorizontal, GripVertical, Plus, X } from 'lucide-react'
import { listOf, listOps, newItem, removeItem, type ListOp } from '@/engine/slides/edit'
import { cellAt } from './selection'
import type { Style } from '@/engine/types'
import type { SlideEdit } from './useSlideEdit'
import { useCellRange } from './useCellRange'
import { useDragMove, type Thing } from './useDragMove'

interface Box { l: number; t: number; w: number; h: number }
const boxIn = (el: Element, host: Element): Box => { const a = el.getBoundingClientRect(), b = host.getBoundingClientRect(); return { l: a.left - b.left, t: a.top - b.top, w: a.width, h: a.height } }
/** Sets a box as CSS variables on a marker: the classes read them (no inline style objects). */
const place = (el: HTMLElement | null, b: Box) => { if (!el) return; for (const [k, v] of Object.entries(b)) el.style.setProperty(`--${k}`, `${v}px`) }
const MARK = 'absolute left-[var(--l)] top-[var(--t)] w-[var(--w)] h-[var(--h)]'

/** `onAddPicture`: adding to a list whose items carry a picture picks the picture first (EditPictures). */
export function EditOverlay({ edit, slide, deckStyle: style, onChart, onAddPicture }: { edit: SlideEdit; slide: HTMLElement | null; deckStyle: Style; onChart: (which: number) => void; onAddPicture: (op: ListOp, index: number) => void }) {
  const host = useRef<HTMLDivElement>(null), [hover, setHover] = useState<HTMLElement | null>(null), [, setTick] = useState(0)
  // A press on a grip that does not move selects the thing: a table row is its cells, anything else is the item.
  const select = (t: Thing) => {
    if (t.kind === 'column') { edit.setTarget({ kind: 'cells', r0: -1, c0: t.index, r1: (edit.draft.table?.rows.length ?? 1) - 1, c1: t.index }); return }
    const row = /^table\.rows\[(\d+)\]$/.exec(`${t.list}[${t.index}]`)
    edit.setTarget(row ? { kind: 'cells', r0: t.index, c0: 0, r1: t.index, c1: (edit.draft.table?.columns.length ?? 1) - 1 } : { kind: 'item', item: `${t.list}[${t.index}]` })
  }
  const { drag, begin } = useDragMove(edit, slide, select)
  useCellRange(edit, slide)
  const [col, setCol] = useState<number | null>(null)

  useEffect(() => {
    if (!slide) return
    // The ring and buttons stay while the pointer travels from the item to its buttons: it only drops an item
    // when another item is entered, or the pointer is well away from it (the gap in between belongs to it).
    // The column grip sits just above its header: the way up to it still belongs to the column.
    const move = (e: PointerEvent) => {
      const c = e.target instanceof Element ? cellAt(e.target)?.c : undefined
      if (c !== undefined) { setCol(c); return }
      setCol((cur) => {
        const th = cur === null ? null : slide.querySelectorAll('th[data-path^="table.columns["]')[cur]
        if (!th) return null
        const b = th.getBoundingClientRect()
        return e.clientX >= b.left - 8 && e.clientX <= b.right + 8 && e.clientY >= b.top - 40 && e.clientY <= b.bottom ? cur : null
      })
    }
    const moveItem = (e: PointerEvent) => setHover((cur) => {
      const next = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-item]') : null
      if (!cur || !cur.isConnected) return next
      const b = cur.getBoundingClientRect(), near = 56
      // Travelling from a bullet to its buttons crosses the card around it: that is still the bullet's, not the card's.
      const toButtons = e.clientX >= b.left && e.clientX <= b.right + near && e.clientY >= b.top - 12 && e.clientY <= b.bottom + 12
      if (next && !(toButtons && next.contains(cur))) return next
      return e.clientX < b.left - near || e.clientX > b.right + near || e.clientY < b.top - near || e.clientY > b.bottom + near ? null : cur
    })
    // The wrapper around the slide and the overlay: leaving the slide onto an overlay button is not leaving.
    const leave = () => { setHover(null); setCol(null) }, frame = slide.parentElement?.parentElement
    // A pair's charts are numbered (data-chart="0", "1"); a chart slide's one host has no number.
    const click = (e: MouseEvent) => { const host = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-chart]') : null; if (host) onChart(Number(host.dataset.chart || 0)) }
    const ro = new ResizeObserver(() => setTick((n) => n + 1))
    slide.addEventListener('pointermove', move); slide.addEventListener('pointermove', moveItem); slide.addEventListener('click', click); frame?.addEventListener('pointerleave', leave); ro.observe(slide)
    return () => { slide.removeEventListener('pointermove', move); slide.removeEventListener('pointermove', moveItem); frame?.removeEventListener('pointerleave', leave); slide.removeEventListener('click', click); ro.disconnect() }
  }, [slide, onChart])

  if (!slide || !host.current?.parentElement) return <div ref={host} className="pointer-events-none absolute inset-0" />
  const frame = host.current.parentElement, ops = listOps(edit.draft, style)
  const hit = hover && listOf(ops, hover.dataset.item ?? '')
  const flagged = edit.issues.flatMap((x) => { const el = x.path ? slide.querySelector(`[data-path="${x.path}"]`) : null; return el ? [{ el, msg: x.msg }] : [] })
  const keep = (e: { preventDefault(): void }) => e.preventDefault()
  // The selected item or cells stay marked while they are acted on.
  const heads = [...slide.querySelectorAll<HTMLElement>('th[data-path^="table.columns["]')]
  const t = edit.target
  const selected: Box[] = t.kind === 'item' ? [...slide.querySelectorAll(`[data-item="${t.item}"]`)].map((el) => boxIn(el, frame))
    : t.kind === 'cells' ? [...slide.querySelectorAll('td, th')].filter((td) => { const c = cellAt(td); return !!c && c.r >= Math.min(t.r0, t.r1) && c.r <= Math.max(t.r0, t.r1) && c.c >= Math.min(t.c0, t.c1) && c.c <= Math.max(t.c0, t.c1) && (t.r0 !== t.r1 || t.c0 !== t.c1) }).map((td) => boxIn(td, frame)) : []

  return (
    <div ref={host} className="pointer-events-none absolute inset-0">
      {flagged.map(({ el, msg }, i) => (
        <span key={i} title={msg} ref={(m) => { const b = boxIn(el, frame); place(m, { ...b, t: b.t + b.h - 2, h: 2 }) }}
          className={`${MARK} pointer-events-auto rounded-full bg-warn/70`} />
      ))}
      {hit && hover && (
        <span ref={(m) => place(m, boxIn(hover, frame))} className={`${MARK} pointer-events-none rounded-md ring-1 ring-line-2`}>
          {/* The strip between the item and its buttons belongs to the overlay, so the pointer never leaves it on the way. */}
          <span className="pointer-events-auto absolute left-full top-1/2 flex w-14 -translate-y-1/2 flex-col gap-1 pl-2">
            {hit.op.length > 1 && <button type="button" aria-label={`Move ${hit.op.path.split('.').at(-1)?.replace(/s$/, '')} ${hit.index + 1}`} onPointerDown={(e) => begin(e, { kind: 'item', list: hit.op.path, index: hit.index })} onMouseDown={keep}
              className="grid size-6 cursor-grab touch-none place-items-center rounded-full bg-raise text-ink-3 shadow-[0_0_0_1px_theme(colors.line-2)] hover:text-ink active:cursor-grabbing"><GripVertical className="size-3.5" /></button>}
            {hit.op.length < hit.op.max && <button type="button" aria-label="Add after" onMouseDown={keep} onClick={() => (hit.op.picture ? onAddPicture(hit.op, hit.index) : edit.patch(newItem(edit.draft, style, hit.op, hit.index + 1), `${hit.op.path}[${hit.index + 1}]`))}
              className="grid size-6 place-items-center rounded-full bg-raise text-ink shadow-[0_0_0_1px_theme(colors.line-2)]"><Plus className="size-3.5" /></button>}
            {(hit.op.length > hit.op.min || !hit.op.required) && <button type="button" aria-label="Remove" onMouseDown={keep} onClick={() => { setHover(null); edit.patch(removeItem(hit.op, hit.index)) }}
              className="grid size-6 place-items-center rounded-full bg-raise text-ink shadow-[0_0_0_1px_theme(colors.line-2)]"><X className="size-3.5" /></button>}
          </span>
        </span>
      )}
      {drag?.line && <DropLine line={drag.line} frame={frame} />}
      {col !== null && heads[col] && t.kind !== 'cells' && (
        <button type="button" aria-label={`Move column ${col + 1}`} onPointerDown={(e) => begin(e, { kind: 'column', index: col })} onMouseDown={keep}
          ref={(m) => { const b = boxIn(heads[col], frame); place(m, { l: b.l + b.w / 2 - 12, t: b.t - 22, w: 24, h: 18 }) }}
          className={`${MARK} pointer-events-auto grid cursor-grab touch-none place-items-center rounded-md bg-raise text-ink-3 shadow-[0_0_0_1px_theme(colors.line-2)] hover:text-ink active:cursor-grabbing`}><GripHorizontal className="size-3.5" /></button>
      )}
      {selected.map((b, i) => <span key={i} ref={(m) => place(m, b)} className={`${MARK} rounded-sm bg-ink/10 ring-1 ring-ink/30`} />)}
    </div>
  )
}

function DropLine({ line, frame }: { line: { left: number; right: number; top: number; bottom: number }; frame: Element }) {
  const f = frame.getBoundingClientRect()
  return <span ref={(m) => place(m, { l: line.left - f.left, t: line.top - f.top, w: line.right - line.left, h: line.bottom - line.top })} className={`${MARK} rounded-full bg-ink`} />
}

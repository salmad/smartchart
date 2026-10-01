/* Dragging a grip moves an item, a table row or a table column to another place. A press that does not move selects it.
   Pointer events on the grip itself (captured), never HTML5 drag, which would drag text out of the editable fields. */
import { useCallback, useState } from 'react'
import { moveColumn, moveItem } from '@/engine/slides/edit'
import type { SlideEdit } from './useSlideEdit'
import { axisOf, dropIndex, dropLine, type Box } from './drag'

export type Thing = { kind: 'item'; list: string; index: number } | { kind: 'column'; index: number }
export interface DragState { line: Box | null; from: number; to: number }

const rect = (el: Element): Box => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom } }

export function useDragMove(edit: SlideEdit, slide: HTMLElement | null, onSelect: (t: Thing) => void) {
  const [drag, setDrag] = useState<DragState | null>(null)

  const begin = useCallback((e: React.PointerEvent<HTMLElement>, thing: Thing) => {
    if (!slide || e.button !== 0) return
    e.preventDefault(); e.stopPropagation()
    const grip = e.currentTarget, id = e.pointerId, sx = e.clientX, sy = e.clientY
    grip.setPointerCapture(id)
    const pick = () => thing.kind === 'column'
      ? [...slide.querySelectorAll('th[data-path^="table.columns["]')]
      : [...slide.querySelectorAll<HTMLElement>('[data-item]')].filter((el) => new RegExp(`^${thing.list.replace(/[.[\]]/g, '\\$&')}\\[\\d+\\]$`).test(el.dataset.item ?? ''))
    let active = false, to = thing.index
    const at = (ev: PointerEvent) => {
      const boxes = pick().map(rect), axis = thing.kind === 'column' ? 'x' : axisOf(boxes)
      to = dropIndex(boxes, thing.index, { x: ev.clientX, y: ev.clientY }, axis)
      setDrag({ from: thing.index, to, line: dropLine(boxes, thing.index, to, axis) })
    }
    const move = (ev: PointerEvent) => { if (!active && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) return; active = true; at(ev) }
    const stop = () => { grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up); grip.removeEventListener('pointercancel', cancel); document.removeEventListener('keydown', esc, true); setDrag(null) }
    const up = () => {
      stop()
      if (!active) { onSelect(thing); return }
      if (to === thing.index) return
      if (thing.kind === 'column') edit.apply({ set: moveColumn(edit.draft, thing.index, to), target: { kind: 'cells', r0: -1, c0: to, r1: (edit.draft.table?.rows.length ?? 1) - 1, c1: to } })
      else edit.apply({ set: moveItem(edit.draft, thing.list, thing.index, to), target: { kind: 'item', item: `${thing.list}[${to}]` } })
    }
    const cancel = () => stop()
    const esc = (ev: KeyboardEvent) => { if (ev.key === 'Escape') { ev.stopPropagation(); ev.preventDefault(); active = false; stop() } }
    grip.addEventListener('pointermove', move); grip.addEventListener('pointerup', up); grip.addEventListener('pointercancel', cancel); document.addEventListener('keydown', esc, true)
  }, [edit, slide, onSelect])

  return { drag, begin }
}

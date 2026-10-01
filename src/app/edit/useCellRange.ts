/* Selecting several table cells: press in one cell and drag into another (or shift-click). The browser clamps a text
   selection to the cell it started in, so a range is ours: it highlights whole cells, and the actions apply to all of them. */
import { useEffect, useRef } from 'react'
import { cellAt } from './selection'
import type { SlideEdit } from './useSlideEdit'

export function useCellRange(edit: SlideEdit, slide: HTMLElement | null) {
  const ref = useRef(edit)
  ref.current = edit
  useEffect(() => {
    if (!slide) return
    let anchor: { r: number; c: number } | null = null, last: { r: number; c: number } | null = null, ranging = false
    const select = (a: { r: number; c: number }, b: { r: number; c: number }) =>
      ref.current.setTarget({ kind: 'cells', r0: Math.min(a.r, b.r), c0: Math.min(a.c, b.c), r1: Math.max(a.r, b.r), c1: Math.max(a.c, b.c) })
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return
      const cell = e.target instanceof Element ? cellAt(e.target) : null
      if (!cell) { anchor = null; if (ref.current.target.kind === 'cells') ref.current.setTarget({ kind: 'slide' }); return }
      if (e.shiftKey && last) { e.preventDefault(); select(last, cell); return }
      anchor = last = cell; ranging = false
      // A press in a cell outside the current range ends the range; a press inside it keeps it (for a right-click).
    }
    const move = (e: PointerEvent) => {
      if (!anchor || !(e.buttons & 1)) return
      const cell = e.target instanceof Element ? cellAt(e.target) : null
      if (!cell || (!ranging && cell.r === anchor.r && cell.c === anchor.c)) return
      window.getSelection()?.removeAllRanges()
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
      select(anchor, cell)
    }
    const up = () => { anchor = null; ranging = false }
    const start = (e: Event) => { if (ranging) e.preventDefault() }
    slide.addEventListener('pointerdown', down); slide.addEventListener('pointermove', move); document.addEventListener('pointerup', up); slide.addEventListener('selectstart', start)
    return () => { slide.removeEventListener('pointerdown', down); slide.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); slide.removeEventListener('selectstart', start) }
  }, [slide])
}

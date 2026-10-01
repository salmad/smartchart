/* From the DOM to the model: what the pointer or the selection is on, as a Target (model coordinates only).
   The slide is redrawn under any selection, so nothing here keeps a DOM node. */
import type { Target } from '@/engine/slides/actions'
import { caretRange } from './fields'

const CELL = /table\.rows\[(\d+)\]\.cells\[(\d+)\]/, HEAD = /table\.columns\[(\d+)\]/

/** The table cell around an element, as (row, column); the header row is -1. */
export function cellAt(el: Element | null): { r: number; c: number } | null {
  const td = el?.closest('td, th')
  if (!td) return null
  const path = td.getAttribute('data-path') ?? td.querySelector('[data-path]')?.getAttribute('data-path') ?? ''
  const body = CELL.exec(path), head = HEAD.exec(path)
  return body ? { r: Number(body[1]), c: Number(body[2]) } : head ? { r: -1, c: Number(head[1]) } : null
}

/** What a right-click or a press on `el` is about: a selection it lands inside, a table cell, a list item, a field. */
export function targetAt(el: Element | null, current: Target): Target {
  const field = el?.closest<HTMLElement>('[data-path]') ?? null
  const cell = cellAt(el)
  if (current.kind === 'cells' && cell && cell.r >= Math.min(current.r0, current.r1) && cell.r <= Math.max(current.r0, current.r1) && cell.c >= Math.min(current.c0, current.c1) && cell.c <= Math.max(current.c0, current.c1)) return current
  if (field) {
    const r = caretRange(field)
    if (r && r[0] !== r[1]) return { kind: 'text', path: field.dataset.path ?? '', from: Math.min(...r), to: Math.max(...r) }
  }
  if (cell) return { kind: 'cells', r0: cell.r, c0: cell.c, r1: cell.r, c1: cell.c }
  const item = el?.closest<HTMLElement>('[data-item]')
  if (item) return { kind: 'item', item: item.dataset.item ?? '' }
  if (field) return { kind: 'text', path: field.dataset.path ?? '', from: 0, to: 0 }
  return { kind: 'slide' }
}

/** The on-screen box of a target, in client pixels (for the floating bar). */
export function rectOf(target: Target, slide: HTMLElement): DOMRect | null {
  if (target.kind === 'text') {
    const sel = window.getSelection()
    return sel && sel.rangeCount && target.from !== target.to ? sel.getRangeAt(0).getBoundingClientRect() : null
  }
  if (target.kind !== 'cells') return null
  const boxes = [...slide.querySelectorAll<HTMLElement>('td, th')].filter((td) => {
    const c = cellAt(td)
    return c && c.r >= Math.min(target.r0, target.r1) && c.r <= Math.max(target.r0, target.r1) && c.c >= Math.min(target.c0, target.c1) && c.c <= Math.max(target.c0, target.c1)
  }).map((td) => td.getBoundingClientRect())
  if (!boxes.length) return null
  const l = Math.min(...boxes.map((b) => b.left)), t = Math.min(...boxes.map((b) => b.top)), r = Math.max(...boxes.map((b) => b.right)), b = Math.max(...boxes.map((x) => x.bottom))
  return new DOMRect(l, t, r - l, b - t)
}

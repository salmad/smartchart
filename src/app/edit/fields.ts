/* A slide field as an editable element: its text in plain-text offsets, the cursor kept across a redraw. The field's
   markup string is the truth (spec 4.1); the element is always redrawn from it, so nothing the browser inserts stays. */
import { FIELD_HTML, type FieldKind } from '@/engine/slides/render'
import { applyText } from '@/engine/slides/markup'

const kindOf = (el: HTMLElement): FieldKind => (el.dataset.kind as FieldKind | undefined) ?? 'esc'
export const isMarkup = (el: HTMLElement) => kindOf(el) === 'md' || kindOf(el) === 'display'

/** Plain-text offset of a DOM position inside `el`. */
function offsetOf(el: HTMLElement, node: Node, at: number): number {
  const r = document.createRange()
  r.selectNodeContents(el)
  r.setEnd(node, at)
  return r.toString().length
}

export function caretRange(el: HTMLElement): [number, number] | null {
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount) return null
  const r = sel.getRangeAt(0)
  if (!el.contains(r.startContainer) || !el.contains(r.endContainer)) return null
  return [offsetOf(el, r.startContainer, r.startOffset), offsetOf(el, r.endContainer, r.endOffset)]
}

/** The DOM position at a plain-text offset. */
function pointAt(el: HTMLElement, offset: number): [Node, number] {
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  let left = offset, node = walk.nextNode()
  while (node) {
    const len = node.textContent?.length ?? 0
    if (left <= len) return [node, left]
    left -= len
    node = walk.nextNode()
  }
  return [el, el.childNodes.length]
}

export function selectRange(el: HTMLElement, from: number, to: number) {
  const sel = window.getSelection(), r = document.createRange()
  r.setStart(...pointAt(el, from))
  r.setEnd(...pointAt(el, to))
  sel?.removeAllRanges()
  sel?.addRange(r)
}
export const setCaret = (el: HTMLElement, offset: number) => selectRange(el, offset, offset)

/** The field's new markup: its text now, written into the markup it had. */
export function typed(el: HTMLElement, markup: string): string {
  const text = (el.textContent ?? '').replace(/\u00a0/g, ' ')
  return isMarkup(el) ? applyText(markup, text) : text
}

export function redraw(el: HTMLElement, markup: string) {
  el.innerHTML = FIELD_HTML[kindOf(el)](markup)
}

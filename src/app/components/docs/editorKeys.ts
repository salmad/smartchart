/* Keys in the doc editor that cross a field's edge: Enter splits, Backspace and Delete join, arrows move between fields,
   ⌘B and ⇧⌘H mark, a paste of several lines makes blocks. Every structural change is an op from blocks.ts or lists.ts,
   handed to edit.apply with where the cursor goes. A field is one block's text, or one item of a list. */
import { convert, insertAfter, mergeBack, removeBlock, splitText, type Keyed } from '@/engine/docs/blocks'
import { endList, insertChunks, joinOntoList, mergeItem, splitItem, type Caret } from '@/engine/docs/lists'
import { parse, toggle, type Mark } from '@/engine/slides/markup'
import { caretRange, redraw, selectRange, setCaret, typed } from '@/app/edit/fields'
import type { DocEdit, HeadField } from './useDocEdit'

export interface Field { el: HTMLElement; key: string | null; head: HeadField | null; item?: number }

export function fieldOf(t: EventTarget | null): Field | null {
  const el = t instanceof Node ? (t instanceof Element ? t : t.parentElement)?.closest<HTMLElement>('[data-field], [data-head]') : null
  if (!el) return null
  const item = el.dataset.item === undefined ? undefined : Number(el.dataset.item)
  return { el, key: el.dataset.field ?? null, head: (el.dataset.head as HeadField | undefined) ?? null, item }
}

export function markupOf(edit: DocEdit, f: Field): string {
  if (f.head) return edit.draft[f.head]
  const b = edit.draft.blocks.find((k) => k.key === f.key)?.block
  if (!b) return ''
  if ((b.type === 'bullets' || b.type === 'numbered') && f.item !== undefined) return b.items[f.item] ?? ''
  return b.type === 'paragraph' || b.type === 'quote' || b.type === 'heading' ? b.text : ''
}

/** Typing: the field's text written into its markup, the field redrawn from it, the caret kept. */
export function typeInto(edit: DocEdit, f: Field) {
  const caret = caretRange(f.el)?.[0] ?? 0, next = typed(f.el, markupOf(edit, f))
  if (f.head) edit.setHead(f.head, next); else if (f.key) edit.setText(f.key, next, f.item)
  redraw(f.el, next); setCaret(f.el, caret)
}

const fields = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>('[data-head], [data-field]')]
const lengthOf = (el: HTMLElement) => (el.textContent ?? '').length
const focusAt = (el: HTMLElement | undefined, at: 'start' | 'end') => { if (!el) return false; el.focus(); setCaret(el, at === 'start' ? 0 : lengthOf(el)); return true }

/** Whether the caret sits on the field's first (or last) line: arrows leave the field only from there. */
function onEdgeLine(el: HTMLElement, edge: 'first' | 'last'): boolean {
  const sel = window.getSelection()
  if (!sel?.rangeCount) return true
  const r = sel.getRangeAt(0).getClientRects()[0], box = el.getBoundingClientRect(), line = parseFloat(getComputedStyle(el).lineHeight) || 24
  if (!r) return true
  return edge === 'first' ? r.top - box.top < line * 0.75 : box.bottom - r.bottom < line * 0.75
}

/** A block that is not text (a figure, a divider, code) is selected as a whole: focused, outlined by CSS. */
export const selectBlock = (root: HTMLElement, key: string) => root.querySelector<HTMLElement>(`[data-key="${key}"][data-block-select]`)?.focus()

const MARKS: Record<string, Mark> = { b: 'b', h: 'f' }

export function fieldKey(e: KeyboardEvent, f: Field, edit: DocEdit, root: HTMLElement): void {
  const list = edit.draft.blocks, i = list.findIndex((k) => k.key === f.key), block = list[i]?.block
  const [from, to] = caretRange(f.el) ?? [0, 0], mod = e.metaKey || e.ctrlKey, len = lengthOf(f.el)
  const all = fields(root), n = all.indexOf(f.el)

  // Bold and Focus over the selection: one undo step, the field redrawn and the selection kept.
  const mark = mod && (e.key.toLowerCase() === 'b' && !e.shiftKey ? MARKS.b : e.key.toLowerCase() === 'h' && e.shiftKey ? MARKS.h : null)
  if (mark) {
    e.preventDefault()
    if (from === to) return
    const next = toggle(markupOf(edit, f), from, to, mark)
    edit.mark(f.head ?? f.key ?? '', next, f.item); redraw(f.el, next); selectRange(f.el, from, to)
    return
  }
  if (mod && ['i', 'u'].includes(e.key.toLowerCase())) { e.preventDefault(); return }
  if (e.key === 'Escape') { e.preventDefault(); f.el.blur(); return }

  if (e.key === 'Enter' && !mod) {
    e.preventDefault()
    if (e.shiftKey) return // the file has no line breaks inside a block
    if (f.head === 'title') { focusAt(all[n + 1], 'start'); return }
    if (f.head === 'subtitle') {
      const first = list[0]
      if (first && all[n + 1]?.dataset.field === first.key) { focusAt(all[n + 1], 'start'); return }
      const r = insertAfter(list, null, { type: 'paragraph', text: '' })
      edit.apply(r.list, { key: r.key, at: 0 }); return
    }
    if (!f.key || !block) return
    // A selection is typed over: drop it first, then split where it started.
    const base = from === to ? list : insertChunks(list, f.key, f.item, from, to, ['']).list
    if (block.type === 'bullets' || block.type === 'numbered') {
      const r = (f.el.textContent ?? '') === '' ? endList(base, f.key, f.item ?? 0) : splitItem(base, f.key, f.item ?? 0, from)
      edit.apply(r.list, { key: r.key, item: r.item, at: r.at }); return
    }
    const r = splitText(base, f.key, from)
    edit.apply(r.list, { key: r.key, at: 0 }); return
  }

  if (e.key === 'Backspace' && from === 0 && to === 0 && !mod) {
    if (f.head === 'subtitle') { e.preventDefault(); focusAt(all[n - 1], 'end'); return }
    if (!f.key || !block) return
    e.preventDefault()
    if (block.type === 'bullets' || block.type === 'numbered') { const r = mergeItem(list, f.key, f.item ?? 0); edit.apply(r.list, { key: r.key, item: r.item, at: r.at }); return }
    // A heading or quote turns into a paragraph first; the next Backspace joins it.
    if (block.type !== 'paragraph') { edit.apply(convert(list, f.key, 'paragraph'), { key: f.key, at: 0 }); return }
    const joined: Caret | null = mergeBack(list, f.key) ?? joinOntoList(list, f.key)
    if (joined) { edit.apply(joined.list, { key: joined.key, item: joined.item, at: joined.at }); return }
    const prev = list[i - 1]
    if (!prev) { focusAt(all[n - 1], 'end'); return }
    // The block before is a figure, a divider or code: an empty paragraph goes; otherwise the block before is selected.
    if (len === 0) { edit.apply(removeBlock(list, f.key), { key: prev.key, select: true }); return }
    selectBlock(root, prev.key); return
  }

  if (e.key === 'Delete' && from === len && to === len && f.key && block && !('items' in block)) {
    const next = list[i + 1]
    if (!next) return
    e.preventDefault()
    const joined = mergeBack(list, next.key)
    if (joined) edit.apply(joined.list, { key: joined.key, at: joined.at }); else selectBlock(root, next.key)
    return
  }

  // Arrows leave a field at its edge, into the field before or after.
  if ((e.key === 'ArrowUp' && onEdgeLine(f.el, 'first')) || (e.key === 'ArrowLeft' && from === 0 && to === 0)) { if (focusAt(all[n - 1], 'end')) e.preventDefault(); return }
  if ((e.key === 'ArrowDown' && onEdgeLine(f.el, 'last')) || (e.key === 'ArrowRight' && from === len && to === len)) { if (focusAt(all[n + 1], 'start')) e.preventDefault() }
}

/** Keys on a selected block (a figure, a divider, code): Backspace removes it, Enter writes a paragraph after it, arrows leave. */
export function blockKey(e: KeyboardEvent, key: string, edit: DocEdit, root: HTMLElement): void {
  const list = edit.draft.blocks, i = list.findIndex((k) => k.key === key), before = list[i - 1], after = list[i + 1]
  const textOf = (k: Keyed) => (k.block.type === 'paragraph' || k.block.type === 'heading' || k.block.type === 'quote' ? k.block.text : null)
  // Into a neighbour: its first or last field, or the block itself when it is not text.
  const go = (k: Keyed | undefined, at: 'start' | 'end') => {
    if (!k) return false
    const els = [...root.querySelectorAll<HTMLElement>(`[data-field="${k.key}"]`)]
    if (els.length) return focusAt(at === 'end' ? els[els.length - 1] : els[0], at)
    selectBlock(root, k.key); return true
  }
  if (e.key === 'Backspace' || e.key === 'Delete') {
    e.preventDefault()
    const rest = removeBlock(list, key), target = after ?? before
    if (!target) { const r = insertAfter(rest, null, { type: 'paragraph', text: '' }); edit.apply(r.list, { key: r.key, at: 0 }); return }
    const text = textOf(target)
    edit.apply(rest, text === null ? { key: target.key, select: true } : { key: target.key, at: target === after ? 0 : parse(text).length })
    return
  }
  if (e.key === 'Enter') { e.preventDefault(); const r = insertAfter(list, key, { type: 'paragraph', text: '' }); edit.apply(r.list, { key: r.key, at: 0 }); return }
  if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { if (go(before, 'end')) e.preventDefault(); return }
  if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { if (go(after, 'start')) e.preventDefault() }
}

/** A paste: plain text only. Several lines become several blocks (or items); the title and subtitle take one line. */
export function pasteInto(e: ClipboardEvent, f: Field, edit: DocEdit) {
  e.preventDefault()
  const raw = (e.clipboardData?.getData('text/plain') ?? '').replace(/\r/g, ''), [from, to] = caretRange(f.el) ?? [0, 0]
  const lines = raw.split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim()).filter(Boolean)
  if (!lines.length) return
  if (f.head || lines.length === 1) {
    const text = f.head ? lines.join(' ') : lines[0], plain = f.el.textContent ?? ''
    f.el.textContent = plain.slice(0, from) + text + plain.slice(to)
    setCaret(f.el, from + text.length)
    typeInto(edit, f)
    return
  }
  if (!f.key) return
  const r = insertChunks(edit.draft.blocks, f.key, f.item, from, to, lines)
  edit.apply(r.list, { key: r.key, item: r.item, at: r.at })
}

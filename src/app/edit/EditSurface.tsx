/* The slide in edit mode: every [data-path] field is typed into in place. Typing updates the draft and redraws only
   that field; leaving a field, +/× and the template re-render the slide (spec 4.1). */
import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { mountSlide } from '@/engine/slides/render'
import { getAt, listOf, listOps, newItem } from '@/engine/slides/edit'
import { toggle } from '@/engine/slides/markup'
import type { Deck, SlideContext } from '@/engine/types'
import { caretRange, isMarkup, redraw, setCaret, typed } from './fields'
import type { SlideEdit } from './useSlideEdit'
import './edit.css'

interface Props { edit: SlideEdit; deck: Pick<Deck, 'style' | 'theme' | 'accent'>; ctx: SlideContext; onSlide: (el: HTMLElement | null) => void; children?: ReactNode }

const hint = (path: string) => { const k = path.replace(/\[\d+\]/g, '').split('.').at(-1) ?? ''; return k.charAt(0).toUpperCase() + k.slice(1) }
const fieldOf = (t: EventTarget | null) => (t instanceof Element ? t.closest<HTMLElement>('[data-path]') : null)

export function EditSurface({ edit, deck, ctx, onSlide, children }: Props) {
  const frame = useRef<HTMLDivElement>(null), editRef = useRef(edit), focus = useRef<{ path: string; at: number } | null>(null)
  editRef.current = edit
  const { style, theme, accent } = deck

  useLayoutEffect(() => {
    const el = frame.current
    if (!el) return
    const s = mountSlide(el, edit.shown, { page: ctx.page, section: ctx.section, kicker: ctx.kicker, footer: ctx.footer }, { style, theme, accent })
    s.querySelectorAll<HTMLElement>('[data-path]').forEach((f) => {
      f.contentEditable = 'true'; f.spellcheck = true; f.dataset.hint = hint(f.dataset.path ?? '')
      if (editRef.current.samples.has(f.dataset.path ?? '')) f.dataset.sample = ''
    })
    // After a structural change, the cursor goes back where it was asked to be (a new item's first field).
    if (focus.current) { const f = s.querySelector<HTMLElement>(`[data-path="${focus.current.path}"]`); if (f) { f.focus(); setCaret(f, focus.current.at) } focus.current = null }
    const fit = () => s.style.setProperty('--s', String(el.clientWidth / 1920))
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    onSlide(s)
    return () => { ro.disconnect(); onSlide(null) }
    // Primitives only: a new ctx object on each render must not remount the slide under the cursor.
  }, [edit.shown, ctx.page, ctx.section, ctx.kicker, ctx.footer, style, theme, accent, onSlide])

  useEffect(() => {
    const el = frame.current
    if (!el) return
    const markupOf = (f: HTMLElement) => String(getAt(editRef.current.draft, f.dataset.path ?? '') ?? '')
    const write = (f: HTMLElement, next: string, caret: number) => {
      editRef.current.set(f.dataset.path ?? '', next)
      redraw(f, next); setCaret(f, caret); delete f.dataset.sample
    }
    const onInput = (e: Event) => {
      const f = fieldOf(e.target)
      if (!f || (e as InputEvent).isComposing) return
      const caret = caretRange(f)?.[0] ?? 0
      write(f, typed(f, markupOf(f)), caret)
    }
    const onComposed = (e: Event) => { const f = fieldOf(e.target); if (f) write(f, typed(f, markupOf(f)), caretRange(f)?.[0] ?? 0) }
    const onPaste = (e: ClipboardEvent) => {
      const f = fieldOf(e.target)
      if (!f) return
      e.preventDefault()
      const text = (e.clipboardData?.getData('text/plain') ?? '').replace(/\s+/g, ' '), [a, b] = caretRange(f) ?? [0, 0]
      const plain = f.textContent ?? ''
      f.textContent = plain.slice(0, a) + text + plain.slice(b)
      write(f, typed(f, markupOf(f)), a + text.length)
    }
    const onKey = (e: KeyboardEvent) => {
      const f = fieldOf(e.target)
      if (!f) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && ['i', 'u'].includes(e.key)) { e.preventDefault(); return }
      if (mod && e.key === 'b') { e.preventDefault(); if (isMarkup(f)) { const [a, b] = caretRange(f) ?? [0, 0]; write(f, toggle(markupOf(f), a, b, 'b'), b) } return }
      if (e.key !== 'Enter' || mod) return
      e.preventDefault()
      // Enter in a list item adds the next item; anywhere else it does nothing.
      const itemEl = f.closest<HTMLElement>('[data-item]'), cur = editRef.current
      const hit = itemEl && listOf(listOps(cur.draft, style), itemEl.dataset.item ?? '')
      if (!hit || hit.op.length >= hit.op.max) return
      const set = newItem(cur.draft, style, hit.op, hit.index + 1)
      const tail = (f.dataset.path ?? '').slice((itemEl.dataset.item ?? '').length)
      focus.current = { path: `${hit.op.path}[${hit.index + 1}]${tail}`, at: 0 }
      cur.patch(set)
    }
    const onLeave = (e: FocusEvent) => { if (fieldOf(e.target) && !fieldOf(e.relatedTarget)) editRef.current.commit() }
    el.addEventListener('input', onInput); el.addEventListener('compositionend', onComposed)
    el.addEventListener('paste', onPaste); el.addEventListener('keydown', onKey); el.addEventListener('focusout', onLeave)
    return () => {
      el.removeEventListener('input', onInput); el.removeEventListener('compositionend', onComposed)
      el.removeEventListener('paste', onPaste); el.removeEventListener('keydown', onKey); el.removeEventListener('focusout', onLeave)
    }
  }, [style])

  return (
    <div className="absolute inset-0" data-editing>
      <div ref={frame} className="absolute inset-0" />
      {children}
    </div>
  )
}

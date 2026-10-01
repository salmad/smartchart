/* The slide in edit mode: every [data-path] field is typed into in place. Typing updates the draft and redraws only
   that field; leaving a field, +/× and the template re-render the slide (spec 4.1). */
import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { mountSlide } from '@/engine/slides/render'
import { getAt, listOf, listOps, newItem } from '@/engine/slides/edit'
import type { Deck, SlideContext } from '@/engine/types'
import { caretRange, redraw, selectRange, setCaret, typed } from './fields'
import type { SlideEdit } from './useSlideEdit'
import './edit.css'

interface Props { edit: SlideEdit; deck: Pick<Deck, 'style' | 'theme' | 'accent'>; ctx: SlideContext; onSlide: (el: HTMLElement | null) => void; children?: ReactNode }

const hint = (path: string) => { const k = path.replace(/\[\d+\]/g, '').split('.').at(-1) ?? ''; return k.charAt(0).toUpperCase() + k.slice(1) }
const fieldOf = (t: EventTarget | null) => (t instanceof Element ? t.closest<HTMLElement>('[data-path]') : null)

export function EditSurface({ edit, deck, ctx, onSlide, children }: Props) {
  const frame = useRef<HTMLDivElement>(null), editRef = useRef(edit)
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
    const keep = editRef.current.takeSelect()
    if (keep) { const f = s.querySelector<HTMLElement>(`[data-path="${keep.path}"]`); if (f) { f.focus(); selectRange(f, keep.from, keep.to) } }
    const want = editRef.current.takeFocus()
    if (want) {
      const f = s.querySelector<HTMLElement>(`[data-path="${want}"]`) ?? s.querySelector<HTMLElement>(`[data-item="${want}"] [data-path]`)
      if (f) { f.focus(); setCaret(f, 0) }
    }
    const fit = () => s.style.setProperty('--s', String(el.clientWidth / 1920))
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    onSlide(s)
    return () => { ro.disconnect(); onSlide(null) }
    // Primitives only: a new ctx object on each render must not remount the slide under the cursor.
  }, [edit.shown, ctx.page, ctx.section, ctx.kicker, ctx.footer, style, theme, accent, onSlide])

  // While a save runs, the fields stop taking text: what is typed now would be lost when edit mode closes.
  useEffect(() => { frame.current?.querySelectorAll<HTMLElement>('[data-path]').forEach((f) => { f.contentEditable = edit.saving ? 'false' : 'true' }) }, [edit.saving, edit.shown])

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
      // Enter and Escape while composing confirm or cancel the candidate; they are not ours.
      if (!f || e.isComposing || e.keyCode === 229) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && ['i', 'u'].includes(e.key)) { e.preventDefault(); return }
      if (e.key !== 'Enter' || mod) return
      e.preventDefault()
      // Enter in a list item adds the next item; anywhere else it does nothing.
      const itemEl = f.closest<HTMLElement>('[data-item]'), cur = editRef.current
      const hit = itemEl && listOf(listOps(cur.draft, style), itemEl.dataset.item ?? '')
      if (!hit || hit.op.length >= hit.op.max) return
      const set = newItem(cur.draft, style, hit.op, hit.index + 1)
      const tail = (f.dataset.path ?? '').slice((itemEl.dataset.item ?? '').length)
      cur.patch(set, `${hit.op.path}[${hit.index + 1}]${tail}`)
    }
    // A menu or bar taking focus is not leaving: committing would redraw the slide under the selection it acts on.
    const onLeave = (e: FocusEvent) => { const to = e.relatedTarget; if (fieldOf(e.target) && !fieldOf(to) && !(to instanceof Element && to.closest('[data-edit-chrome]'))) editRef.current.commit() }
    // What is selected, as the model sees it: a selection inside one field. Menus and bars read it.
    const onSelect = () => {
      const sel = window.getSelection(), node = sel?.anchorNode, f = node ? (node instanceof Element ? node : node.parentElement)?.closest<HTMLElement>('[data-path]') : null
      if (!f || !el.contains(f)) return
      const r = caretRange(f), cur = editRef.current.target
      if (!r) return
      const next = { kind: 'text' as const, path: f.dataset.path ?? '', from: Math.min(...r), to: Math.max(...r) }
      if (next.from !== next.to || cur.kind === 'text') { if (cur.kind !== 'text' || cur.path !== next.path || cur.from !== next.from || cur.to !== next.to) editRef.current.setTarget(next) }
    }
    document.addEventListener('selectionchange', onSelect)
    el.addEventListener('input', onInput); el.addEventListener('compositionend', onComposed)
    el.addEventListener('paste', onPaste); el.addEventListener('keydown', onKey); el.addEventListener('focusout', onLeave)
    return () => {
      el.removeEventListener('input', onInput); el.removeEventListener('compositionend', onComposed)
      el.removeEventListener('paste', onPaste); el.removeEventListener('keydown', onKey); el.removeEventListener('focusout', onLeave); document.removeEventListener('selectionchange', onSelect)
    }
  }, [style])

  return (
    <div className="absolute inset-0" data-editing>
      <div ref={frame} className="absolute inset-0" />
      {children}
    </div>
  )
}

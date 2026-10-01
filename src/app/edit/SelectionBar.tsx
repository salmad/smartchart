/* Bold and Focus over selected text, in fields that take markup (spec 3). Positive and negative are the agent's. */
import { useEffect, useState } from 'react'
import { Bold, Highlighter } from 'lucide-react'
import { getAt } from '@/engine/slides/edit'
import { hasMark, toggle, type Mark } from '@/engine/slides/markup'
import { caretRange, isMarkup, redraw, selectRange } from './fields'
import type { SlideEdit } from './useSlideEdit'

export function SelectionBar({ edit, slide }: { edit: SlideEdit; slide: HTMLElement | null }) {
  const [at, setAt] = useState<{ el: HTMLElement; from: number; to: number; box: DOMRect } | null>(null)
  useEffect(() => {
    const change = () => {
      const sel = window.getSelection(), node = sel?.anchorNode
      const el = node && (node instanceof Element ? node : node.parentElement)?.closest<HTMLElement>('[data-path]')
      const r = el && slide?.contains(el) && isMarkup(el) ? caretRange(el) : null
      setAt(el && r && r[0] !== r[1] && sel?.rangeCount ? { el, from: r[0], to: r[1], box: sel.getRangeAt(0).getBoundingClientRect() } : null)
    }
    document.addEventListener('selectionchange', change)
    return () => document.removeEventListener('selectionchange', change)
  }, [slide])
  if (!at || !slide) return null
  const markup = String(getAt(edit.draft, at.el.dataset.path ?? '') ?? '')
  const apply = (m: Mark) => {
    const next = toggle(markup, at.from, at.to, m)
    edit.set(at.el.dataset.path ?? '', next); redraw(at.el, next); selectRange(at.el, at.from, at.to)
  }
  const frame = slide.parentElement?.getBoundingClientRect()
  const place = (m: HTMLElement | null) => { if (!m || !frame) return; m.style.setProperty('--x', `${at.box.left - frame.left + at.box.width / 2}px`); m.style.setProperty('--y', `${at.box.top - frame.top - 8}px`) }
  const btn = (m: Mark, label: string, Icon: typeof Bold) => (
    <button type="button" aria-label={label} aria-pressed={hasMark(markup, at.from, at.to, m)} onMouseDown={(e) => e.preventDefault()} onClick={() => apply(m)}
      className="grid size-7 place-items-center rounded-md text-ink-2 hover:bg-line aria-pressed:text-ink aria-pressed:bg-line"><Icon className="size-4" /></button>
  )
  return (
    <div ref={place} role="toolbar" aria-label="Text emphasis"
      className="absolute left-[var(--x)] top-[var(--y)] z-10 flex -translate-x-1/2 -translate-y-full gap-0.5 rounded-lg bg-raise p-1 shadow-[0_0_0_1px_theme(colors.line-2),0_8px_24px_rgba(0,0,0,.4)]">
      {btn('b', 'Bold', Bold)}{btn('f', 'Focus', Highlighter)}
    </div>
  )
}

/* How a reader starts a comment on the page: a small Comment button beside selected words, and on a pointer that
   hovers, one beside the heading or figure under it. Both are drawn over the page, not into it (the page is redrawn
   whenever the doc is), in the page's own colours. Words selected in a figure comment on the figure, without a quote. */
import { useEffect, useRef, useState } from 'react'
import { MessageSquarePlus } from 'lucide-react'
import type { Theme } from '@/engine/types'
import { cn } from '@/app/lib/utils'
import { surface, tintOnHover } from './chrome'
import { WHOLE_DOC } from './anchors'
import type { CommentTarget } from './DocComments'

interface Props { page: HTMLElement | null; theme: Theme; onPick: (t: CommentTarget) => void }
interface Spot { x: number; y: number; target: CommentTarget; label: string; below?: boolean }

const QUOTE = 200
/** The section, subsection or figure an element sits in; the whole doc when it sits in none. */
function anchorOf(el: Element | null): string {
  const fig = el?.closest('.doc-fig[id]'); if (fig) return fig.id
  const sec = el?.closest('.doc-sec'); return sec?.id ?? WHOLE_DOC
}

export function CommentTriggers({ page, theme, onPick }: Props) {
  const [pick, setPick] = useState<Spot | null>(null), [hover, setHover] = useState<Spot | null>(null), timer = useRef(0)

  useEffect(() => {
    if (!page) return
    const select = () => {
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => {
        const sel = window.getSelection(), range = sel && !sel.isCollapsed && sel.rangeCount ? sel.getRangeAt(0) : null
        const inside = range && page.contains(range.commonAncestorContainer) && !(range.commonAncestorContainer instanceof Element ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement)?.closest('dialog')
        const quote = sel?.toString().replace(/\s+/g, ' ').trim().slice(0, QUOTE)
        if (!range || !inside || !quote) { setPick(null); return }
        const el = range.commonAncestorContainer instanceof Element ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement
        const box = range.getBoundingClientRect(), anchor = anchorOf(el), inFigure = !!el?.closest('.doc-fig')
        const coarse = window.matchMedia('(pointer: coarse)').matches, below = coarse || box.top < 96
        setPick({ x: box.left + box.width / 2, y: below ? box.bottom + 8 : box.top - 8, below, target: { anchor, ...(inFigure ? {} : { quote }) }, label: 'Comment on the selection' })
      }, 120)
    }
    const over = (e: MouseEvent) => {
      if (!window.matchMedia('(pointer: fine)').matches) return
      const t = e.target instanceof Element ? e.target : null
      const head = t?.closest('.doc-sec > h2, h3[id]'), fig = t?.closest('.doc-fig[id]')
      const el = head ?? fig
      if (!el) return
      const id = head ? (head.matches('h2') ? head.parentElement?.id : head.id) : fig?.id
      if (!id) return
      const r = head ? (() => { const g = document.createRange(); g.selectNodeContents(head.querySelector('a') ?? head); return g.getBoundingClientRect() })() : el.getBoundingClientRect()
      const name = head ? head.textContent?.trim() ?? '' : 'figure'
      setHover({ x: head ? r.right + 8 + 14 : r.right - 8 - 16, y: head ? r.top + r.height / 2 : r.top + 8 + 16, target: { anchor: id }, label: `Comment on “${name}”` })
    }
    const away = (e: MouseEvent) => { if (!(e.relatedTarget instanceof Element && e.relatedTarget.closest('[data-comment-trigger]'))) setHover(null) }
    const clear = () => setHover(null)
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPick(null)
      if ((e.metaKey || e.ctrlKey) && e.altKey && e.code === 'KeyM') { e.preventDefault(); setPick((p) => { if (p) onPick(p.target); return null }) }
    }
    document.addEventListener('selectionchange', select); page.addEventListener('mouseover', over); page.addEventListener('mouseleave', away)
    document.addEventListener('keydown', key); window.addEventListener('scroll', clear, true)
    return () => {
      window.clearTimeout(timer.current)
      document.removeEventListener('selectionchange', select); page.removeEventListener('mouseover', over); page.removeEventListener('mouseleave', away)
      document.removeEventListener('keydown', key); window.removeEventListener('scroll', clear, true)
    }
  }, [page, onPick])

  const button = (s: Spot, shortcut: boolean, label: string | null) => (
    <button type="button" data-comment-trigger aria-label={s.label} title={shortcut ? `${s.label} (⌘⌥M)` : s.label}
      // The selection must survive the press.
      onMouseDown={(e) => e.preventDefault()} onClick={() => { onPick(s.target); setPick(null); setHover(null) }}
      className={cn('fixed left-[var(--x)] top-[var(--y)] z-30 flex h-8 cursor-pointer items-center gap-1.5 rounded-lg text-[13px] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]', surface, tintOnHover,
        label ? '-translate-x-1/2 px-2.5' : '-translate-x-1/2 -translate-y-1/2 px-2', label && !s.below && '-translate-y-full')}
      ref={(el) => { el?.style.setProperty('--x', `${s.x}px`); el?.style.setProperty('--y', `${s.y}px`) }}>
      <MessageSquarePlus aria-hidden className="size-3.5" strokeWidth={1.75} />{label}
    </button>
  )
  return (
    <div className={`theme-${theme} contents`} data-print-hide>
      {pick && button(pick, true, 'Comment')}
      {!pick && hover && button(hover, false, null)}
    </div>
  )
}

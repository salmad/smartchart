// src/app/edit/ActionBar.tsx
/* The floating bar over a selection: its few main actions (Bold and Focus on text or on a range of cells). It reads the
   same actions as the context menu, so the two never differ. */
import { Bold, Highlighter } from 'lucide-react'
import { actionsFor } from '@/engine/slides/actions'
import type { Style } from '@/engine/types'
import { rectOf } from './selection'
import type { SlideEdit } from './useSlideEdit'

const ICON = { bold: Bold, focus: Highlighter } as const

export function ActionBar({ edit, slide, deckStyle }: { edit: SlideEdit; slide: HTMLElement | null; deckStyle: Style }) {
  if (!slide) return null
  const box = rectOf(edit.target, slide), actions = actionsFor(edit.target, edit.draft, deckStyle).filter((a) => a.bar)
  const frame = slide.parentElement?.getBoundingClientRect()
  if (!box || !frame || !actions.length) return null
  const place = (m: HTMLElement | null) => { if (!m) return; m.style.setProperty('--x', `${box.left - frame.left + box.width / 2}px`); m.style.setProperty('--y', `${box.top - frame.top - 8}px`) }
  return (
    <div ref={place} role="toolbar" aria-label="Text emphasis" data-edit-chrome
      className="absolute left-[var(--x)] top-[var(--y)] z-10 flex -translate-x-1/2 -translate-y-full gap-0.5 rounded-lg bg-raise p-1 shadow-[0_0_0_1px_theme(colors.line-2),0_8px_24px_rgba(0,0,0,.4)]">
      {actions.map((a) => {
        const Icon = ICON[a.id as keyof typeof ICON]
        return (
          <button key={a.id} type="button" aria-label={a.label} aria-pressed={a.checked} onMouseDown={(e) => e.preventDefault()} onClick={() => edit.apply(a.run())}
            className="grid size-7 place-items-center rounded-md text-ink-2 hover:bg-line aria-pressed:bg-line aria-pressed:text-ink">{Icon && <Icon className="size-4" />}</button>
        )
      })}
    </div>
  )
}

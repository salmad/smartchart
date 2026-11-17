import { useRef, useState } from 'react'
import { StatusGlyph } from './StatusGlyph'

interface Props {
  onCommit: (title: string) => void
  onCancel: () => void
}

/** The Gantt list's New issue row: a real row (glyph where the glyph goes, title where the title goes) with the
    title still to type. */
export function GanttCompose({ onCommit, onCancel }: Props) {
  const [title, setTitle] = useState('')
  const settled = useRef(false)
  const settle = (fn: () => void) => { if (settled.current) return; settled.current = true; fn() }
  const done = () => settle(() => { const t = title.trim(); if (t) onCommit(t); else onCancel() })
  return (
    <div className="flex h-full animate-in fade-in-0 items-center gap-2 bg-ink/[.045] pl-3 pr-3 text-[13px] shadow-[inset_2px_0_0_theme(colors.ink)] duration-150 ease-out-strong motion-reduce:animate-none">
      <span className="size-5 shrink-0" aria-hidden />
      <StatusGlyph status="todo" className="size-3.5 shrink-0" />
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); done() }
          else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); settle(onCancel) }
        }}
        onBlur={done}
        aria-label="New issue title"
        placeholder="Issue title"
        className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[13px] text-ink outline-none ring-0 placeholder:text-ink-3 focus:ring-0"
      />
    </div>
  )
}

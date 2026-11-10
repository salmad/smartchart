import { useRef, useState } from 'react'
import { StatusGlyph } from './StatusGlyph'

interface Props {
  onCommit: (title: string) => void
  onCancel: () => void
}

/** The Gantt list's own New issue row, in the table's compose language: an inset bar, no input box. */
export function GanttCompose({ onCommit, onCancel }: Props) {
  const [title, setTitle] = useState('')
  const settled = useRef(false)
  const settle = (fn: () => void) => { if (settled.current) return; settled.current = true; fn() }
  const done = () => settle(() => { const t = title.trim(); if (t) onCommit(t); else onCancel() })
  return (
    <div className="flex h-[34px] animate-in fade-in-0 slide-in-from-top-1 items-center gap-1.5 border-b border-hair bg-white/[.045] duration-150 ease-out-strong motion-reduce:animate-none px-2 text-[12.5px] shadow-[inset_2px_0_0_theme(colors.ink)]">
      <span className="inline-block w-3 shrink-0" aria-hidden />
      <StatusGlyph status="todo" className="size-3.5 shrink-0" />
      <span className="w-[52px] shrink-0 pl-1 font-mono text-[11.5px] text-ink-3">…</span>
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
        className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[12.5px] text-ink outline-none ring-0 placeholder:text-ink-3 focus:ring-0"
      />
    </div>
  )
}

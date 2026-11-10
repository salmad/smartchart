import { useState, type ReactNode } from 'react'
import type { Issue, Roadmap } from '@/engine/roadmaps/types'
import { keyOf } from '@/engine/roadmaps/fields'
import { StatusGlyph } from './StatusGlyph'
import { Command, CommandItem, CommandList } from '../ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'

interface Props {
  roadmap: Roadmap
  issues: Issue[]
  ids: string[]
  label: string
  focused: boolean
  onFocus: () => void
  onOpen: (id: string) => void
  children?: ReactNode
}

/** Lists top-most issues in a matrix cell; one pick opens the panel. */
export function MatrixPicker({ roadmap, issues, ids, label, focused, onFocus, onOpen, children }: Props) {
  const [open, setOpen] = useState(false)
  const picks = ids.map((id) => issues.find((i) => i.id === id)).filter((i): i is Issue => !!i)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          tabIndex={focused ? 0 : -1}
          aria-label={label}
          className="flex min-h-[28px] w-full flex-col items-center justify-center gap-0.5 rounded px-1 py-0.5 outline-none hover:bg-white/[.03] focus-visible:ring-1 focus-visible:ring-line"
          onFocus={onFocus}
        >
          <span className="text-[12px] font-medium tabular-nums text-ink">{ids.length}</span>
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-72 p-0" aria-label="Issues in cell">
        <Command>
          <CommandList label="Issues">
            {picks.map((i) => (
              <CommandItem
                key={i.id}
                value={`${keyOf(roadmap, i)} ${i.title}`}
                onSelect={() => { onOpen(i.id); setOpen(false) }}
                className="gap-2 text-[13px]"
              >
                <StatusGlyph status={i.status} className="size-3.5 shrink-0" />
                <span className="font-mono text-[11.5px] text-ink-3">{keyOf(roadmap, i)}</span>
                <span className="truncate">{i.title}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

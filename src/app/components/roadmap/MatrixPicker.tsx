import { useState, type ReactNode } from 'react'
import { cn } from '@/app/lib/utils'
import type { Issue, Roadmap } from '@/engine/roadmaps/types'
import { keyOf } from '@/engine/roadmaps/fields'
import { StatusGlyph } from './StatusGlyph'
import { Command, CommandItem, CommandList } from '../ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { menuCommand, menuSurface } from './roadmapChrome'

interface Props {
  roadmap: Roadmap
  picks: Issue[]
  label: string
  cellTag: string
  focused: boolean
  onFocus: () => void
  onOpen: (id: string) => void
  className: string
  children: ReactNode
}

/** A cell holding several issues: it lists them, and one pick opens the panel. */
export function MatrixPicker({ roadmap, picks, label, cellTag, focused, onFocus, onOpen, className, children }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" tabIndex={focused ? 0 : -1} data-matrix-cell={cellTag} aria-label={label} className={className} onFocus={onFocus}>
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className={cn('w-80 p-1', menuSurface)} aria-label="Issues in cell">
        <Command className={menuCommand}>
          <CommandList label="Issues">
            {picks.map((i) => (
              <CommandItem
                key={i.id}
                value={`${keyOf(roadmap, i)} ${i.title}`}
                onSelect={() => { onOpen(i.id); setOpen(false) }}
                className="gap-2 text-[13px]"
              >
                <StatusGlyph status={i.status} />
                <span className="min-w-0 flex-1 truncate" title={i.title}>{i.title}</span>
                <span className="whitespace-nowrap text-[12px] tabular-nums text-ink-3">{keyOf(roadmap, i)}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

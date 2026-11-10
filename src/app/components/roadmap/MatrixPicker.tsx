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
  issues: Issue[]
  ids: string[]
  label: string
  cellTag: string
  focused: boolean
  onFocus: () => void
  onOpen: (id: string) => void
  className?: string
  children?: ReactNode
}

/** Lists top-most issues in a matrix cell; one pick opens the panel. */
export function MatrixPicker({ roadmap, issues, ids, label, cellTag, focused, onFocus, onOpen, className, children }: Props) {
  const [open, setOpen] = useState(false)
  const picks = ids.map((id) => issues.find((i) => i.id === id)).filter((i): i is Issue => !!i)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          tabIndex={focused ? 0 : -1}
          data-matrix-cell={cellTag}
          aria-label={label}
          className={cn(className, 'cursor-pointer')}
          onFocus={onFocus}
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent align="center" sideOffset={6} className={cn('w-72 overflow-hidden p-1', menuSurface)} aria-label="Issues in cell">
        <Command className={menuCommand}>
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

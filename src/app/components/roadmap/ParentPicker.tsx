import { useState } from 'react'
import type { Issue, Roadmap } from '@/engine/roadmaps/types'
import { keyOf } from '@/engine/roadmaps/fields'
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '../ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'

interface Props {
  roadmap: Roadmap
  parent: Issue | null
  choices: Issue[]
  onPick: (parentId: string | null) => void
}

/** Select, then it applies: type to find the parent by key or title. */
export function ParentPicker({ roadmap, parent, choices, onPick }: Props) {
  const [open, setOpen] = useState(false)
  const pick = (id: string | null) => { onPick(id); setOpen(false) }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label="Parent issue" className="flex min-w-0 items-center gap-1.5 rounded px-1 py-0.5 text-left hover:bg-raise">
          {parent ? (
            <>
              <span className="font-mono text-[11.5px] text-ink-3">{keyOf(roadmap, parent)}</span>
              <span className="truncate text-ink">{parent.title}</span>
            </>
          ) : <span className="text-ink-3">None</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0" aria-label="Choose parent">
        <Command>
          <CommandInput placeholder="Find an issue…" className="text-[13px]" />
          <CommandList label="Parents">
            <CommandEmpty>No issue fits.</CommandEmpty>
            <CommandItem value="none" onSelect={() => pick(null)} className="text-[13px] text-ink-2">No parent</CommandItem>
            {choices.map((i) => (
              <CommandItem key={i.id} value={`${keyOf(roadmap, i)} ${i.title}`} onSelect={() => pick(i.id)} className="gap-2 text-[13px]">
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

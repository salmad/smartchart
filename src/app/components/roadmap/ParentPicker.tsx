import { useState } from 'react'
import type { Issue, Roadmap } from '@/engine/roadmaps/types'
import { keyOf } from '@/engine/roadmaps/fields'
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '../ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { cn } from '@/app/lib/utils'
import { IssueKey, Placeholder, ValueButton } from './issueParts'
import { menuCommand, menuSurface } from './roadmapChrome'

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
        <ValueButton aria-label="Parent issue" title={parent?.title}>
          {parent ? (
            <>
              <span className="truncate">{parent.title}</span>
              <IssueKey roadmap={roadmap} issue={parent} />
            </>
          ) : <Placeholder>Add parent</Placeholder>}
        </ValueButton>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className={cn('w-72 overflow-hidden p-0', menuSurface)} aria-label="Choose parent">
        <Command className={cn(menuCommand, '[&_[cmdk-list]]:p-1')}>
          <CommandInput placeholder="Find an issue…" className="text-[13px]" />
          <CommandList label="Parents">
            <CommandEmpty>No issue fits.</CommandEmpty>
            {parent && <CommandItem value="none" onSelect={() => pick(null)} className="text-[13px] text-ink-2">No parent</CommandItem>}
            {choices.map((i) => (
              <CommandItem key={i.id} value={`${keyOf(roadmap, i)} ${i.title}`} onSelect={() => pick(i.id)} className="gap-2 text-[13px]">
                <span className="min-w-0 flex-1 truncate">{i.title}</span>
                <IssueKey roadmap={roadmap} issue={i} />
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

import { useState } from 'react'
import type { MemberLite } from '@/engine/roadmaps/types'
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover'
import { Command, CommandItem, CommandList } from '../../ui/command'

interface Props {
  assignee: string | null
  members: MemberLite[]
  disabled?: boolean
  onPick: (id: string | null) => void
}

export function PersonCell({ assignee, members, disabled, onPick }: Props) {
  const [open, setOpen] = useState(false)
  const name = members.find((m) => m.id === assignee)?.name ?? ''
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button type="button" className="block w-full truncate rounded px-1 py-0.5 text-left hover:bg-raise" aria-label={name ? `Assignee: ${name}` : 'Assignee: unassigned'}>
          {name || <span className="text-ink-3">—</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-48 p-0" aria-label="Choose assignee">
        <Command>
          <CommandList label="Members">
            <CommandItem value="none" onSelect={() => { onPick(null); setOpen(false) }} className="text-[13px]">
              Unassigned
            </CommandItem>
            {members.map((m) => (
              <CommandItem key={m.id} value={m.id} onSelect={() => { onPick(m.id); setOpen(false) }} className="text-[13px]">
                {m.name}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

import { useState } from 'react'
import type { MemberLite } from '@/engine/roadmaps/types'
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover'
import { Command, CommandItem, CommandList } from '../../ui/command'
import { Avatar } from '../Avatar'

interface Props {
  assignee: string | null
  members: MemberLite[]
  disabled?: boolean
  onPick: (id: string | null) => void
  /** The table shows the disc alone; the panel shows the name too. */
  withName?: boolean
}

export function PersonCell({ assignee, members, disabled, onPick, withName }: Props) {
  const [open, setOpen] = useState(false)
  const name = members.find((m) => m.id === assignee)?.name ?? ''
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          title={name || undefined}
          className="flex min-w-0 items-center gap-1.5 rounded px-1 py-0.5 text-left text-ink hover:bg-raise disabled:hover:bg-transparent"
          aria-label={name ? `Assignee: ${name}` : 'Assignee: unassigned'}
        >
          {name ? <Avatar name={name} /> : <span className="text-ink-3">—</span>}
          {name && withName && <span className="truncate">{name}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-48 p-0" aria-label="Choose assignee">
        <Command>
          <CommandList label="Members">
            <CommandItem value="none" onSelect={() => { onPick(null); setOpen(false) }} className="text-[13px]">
              Unassigned
            </CommandItem>
            {members.map((m) => (
              <CommandItem key={m.id} value={m.id} onSelect={() => { onPick(m.id); setOpen(false) }} className="gap-2 text-[13px]">
                <Avatar name={m.name} />
                {m.name}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

import { useState } from 'react'
import type { Status } from '@/engine/roadmaps/types'
import { STATUS_LABEL, STATUSES } from '@/engine/roadmaps/types'
import { StatusGlyph } from '../StatusGlyph'
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover'
import { Command, CommandItem, CommandList } from '../../ui/command'

interface Props {
  status: Status
  disabled?: boolean
  onPick: (status: Status) => void
}

export function StatusCell({ status, disabled, onPick }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button type="button" className="rounded p-0.5 hover:bg-raise" aria-label={`Status: ${STATUS_LABEL[status]}`}>
          <StatusGlyph status={status} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-44 p-0" aria-label="Choose status">
        <Command>
          <CommandList label="Statuses">
            {STATUSES.map((s) => (
              <CommandItem
                key={s}
                value={s}
                onSelect={() => { onPick(s); setOpen(false) }}
                className="gap-2 text-[13px]"
              >
                <StatusGlyph status={s} />
                {STATUS_LABEL[s]}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

import { useState, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover'
import { Command, CommandItem, CommandList } from '../../ui/command'
import { cn } from '@/app/lib/utils'
import { menuCommand } from '../roadmapChrome'

export interface CellOption {
  id: string
  name: string
  icon?: ReactNode
}

interface Props {
  /** Names the popover ("Choose status"). */
  label: string
  /** Names the list inside it ("Statuses"). */
  listLabel: string
  options: CellOption[]
  value: string | null
  /** The row that empties the value ("Unassigned", "Clear"); leave out where a value is required. */
  none?: string
  disabled?: boolean
  onPick: (id: string | null) => void
  /** The trigger: one button. */
  children: ReactNode
}

/** The one picker behind every cell that chooses from a list: it opens under its cell's left edge and ticks the current value. */
export function CellMenu({ label, listLabel, options, value, none, disabled, onPick, children }: Props) {
  const [open, setOpen] = useState(false)
  const pick = (id: string | null) => { onPick(id); setOpen(false) }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>{children}</PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className={cn('w-52 overflow-hidden p-1')} aria-label={label}>
        <Command className={menuCommand}>
          <CommandList label={listLabel}>
            {none && (
              <CommandItem value="none" onSelect={() => pick(null)} className="text-[13px] text-ink-2">
                {none}
              </CommandItem>
            )}
            {options.map((o) => (
              <CommandItem key={o.id} value={o.id} keywords={[o.name]} onSelect={() => pick(o.id)} className="gap-2 text-[13px]">
                {o.icon}
                <span className="truncate">{o.name}</span>
                {o.id === value && <Check className="ml-auto size-3.5 text-ink-2" strokeWidth={2} aria-hidden />}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

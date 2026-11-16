import { useState } from 'react'
import { cn } from '@/app/lib/utils'
import { Button } from '../../ui/button'
import { Calendar } from '../../ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover'
import { dateOf, isoOf, shortDate, todayIso } from '../dates'
import { menuSurface } from '../roadmapChrome'
import { CellButton } from './CellButton'

interface Props {
  value: string | null
  label: string
  disabled?: boolean
  /** Past due on an open issue: the one place a date turns red. */
  late?: boolean
  /** Always-visible words for no date (the panel's "Start → Due"); the table leaves it out. */
  placeholder?: string
  onPick: (iso: string | null) => void
}

/** A date as quiet text ("2 Nov"); a click opens a calendar under it. */
export function DateCell({ value, label, disabled, late, placeholder, onPick }: Props) {
  const [open, setOpen] = useState(false)
  const pick = (iso: string | null) => { onPick(iso); setOpen(false) }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <CellButton
          empty={!value}
          placeholder={placeholder}
          aria-label={value ? `${label}: ${value}` : `${label}: none`}
          className={cn('whitespace-nowrap tabular-nums', late ? 'text-bad' : 'text-ink-2')}
        >
          {value && shortDate(value, todayIso())}
        </CellButton>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className={cn('w-auto overflow-hidden p-0', menuSurface)} aria-label={label}>
        <Calendar
          className="bg-transparent"
          mode="single"
          selected={value ? dateOf(value) : undefined}
          defaultMonth={value ? dateOf(value) : undefined}
          onSelect={(d) => pick(d ? isoOf(d) : null)}
        />
        {value && (
          <div className="border-t border-line p-1">
            <Button variant="ghost" size="sm" className="w-full justify-start px-2 font-normal hover:bg-panel" onClick={() => pick(null)}>
              Clear date
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

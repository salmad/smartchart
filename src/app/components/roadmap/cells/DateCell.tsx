import { useState } from 'react'
import { cn } from '@/app/lib/utils'
import { Calendar } from '../../ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover'
import { dateOf, isoOf, shortDate, todayIso } from '../dates'

interface Props {
  value: string | null
  label: string
  disabled?: boolean
  /** Past due on an open issue: the one place a date turns red. */
  late?: boolean
  /** Shown when empty instead of a dash (the panel's Dates row reads "Start → Due"). */
  placeholder?: string
  onPick: (iso: string | null) => void
}

/** A date as quiet text ("2 Nov"); a click opens a calendar. */
export function DateCell({ value, label, disabled, late, placeholder, onPick }: Props) {
  const [open, setOpen] = useState(false)
  const today = todayIso()
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          aria-label={value ? `${label}: ${value}` : `${label}: none`}
          className={cn('rounded px-1 py-0.5 text-left tabular-nums hover:bg-raise disabled:hover:bg-transparent', late ? 'text-bad' : 'text-ink-2')}
        >
          {value ? shortDate(value, today) : <span className="text-ink-3">{placeholder ?? '—'}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0" aria-label={label}>
        <Calendar
          mode="single"
          selected={value ? dateOf(value) : undefined}
          defaultMonth={value ? dateOf(value) : undefined}
          onSelect={(d) => { onPick(d ? isoOf(d) : null); setOpen(false) }}
        />
        {value && (
          <button
            type="button"
            className="w-full border-t border-line px-3 py-2 text-left text-[12px] text-ink-2 hover:bg-raise hover:text-ink"
            onClick={() => { onPick(null); setOpen(false) }}
          >
            Clear date
          </button>
        )}
      </PopoverContent>
    </Popover>
  )
}

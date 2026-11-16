import { useState } from 'react'
import { X } from 'lucide-react'
import type { Chip } from '@/engine/roadmaps/view'
import type { FieldDef, MemberLite, Status } from '@/engine/roadmaps/types'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { chipLabel, chipParts, namesShort } from './chipLabel'
import { chipProperty, FilterValuePicker, pickNoun, pickOptions } from './FilterValuePicker'
import { cn } from '@/app/lib/utils'

interface Props {
  chip: Chip
  fields: FieldDef[]
  members: MemberLite[]
  /** The chip as edited in place; null removes it. */
  onPut: (chip: Chip | null) => void
}

const PART = 'h-full whitespace-nowrap px-1.5 outline-none transition-colors hover:bg-raise hover:text-ink focus-visible:bg-raise focus-visible:text-ink data-[state=open]:bg-raise data-[state=open]:text-ink'

/** One active filter in the toolbar. A value filter reads as a sentence; its values reopen the picker, and the cross
    removes it. */
export function FilterChip({ chip, fields, members, onPut }: Props) {
  const [open, setOpen] = useState(false)
  const label = chipLabel(chip, fields, members)
  const parts = chipParts(chip, fields, members)
  const property = chipProperty(chip, fields)
  const values = chip.on === 'status' || chip.on === 'assignee' || chip.on === 'field' ? chip.values : null

  const withValues = (next: (string | null)[]): Chip | null => {
    if (!next.length) return null
    if (chip.on === 'status') return { ...chip, values: next as Status[] }
    if (chip.on === 'assignee' || chip.on === 'field') return { ...chip, values: next }
    return chip
  }

  return (
    <span className="inline-flex h-7 flex-none items-center overflow-hidden rounded-md border border-line bg-panel text-[12px] text-ink-2">
      {parts && values && property ? (
        <>
          <span className="whitespace-nowrap pl-2 pr-1 text-ink-3">{parts.on}</span>
          <span className="whitespace-nowrap pr-0.5 text-ink-3">{parts.is ? 'is' : 'is not'}</span>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button type="button" className={cn(PART, 'font-medium text-ink')} aria-label={`Change ${label}`}>
                {namesShort(parts.names)}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" sideOffset={8} className="w-[min(16rem,calc(100vw-1.5rem))] overflow-hidden p-0" aria-label={`${parts.on} ${parts.is ? 'is' : 'is not'}`}>
              <FilterValuePicker
                options={pickOptions(property, members)}
                selected={values}
                noun={pickNoun(property)}
                onChange={(next) => onPut(withValues(next))}
              />
            </PopoverContent>
          </Popover>
        </>
      ) : (
        <span className="whitespace-nowrap pl-2 pr-1">{label}</span>
      )}
      <button
        type="button"
        className="mr-1 grid size-5 place-items-center rounded text-ink-3 outline-none transition-colors hover:bg-raise hover:text-ink focus-visible:ring-1 focus-visible:ring-line-2"
        aria-label={`Remove ${label}`}
        onClick={() => onPut(null)}
      >
        <X className="size-3" strokeWidth={2} aria-hidden />
      </button>
    </span>
  )
}

import { Plus } from 'lucide-react'
import { useState } from 'react'
import type { ViewSettings } from '@/engine/roadmaps/view'
import type { FieldDef } from '@/engine/roadmaps/types'
import { STATUS_LABEL, STATUSES, type Status } from '@/engine/roadmaps/types'
import { liveChips } from '@/engine/roadmaps/view'
import { FilterChip } from './FilterChip'
import { groupByLabel } from './DisplayMenu'
import { Button } from '../ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'

type ViewChange = ViewSettings | ((prev: ViewSettings) => ViewSettings)

interface Props {
  fields: FieldDef[]
  view: ViewSettings
  issueCount: number
  onChange: (v: ViewChange) => void
}

export function FilterBar({ fields, view, issueCount, onChange }: Props) {
  const group = groupByLabel(view, fields)
  const [open, setOpen] = useState(false)

  const addStatus = (status: Status, is: boolean) => {
    onChange((v) => ({ ...v, chips: [...v.chips, { on: 'status', is, values: [status] }] }))
    setOpen(false)
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2">
      {view.chips.map((chip, i) => {
        const live = liveChips(fields, [chip])[0]
        if (!live) return null
        return (
          <FilterChip
            key={`${chip.on}-${i}`}
            chip={live}
            fields={fields}
            onRemove={() => onChange((v) => ({ ...v, chips: v.chips.filter((_, j) => j !== i) }))}
          />
        )
      })}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-[12px] text-ink-3 hover:text-ink">
            <Plus className="size-3.5" strokeWidth={2} aria-hidden />
            Filter
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="max-h-80 w-56 overflow-y-auto p-1 text-[13px]" aria-label="Add a filter">
          {STATUSES.map((s) => (
            <button
              key={`is-${s}`}
              type="button"
              className="block w-full rounded-md px-2 py-1.5 text-left text-ink-2 hover:bg-raise hover:text-ink"
              onClick={() => addStatus(s, true)}
            >
              Status is {STATUS_LABEL[s]}
            </button>
          ))}
          {STATUSES.map((s) => (
            <button
              key={`not-${s}`}
              type="button"
              className="block w-full rounded-md px-2 py-1.5 text-left text-ink-2 hover:bg-raise hover:text-ink"
              onClick={() => addStatus(s, false)}
            >
              Status is not {STATUS_LABEL[s]}
            </button>
          ))}
        </PopoverContent>
      </Popover>
      <span className="flex-1" />
      <p className="text-[12px] text-ink-3">
        {group && <>Group by <span className="font-medium text-ink-2">{group}</span>{' · '}</>}
        {issueCount} {issueCount === 1 ? 'issue' : 'issues'}
      </p>
    </div>
  )
}

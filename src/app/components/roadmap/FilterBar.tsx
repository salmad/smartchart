import { ListFilter } from 'lucide-react'
import { useState } from 'react'
import type { Chip, ViewSettings } from '@/engine/roadmaps/view'
import type { FieldDef, MemberLite } from '@/engine/roadmaps/types'
import { liveChips } from '@/engine/roadmaps/view'
import { FilterChip } from './FilterChip'
import { FilterAddMenu } from './FilterAddMenu'
import { groupByLabel } from './DisplayMenu'
import { Button } from '../ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { cn } from '@/app/lib/utils'
import { chromeGhost, menuSurface } from './roadmapChrome'

type ViewChange = ViewSettings | ((prev: ViewSettings) => ViewSettings)

interface Props {
  fields: FieldDef[]
  members: MemberLite[]
  today: string
  view: ViewSettings
  issueCount: number
  onChange: (v: ViewChange) => void
}

export function FilterBar({ fields, members, today, view, issueCount, onChange }: Props) {
  const group = groupByLabel(view, fields)
  const [open, setOpen] = useState(false)

  const addChip = (chip: Chip) => {
    onChange((v) => ({ ...v, chips: [...v.chips, chip] }))
    setOpen(false)
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-hair px-4 py-1.5">
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
      {view.chips.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className={cn('h-6 px-2 text-[11.5px]', chromeGhost)}
          onClick={() => onChange((v) => ({ ...v, chips: [] }))}
        >
          Clear all
        </Button>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className={cn('h-7 gap-1 px-2 text-[12px]', chromeGhost)}>
            <ListFilter className="size-3.5" strokeWidth={1.75} aria-hidden />
            Filter
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={8}
          className={cn('w-[min(17rem,calc(100vw-1.5rem))] overflow-hidden p-0', menuSurface)}
          aria-label="Add a filter"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {open && (
            <FilterAddMenu
              fields={fields}
              members={members}
              today={today}
              onAdd={addChip}
              onClose={() => setOpen(false)}
            />
          )}
        </PopoverContent>
      </Popover>
      <span className="flex-1" />
      <p className="text-[12px] text-ink-3">
        {group && (
          <>
            Group by <span className="font-medium text-ink-2">{group}</span>
            {' · '}
          </>
        )}
        {issueCount} {issueCount === 1 ? 'issue' : 'issues'}
      </p>
    </div>
  )
}

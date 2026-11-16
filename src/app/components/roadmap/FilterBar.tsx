import { ListFilter, Settings } from 'lucide-react'
import { useState } from 'react'
import type { Chip, ViewSettings } from '@/engine/roadmaps/view'
import type { FieldDef, MemberLite } from '@/engine/roadmaps/types'
import { liveChips } from '@/engine/roadmaps/view'
import { cn } from '@/app/lib/utils'
import { Toggle } from '../Toggle'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { DisplayMenu, groupByLabel } from './DisplayMenu'
import { FilterAddMenu } from './FilterAddMenu'
import { FilterChip } from './FilterChip'
import { GanttControls } from './GanttControls'
import { ToolButton } from './ToolButton'

type ViewChange = ViewSettings | ((prev: ViewSettings) => ViewSettings)

interface Props {
  fields: FieldDef[]
  members: MemberLite[]
  today: string
  view: ViewSettings
  issueCount: number
  onChange: (v: ViewChange) => void
  onToday: () => void
  /** Roadmap settings: its state and how to open it. Absent for a viewer who cannot edit. */
  settings?: { open: boolean; onOpen: () => void }
}

/** The one row under the bar, the same height on every view. Left: Filter and its chips. Right: the count, the Gantt's
    scale and Today, Display, and the roadmap's settings. */
export function FilterBar({ fields, members, today, view, issueCount, onChange, onToday, settings }: Props) {
  const group = view.layout === 'table' ? groupByLabel(view, fields) : null
  const [open, setOpen] = useState(false)
  // A menu reopened mid-close keeps its component; a fresh key starts it at the first step.
  const [menuKey, setMenuKey] = useState(0)
  const chips = view.chips.map((chip, i) => ({ live: liveChips(fields, [chip])[0], i })).filter((c): c is { live: Chip; i: number } => Boolean(c.live))

  return (
    <div role="toolbar" aria-label="Roadmap toolbar" className="flex h-11 flex-none items-center gap-3 border-b border-hair pl-3 pr-4">
      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
        {issueCount > 0 && (
          <Popover open={open} onOpenChange={(next) => { if (next) setMenuKey((k) => k + 1); setOpen(next) }}>
            <PopoverTrigger asChild>
              <ToolButton className="flex-none">
                <ListFilter strokeWidth={1.75} aria-hidden />
                Filter
              </ToolButton>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              sideOffset={8}
              className={cn('w-[min(16rem,calc(100vw-1.5rem))] overflow-hidden p-0')}
              aria-label="Add a filter"
            >
              <FilterAddMenu
                key={menuKey}
                fields={fields}
                members={members}
                today={today}
                onAdd={(chip) => { onChange((v) => ({ ...v, chips: [...v.chips, chip] })); setOpen(false) }}
              />
            </PopoverContent>
          </Popover>
        )}
        {chips.map(({ live, i }) => (
          <FilterChip key={`${live.on}-${i}`} chip={live} fields={fields} onRemove={() => onChange((v) => ({ ...v, chips: v.chips.filter((_, j) => j !== i) }))} />
        ))}
        {chips.length > 1 && (
          <ToolButton className="h-7 flex-none px-2 text-[12px]" onClick={() => onChange((v) => ({ ...v, chips: [] }))}>Clear all</ToolButton>
        )}
      </div>
      <div className="flex flex-none items-center gap-1">
        {issueCount > 0 && (
          <p className="whitespace-nowrap px-2 text-[12px] tabular-nums text-ink-3">
            {group && <span className="max-[1100px]:hidden">Group by <span className="text-ink-2">{group}</span>{' · '}</span>}
            {issueCount} {issueCount === 1 ? 'issue' : 'issues'}
          </p>
        )}
        {view.layout === 'gantt' && <GanttControls scale={view.scale} onScale={(scale) => onChange((v) => ({ ...v, scale }))} onToday={onToday} />}
        {view.layout !== 'checks' && <DisplayMenu fields={fields} view={view} onChange={onChange} />}
        {settings && (
          <Toggle open={settings.open} onClick={settings.onOpen} label="Roadmap settings"><Settings className="size-[17px]" strokeWidth={1.75} /></Toggle>
        )}
      </div>
    </div>
  )
}

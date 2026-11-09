import { SlidersHorizontal } from 'lucide-react'
import type { FieldDef } from '@/engine/roadmaps/types'
import type { ViewSettings } from '@/engine/roadmaps/view'
import { Button } from '../ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { cn } from '@/app/lib/utils'

const SORTS: { id: ViewSettings['sort']; label: string }[] = [
  { id: 'order', label: 'Order' },
  { id: 'due', label: 'Due' },
  { id: 'start', label: 'Start' },
  { id: 'status', label: 'Status' },
  { id: 'updated', label: 'Updated' },
]

const COLS: { id: string; label: string }[] = [
  { id: 'assignee', label: 'Assignee' },
  { id: 'start', label: 'Start' },
  { id: 'due', label: 'Due' },
]

type ViewChange = ViewSettings | ((prev: ViewSettings) => ViewSettings)

interface Props {
  fields: FieldDef[]
  view: ViewSettings
  onChange: (v: ViewChange) => void
}

/** Sort, group-by and visible columns for the table. */
export function DisplayMenu({ fields, view, onChange }: Props) {
  const toggleCol = (id: string) => {
    const on = view.columns.includes(id)
    const columns = on ? view.columns.filter((c) => c !== id) : [...view.columns, id]
    onChange({ ...view, columns })
  }

  const setGroup = (groupBy: ViewSettings['groupBy']) => onChange({ ...view, groupBy })

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-ink-3 hover:text-ink">
          <SlidersHorizontal className="size-[15px]" strokeWidth={1.75} aria-hidden />
          Display
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-72 text-[13px]" aria-label="Display settings">
        <section className="mb-4">
          <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-3">Sort</h3>
          <div className="flex flex-wrap gap-1">
            {SORTS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={cn(
                  'rounded-md px-2 py-1 text-[12px]',
                  view.sort === s.id ? 'bg-raise text-ink shadow-[0_0_0_1px_theme(colors.line)]' : 'text-ink-2 hover:text-ink',
                )}
                onClick={() => onChange({ ...view, sort: s.id })}
              >
                {s.label}
              </button>
            ))}
          </div>
        </section>
        <section className="mb-4">
          <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-3">Group by</h3>
          <div className="flex max-h-40 flex-col gap-0.5 overflow-y-auto">
            <GroupPick label="None" on={view.groupBy === null} onClick={() => setGroup(null)} />
            <GroupPick label="Status" on={view.groupBy?.on === 'status'} onClick={() => setGroup({ on: 'status' })} />
            <GroupPick label="Assignee" on={view.groupBy?.on === 'assignee'} onClick={() => setGroup({ on: 'assignee' })} />
            {fields.filter((f) => f.type === 'choice' || f.type === 'person').map((f) => (
              <GroupPick
                key={f.id}
                label={f.name}
                on={view.groupBy?.on === 'field' && view.groupBy.field === f.id}
                onClick={() => setGroup({ on: 'field', field: f.id })}
              />
            ))}
          </div>
        </section>
        <section>
          <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-3">Columns</h3>
          <div className="flex flex-col gap-1">
            {COLS.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-2 text-[12px] text-ink-2">
                <input
                  type="checkbox"
                  className="size-3.5 accent-ink"
                  checked={view.columns.includes(c.id)}
                  onChange={() => toggleCol(c.id)}
                />
                {c.label}
              </label>
            ))}
            {fields.map((f) => (
              <label key={f.id} className="flex cursor-pointer items-center gap-2 text-[12px] text-ink-2">
                <input
                  type="checkbox"
                  className="size-3.5 accent-ink"
                  checked={view.columns.includes(f.id)}
                  onChange={() => toggleCol(f.id)}
                />
                {f.name}
              </label>
            ))}
          </div>
        </section>
      </PopoverContent>
    </Popover>
  )
}

function GroupPick({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={cn(
        'rounded-md px-2 py-1 text-left text-[12px]',
        on ? 'bg-raise font-medium text-ink shadow-[0_0_0_1px_theme(colors.line)]' : 'text-ink-2 hover:text-ink',
      )}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

export function groupByLabel(view: ViewSettings, fields: FieldDef[]): string | null {
  if (!view.groupBy) return null
  if (view.groupBy.on === 'status') return 'Status'
  if (view.groupBy.on === 'assignee') return 'Assignee'
  const g = view.groupBy
  if (g.on !== 'field') return null
  return fields.find((d) => d.id === g.field)?.name ?? null
}

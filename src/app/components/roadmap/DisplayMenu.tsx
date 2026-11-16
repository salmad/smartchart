import { SlidersHorizontal } from 'lucide-react'
import type { FieldDef } from '@/engine/roadmaps/types'
import type { ViewSettings } from '@/engine/roadmaps/view'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { cn } from '@/app/lib/utils'
import { MatrixDisplay } from './MatrixDisplay'
import { MenuSection, MenuSelect, MenuSwitch } from './MenuParts'
import { ToolButton } from './ToolButton'
import { menuSurface } from './roadmapChrome'

type Sort = ViewSettings['sort']

const SORTS: { value: Sort; label: string }[] = [
  { value: 'order', label: 'Manual order' },
  { value: 'due', label: 'Due date' },
  { value: 'start', label: 'Start date' },
  { value: 'status', label: 'Status' },
  { value: 'updated', label: 'Last updated' },
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

/** The select's value for a grouping, and back. */
const groupValue = (g: ViewSettings['groupBy']): string => (g === null ? 'none' : g.on === 'field' ? `field:${g.field}` : g.on)
const groupOf = (v: string): ViewSettings['groupBy'] =>
  v === 'none' ? null : v === 'status' || v === 'assignee' ? { on: v } : { on: 'field', field: v.slice('field:'.length) }

/** How this view is drawn: sort, grouping and visible columns; on the Matrix, its rows, columns and cards. */
export function DisplayMenu({ fields, view, onChange }: Props) {
  const matrix = view.layout === 'matrix'
  const toggleCol = (id: string) =>
    onChange((v) => ({ ...v, columns: v.columns.includes(id) ? v.columns.filter((c) => c !== id) : [...v.columns, id] }))

  return (
    <Popover modal={false}>
      <PopoverTrigger asChild>
        <ToolButton>
          <SlidersHorizontal strokeWidth={1.75} aria-hidden />
          {matrix ? 'Layout' : 'Display'}
        </ToolButton>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        collisionPadding={12}
        className={cn(
          'max-h-[min(32rem,var(--radix-popover-content-available-height))] overflow-y-auto overscroll-contain p-2 text-[13px]',
          matrix ? 'w-[min(20rem,calc(100vw-1.5rem))]' : 'w-[17rem]',
          menuSurface,
        )}
        aria-label={matrix ? 'Matrix layout' : 'Display settings'}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {matrix ? (
          <MatrixDisplay fields={fields} view={view} onChange={onChange} />
        ) : (
          <div className="grid gap-2">
            <div>
              <MenuSelect label="Sort by" value={view.sort} options={SORTS} onChange={(sort) => onChange((v) => ({ ...v, sort }))} />
              <MenuSelect
                label="Group by"
                value={groupValue(view.groupBy)}
                options={[
                  { value: 'none', label: 'Nothing' },
                  { value: 'status', label: 'Status' },
                  { value: 'assignee', label: 'Assignee' },
                  ...fields.filter((f) => f.type !== 'date').map((f) => ({ value: `field:${f.id}`, label: f.name })),
                ]}
                onChange={(v) => onChange((prev) => ({ ...prev, groupBy: groupOf(v) }))}
              />
            </div>
            <MenuSection title="Columns">
              {COLS.map((c) => (
                <MenuSwitch key={c.id} label={c.label} on={view.columns.includes(c.id)} onChange={() => toggleCol(c.id)} />
              ))}
              {fields.map((f) => (
                <MenuSwitch key={f.id} label={f.name} on={view.columns.includes(f.id)} onChange={() => toggleCol(f.id)} />
              ))}
            </MenuSection>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

export function groupByLabel(view: ViewSettings, fields: FieldDef[]): string | null {
  const g = view.groupBy
  if (!g) return null
  if (g.on === 'status') return 'Status'
  if (g.on === 'assignee') return 'Assignee'
  if (g.on !== 'field') return null
  return fields.find((d) => d.id === g.field)?.name ?? null
}

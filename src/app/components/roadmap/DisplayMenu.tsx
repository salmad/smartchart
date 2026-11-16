import { SlidersHorizontal } from 'lucide-react'
import type { FieldDef } from '@/engine/roadmaps/types'
import { liveGroupBy, type GroupKey, type ViewSettings } from '@/engine/roadmaps/view'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { MatrixDisplay } from './MatrixDisplay'
import { MenuMulti, MenuSection, MenuSelect } from './MenuParts'
import { FieldIcon } from './FieldIcon'
import { ToolButton } from './ToolButton'

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

export type ViewChange = ViewSettings | ((prev: ViewSettings) => ViewSettings)

interface Props {
  fields: FieldDef[]
  view: ViewSettings
  onChange: (v: ViewChange) => void
}

/** A grouping level as a select's value, and back. */
const levelValue = (g: GroupKey | undefined): string => (!g ? 'none' : g.on === 'field' ? `field:${g.field}` : g.on)
const levelOf = (v: string): GroupKey | null =>
  v === 'none' ? null : v === 'status' || v === 'assignee' ? { on: v } : { on: 'field', field: v.slice('field:'.length) }

/** How every view is drawn, in one menu with the same rows in the same order: the grouping (shared by the views),
    the sort, then what only this view has. Each row is one dropdown, so the menu stays short. */
export function DisplayMenu({ fields, view, onChange }: Props) {
  const matrix = view.layout === 'matrix'
  const levels = liveGroupBy(fields, view.groupBy)
  // The matrix groups by field values only; the list and the Gantt also by status and person.
  const choices = [
    { value: 'none', label: 'Nothing' },
    ...(matrix ? [] : [{ value: 'status', label: 'Status' }, { value: 'assignee', label: 'Assignee' }]),
    ...fields.filter((f) => matrix || f.type !== 'date').map((f) => ({ value: `field:${f.id}`, label: f.name, icon: <FieldIcon type={f.type} />, section: 'Fields' })),
  ]
  const shown = (g: GroupKey | undefined) => (choices.some((c) => c.value === levelValue(g)) ? levelValue(g) : 'none')
  const [outer, inner] = levels
  const setLevel = (at: 0 | 1, value: string) =>
    onChange((v) => {
      const next = liveGroupBy(fields, v.groupBy).slice(0, at)
      const picked = levelOf(value)
      if (picked) next.push(picked)
      // Picking the outer level again keeps the inner one when it still differs.
      const kept = at === 0 && picked ? liveGroupBy(fields, v.groupBy)[1] : undefined
      if (kept && levelValue(kept) !== value) next.push(kept)
      return { ...v, groupBy: next }
    })
  const toggleCol = (id: string) =>
    onChange((v) => ({ ...v, columns: v.columns.includes(id) ? v.columns.filter((c) => c !== id) : [...v.columns, id] }))

  return (
    <Popover modal={false}>
      <PopoverTrigger asChild>
        <ToolButton>
          <SlidersHorizontal strokeWidth={1.75} aria-hidden />
          Display
        </ToolButton>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        collisionPadding={12}
        className="w-[18.5rem] p-2 text-[13px]"
        aria-label="Display settings"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="grid gap-2">
          <MenuSection title="Rows">
            <MenuSelect label="Group by" value={shown(outer)} options={choices} onChange={(v) => setLevel(0, v)} />
            {shown(outer) !== 'none' && (
              <MenuSelect label="Then by" value={shown(inner)} options={choices.filter((c) => c.value !== levelValue(outer))} onChange={(v) => setLevel(1, v)} />
            )}
            <MenuSelect label="Sort by" value={view.sort} options={SORTS} onChange={(sort) => onChange((v) => ({ ...v, sort }))} />
          </MenuSection>
          {view.layout === 'table' && (
            <MenuSection title="List">
              <MenuMulti
                label="Columns"
                options={[...COLS.map((c) => ({ value: c.id, label: c.label })), ...fields.map((f) => ({ value: f.id, label: f.name, icon: <FieldIcon type={f.type} />, section: 'Fields' }))].map((o) => ({ ...o, on: view.columns.includes(o.value) }))}
                onToggle={toggleCol}
              />
            </MenuSection>
          )}
          {matrix && <MatrixDisplay fields={fields} view={view} onChange={onChange} />}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** The grouping in words for the bar: "Workstream, Country". */
export function groupByLabel(view: ViewSettings, fields: FieldDef[]): string | null {
  const names = liveGroupBy(fields, view.groupBy)
    .filter((g) => view.layout !== 'matrix' || g.on === 'field')
    .map((g) => (g.on === 'status' ? 'Status' : g.on === 'assignee' ? 'Assignee' : fields.find((d) => d.id === g.field)?.name ?? ''))
    .filter(Boolean)
  return names.length ? names.join(', ') : null
}

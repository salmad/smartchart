import type { FieldDef } from '@/engine/roadmaps/types'
import type { MatrixRow } from '@/engine/roadmaps/matrix'
import { useCallback } from 'react'
import { liveGroupBy, toggleFolded, type TableRow, type ViewSettings } from '@/engine/roadmaps/view'
import { cn } from '@/app/lib/utils'
import { FieldIcon } from './FieldIcon'

export const ROW_H = 36
export const VIRT = 200
const OVERSCAN = 8

type WalkRow = TableRow | MatrixRow

export function visibleRows<T extends WalkRow>(rows: T[], filtersActive: boolean): T[] {
  if (filtersActive) return rows
  const out: T[] = []
  const openAt: boolean[] = []
  for (const row of rows) {
    if (row.kind === 'group') {
      out.push(row)
      continue
    }
    const { depth, open, hasChildren } = row
    while (openAt.length > depth) openAt.pop()
    let show = true
    for (let i = 0; i < depth; i++) {
      if (!openAt[i]) {
        show = false
        break
      }
    }
    if (show) {
      out.push(row)
      openAt[depth] = !hasChildren || open
    }
  }
  return out
}

/** The columns shown: known ones, less any the rows are grouped by (every row in a group would repeat it). */
export function liveColumns(view: ViewSettings, fields: FieldDef[]): string[] {
  const grouped = new Set(liveGroupBy(fields, view.groupBy).map((g) => (g.on === 'field' ? g.field : g.on)))
  return view.columns.filter((id) => (id in BUILT_IN || fields.some((f) => f.id === id)) && !grouped.has(id))
}

const BUILT_IN: Record<string, { name: string; type: FieldDef['type'] }> = {
  assignee: { name: 'Assignee', type: 'person' },
  start: { name: 'Start', type: 'date' },
  due: { name: 'Due', type: 'date' },
}

/** One width per kind of value, so a column never reflows as its cells change. */
const COLUMN_W: Record<FieldDef['type'], string> = {
  person: 'w-[84px] min-w-[84px]',
  date: 'w-[112px] min-w-[112px]',
  choice: 'w-[148px] min-w-[148px] max-w-[148px]',
  number: 'w-[104px] min-w-[104px] max-w-[104px]',
  text: 'w-[176px] min-w-[176px] max-w-[176px]',
}

/** The width classes of a property column, shared by its header and its cells. */
export function columnWidth(id: string, fields: FieldDef[]): string {
  return COLUMN_W[BUILT_IN[id]?.type ?? fields.find((f) => f.id === id)?.type ?? 'text']
}

/** The title column is pinned left; once the table has scrolled sideways a hairline marks its edge. */
export const titleColumn = 'sticky left-0 bg-app-bg group-data-[scrolled]/table:shadow-[1px_0_0_theme(colors.line)]'
export const progressColumn = 'w-[136px] min-w-[136px]'

/** Whether a group row groups by person, so its header shows their initials. */
export function personGroup(key: string): boolean {
  return (key.split('/').pop() ?? '').startsWith('assignee=')
}

type ViewChange = (v: ViewSettings | ((prev: ViewSettings) => ViewSettings)) => void

/** Folds a group (by its path) or, with `all`, every group shown at its level. Shared by the list, the Gantt and
    the matrix: the fold list is one, so a group folded in one view is folded in all. */
export function useGroupToggle(rows: WalkRow[], onView: ViewChange): (key: string, all: boolean) => void {
  return useCallback(
    (key: string, all: boolean) => {
      const depth = key.split('/').length
      const level = rows.flatMap((r) => (r.kind === 'group' && r.key.split('/').length === depth ? [r.key] : []))
      onView((v) => ({ ...v, folded: toggleFolded(v.folded, key, level, all) }))
    },
    [rows, onView],
  )
}

const headCell = 'sticky top-0 h-9 whitespace-nowrap border-b border-line bg-app-bg text-[12px] font-normal text-ink-3'

/** A column's name; a custom field's carries its type icon, so it reads apart from the built-in columns. */
function HeadName({ id, fields }: { id: string; fields: FieldDef[] }) {
  const def = BUILT_IN[id] ? undefined : fields.find((f) => f.id === id)
  if (!def) return <>{BUILT_IN[id]?.name ?? id}</>
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <FieldIcon type={def.type} />
      <span className="truncate">{def.name}</span>
    </span>
  )
}

export function TableHead({ columns, fields }: { columns: string[]; fields: FieldDef[] }) {
  return (
    <thead>
      <tr>
        <th scope="col" className={cn(headCell, titleColumn, 'z-30 w-full min-w-[320px] pl-9 pr-3')}>Title</th>
        {columns.map((c) => (
          <th key={c} scope="col" className={cn(headCell, columnWidth(c, fields), 'z-20 truncate px-3')}>
            <HeadName id={c} fields={fields} />
          </th>
        ))}
        <th scope="col" className={cn(headCell, progressColumn, 'z-20 pl-3 pr-4')}>Progress</th>
      </tr>
    </thead>
  )
}

export function rowSlice(length: number, scrollTop: number, viewHeight: number, rowH = ROW_H): { start: number; end: number } {
  if (length <= VIRT) return { start: 0, end: length }
  let start = Math.max(0, Math.floor(scrollTop / rowH) - OVERSCAN)
  let end = Math.min(length, Math.ceil((scrollTop + viewHeight) / rowH) + OVERSCAN)
  if (start >= length) {
    start = Math.max(0, length - VIRT)
    end = length
  }
  return { start, end }
}

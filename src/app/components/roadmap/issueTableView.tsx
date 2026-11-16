import type { FieldDef } from '@/engine/roadmaps/types'
import type { MatrixRow } from '@/engine/roadmaps/matrix'
import type { TableRow, ViewSettings } from '@/engine/roadmaps/view'
import { cn } from '@/app/lib/utils'

export const ROW_H = 36
/** The Gantt list's own row height. */
export const GANTT_ROW_H = 34
/** A matrix card is two lines (status and quarter, then progress): 54px with its padding. */
export const MATRIX_ROW_H = 56
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

export function liveColumns(view: ViewSettings, fields: FieldDef[]): string[] {
  const cols: string[] = []
  for (const id of view.columns) {
    if (id in BUILT_IN || fields.some((f) => f.id === id)) cols.push(id)
  }
  return cols
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

/** A group header's name: a group with no value says what is missing ("No country"), never a bare "Empty". */
export function groupName(row: Extract<TableRow, { kind: 'group' }>, groupBy: ViewSettings['groupBy'], fields: FieldDef[]): string {
  if (row.key !== '' || groupBy?.on !== 'field') return row.label
  const name = fields.find((f) => f.id === groupBy.field)?.name
  return name ? `No ${name.toLowerCase()}` : row.label
}

const headCell = 'sticky top-0 h-9 whitespace-nowrap border-b border-line bg-app-bg text-[12px] font-normal text-ink-3'

export function TableHead({ columns, fields }: { columns: string[]; fields: FieldDef[] }) {
  return (
    <thead>
      <tr>
        <th scope="col" className={cn(headCell, titleColumn, 'z-30 w-full min-w-[320px] pl-9 pr-3')}>Title</th>
        {columns.map((c) => (
          <th key={c} scope="col" className={cn(headCell, columnWidth(c, fields), 'z-20 truncate px-3')}>
            {BUILT_IN[c]?.name ?? fields.find((f) => f.id === c)?.name ?? c}
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

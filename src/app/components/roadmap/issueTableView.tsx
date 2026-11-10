import type { FieldDef } from '@/engine/roadmaps/types'
import type { MatrixRow } from '@/engine/roadmaps/matrix'
import type { TableRow, ViewSettings } from '@/engine/roadmaps/view'

export const ROW_H = 34
export const GANTT_ROW_H = 32
export const MATRIX_ROW_H = 34
export const VIRT = 200
export const OVERSCAN = 8

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
    if (id === 'assignee' || id === 'start' || id === 'due') cols.push(id)
    else if (fields.some((f) => f.id === id)) cols.push(id)
  }
  return cols
}

function headerLabel(id: string, fields: FieldDef[]): string {
  if (id === 'assignee') return 'Assignee'
  if (id === 'start') return 'Start'
  if (id === 'due') return 'Due'
  return fields.find((f) => f.id === id)?.name ?? id
}

export function TableHead({ columns, fields }: { columns: string[]; fields: FieldDef[] }) {
  return (
    <thead className="sticky top-0 z-10 bg-app-bg">
      <tr className="h-9 border-b border-line text-[11.5px] text-ink-3">
        <th scope="col" className="w-6 px-1 font-medium" />
        <th scope="col" className="w-8 px-2 font-medium">Status</th>
        <th scope="col" className="w-20 px-2 font-medium">Key</th>
        <th scope="col" className="min-w-[200px] px-2 font-medium">Title</th>
        {columns.map((c) => (
          <th key={c} scope="col" className="w-24 px-2 font-medium">
            {headerLabel(c, fields)}
          </th>
        ))}
        <th scope="col" className="w-20 px-2 font-medium">Progress</th>
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

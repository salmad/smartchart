import { useCallback, useMemo, useRef, useState } from 'react'
import type { FieldDef, MemberLite, RoadmapState } from '@/engine/roadmaps/types'
import type { TableRow, ViewSettings } from '@/engine/roadmaps/view'
import { tableRows } from '@/engine/roadmaps/view'
import { IssueDataRow, IssueGroupRow } from './IssueRow'

const ROW_H = 34
const VIRT = 200

interface Props {
  state: RoadmapState
  view: ViewSettings
  members: MemberLite[]
  today: string
  onView: (v: ViewSettings | ((prev: ViewSettings) => ViewSettings)) => void
}

function visibleRows(rows: TableRow[]): TableRow[] {
  const out: TableRow[] = []
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

function liveColumns(view: ViewSettings, fields: FieldDef[]): string[] {
  const cols: string[] = []
  for (const id of view.columns) {
    if (id === 'assignee' || id === 'start' || id === 'due') cols.push(id)
    else if (fields.some((f) => f.id === id)) cols.push(id)
  }
  for (const f of fields) {
    if (!cols.includes(f.id)) cols.push(f.id)
  }
  return cols
}

function headerLabel(id: string, fields: FieldDef[]): string {
  if (id === 'assignee') return 'Assignee'
  if (id === 'start') return 'Start'
  if (id === 'due') return 'Due'
  return fields.find((f) => f.id === id)?.name ?? id
}

function TableHead({ columns, fields }: { columns: string[]; fields: FieldDef[] }) {
  return (
    <thead className="sticky top-0 z-10 bg-app-bg">
      <tr className="h-9 border-b border-line text-[11.5px] text-ink-3">
        <th scope="col" className="w-8 px-2 font-medium" />
        <th scope="col" className="w-24 px-2 font-medium">Key</th>
        <th scope="col" className="min-w-[200px] px-2 font-medium">Title</th>
        {columns.map((c) => (
          <th key={c} scope="col" className="w-28 px-2 font-medium">
            {headerLabel(c, fields)}
          </th>
        ))}
        <th scope="col" className="w-20 px-2 font-medium">Progress</th>
      </tr>
    </thead>
  )
}

export function IssueTable({ state, view, members, today, onView }: Props) {
  const all = useMemo(() => tableRows(state, view, today), [state, view, today])
  const rows = useMemo(() => visibleRows(all), [all])
  const columns = useMemo(() => liveColumns(view, state.roadmap.fields), [view.columns, state.roadmap.fields])
  const colCount = 3 + columns.length + 1

  const onToggleCollapse = useCallback(
    (id: string) => {
      onView({
        ...view,
        collapsed: view.collapsed.includes(id) ? view.collapsed.filter((c) => c !== id) : [...view.collapsed, id],
      })
    },
    [onView, view],
  )

  const scrollRef = useRef<HTMLDivElement>(null)
  const [window, setWindow] = useState({ start: 0, end: rows.length })

  const onScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el || rows.length <= VIRT) return
    const top = el.scrollTop
    const h = el.clientHeight
    const start = Math.max(0, Math.floor(top / ROW_H) - 8)
    const end = Math.min(rows.length, Math.ceil((top + h) / ROW_H) + 8)
    setWindow((w) => (w.start === start && w.end === end ? w : { start, end }))
  }, [rows.length])

  const body = rows.length > VIRT ? rows.slice(window.start, window.end) : rows
  const padTop = rows.length > VIRT ? window.start * ROW_H : 0
  const padBottom = rows.length > VIRT ? (rows.length - window.end) * ROW_H : 0

  const shared = {
    roadmap: state.roadmap,
    fields: state.roadmap.fields,
    columns,
    members,
    allIssues: state.issues.filter((i) => i.deletedAt === null),
    colCount,
  }

  if (!rows.length) {
    return (
      <div className="overflow-x-auto px-4">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <TableHead columns={columns} fields={state.roadmap.fields} />
        </table>
      </div>
    )
  }

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto" onScroll={onScroll}>
      <table className="w-full min-w-[640px] border-collapse text-left">
        <TableHead columns={columns} fields={state.roadmap.fields} />
        <tbody>
          {padTop > 0 && (
            <tr aria-hidden className="border-0">
              <td colSpan={colCount} className="p-0 leading-[0]">
                <svg height={padTop} width={1} className="block w-full" aria-hidden />
              </td>
            </tr>
          )}
          {body.map((row) =>
            row.kind === 'group' ? (
              <IssueGroupRow key={`g-${row.key}`} row={row} {...shared} />
            ) : (
              <IssueDataRow
                key={row.issue.id}
                row={row}
                onToggleCollapse={onToggleCollapse}
                {...shared}
              />
            ),
          )}
          {padBottom > 0 && (
            <tr aria-hidden className="border-0">
              <td colSpan={colCount} className="p-0 leading-[0]">
                <svg height={padBottom} width={1} className="block w-full" aria-hidden />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

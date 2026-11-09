import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FieldDef, MemberLite, RoadmapState } from '@/engine/roadmaps/types'
import type { TableRow, ViewSettings } from '@/engine/roadmaps/view'
import { tableRows } from '@/engine/roadmaps/view'
import type { RoadmapOp } from '@/engine/roadmaps/ops'
import { subtree } from '@/engine/roadmaps/tree'
import { IssueDataRow, IssueGroupRow, ComposeIssueRow } from './IssueRow'
import { BulkBar } from './BulkBar'
import { offerDeleteUndo } from './UndoToast'
import { useSelection } from './useSelection'
import { useRowDrag } from './useRowDrag'
import { useTableKeys, type ComposeDraft } from './useTableKeys'
import { newIssueId } from './issueIds'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog'

const ROW_H = 34
const VIRT = 200
const OVERSCAN = 8

interface Props {
  state: RoadmapState
  view: ViewSettings
  members: MemberLite[]
  today: string
  onView: (v: ViewSettings | ((prev: ViewSettings) => ViewSettings)) => void
  canEdit: boolean
  act: (op: RoadmapOp) => 'ok' | string
  said: string | null
}

function visibleRows(rows: TableRow[], filtersActive: boolean): TableRow[] {
  if (filtersActive) return rows
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
        <th scope="col" className="w-6 px-1 font-medium" />
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

function rowSlice(length: number, scrollTop: number, viewHeight: number): { start: number; end: number } {
  if (length <= VIRT) return { start: 0, end: length }
  let start = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN)
  let end = Math.min(length, Math.ceil((scrollTop + viewHeight) / ROW_H) + OVERSCAN)
  if (start >= length) {
    start = Math.max(0, length - VIRT)
    end = length
  }
  return { start, end }
}

export function IssueTable({ state, view, members, today, onView, canEdit, act, said }: Props) {
  const all = useMemo(() => tableRows(state, view, today), [state, view, today])
  const filtersActive = view.chips.length > 0
  const rows = useMemo(() => visibleRows(all, filtersActive), [all, filtersActive])
  const columns = useMemo(() => liveColumns(view, state.roadmap.fields), [view.columns, state.roadmap.fields])
  const colCount = 4 + columns.length + 1
  const liveIssues = useMemo(() => state.issues.filter((i) => i.deletedAt === null), [state.issues])
  const issueOrder = useMemo(
    () => rows.filter((r): r is Extract<TableRow, { kind: 'issue' }> => r.kind === 'issue').map((r) => r.issue.id),
    [rows],
  )

  const [focusId, setFocusId] = useState<string | null>(null)
  const [compose, setCompose] = useState<ComposeDraft | null>(null)
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null)
  const selection = useSelection(issueOrder)
  const rootRef = useRef<HTMLDivElement>(null)

  const onToggleCollapse = useCallback(
    (id: string) => {
      onView({
        ...view,
        collapsed: view.collapsed.includes(id) ? view.collapsed.filter((c) => c !== id) : [...view.collapsed, id],
      })
    },
    [onView, view],
  )

  const focusedIssue = focusId ? liveIssues.find((i) => i.id === focusId) ?? null : null

  const startCompose = useCallback((asChild: boolean) => {
    const parentId = asChild ? focusedIssue?.id ?? null : focusedIssue?.parentId ?? null
    const after = asChild ? undefined : focusedIssue?.id
    setCompose({ id: newIssueId(), parentId, after, title: '' })
  }, [focusedIssue])

  const { commitCompose } = useTableKeys({
    root: rootRef,
    order: issueOrder,
    focusId,
    setFocusId,
    compose,
    setCompose,
    canEdit,
    act,
    onStartCompose: startCompose,
    selection,
  })

  const drag = useRowDrag({
    issues: liveIssues,
    canEdit,
    act,
    onRefused: () => undefined,
  })

  useEffect(() => {
    if (!focusId && issueOrder[0]) setFocusId(issueOrder[0])
  }, [focusId, issueOrder])

  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewHeight, setViewHeight] = useState(900)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    setViewHeight(el.clientHeight)
  }, [rows.length])

  const slice = useMemo(
    () => rowSlice(rows.length, scrollTop, viewHeight),
    [rows.length, scrollTop, viewHeight],
  )

  const onScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const top = el.scrollTop
    const h = el.clientHeight
    setScrollTop((t) => (t === top ? t : top))
    setViewHeight((vh) => (vh === h ? vh : h))
  }, [])

  const body = rows.length > VIRT ? rows.slice(slice.start, slice.end) : rows
  const padTop = rows.length > VIRT ? slice.start * ROW_H : 0
  const padBottom = rows.length > VIRT ? (rows.length - slice.end) * ROW_H : 0

  const shared = {
    roadmap: state.roadmap,
    fields: state.roadmap.fields,
    columns,
    members,
    allIssues: liveIssues,
    colCount,
    canEdit,
    act,
  }

  const bulkSet = (props: import('@/engine/roadmaps/ops').IssueProps) => {
    const ids = [...selection.selected]
    if (!ids.length) return
    act({ op: 'set', ids, props })
    selection.clear()
  }

  const runDelete = (ids: string[]) => {
    const total = new Set<string>()
    let sub = 0
    for (const id of ids) {
      const nodes = subtree(liveIssues, id)
      for (const n of nodes) {
        if (id !== n.id) sub++
        total.add(n.id)
      }
    }
    const label = sub > 0
      ? `Deleted${ids.length > 1 ? ` ${ids.length} issues` : ''} and ${sub} sub-issue${sub === 1 ? '' : 's'}.`
      : `Deleted${ids.length > 1 ? ` ${ids.length} issues` : ' issue'}.`
    act({ op: 'delete', ids })
    offerDeleteUndo(label, () => act({ op: 'restore', ids }))
    selection.clear()
    setDeleteIds(null)
  }

  const pendingDelete = deleteIds
    ? (() => {
        let sub = 0
        for (const id of deleteIds) sub += subtree(liveIssues, id).length - 1
        const root = liveIssues.find((i) => i.id === deleteIds[0])
        return { sub, title: root?.title ?? 'issue' }
      })()
    : null

  const composeDepth = useMemo(() => {
    if (!compose) return 0
    if (compose.after) {
      const row = rows.find((r) => r.kind === 'issue' && r.issue.id === compose.after) as Extract<TableRow, { kind: 'issue' }> | undefined
      return row?.depth ?? 0
    }
    if (compose.parentId) {
      const row = rows.find((r) => r.kind === 'issue' && r.issue.id === compose.parentId) as Extract<TableRow, { kind: 'issue' }> | undefined
      return (row?.depth ?? -1) + 1
    }
    return 0
  }, [compose, rows])

  if (!rows.length && !compose) {
    return (
      <div className="overflow-x-auto px-4">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <TableHead columns={columns} fields={state.roadmap.fields} />
        </table>
      </div>
    )
  }

  return (
    <div ref={rootRef} className="flex min-h-0 flex-1 flex-col outline-none" tabIndex={-1}>
      {selection.selected.size > 0 && canEdit && (
        <BulkBar
          count={selection.selected.size}
          fields={state.roadmap.fields}
          members={members}
          onStatus={(status) => bulkSet({ status })}
          onAssignee={(assignee) => bulkSet({ assignee })}
          onField={(fieldId, value) => bulkSet({ fields: { [fieldId]: value } })}
          onDelete={() => setDeleteIds([...selection.selected])}
          onClear={selection.clear}
        />
      )}
      {said && <p role="status" className="border-b border-line bg-panel px-4 py-2 text-[12.5px] text-ink-2">{said}</p>}
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
                  focused={focusId === row.issue.id}
                  selected={selection.selected.has(row.issue.id)}
                  onFocus={() => { setFocusId(row.issue.id); rootRef.current?.focus() }}
                  onSelect={(extend) => selection.toggle(row.issue.id, extend)}
                  drag={{ start: drag.start, end: drag.end, over: drag.over, dropOn: drag.dropOn, dragging: drag.dragId }}
                  {...shared}
                />
              ),
            )}
            {compose && (
              <ComposeIssueRow
                draft={compose}
                depth={composeDepth}
                onTitle={(title) => setCompose({ ...compose, title })}
                onCommit={commitCompose}
                {...shared}
              />
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
      <Dialog open={!!deleteIds?.length} onOpenChange={(o) => { if (!o) setDeleteIds(null) }}>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>Delete {pendingDelete?.title}?</DialogTitle>
          <DialogDescription className="text-[13px] text-ink-2">
            {pendingDelete && pendingDelete.sub > 0
              ? `This issue and ${pendingDelete.sub} sub-issue${pendingDelete.sub === 1 ? '' : 's'} will be removed.`
              : 'This issue will be removed.'}
          </DialogDescription>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setDeleteIds(null)}>Cancel</Button>
            <Button variant="default" className="bg-bad text-app-bg hover:bg-bad/90" onClick={() => deleteIds && runDelete(deleteIds)}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

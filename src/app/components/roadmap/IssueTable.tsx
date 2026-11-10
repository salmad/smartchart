import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { MemberLite, RoadmapState } from '@/engine/roadmaps/types'
import type { TableRow, ViewSettings } from '@/engine/roadmaps/view'
import { tableRows } from '@/engine/roadmaps/view'
import { buildDuplicateCopies, type RoadmapOp } from '@/engine/roadmaps/ops'
import { IssueDataRow, IssueGroupRow, ComposeIssueRow } from './IssueRow'
import { BulkBar } from './BulkBar'
import { IssueDeleteDialog } from './IssueDeleteDialog'
import { useSelection } from './useSelection'
import { useRowDrag } from './useRowDrag'
import { useTableKeys, type ComposeDraft } from './useTableKeys'
import { liveColumns, ROW_H, rowSlice, TableHead, visibleRows, VIRT } from './issueTableView'
import { newIssueId } from './issueIds'

interface Props {
  state: RoadmapState
  view: ViewSettings
  members: MemberLite[]
  today: string
  onView: (v: ViewSettings | ((prev: ViewSettings) => ViewSettings)) => void
  canEdit: boolean
  act: (op: RoadmapOp) => 'ok' | string
  said: string | null
  onOpenIssue?: (id: string) => void
  /** Bumped by the top bar's New issue: open a top-level compose row at the end. */
  newIssue?: number
}

export function IssueTable({ state, view, members, today, onView, canEdit, act, said, onOpenIssue, newIssue = 0 }: Props) {
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

  useEffect(() => {
    if (newIssue > 0) setCompose({ id: newIssueId(), parentId: null, title: '' })
  }, [newIssue])

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
    onOpenIssue,
    selection,
  })

  const onRefused = useCallback((msg: string) => { toast(msg) }, [])

  const drag = useRowDrag({
    issues: liveIssues,
    canEdit,
    act,
    onRefused,
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

  const onDuplicate = () => {
    const ids = [...selection.selected]
    if (!ids.length) return
    const copies = buildDuplicateCopies(ids, liveIssues, newIssueId)
    if (!copies.length) return
    const out = act({ op: 'duplicate', copies })
    if (out === 'ok') selection.replace(copies.map((c) => c.id))
    else onRefused(out)
  }

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
        <p className="px-2 py-8 text-[13px] text-ink-3">
          {filtersActive ? 'No issues match these filters.' : 'No issues yet. Press C or New issue to add the first.'}
        </p>
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
          onDuplicate={onDuplicate}
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
                  onOpen={() => {
                    onOpenIssue?.(row.issue.id)
                    requestAnimationFrame(() => rootRef.current?.focus())
                  }}
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
      <IssueDeleteDialog
        deleteIds={deleteIds}
        liveIssues={liveIssues}
        onClose={() => setDeleteIds(null)}
        act={act}
        onDeleted={selection.clear}
      />
    </div>
  )
}

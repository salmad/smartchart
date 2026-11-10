import type { Issue, MemberLite, Roadmap } from '@/engine/roadmaps/types'
import type { MatrixCol, MatrixCell as Cell, MatrixGroupCell } from '@/engine/roadmaps/matrix'
import { cellWorst } from '@/engine/roadmaps/matrix'
import { keyOf } from '@/engine/roadmaps/fields'
import { dateSpan } from '@/engine/roadmaps/rollup'
import { dueQuarter } from '@/engine/roadmaps/matrix'
import type { MatrixSettings } from '@/engine/roadmaps/view'
import { StatusGlyph } from './StatusGlyph'
import { ProgressBar } from './ProgressBar'
import { MatrixPicker } from './MatrixPicker'
import { Avatar } from '../Avatar'
import { cellProgress, colAria, displayDueQuarter, issueOverdue, sharedAssignee } from './matrixCellMeta'
import { cn } from '@/app/lib/utils'

interface IssueCellProps {
  roadmap: Roadmap
  issues: Issue[]
  members: MemberLite[]
  col: MatrixCol
  cell: Cell
  show: MatrixSettings['show']
  today: string
  cellTag: string
  focused: boolean
  onFocus: () => void
  onOpen: (id: string) => void
}

interface GroupCellProps {
  issues: Issue[]
  members: MemberLite[]
  col: MatrixCol
  cell: MatrixGroupCell
  show: MatrixSettings['show']
  today: string
}

function AssigneeDisc({ assignee, members }: { assignee: string; members: MemberLite[] }) {
  const name = members.find((m) => m.id === assignee)?.name ?? ''
  if (!name) return null
  return (
    <span className="relative flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-line text-[10px] text-ink-2">
      <Avatar name={name} image={null} />
    </span>
  )
}

function CellExtras({
  issues,
  members,
  ids,
  singleId,
  show,
}: {
  issues: Issue[]
  members: MemberLite[]
  ids: string[]
  singleId: string | null
  show: MatrixSettings['show']
  today: string
}) {
  const prog = show.progress ? cellProgress(issues, ids, singleId) : null
  const quarter = show.dates
    ? singleId
      ? (() => {
          const due = dateSpan(issues, singleId).due
          return due ? dueQuarter(due) : null
        })()
      : displayDueQuarter(issues, ids)
    : null
  const assignee = show.assignee ? sharedAssignee(issues, ids) : undefined
  return (
    <>
      {quarter && <span className="text-[10.5px] tabular-nums text-ink-2">{quarter}</span>}
      {prog !== null && <ProgressBar value={prog} />}
      {show.assignee && assignee !== undefined && assignee !== null && (
        <AssigneeDisc assignee={assignee} members={members} />
      )}
    </>
  )
}

export function MatrixEmptyCell() {
  return (
    <td className="min-w-[148px] border-b border-hair px-2 py-1 text-center text-[13px] text-ink-3" aria-label="Not planned here">
      —
    </td>
  )
}

export function MatrixGroupCellView({ issues, members, col, cell, show, today }: GroupCellProps) {
  return (
    <td
      className={cn(
        'min-w-[148px] border-b border-hair bg-panel px-2 py-1',
        cell.worst && 'shadow-[inset_0_0_0_1px_theme(colors.bad)]',
      )}
      aria-label={`${colAria(col.parts)} group`}
    >
      <div className="flex flex-col items-center gap-0.5 py-0.5">
        {show.status && cell.issueIds.length > 0 && <span className="h-3.5 w-3.5" aria-hidden />}
        <CellExtras
          issues={issues}
          members={members}
          ids={cell.issueIds}
          singleId={null}
          show={show}
          today={today}
        />
      </div>
    </td>
  )
}

export function MatrixIssueCell({
  roadmap,
  issues,
  members,
  col,
  cell,
  show,
  today,
  cellTag,
  focused,
  onFocus,
  onOpen,
}: IssueCellProps) {
  if (cell.kind === 'empty') return <MatrixEmptyCell />

  if (cell.kind === 'many') {
    const worst = cellWorst(issues, cell.issueIds, today)
    const label = `${colAria(col.parts)}: ${cell.issueIds.length} issues`
    const statusOn = show.status
    return (
      <td
        className={cn(
          'min-w-[148px] border-b border-hair px-2 py-1',
          worst && 'shadow-[inset_0_0_0_1px_theme(colors.bad)]',
        )}
      >
        <MatrixPicker
          roadmap={roadmap}
          issues={issues}
          ids={cell.issueIds}
          label={label}
          cellTag={cellTag}
          focused={focused}
          onFocus={onFocus}
          onOpen={onOpen}
        >
          {statusOn && <span className="h-3.5 w-3.5" aria-hidden />}
          <CellExtras issues={issues} members={members} ids={cell.issueIds} singleId={null} show={show} today={today} />
        </MatrixPicker>
      </td>
    )
  }

  const issue = issues.find((i) => i.id === cell.issueId)
  if (!issue) return <MatrixEmptyCell />

  const overdue = issueOverdue(issue, today)
  const aria = `Open ${keyOf(roadmap, issue)} ${issue.title} in ${colAria(col.parts)}`

  return (
    <td
      className={cn('min-w-[148px] border-b border-hair px-2 py-1', overdue && 'shadow-[inset_0_0_0_1px_theme(colors.bad)]')}
    >
      <button
        type="button"
        tabIndex={focused ? 0 : -1}
        data-matrix-cell={cellTag}
        aria-label={aria}
        className={cn(
          'flex w-full flex-col items-center gap-0.5 rounded px-1 py-0.5 outline-none hover:bg-white/[.03] focus-visible:ring-1 focus-visible:ring-line',
          focused && 'ring-1 ring-line',
        )}
        onFocus={onFocus}
        onClick={() => onOpen(issue.id)}
      >
        {show.status && <StatusGlyph status={issue.status} className="size-3.5" />}
        <CellExtras issues={issues} members={members} ids={[issue.id]} singleId={issue.id} show={show} today={today} />
      </button>
    </td>
  )
}

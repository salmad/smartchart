import type { ReactNode } from 'react'
import type { Issue, MemberLite, Roadmap, Status } from '@/engine/roadmaps/types'
import { STATUS_LABEL } from '@/engine/roadmaps/types'
import type { MatrixCol, MatrixCell as Cell, MatrixGroupCell } from '@/engine/roadmaps/matrix'
import { keyOf } from '@/engine/roadmaps/fields'
import { progress, progressUnder } from '@/engine/roadmaps/rollup'
import type { MatrixSettings } from '@/engine/roadmaps/view'
import { cn } from '@/app/lib/utils'
import { Avatar } from './Avatar'
import { MatrixPicker } from './MatrixPicker'
import { ProgressBar } from './ProgressBar'
import { StatusGlyph } from './StatusGlyph'
import { blendStatus, colAria, issueOverdue, lastQuarter, sharedAssignee } from './matrixCellMeta'

const TD = 'h-10 min-w-[256px] border-b border-l border-hair p-0'

/** A cell is a flat tile the size of its box. A light wash of its status makes the grid read as a heat map. */
const TILE =
  'flex h-10 w-full cursor-pointer items-center gap-2 px-3 text-left text-[13px] outline-none transition-colors duration-150 ease-out focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ink-3'

const WASH: Record<Status, string> = {
  backlog: 'hover:bg-panel',
  todo: 'hover:bg-panel',
  cancelled: 'hover:bg-panel',
  in_progress: 'bg-gold/[.06] hover:bg-gold/[.11]',
  done: 'bg-ok/[.06] hover:bg-ok/[.11]',
  blocked: 'bg-bad/[.07] hover:bg-bad/[.12]',
}

type Show = MatrixSettings['show']

function Rollup({ value }: { value: number }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <ProgressBar value={value} />
      <span className="w-8 text-right text-[12px] tabular-nums text-ink-3">{Math.round(value * 100)}%</span>
    </span>
  )
}

interface FaceProps {
  status: Status
  label: string
  /** Null for an issue with no children: its status already says it all. */
  progress: number | null
  quarter: string | null
  late: boolean
  assignee: string | null
  members: MemberLite[]
  show: Show
}

function Face({ status, label, progress: share, quarter, late, assignee, members, show }: FaceProps) {
  const who = show.assignee && assignee ? members.find((m) => m.id === assignee)?.name : undefined
  return (
    <>
      <StatusGlyph status={status} />
      <span className="min-w-0 flex-1 truncate text-ink-2">{label}</span>
      {show.progress && share !== null && <Rollup value={share} />}
      {show.dates && (
        <span className={cn('w-[52px] shrink-0 whitespace-nowrap text-right text-[12px] tabular-nums', late ? 'text-bad' : 'text-ink-3')}>
          {late ? 'Overdue' : quarter}
        </span>
      )}
      {who && <Avatar name={who} />}
    </>
  )
}

interface IssueCellProps {
  roadmap: Roadmap
  issues: Issue[]
  /** Ids of the issues that have children. */
  parents: ReadonlySet<string>
  members: MemberLite[]
  rowIssue: Issue
  col: MatrixCol
  cell: Cell
  show: Show
  today: string
  cellTag: string
  focused: boolean
  onFocus: () => void
  onOpen: (id: string) => void
}

/** A cell names its issue only when the row does not already: "Credit policy: UK" under Credit policy reads as its status. */
function namedByRow(issue: Issue, row: Issue): boolean {
  return issue.id === row.id || issue.title.toLowerCase().startsWith(row.title.toLowerCase())
}

export function MatrixIssueCell({ roadmap, issues, parents, members, rowIssue, col, cell, show, today, cellTag, focused, onFocus, onOpen }: IssueCellProps) {
  const ids = cell.kind === 'one' ? [cell.issueId] : cell.kind === 'many' ? cell.issueIds : []
  const picks = ids.map((id) => issues.find((i) => i.id === id)).filter((i): i is Issue => !!i)
  // Nothing planned here: nothing drawn, nothing to press.
  if (!picks.length) return <td className={TD} />

  const where = colAria(col.parts)
  const face = (status: Status, label: string, share: number | null): ReactNode => (
    <Face
      status={status}
      label={label}
      progress={share}
      quarter={lastQuarter(issues, picks)}
      late={picks.some((p) => issueOverdue(p, today))}
      assignee={sharedAssignee(picks)}
      members={members}
      show={show}
    />
  )

  if (picks.length > 1) {
    const status = blendStatus(picks)
    return (
      <td className={TD}>
        <MatrixPicker
          roadmap={roadmap}
          picks={picks}
          label={`${where}: ${picks.length} issues`}
          cellTag={cellTag}
          focused={focused}
          onFocus={onFocus}
          onOpen={onOpen}
          className={cn(TILE, WASH[status])}
        >
          {face(status, `${picks.length} issues`, progressUnder(issues, ids))}
        </MatrixPicker>
      </td>
    )
  }

  const issue = picks[0]
  const label = namedByRow(issue, rowIssue) ? STATUS_LABEL[issue.status] : issue.title
  return (
    <td className={TD}>
      <button
        type="button"
        tabIndex={focused ? 0 : -1}
        data-matrix-cell={cellTag}
        aria-label={`Open ${keyOf(roadmap, issue)} ${issue.title} in ${where}`}
        title={`${issue.title} · ${STATUS_LABEL[issue.status]}`}
        className={cn(TILE, WASH[issue.status])}
        onFocus={onFocus}
        onClick={() => onOpen(issue.id)}
      >
        {face(issue.status, label, parents.has(issue.id) ? progress(issues, issue.id) : null)}
      </button>
    </td>
  )
}

/** A group row's cell rolls up what sits under it, in the same slots as the cells below so the bars line up. */
export function MatrixGroupCellView({ col, cell, show }: { col: MatrixCol; cell: MatrixGroupCell; show: Show }) {
  return (
    <td className={cn(TD, 'bg-panel')} aria-label={`${colAria(col.parts)} group`}>
      {show.progress && cell.progress !== null && (
        <span className="flex items-center justify-end gap-2 px-3">
          <Rollup value={cell.progress} />
          {show.dates && <span className="w-[52px] shrink-0" aria-hidden />}
        </span>
      )}
    </td>
  )
}

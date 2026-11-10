import type { Issue, MemberLite, Roadmap } from '@/engine/roadmaps/types'
import type { MatrixCol, MatrixCell as Cell, MatrixGroupCell } from '@/engine/roadmaps/matrix'
import { cellWorst, dueQuarter } from '@/engine/roadmaps/matrix'
import { keyOf } from '@/engine/roadmaps/fields'
import { dateSpan } from '@/engine/roadmaps/rollup'
import type { MatrixSettings } from '@/engine/roadmaps/view'
import { MatrixPicker } from './MatrixPicker'
import { CardBar, CardFace, cardLateRing, cardRing, cardSurface, statusFace, toneOf } from './MatrixCard'
import { Avatar } from '../Avatar'
import { cellProgress, colAria, displayDueQuarter, issueOverdue, sharedAssignee } from './matrixCellMeta'
import { cn } from '@/app/lib/utils'

const TD = 'min-w-[160px] border-b border-l border-hair p-1'

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
  col: MatrixCol
  cell: MatrixGroupCell
  show: MatrixSettings['show']
}

function AssigneeDisc({ assignee, members }: { assignee: string; members: MemberLite[] }) {
  const name = members.find((m) => m.id === assignee)?.name ?? ''
  if (!name) return null
  return (
    <span className="relative flex size-[18px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-line text-[9px] text-ink-2">
      <Avatar name={name} image={null} />
    </span>
  )
}

interface Shown {
  quarter: string | null
  progress: number | null
  assignee: React.ReactNode
}

/** What the Display switches ask a cell to show beyond its status. */
function shown(
  issues: Issue[],
  members: MemberLite[],
  ids: string[],
  singleId: string | null,
  show: MatrixSettings['show'],
): Shown {
  const due = singleId ? dateSpan(issues, singleId).due : null
  const quarter = show.dates ? (singleId ? (due ? dueQuarter(due) : null) : displayDueQuarter(issues, ids)) : null
  const who = show.assignee ? sharedAssignee(issues, ids) : undefined
  return {
    quarter,
    progress: show.progress ? cellProgress(issues, ids, singleId) : null,
    assignee: who ? <AssigneeDisc assignee={who} members={members} /> : null,
  }
}

export function MatrixEmptyCell() {
  return (
    <td className={cn(TD, 'text-center text-[13px] text-white/20')} aria-label="Not planned here">
      —
    </td>
  )
}

/** A group row's cell rolls its issues up: one bar and a share, on the panel. */
export function MatrixGroupCellView({ issues, col, cell, show }: GroupCellProps) {
  const progress = show.progress ? cellProgress(issues, cell.issueIds, null) : null
  return (
    <td className={cn(TD, 'bg-panel')} aria-label={`${colAria(col.parts)} group`}>
      {progress !== null && (
        <span className="flex h-3 items-center gap-2 px-2">
          <CardBar value={progress} />
          <span className="w-8 text-right text-[11.5px] tabular-nums text-ink-2">{Math.round(progress * 100)}%</span>
        </span>
      )}
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
    const late = cellWorst(issues, cell.issueIds, today)
    const label = `${colAria(col.parts)}: ${cell.issueIds.length} issues`
    const s = shown(issues, members, cell.issueIds, null, show)
    return (
      <td className={TD}>
        <MatrixPicker
          roadmap={roadmap}
          issues={issues}
          ids={cell.issueIds}
          label={label}
          cellTag={cellTag}
          focused={focused}
          onFocus={onFocus}
          onOpen={onOpen}
          className={cn(cardSurface, late ? cardLateRing : cardRing)}
        >
          <CardFace
            label={`${cell.issueIds.length} issues`}
            quarter={s.quarter}
            assignee={s.assignee}
            progress={s.progress}
            tone={toneOf(null, late)}
          />
        </MatrixPicker>
      </td>
    )
  }

  const issue = issues.find((i) => i.id === cell.issueId)
  if (!issue) return <MatrixEmptyCell />

  const late = issueOverdue(issue, today)
  const s = shown(issues, members, [issue.id], issue.id, show)
  const face = show.status ? statusFace(issue.status) : null
  return (
    <td className={TD}>
      <button
        type="button"
        tabIndex={focused ? 0 : -1}
        data-matrix-cell={cellTag}
        aria-label={`Open ${keyOf(roadmap, issue)} ${issue.title} in ${colAria(col.parts)}`}
        className={cn(cardSurface, late ? cardLateRing : cardRing, 'cursor-pointer')}
        onFocus={onFocus}
        onClick={() => onOpen(issue.id)}
      >
        <CardFace
          glyph={face?.glyph}
          label={face?.label}
          quarter={late && s.quarter ? 'Overdue' : s.quarter}
          late={late}
          assignee={s.assignee}
          progress={s.progress}
          tone={toneOf(issue.status, late)}
        />
      </button>
    </td>
  )
}

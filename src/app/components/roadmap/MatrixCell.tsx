import type { ReactNode } from 'react'
import type { Issue, MemberLite, Roadmap, Status } from '@/engine/roadmaps/types'
import { STATUS_LABEL } from '@/engine/roadmaps/types'
import type { MatrixCol, MatrixCell as Cell, MatrixGroupCell } from '@/engine/roadmaps/matrix'
import { keyOf } from '@/engine/roadmaps/fields'
import { progressUnder, statusMix, type StatusMix } from '@/engine/roadmaps/rollup'
import type { MatrixSettings } from '@/engine/roadmaps/view'
import { cn } from '@/app/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip'
import { Avatar } from './Avatar'
import { MatrixPicker } from './MatrixPicker'
import { StatusGlyph } from './StatusGlyph'
import { blendStatus, colAria, issueOverdue, lastQuarter, sharedAssignee } from './matrixCellMeta'

const TD = 'h-10 border-b border-hair p-0'

/** A cell with work is a quiet neutral card inset in its box, so it stands apart from an empty cell (which draws
    nothing). The card is the same grey for every status: the status is said once, by its mark or its strip. */
const TILE =
  'group/cell flex h-8 w-full cursor-pointer items-center gap-2 rounded-md bg-ink/[.06] px-2.5 text-left text-[13px] outline-none transition-colors duration-150 ease-out hover:bg-ink/[.1] focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ink-3'

/** The box around a card: the row's height, with the card's inset. */
const TD_FILLED = 'h-10 border-b border-hair px-1 py-1'

type Show = MatrixSettings['show']

/** What sits under a cell: its status split as a strip, then the share done. */
interface Rolled {
  mix: StatusMix
  share: number
}

function Rollup({ mix, share }: Rolled) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      <StatusStrip mix={mix} />
      <span className="w-8 text-right text-[12px] tabular-nums text-ink-3">{Math.round(share * 100)}%</span>
    </span>
  )
}

interface FaceProps {
  status: Status
  label: string
  /** Null for an issue with no children: its status already says it all. */
  rolled: Rolled | null
  quarter: string | null
  late: boolean
  assignee: string | null
  members: MemberLite[]
  show: Show
}

/** The due quarter, always shown once turned on in Display. Overdue (not done, past its date) turns it red: the
    colour says it, so the quarter stays readable. */
function Due({ quarter, late }: { quarter: string | null; late: boolean }) {
  return (
    <span title={late ? 'Overdue' : undefined} className={cn('w-[52px] shrink-0 whitespace-nowrap text-right text-[12px] tabular-nums', late ? 'text-bad' : 'text-ink-3')}>
      {quarter}
      {late && <span className="sr-only">, overdue</span>}
    </span>
  )
}

function Face({ status, label, rolled, quarter, late, assignee, members, show }: FaceProps) {
  const who = show.assignee && assignee ? members.find((m) => m.id === assignee)?.name : undefined
  return (
    <>
      {/* Rolled up, the strip is the status; one piece of work shows its mark. Never both. */}
      {show.progress && rolled ? (
        <>
          {label && <span className="min-w-0 max-w-[45%] truncate text-ink-2">{label}</span>}
          <Rollup {...rolled} />
        </>
      ) : (
        <>
          <StatusGlyph status={status} />
          <span className="min-w-0 flex-1 truncate text-ink-2">{label}</span>
        </>
      )}
      {show.dates && <Due quarter={quarter} late={late} />}
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
  // A cell rolls up whenever there is more than one piece of work under it: several issues, or one with children.
  const share = picks.length > 1 || parents.has(picks[0].id) ? progressUnder(issues, ids) : null
  const rolled = share === null ? null : { mix: statusMix(issues, ids), share }
  const face = (status: Status, label: string): ReactNode => (
    <Face
      status={status}
      label={label}
      rolled={rolled}
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
      <td className={TD_FILLED}>
        <MatrixPicker
          roadmap={roadmap}
          picks={picks}
          label={`${where}: ${picks.length} issues`}
          cellTag={cellTag}
          focused={focused}
          onFocus={onFocus}
          onOpen={onOpen}
          className={TILE}
        >
          {face(status, `${picks.length} issues`)}
        </MatrixPicker>
      </td>
    )
  }

  const issue = picks[0]
  const label = namedByRow(issue, rowIssue) ? '' : issue.title
  return (
    <td className={TD_FILLED}>
      <button
        type="button"
        tabIndex={focused ? 0 : -1}
        data-matrix-cell={cellTag}
        aria-label={`Open ${keyOf(roadmap, issue)} ${issue.title} in ${where}`}
        title={`${issue.title} · ${STATUS_LABEL[issue.status]}`}
        className={TILE}
        onFocus={onFocus}
        onClick={() => onOpen(issue.id)}
      >
        {face(issue.status, label)}
      </button>
    </td>
  )
}

const MIX: { key: keyof StatusMix; label: string; fill: string }[] = [
  { key: 'done', label: 'done', fill: 'fill-ok' },
  { key: 'in_progress', label: 'in progress', fill: 'fill-gold' },
  { key: 'blocked', label: 'blocked', fill: 'fill-bad' },
  { key: 'open', label: 'open', fill: 'fill-line' },
]

/** The group's work under one column, split by status in the heat map's colours: done, moving, stuck, still open. */
function StatusStrip({ mix, className }: { mix: StatusMix; className?: string }) {
  const total = MIX.reduce((n, m) => n + mix[m.key], 0)
  let x = 0
  const parts = MIX.filter((m) => mix[m.key] > 0).map((m) => {
    const w = (mix[m.key] / total) * 100
    const rect = <rect key={m.key} x={x} width={w} height="4" className={m.fill} />
    x += w
    return rect
  })
  const says = MIX.filter((m) => mix[m.key] > 0).map((m) => `${mix[m.key]} ${m.label}`).join(' · ')
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn('flex h-1 min-w-0 flex-1 cursor-default overflow-hidden rounded-full', className)}>
          <svg viewBox="0 0 100 4" preserveAspectRatio="none" className="h-1 w-full" aria-hidden>
            {parts}
          </svg>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-[11px] tabular-nums">{says}</TooltipContent>
    </Tooltip>
  )
}

/** A group row's cell sums up what sits under it, in the same slots as the cells below so the numbers line up: the
    status split and share done where a parent shows its own, then the last due quarter, red when any is overdue. */
export function MatrixGroupCellView({ col, cell, show, issues, today }: { col: MatrixCol; cell: MatrixGroupCell; show: Show; issues: Issue[]; today: string }) {
  const picks = cell.issueIds.map((id) => issues.find((i) => i.id === id)).filter((i): i is Issue => !!i)
  if (!picks.length) return <td className={cn(TD, 'bg-panel')} />
  return (
    <td className={cn(TD, 'bg-panel')} aria-label={`${colAria(col.parts)} group`}>
      <span className="flex items-center gap-2 px-3.5">
        {show.progress && cell.progress !== null ? <Rollup mix={cell.mix} share={cell.progress} /> : <span className="flex-1" />}
        {show.dates && <Due quarter={lastQuarter(issues, picks)} late={picks.some((p) => issueOverdue(p, today))} />}
      </span>
    </td>
  )
}

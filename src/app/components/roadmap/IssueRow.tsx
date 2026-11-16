import type { DragEvent, ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import type { FieldDef, Issue, MemberLite, Roadmap } from '@/engine/roadmaps/types'
import type { TableRow } from '@/engine/roadmaps/view'
import { keyOf } from '@/engine/roadmaps/fields'
import { dateSpan, progress } from '@/engine/roadmaps/rollup'
import type { IssueProps, RoadmapOp } from '@/engine/roadmaps/ops'
import { StatusCell } from './cells/StatusCell'
import { PersonCell } from './cells/PersonCell'
import { DateCell } from './cells/DateCell'
import { FieldCell } from './cells/FieldCell'
import { SprintCell } from './cells/SprintCell'
import { GroupHeader } from './GroupLabel'
import { ProgressBar } from './ProgressBar'
import { StatusGlyph } from './StatusGlyph'
import { Checkbox } from '../ui/checkbox'
import { Input } from '../ui/input'
import { shortDate } from './dates'
import { columnWidth, progressColumn, titleColumn } from './issueTableView'
import { cn } from '@/app/lib/utils'
import type { ComposeDraft } from './useTableKeys'

/* A row paints itself through --row, so the pinned title cell (opaque, to cover what scrolls under it) and the rest of
   the row always carry the same tint. */
// The sticky title cell is opaque (it covers what scrolls under it), so its inner line carries the row's tint; the other cells carry it themselves.
const rowTint = '[&>td]:border-b [&>td]:border-hair [&>td:not(:first-child)]:bg-[color:var(--row,transparent)]'
const titleCell = cn(titleColumn, 'z-[1] w-full max-w-0 p-0')
const titleLine = 'flex h-[35px] min-w-0 items-center bg-[color:var(--row,transparent)] pr-3'
const gutter = 'grid w-9 shrink-0 place-items-center'
const tinted = '[--row:theme(colors.hair)]'

function Indent({ depth }: { depth: number }) {
  return (
    <>
      {Array.from({ length: depth }).map((_, i) => (
        <span key={i} className="w-5 shrink-0" aria-hidden />
      ))}
    </>
  )
}

/** A parent's rolled-up progress: the bar, then the share in figures. */
function ProgressCell({ value, className }: { value: number | null; className?: string }) {
  return (
    <td className={cn(progressColumn, 'pl-3 pr-4', className)}>
      {value !== null && (
        <div className="flex items-center gap-2.5">
          <ProgressBar value={value} />
          <span className="text-[12px] tabular-nums text-ink-3">{Math.round(value * 100)}%</span>
        </div>
      )}
    </td>
  )
}

interface ColProps {
  fields: FieldDef[]
  columns: string[]
}

interface GroupProps {
  row: Extract<TableRow, { kind: 'group' }>
  colCount: number
  person?: boolean
  onToggle: (key: string, all: boolean) => void
}

/** Group headers stay under the column head while their rows scroll; an inner level stays under its outer one. */
const groupCell = 'sticky z-10 h-9 border-b border-hair bg-panel p-0'
const groupTop = ['top-[35px]', 'top-[71px]']

/** A group's header: the fold, its name and count, its progress. The whole row folds it. */
export function IssueGroupRow({ row, colCount, person, onToggle }: GroupProps) {
  const cell = cn(groupCell, groupTop[row.depth] ?? groupTop[0])
  return (
    <tr className="cursor-default" onClick={(e) => onToggle(row.key, e.altKey)}>
      <td colSpan={colCount - 1} className={cell}>
        <div className="sticky left-0 flex w-fit items-center whitespace-nowrap pl-3 pr-3">
          <GroupHeader label={row.label} count={row.count} person={person} empty={row.empty} open={row.open} depth={row.depth} onToggle={(all) => onToggle(row.key, all)} />
        </div>
      </td>
      <ProgressCell value={row.progress} className={cell} />
    </tr>
  )
}

interface ComposeProps extends ColProps {
  draft: ComposeDraft
  depth: number
  onTitle: (title: string) => void
  onCommit: () => void
}

/** A new issue being typed: a real row's columns, with the title still to come. */
export function ComposeIssueRow({ draft, depth, fields, columns, onTitle, onCommit }: ComposeProps) {
  return (
    <tr className={cn(rowTint, tinted, 'animate-in fade-in-0 duration-150 motion-reduce:animate-none')}>
      <td className={titleCell}>
        <div className={titleLine}>
          <span className={gutter} aria-hidden />
          <Indent depth={depth} />
          <span className="grid h-6 w-11 shrink-0 place-items-center pl-5" aria-hidden>
            <StatusGlyph status="todo" className="opacity-50" />
          </span>
          <Input
            autoFocus
            value={draft.title}
            onChange={(e) => onTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); onCommit() } }}
            className="ml-1.5 h-7 min-w-0 flex-1 rounded-none border-0 px-0 text-[13px] text-ink shadow-none placeholder:text-ink-3 focus-visible:ring-0 md:text-[13px]"
            aria-label="New issue title"
            placeholder="Issue title"
          />
        </div>
      </td>
      {columns.map((c) => (
        <td key={c} className={columnWidth(c, fields)} />
      ))}
      <td className={progressColumn} />
    </tr>
  )
}

interface RowProps extends ColProps {
  row: Extract<TableRow, { kind: 'issue' }>
  roadmap: Roadmap
  members: MemberLite[]
  allIssues: Issue[]
  today: string
  canEdit: boolean
  act: (op: RoadmapOp) => 'ok' | string
  onToggleCollapse: (id: string) => void
  focused: boolean
  selected: boolean
  onFocus: () => void
  onOpen: () => void
  onSelect: (extend: boolean) => void
  drag: {
    start: (id: string) => (e: DragEvent<HTMLTableRowElement>) => void
    end: () => void
    over: (id: string) => (e: DragEvent<HTMLTableRowElement>) => void
    dropOn: (id: string) => (e: DragEvent<HTMLTableRowElement>) => void
    dragging: string | null
  }
}

export function IssueDataRow({
  row, roadmap, fields, columns, members, allIssues, today, canEdit, act, onToggleCollapse, focused, selected, onFocus, onOpen, onSelect, drag,
}: RowProps) {
  const { issue, depth, dim, hasChildren, open } = row
  const late = !!issue.due && issue.due < today && issue.status !== 'done' && issue.status !== 'cancelled'
  // Under a group a parent shows only that group's part of its work.
  const span = hasChildren ? row.part ?? dateSpan(allIssues, issue.id) : null
  const patch = (props: IssueProps) => { act({ op: 'set', ids: [issue.id], props }) }

  /** A parent with no date of its own shows the span of its sub-issues, as the Gantt draws it: derived, so not editable. */
  const dateCell = (side: 'start' | 'due'): ReactNode => {
    const rolled = issue[side] === null || row.part ? span?.[side] : null
    if (rolled) {
      return (
        <span className="px-1.5 tabular-nums text-ink-3" title={`${side === 'start' ? 'Earliest start' : 'Latest due date'} of its sub-issues${row.part ? ' in this group' : ''}`}>
          {shortDate(rolled, today)}
        </span>
      )
    }
    return side === 'start' ? (
      <DateCell value={issue.start} label="Start date" disabled={!canEdit} onPick={(v) => patch({ start: v })} />
    ) : (
      <DateCell value={issue.due} label="Due date" late={late} disabled={!canEdit} onPick={(v) => patch({ due: v })} />
    )
  }

  return (
    <tr
      data-issue-id={issue.id}
      draggable={canEdit}
      onDragStart={drag.start(issue.id)}
      onDragEnd={drag.end}
      onDragOver={drag.over(issue.id)}
      onDrop={drag.dropOn(issue.id)}
      onClick={(e) => {
        const target = e.target as HTMLElement
        if (target.closest('[data-skip-select]')) return
        onFocus()
        if (canEdit && e.shiftKey) onSelect(true)
        else if (!e.metaKey && !e.ctrlKey && target.closest('[data-open]')) onOpen()
      }}
      className={cn(
        'group scroll-mt-9 text-[13px] text-ink transition-colors duration-120 hover:[--row:theme(colors.hair)]',
        rowTint,
        dim && 'opacity-45',
        focused && 'group-focus-within/table:[--row:theme(colors.hair)]',
        selected && '[--row:theme(colors.line)] hover:[--row:theme(colors.line)] group-focus-within/table:[--row:theme(colors.line)]',
        drag.dragging === issue.id && 'opacity-40',
      )}
    >
      <td data-open className={cn(titleCell, 'cursor-pointer')}>
        <div className={titleLine}>
          <span className={gutter} data-skip-select>
            {canEdit && (
              <Checkbox
                checked={selected}
                onCheckedChange={() => onSelect(false)}
                aria-label={`Select ${issue.title}`}
                className={cn(
                  'size-3.5 rounded-[4px] border-line-2 opacity-0 shadow-none transition-opacity duration-120 focus-visible:opacity-100 group-hover:opacity-100 data-[state=checked]:border-primary data-[state=checked]:opacity-100',
                  focused && 'group-focus-within/table:opacity-100',
                )}
              />
            )}
          </span>
          <Indent depth={depth + (row.inset ?? 0)} />
          {hasChildren ? (
            <button
              type="button"
              className="grid size-5 shrink-0 place-items-center rounded text-ink-3 outline-none transition-colors duration-120 hover:bg-raise hover:text-ink focus-visible:ring-1 focus-visible:ring-ring"
              data-skip-select
              aria-label={open ? `Collapse ${issue.title}` : `Expand ${issue.title}`}
              aria-expanded={open}
              onClick={() => onToggleCollapse(issue.id)}
            >
              <ChevronRight className={cn('size-3.5 transition-transform duration-120', open && 'rotate-90')} strokeWidth={2} aria-hidden />
            </button>
          ) : (
            <span className="w-5 shrink-0" aria-hidden />
          )}
          <span data-skip-select className="shrink-0">
            <StatusCell status={issue.status} disabled={!canEdit} onPick={(status) => patch({ status })} />
          </span>
          <span className={cn('ml-1.5 truncate', hasChildren && 'font-medium')} title={issue.title}>{issue.title}</span>
          <span className="ml-2 shrink-0 whitespace-nowrap text-[12px] tabular-nums text-ink-3">{keyOf(roadmap, issue)}</span>
        </div>
      </td>
      {columns.map((col) => {
        const custom = fields.find((f) => f.id === col)
        return (
          <td key={col} className={cn(columnWidth(col, fields), 'px-1.5')} data-skip-select>
            {col === 'assignee' ? (
              <PersonCell assignee={issue.assignee} members={members} disabled={!canEdit} onPick={(id) => patch({ assignee: id })} />
            ) : col === 'start' || col === 'due' ? (
              dateCell(col)
            ) : col === 'sprint' ? (
              roadmap.sprints && <SprintCell rhythm={roadmap.sprints} today={today} sprint={issue.sprint} disabled={!canEdit} onPick={(sprint) => patch({ sprint })} />
            ) : custom ? (
              <FieldCell field={custom} value={issue.fields[col]} members={members} disabled={!canEdit} onPick={(v) => patch({ fields: { [col]: v } })} />
            ) : null}
          </td>
        )
      })}
      <ProgressCell value={hasChildren ? (row.part ? row.part.progress : progress(allIssues, issue.id)) : null} />
    </tr>
  )
}

import { ChevronDown, ChevronRight } from 'lucide-react'
import type { FieldDef, Issue, MemberLite, Roadmap } from '@/engine/roadmaps/types'
import type { TableRow } from '@/engine/roadmaps/view'
import { keyOf } from '@/engine/roadmaps/fields'
import { progress } from '@/engine/roadmaps/rollup'
import type { RoadmapOp } from '@/engine/roadmaps/ops'
import { StatusCell } from './cells/StatusCell'
import { PersonCell } from './cells/PersonCell'
import { DateCell } from './cells/DateCell'
import { FieldCell } from './cells/FieldCell'
import { ProgressBar } from './ProgressBar'
import { Checkbox } from '../ui/checkbox'
import { todayIso } from './dates'
import { cn } from '@/app/lib/utils'
import type { DragEvent } from 'react'
import type { ComposeDraft } from './useTableKeys'

interface ColProps {
  roadmap: Roadmap
  fields: FieldDef[]
  columns: string[]
  members: MemberLite[]
  allIssues: Issue[]
  colCount: number
  canEdit: boolean
  act: (op: RoadmapOp) => 'ok' | string
}

interface IssueProps extends ColProps {
  row: Extract<TableRow, { kind: 'issue' }>
  onToggleCollapse: (id: string) => void
  focused: boolean
  selected: boolean
  onFocus: () => void
  onOpen?: () => void
  onSelect: (extend: boolean) => void
  drag: {
    start: (id: string) => (e: DragEvent<HTMLTableRowElement>) => void
    end: () => void
    over: (id: string) => (e: DragEvent<HTMLTableRowElement>) => void
    dropOn: (id: string) => (e: DragEvent<HTMLTableRowElement>) => void
    dragging: string | null
  }
}

interface GroupProps extends ColProps {
  row: Extract<TableRow, { kind: 'group' }>
}

interface ComposeProps extends ColProps {
  draft: ComposeDraft
  depth: number
  onTitle: (title: string) => void
  onCommit: () => void
}

export function IssueGroupRow({ row, colCount }: GroupProps) {
  return (
    <tr className="h-[34px] border-b border-hair bg-panel text-[12px] text-ink-2">
      <td colSpan={colCount} className="px-4">
        <div className="flex items-center gap-3">
          <span className="font-medium text-ink">{row.label}</span>
          <span className="text-ink-3">
            {row.count} {row.count === 1 ? 'issue' : 'issues'}
          </span>
          {row.progress !== null && (
            <span className="ml-auto">
              <ProgressBar value={row.progress} />
            </span>
          )}
        </div>
      </td>
    </tr>
  )
}

export function ComposeIssueRow({ draft, depth, columns, onTitle, onCommit }: ComposeProps) {
  return (
    <tr className="h-[34px] border-b border-hair bg-white/[.045] text-[12.5px] shadow-[inset_2px_0_0_theme(colors.ink)]">
      <td className="w-6 px-1" />
      <td className="w-8 px-2" />
      <td className="w-24 px-2 font-mono text-ink-3">…</td>
      <td className="min-w-[200px] px-2" colSpan={1}>
        <div className="flex min-w-0 items-center gap-1">
          {Array.from({ length: depth }).map((_, i) => (
            <span key={i} className="inline-block w-4 shrink-0" aria-hidden />
          ))}
          <input
            autoFocus
            value={draft.title}
            onChange={(e) => onTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); onCommit() } }}
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[12.5px] text-ink outline-none ring-0 placeholder:text-ink-3 focus:ring-0"
            aria-label="New issue title"
            placeholder="Issue title"
          />
        </div>
      </td>
      {columns.map((c) => (
        <td key={c} className="w-28 px-2" />
      ))}
      <td className="w-20 px-2" />
    </tr>
  )
}

export function IssueDataRow({
  row,
  roadmap,
  fields,
  columns,
  members,
  allIssues,
  canEdit,
  act,
  onToggleCollapse,
  focused,
  selected,
  onFocus,
  onOpen,
  onSelect,
  drag,
}: IssueProps) {
  const { issue, depth, dim, hasChildren, open } = row
  const late = !!issue.due && issue.due < todayIso() && issue.status !== 'done' && issue.status !== 'cancelled'
  const parentProg = hasChildren ? progress(allIssues, issue.id) : null

  const patch = (props: Record<string, unknown>) => {
    act({ op: 'set', ids: [issue.id], props: props as import('@/engine/roadmaps/ops').IssueProps })
  }

  const fieldDef = (col: string) => fields.find((f) => f.id === col)

  return (
    <tr
      data-issue-id={issue.id}
      tabIndex={0}
      draggable={canEdit}
      onDragStart={drag.start(issue.id)}
      onDragEnd={drag.end}
      onDragOver={drag.over(issue.id)}
      onDrop={drag.dropOn(issue.id)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-skip-select]')) return
        onFocus()
        if (canEdit && e.shiftKey) onSelect(true)
      }}
      onDoubleClick={() => onOpen?.()}
      className={cn(
        'group h-[34px] border-b border-hair text-[12.5px] text-ink outline-none hover:bg-white/[.025]',
        dim && 'opacity-45',
        (focused || selected) && 'bg-white/[.045] shadow-[inset_2px_0_0_theme(colors.ink)] hover:bg-white/[.045]',
        drag.dragging === issue.id && 'opacity-40',
      )}
    >
      <td className="w-6 px-1" data-skip-select>
        <Checkbox
          checked={selected}
          onCheckedChange={() => onSelect(false)}
          aria-label={`Select ${issue.title}`}
          className="size-3.5 rounded-[3px] border-line-2 opacity-0 shadow-none transition-opacity focus-visible:opacity-100 group-hover:opacity-100 data-[state=checked]:border-ink data-[state=checked]:bg-ink data-[state=checked]:text-app-bg data-[state=checked]:opacity-100"
        />
      </td>
      <td className="w-8 px-2" data-skip-select>
        <StatusCell
          status={issue.status}
          disabled={!canEdit}
          onPick={(status) => { act({ op: 'set', ids: [issue.id], props: { status } }) }}
        />
      </td>
      <td className="w-20 whitespace-nowrap px-2 font-mono text-[12px] text-ink-3">{keyOf(roadmap, issue)}</td>
      <td className="min-w-[200px] max-w-[420px] px-2">
        <div className="flex min-w-0 items-center gap-1">
          {Array.from({ length: depth }).map((_, i) => (
            <span key={i} className="inline-block w-4 shrink-0" aria-hidden />
          ))}
          {hasChildren ? (
            <button
              type="button"
              className="shrink-0 text-ink-3 hover:text-ink"
              data-skip-select
              aria-label={open ? `Collapse ${issue.title}` : `Expand ${issue.title}`}
              onClick={() => onToggleCollapse(issue.id)}
            >
              {open ? <ChevronDown className="size-3" strokeWidth={2} /> : <ChevronRight className="size-3" strokeWidth={2} />}
            </button>
          ) : (
            <span className="inline-block w-3 shrink-0" aria-hidden />
          )}
          <span className="truncate">{issue.title}</span>
        </div>
      </td>
      {columns.map((col) => {
        const custom = fieldDef(col)
        return (
          <td key={col} className="w-24 whitespace-nowrap px-2 text-ink-2" data-skip-select>
            {col === 'assignee' ? (
              <PersonCell
                assignee={issue.assignee}
                members={members}
                disabled={!canEdit}
                onPick={(id) => patch({ assignee: id })}
              />
            ) : col === 'start' ? (
              <DateCell value={issue.start} label="Start date" disabled={!canEdit} onPick={(v) => patch({ start: v })} />
            ) : col === 'due' ? (
              <DateCell value={issue.due} label="Due date" late={late} disabled={!canEdit} onPick={(v) => patch({ due: v })} />
            ) : custom ? (
              <FieldCell
                field={custom}
                value={issue.fields[col]}
                members={members}
                disabled={!canEdit}
                onPick={(v) => patch({ fields: { [col]: v } })}
              />
            ) : null}
          </td>
        )
      })}
      <td className="w-20 px-2">
        {parentProg !== null && <ProgressBar value={parentProg} />}
      </td>
    </tr>
  )
}

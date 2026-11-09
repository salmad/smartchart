import { ChevronDown, ChevronRight } from 'lucide-react'
import type { TableRow } from '@/engine/roadmaps/view'
import type { Mark } from '@/engine/roadmaps/gantt'
import { StatusGlyph } from './StatusGlyph'
import { cn } from '@/app/lib/utils'
import { listRowDatesDraggable, type useIssueDatesDrop } from './useIssueDatesDrop'

type DatesDropApi = ReturnType<typeof useIssueDatesDrop>

interface Props {
  row: TableRow
  mark: Mark | null
  canEdit: boolean
  datesDrop: DatesDropApi
  onToggleCollapse: (id: string) => void
  onOpenIssue?: (id: string) => void
}

export function GanttListRow({ row, mark, canEdit, datesDrop, onToggleCollapse, onOpenIssue }: Props) {
  if (row.kind === 'group') {
    return (
      <div className="flex h-8 items-center gap-3 border-b border-hair bg-panel px-4 text-[12px] text-ink-2">
        <span className="font-medium text-ink">{row.label}</span>
        <span className="text-ink-3">
          {row.count} {row.count === 1 ? 'issue' : 'issues'}
        </span>
      </div>
    )
  }

  const { issue, depth, dim, hasChildren, open } = row
  const issueMark = mark ?? { kind: 'none' as const }
  const noDates = issueMark.kind === 'none'
  const draggable = listRowDatesDraggable(canEdit, issueMark)

  return (
    <div
      data-list-issue={issue.id}
      data-dim={dim ? 'true' : undefined}
      draggable={draggable}
      onDragStart={draggable ? datesDrop.listDragStart(issue.id) : undefined}
      onDragEnd={draggable ? datesDrop.listDragEnd : undefined}
      className={cn(
        'flex h-8 items-center gap-1.5 border-b border-hair px-2 text-[12.5px] text-ink',
        dim && 'opacity-50',
        draggable && 'cursor-grab active:cursor-grabbing',
        !draggable && 'cursor-default',
      )}
      onClick={() => onOpenIssue?.(issue.id)}
    >
      {Array.from({ length: depth }).map((_, i) => (
        <span key={i} className="inline-block w-5 shrink-0" aria-hidden />
      ))}
      {hasChildren ? (
        <button
          type="button"
          className="shrink-0 text-ink-3 hover:text-ink"
          aria-label={open ? `Collapse ${issue.title}` : `Expand ${issue.title}`}
          onClick={(e) => { e.stopPropagation(); onToggleCollapse(issue.id) }}
        >
          {open ? <ChevronDown className="size-3" strokeWidth={2} /> : <ChevronRight className="size-3" strokeWidth={2} />}
        </button>
      ) : (
        <span className="inline-block w-3 shrink-0" aria-hidden />
      )}
      <StatusGlyph status={issue.status} className="size-3.5 shrink-0" />
      <span className="min-w-0 truncate">{issue.title}</span>
      {noDates && <span className="ml-auto shrink-0 text-[11px] text-ink-3">No dates</span>}
    </div>
  )
}

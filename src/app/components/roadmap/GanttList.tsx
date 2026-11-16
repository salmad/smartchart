import { useRef } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { TableRow } from '@/engine/roadmaps/view'
import type { Mark } from '@/engine/roadmaps/gantt'
import type { Roadmap } from '@/engine/roadmaps/types'
import { keyOf } from '@/engine/roadmaps/fields'
import { cn } from '@/app/lib/utils'
import { Button } from '../ui/button'
import { GroupLabel } from './GroupLabel'
import { StatusGlyph } from './StatusGlyph'
import { listRowDatesDraggable, type useIssueDatesDrop } from './useIssueDatesDrop'

interface Props {
  row: TableRow
  roadmap: Roadmap
  person?: boolean
  mark: Mark
  canEdit: boolean
  /** A narrow list drops the issue key and keeps the title. */
  compact: boolean
  datesDrop: ReturnType<typeof useIssueDatesDrop>
  onToggleCollapse: (id: string) => void
  onOpenIssue?: (id: string) => void
}

/** A row's cell in the list: chevron, status, title, quiet key. An issue with no dates of its own can be dragged
    from here onto the timeline. */
export function GanttListRow({ row, roadmap, person, mark, canEdit, compact, datesDrop, onToggleCollapse, onOpenIssue }: Props) {
  const dragMoved = useRef(false)
  if (row.kind === 'group') {
    return (
      <div className="flex h-full items-center gap-3 px-4 text-[12px] text-ink-2">
        <GroupLabel label={row.label} count={row.count} person={person} empty={row.key === ''} />
      </div>
    )
  }

  const { issue, depth, dim, hasChildren, open } = row
  const draggable = listRowDatesDraggable(canEdit, mark)

  return (
    <div
      data-list-issue={issue.id}
      data-dim={dim ? 'true' : undefined}
      draggable={draggable}
      onDragStart={draggable ? (e) => { dragMoved.current = false; datesDrop.listDragStart(issue.id)(e) } : undefined}
      onDrag={draggable ? () => { dragMoved.current = true } : undefined}
      onDragEnd={draggable ? datesDrop.listDragEnd : undefined}
      onClick={() => {
        if (dragMoved.current) { dragMoved.current = false; return }
        onOpenIssue?.(issue.id)
      }}
      className={cn(
        'flex h-full cursor-pointer items-center gap-2 pl-3 pr-3 text-[13px] text-ink transition-colors duration-150 ease-out group-hover/row:bg-white/[.025]',
        dim && 'opacity-50',
      )}
    >
      {depth > 0 && Array.from({ length: depth }, (_, i) => <span key={i} className="w-2 shrink-0" aria-hidden />)}
      {hasChildren ? (
        <Button
          variant="ghost"
          className="size-5 shrink-0 rounded-[5px] p-0 text-ink-3 hover:bg-white/[.06] [&_svg]:size-3.5"
          aria-label={open ? `Collapse ${issue.title}` : `Expand ${issue.title}`}
          onClick={(e) => { e.stopPropagation(); onToggleCollapse(issue.id) }}
        >
          {open ? <ChevronDown strokeWidth={2} /> : <ChevronRight strokeWidth={2} />}
        </Button>
      ) : (
        <span className="size-5 shrink-0" aria-hidden />
      )}
      <StatusGlyph status={issue.status} className="size-3.5 shrink-0" />
      <span title={issue.title} className={cn('min-w-0 flex-1 truncate', hasChildren && 'font-medium')}>{issue.title}</span>
      {!compact && <span className="shrink-0 whitespace-nowrap text-[12px] tabular-nums text-ink-3">{keyOf(roadmap, issue)}</span>}
    </div>
  )
}

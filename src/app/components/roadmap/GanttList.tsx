import { useRef } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { TableRow } from '@/engine/roadmaps/view'
import type { Mark } from '@/engine/roadmaps/gantt'
import type { Roadmap } from '@/engine/roadmaps/types'
import { keyOf } from '@/engine/roadmaps/fields'
import { GroupLabel } from './GroupLabel'
import { StatusGlyph } from './StatusGlyph'
import { cn } from '@/app/lib/utils'
import { listRowDatesDraggable, type useIssueDatesDrop } from './useIssueDatesDrop'

type DatesDropApi = ReturnType<typeof useIssueDatesDrop>

interface Props {
  row: TableRow
  roadmap: Roadmap
  person?: boolean
  mark: Mark | null
  canEdit: boolean
  datesDrop: DatesDropApi
  onToggleCollapse: (id: string) => void
  onOpenIssue?: (id: string) => void
}

export function GanttListRow({ row, roadmap, person, mark, canEdit, datesDrop, onToggleCollapse, onOpenIssue }: Props) {
  const dragMoved = useRef(false)
  if (row.kind === 'group') {
    return (
      <div className="flex h-[34px] items-center gap-3 border-b border-hair bg-panel px-4 text-[12px] text-ink-2">
        <GroupLabel label={row.label} count={row.count} person={person} empty={row.key === ''} />
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
      onDragStart={
        draggable
          ? (e) => {
              dragMoved.current = false
              datesDrop.listDragStart(issue.id)(e)
            }
          : undefined
      }
      onDrag={draggable ? () => { dragMoved.current = true } : undefined}
      onDragEnd={
        draggable
          ? (e) => {
              datesDrop.listDragEnd()
              if (dragMoved.current) e.preventDefault()
            }
          : undefined
      }
      className={cn(
        'flex h-[34px] items-center gap-1.5 border-b border-hair px-2 text-[12.5px] text-ink',
        dim && 'opacity-50',
        draggable && 'cursor-grab active:cursor-grabbing',
        !draggable && 'cursor-default',
      )}
      onClick={() => {
        if (dragMoved.current) {
          dragMoved.current = false
          return
        }
        onOpenIssue?.(issue.id)
      }}
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
      <span className="w-[52px] shrink-0 whitespace-nowrap pl-1 font-mono text-[11.5px] text-ink-3">{keyOf(roadmap, issue)}</span>
      <span className="min-w-0 truncate">{issue.title}</span>
      {noDates && <span className="ml-auto shrink-0 text-[11px] text-ink-3">No dates</span>}
    </div>
  )
}

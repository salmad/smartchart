import { ChevronDown, ChevronRight } from 'lucide-react'
import type { Roadmap } from '@/engine/roadmaps/types'
import type { MatrixRow } from '@/engine/roadmaps/matrix'
import { keyOf } from '@/engine/roadmaps/fields'
import { cn } from '@/app/lib/utils'
interface Props {
  row: MatrixRow
  roadmap: Roadmap
  onToggleCollapse: (id: string) => void
  onOpenIssue?: (id: string) => void
}

export function MatrixTitleCell({ row, roadmap, onToggleCollapse, onOpenIssue }: Props) {
  if (row.kind === 'group') {
    return (
      <th
        scope="row"
        className="sticky left-0 z-[1] h-14 min-w-[280px] max-w-[360px] border-b border-hair bg-panel px-3 text-left text-[12px] font-medium text-ink"
      >
        <div className="flex items-center gap-2">
          <span>{row.label}</span>
          <span className="font-normal text-ink-3">
            {row.count} {row.count === 1 ? 'issue' : 'issues'}
          </span>
        </div>
      </th>
    )
  }

  const { issue, depth, dim, hasChildren, open } = row
  return (
    <th
      scope="row"
      className={cn(
        'sticky left-0 z-[1] h-14 min-w-[280px] max-w-[360px] border-b border-hair bg-app-bg px-2 text-left text-[12.5px] font-normal text-ink',
        dim && 'opacity-45',
      )}
    >
      <div className="flex min-w-0 items-center gap-1">
        {Array.from({ length: depth }).map((_, i) => (
          <span key={i} className="inline-block w-4 shrink-0" aria-hidden />
        ))}
        {hasChildren ? (
          <button
            type="button"
            className="shrink-0 text-ink-3 hover:text-ink"
            aria-label={open ? `Collapse ${issue.title}` : `Expand ${issue.title}`}
            onClick={() => onToggleCollapse(issue.id)}
          >
            {open ? <ChevronDown className="size-3" strokeWidth={2} /> : <ChevronRight className="size-3" strokeWidth={2} />}
          </button>
        ) : (
          <span className="inline-block w-3 shrink-0" aria-hidden />
        )}
        <button
          type="button"
          className="flex min-w-0 flex-1 flex-col items-start text-left leading-tight hover:text-ink-2"
          onClick={() => onOpenIssue?.(issue.id)}
        >
          <span className="w-full truncate font-medium">{issue.title}</span>
          <span className="font-mono text-[11px] text-ink-3">{keyOf(roadmap, issue)}</span>
        </button>
      </div>
    </th>
  )
}

export function matrixRowKey(row: MatrixRow): string {
  return row.kind === 'group' ? `g:${row.key}` : `i:${row.issue.id}`
}

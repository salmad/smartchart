import type { Roadmap } from '@/engine/roadmaps/types'
import type { MatrixRow } from '@/engine/roadmaps/matrix'
import { keyOf } from '@/engine/roadmaps/fields'
import { cn } from '@/app/lib/utils'
import { Button } from '../ui/button'
import { Fold, GroupHeader } from './GroupLabel'

interface Props {
  row: MatrixRow
  roadmap: Roadmap
  onToggle: (id: string) => void
  onToggleGroup: (key: string, all: boolean) => void
  onOpenIssue: (id: string) => void
}

/** The first column, pinned left: its width is set here and on the corner header. */
export const TITLE_COL = 'sticky left-0 w-[280px] min-w-[280px] max-w-[280px] border-b border-r border-hair text-left'

export function MatrixTitleCell({ row, roadmap, onToggle, onToggleGroup, onOpenIssue }: Props) {
  if (row.kind === 'group') {
    return (
      <th scope="row" className={cn(TITLE_COL, 'z-[1] h-10 cursor-default bg-panel pl-2 pr-3 font-normal')} onClick={(e) => onToggleGroup(row.key, e.altKey)}>
        <GroupHeader label={row.label} count={row.count} empty={row.empty} open={row.open} depth={row.depth} onToggle={(all) => onToggleGroup(row.key, all)} />
      </th>
    )
  }

  const { issue, depth, dim, hasChildren, open } = row
  return (
    <th scope="row" className={cn(TITLE_COL, 'z-[1] h-10 bg-app-bg pl-2 pr-3 text-[13px] font-normal')}>
      <span className={cn('flex min-w-0 items-center gap-1', dim && 'opacity-45')}>
        {Array.from({ length: depth }, (_, i) => (
          <span key={i} className="w-4 shrink-0" aria-hidden />
        ))}
        {hasChildren ? (
          <Fold open={open} label={issue.title} onToggle={() => onToggle(issue.id)} />
        ) : (
          <span className="w-5 shrink-0" aria-hidden />
        )}
        <Button
          variant="ghost"
          size="sm"
          className={cn('h-7 min-w-0 flex-1 justify-start rounded-md px-1.5 text-[13px] text-ink', hasChildren ? 'font-medium' : 'font-normal')}
          title={issue.title}
          onClick={() => onOpenIssue(issue.id)}
        >
          <span className="truncate">{issue.title}</span>
        </Button>
        <span className="whitespace-nowrap text-[12px] tabular-nums text-ink-3 opacity-0 transition-opacity duration-150 ease-out group-focus-within/row:opacity-100 group-hover/row:opacity-100">
          {keyOf(roadmap, issue)}
        </span>
      </span>
    </th>
  )
}

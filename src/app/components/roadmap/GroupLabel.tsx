import type { MouseEvent } from 'react'
import { ChevronRight } from 'lucide-react'
import { Avatar } from './Avatar'
import { Button } from '../ui/button'
import { cn } from '@/app/lib/utils'

interface Props {
  label: string
  count: number
  /** An Assignee group: show the person's initials, and dim the group with no one. */
  person?: boolean
  empty?: boolean
}

/** A group header's name and count, shared by the list, the Gantt and the matrix. */
export function GroupLabel({ label, count, person, empty }: Props) {
  return (
    <>
      {person && !empty && <Avatar name={label} />}
      <span className={cn('truncate font-medium', empty ? 'text-ink-2' : 'text-ink')}>{label}</span>
      <span className="tabular-nums text-ink-3">{count}</span>
    </>
  )
}

/** The one disclosure chevron, for group rows and the matrix's issue rows. Option-click reaches every sibling: the
    caller gets `all` and folds or opens the whole level, as Finder does. */
export function Fold({ open, label, onToggle }: { open: boolean; label: string; onToggle: (all: boolean) => void }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="size-5 shrink-0 rounded-md p-0 text-ink-3 hover:bg-raise"
      aria-expanded={open}
      aria-label={open ? `Collapse ${label}` : `Expand ${label}`}
      title="Option-click for every group at this level"
      onClick={(e: MouseEvent) => { e.stopPropagation(); onToggle(e.altKey) }}
    >
      <ChevronRight className={cn('!size-3.5 transition-transform duration-150 ease-out motion-reduce:transition-none', open && 'rotate-90')} strokeWidth={2} />
    </Button>
  )
}

interface HeaderProps extends Props {
  open: boolean
  depth: number
  onToggle: (all: boolean) => void
}

/** A group row's lead: indent for its level, the fold, the name and count. Text sizes come from here, so a group
    reads the same in every view. */
export function GroupHeader({ open, depth, onToggle, ...label }: HeaderProps) {
  return (
    <span className="flex min-w-0 items-center gap-1 text-[13px]">
      {Array.from({ length: depth }, (_, i) => <span key={i} className="w-4 shrink-0" aria-hidden />)}
      <Fold open={open} label={label.label} onToggle={onToggle} />
      <span className="flex min-w-0 items-center gap-2 px-1.5">
        <GroupLabel {...label} />
      </span>
    </span>
  )
}

import { Avatar } from './Avatar'
import { cn } from '@/app/lib/utils'

interface Props {
  label: string
  count: number
  /** An Assignee group: show the person's initials, and dim the group with no one. */
  person?: boolean
  empty?: boolean
}

/** A group header's name and count, shared by the table and the Gantt list. */
export function GroupLabel({ label, count, person, empty }: Props) {
  return (
    <>
      {person && !empty && <Avatar name={label} />}
      <span className={cn('font-medium', empty ? 'text-ink-2' : 'text-ink')}>{label}</span>
      <span className="tabular-nums text-ink-3">{count}</span>
    </>
  )
}

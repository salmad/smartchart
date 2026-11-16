import type { MemberLite } from '@/engine/roadmaps/types'
import { Avatar } from '../Avatar'
import { CellButton } from './CellButton'
import { CellMenu } from './CellMenu'

interface Props {
  assignee: string | null
  members: MemberLite[]
  disabled?: boolean
  onPick: (id: string | null) => void
  /** The table shows the disc alone; the panel shows the name too. */
  withName?: boolean
  /** Always-visible words for no one (the panel); the table leaves it out and shows a plus on hover. */
  placeholder?: string
}

export function PersonCell({ assignee, members, disabled, onPick, withName, placeholder }: Props) {
  const name = members.find((m) => m.id === assignee)?.name ?? ''
  return (
    <CellMenu
      label="Choose assignee"
      listLabel="Members"
      options={members.map((m) => ({ id: m.id, name: m.name, icon: <Avatar name={m.name} /> }))}
      value={assignee}
      none="Unassigned"
      disabled={disabled}
      onPick={onPick}
    >
      <CellButton
        empty={!name}
        placeholder={placeholder}
        title={name || undefined}
        aria-label={name ? `Assignee: ${name}` : 'Assignee: unassigned'}
        className="text-ink"
      >
        <Avatar name={name} />
        {withName && <span className="truncate">{name}</span>}
      </CellButton>
    </CellMenu>
  )
}

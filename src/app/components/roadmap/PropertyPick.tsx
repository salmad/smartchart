import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import type { MemberLite, Status } from '@/engine/roadmaps/types'
import { STATUS_LABEL, STATUSES } from '@/engine/roadmaps/types'
import { cn } from '@/app/lib/utils'
import { MENU_ITEM } from '../menu'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu'
import { Avatar } from './Avatar'
import { StatusGlyph } from './StatusGlyph'
import { Placeholder, ValueButton } from './issueParts'
import { menuSurface } from './roadmapChrome'

export interface PickOption {
  id: string
  label: string
  icon?: ReactNode
}

interface Props {
  /** The control's name, with its value ("Assignee: Dana"). */
  label: string
  options: PickOption[]
  value: string | null
  /** The row that empties the value ("Unassigned"); none when the value can't be empty. */
  clear?: string
  disabled?: boolean
  className?: string
  children: ReactNode
  onPick: (id: string | null) => void
}

/** One value out of a short list, in the app's menu: arrows, typeahead, a tick on the chosen row. Read-only, it is plain text. */
export function PropertyPick({ label, options, value, clear, disabled, className, children, onPick }: Props) {
  if (disabled) return <span className={cn('flex h-7 min-w-0 items-center gap-2', className)}>{children}</span>
  const rows: (PickOption & { pick: string | null })[] = [
    ...(clear ? [{ id: '', label: clear, pick: null }] : []),
    ...options.map((o) => ({ ...o, pick: o.id })),
  ]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ValueButton aria-label={label} className={className}>{children}</ValueButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className={cn('min-w-44 p-1 text-ink', menuSurface)}>
        {rows.map((o) => (
          <DropdownMenuItem key={o.id} className={MENU_ITEM} onSelect={() => onPick(o.pick)}>
            {o.icon && <span className="flex flex-none items-center">{o.icon}</span>}
            <span className="min-w-0 flex-1 truncate">{o.label}</span>
            {o.pick === value && <Check className="size-3.5" strokeWidth={2} aria-hidden />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const STATUS_OPTIONS: PickOption[] = STATUSES.map((s) => ({ id: s, label: STATUS_LABEL[s], icon: <StatusGlyph status={s} /> }))

/** An issue's status: the glyph alone in a list row, glyph and word in the property list. */
export function StatusPick({ status, withLabel, disabled, onPick }: { status: Status; withLabel?: boolean; disabled?: boolean; onPick: (s: Status) => void }) {
  return (
    <PropertyPick
      label={`Status: ${STATUS_LABEL[status]}`}
      options={STATUS_OPTIONS}
      value={status}
      disabled={disabled}
      className={withLabel ? undefined : 'ml-0 w-7 flex-none justify-center px-0'}
      onPick={(id) => { if (id) onPick(id as Status) }}
    >
      <StatusGlyph status={status} />
      {withLabel && <span>{STATUS_LABEL[status]}</span>}
    </PropertyPick>
  )
}

/** A member: disc and name, or what to do when there is none. */
export function PersonPick({ label, empty, person, members, disabled, onPick }: { label: string; empty: string; person: string | null; members: MemberLite[]; disabled?: boolean; onPick: (id: string | null) => void }) {
  const name = members.find((m) => m.id === person)?.name ?? ''
  return (
    <PropertyPick
      label={`${label}: ${name || 'unassigned'}`}
      options={members.map((m) => ({ id: m.id, label: m.name, icon: <Avatar name={m.name} /> }))}
      value={name ? person : null}
      clear="Unassigned"
      disabled={disabled}
      onPick={onPick}
    >
      {name ? <><Avatar name={name} /><span className="truncate">{name}</span></> : !disabled && <Placeholder>{empty}</Placeholder>}
    </PropertyPick>
  )
}

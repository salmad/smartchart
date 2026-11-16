import { CalendarDays, Circle, CircleDot, Hash, Type, User, type LucideIcon } from 'lucide-react'
import type { FieldType } from '@/engine/roadmaps/types'
import { cn } from '@/app/lib/utils'
import type { FilterProperty } from './filterAddTypes'

/** Each field type's icon. A property carries its type wherever it is listed, so Status, Assignee, dates and
    custom fields scan the same way. */
export const FIELD_TYPE_ICON: Record<FieldType, LucideIcon> = {
  choice: CircleDot,
  text: Type,
  number: Hash,
  date: CalendarDays,
  person: User,
}

/** Built-in filter properties: a ring for status (the same family as StatusGlyph), person and calendar for the rest. */
const BUILT_IN_ICON = {
  status: Circle,
  assignee: User,
  dates: CalendarDays,
} as const

export function FieldIcon({ type, className }: { type: FieldType; className?: string }) {
  const Icon = FIELD_TYPE_ICON[type]
  return <Icon className={cn('size-3.5 shrink-0 text-ink-3', className)} strokeWidth={1.75} aria-hidden />
}

/** The icon for a filter property: built-in or a custom field's type. */
export function FilterPropertyIcon({ property, className }: { property: FilterProperty; className?: string }) {
  if (property.kind === 'field') return <FieldIcon type={property.def.type} className={className} />
  const Icon = BUILT_IN_ICON[property.kind]
  return <Icon className={cn('size-3.5 shrink-0 text-ink-3', className)} strokeWidth={1.75} aria-hidden />
}

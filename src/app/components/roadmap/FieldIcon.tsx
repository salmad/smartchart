import { CalendarDays, CircleDot, Hash, Type, User, type LucideIcon } from 'lucide-react'
import type { FieldType } from '@/engine/roadmaps/types'
import { cn } from '@/app/lib/utils'

/** Each field type's icon. A custom field carries it wherever it is listed, so it reads apart from the built-in
    properties (Status, Assignee, dates), which carry none. */
export const FIELD_TYPE_ICON: Record<FieldType, LucideIcon> = {
  choice: CircleDot,
  text: Type,
  number: Hash,
  date: CalendarDays,
  person: User,
}

export function FieldIcon({ type, className }: { type: FieldType; className?: string }) {
  const Icon = FIELD_TYPE_ICON[type]
  return <Icon className={cn('size-3.5 shrink-0 text-ink-3', className)} strokeWidth={1.75} aria-hidden />
}

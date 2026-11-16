import type { FieldDef } from '@/engine/roadmaps/types'
import { menuCommand } from './roadmapChrome'

export type FilterProperty =
  | { kind: 'status' }
  | { kind: 'assignee' }
  | { kind: 'dates' }
  | { kind: 'field'; def: FieldDef }

export type FilterStep =
  | { kind: 'property' }
  | { kind: 'operator'; property: FilterProperty }
  | { kind: 'value'; property: FilterProperty; is: boolean }
  | { kind: 'date'; when: 'before' | 'after' }

export const FILTER_ITEM_CLASS = 'text-[13px] text-ink-2'

export const FILTER_COMMAND_CLASS = `rounded-none outline-none ${menuCommand}`

export function filterPropertyLabel(p: FilterProperty): string {
  switch (p.kind) {
    case 'status':
      return 'Status'
    case 'assignee':
      return 'Assignee'
    case 'dates':
      return 'Due date'
    case 'field':
      return p.def.name
  }
}

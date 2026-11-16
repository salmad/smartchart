import { CHECK_COPY } from '@/engine/roadmaps/checks'
import { emptyLabel, type Chip } from '@/engine/roadmaps/view'
import type { FieldDef, MemberLite } from '@/engine/roadmaps/types'
import { STATUS_LABEL, type Status } from '@/engine/roadmaps/types'

/** A value filter in its three parts: what it is on, is or is not, and the names it keeps. */
export interface ChipParts { on: string; is: boolean; names: string[] }

export function chipParts(chip: Chip, fields: FieldDef[], members: MemberLite[]): ChipParts | null {
  const person = (v: string) => members.find((m) => m.id === v)?.name ?? v
  switch (chip.on) {
    case 'status':
      return { on: 'Status', is: chip.is, names: chip.values.map((s) => STATUS_LABEL[s as Status]) }
    case 'assignee':
      return { on: 'Assignee', is: chip.is, names: chip.values.map((v) => (v === null ? 'Unassigned' : person(v))) }
    case 'field': {
      const def = fields.find((f) => f.id === chip.field)
      const field = def?.name ?? chip.field
      const names = chip.values.map((v) => {
        if (v === null) return chip.values.length === 1 ? 'empty' : emptyLabel(field)
        if (def?.type === 'person') return person(v)
        return (def?.type === 'choice' ? def.options?.find((o) => o.id === v)?.name : undefined) ?? v
      })
      return { on: field, is: chip.is, names }
    }
    default:
      return null
  }
}

/** The values as a chip shows them: two names, then how many more. */
export function namesShort(names: string[]): string {
  return names.length <= 2 ? names.join(', ') : `${names.slice(0, 2).join(', ')} +${names.length - 2}`
}

export function chipLabel(chip: Chip, fields: FieldDef[], members: MemberLite[]): string {
  const parts = chipParts(chip, fields, members)
  if (parts) return `${parts.on} ${parts.is ? 'is' : 'is not'} ${parts.names.join(', ')}`
  switch (chip.on) {
    case 'dates': {
      if (chip.when === 'overdue') return 'Due overdue'
      if (chip.when === 'before' && chip.date) return `Due before ${chip.date}`
      if (chip.when === 'after' && chip.date) return `Due after ${chip.date}`
      return 'Due'
    }
    case 'check':
      return CHECK_COPY[chip.id].label
    default:
      return 'Filter'
  }
}

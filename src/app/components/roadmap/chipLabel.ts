import { CHECK_COPY } from '@/engine/roadmaps/checks'
import type { Chip } from '@/engine/roadmaps/view'
import type { FieldDef } from '@/engine/roadmaps/types'
import { STATUS_LABEL, type Status } from '@/engine/roadmaps/types'

export function chipLabel(chip: Chip, fields: FieldDef[]): string {
  switch (chip.on) {
    case 'status': {
      const op = chip.is ? 'is' : 'is not'
      const names = chip.values.map((s) => STATUS_LABEL[s as Status]).join(', ')
      return `Status ${op} ${names}`
    }
    case 'assignee': {
      const op = chip.is ? 'is' : 'is not'
      const names = chip.values.map((v) => v ?? 'Unassigned').join(', ')
      return `Assignee ${op} ${names}`
    }
    case 'field': {
      const def = fields.find((f) => f.id === chip.field)
      const field = def?.name ?? chip.field
      const op = chip.is ? 'is' : 'is not'
      const names = chip.values.map((v) => {
        if (v === null) return 'empty'
        const opt = def?.type === 'choice' ? def.options?.find((o) => o.id === v) : undefined
        return opt?.name ?? v
      }).join(', ')
      return `${field} ${op} ${names}`
    }
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

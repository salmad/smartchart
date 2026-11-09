import { X } from 'lucide-react'
import type { Chip } from '@/engine/roadmaps/view'
import type { FieldDef } from '@/engine/roadmaps/types'
import { chipLabel } from './chipLabel'

interface Props {
  chip: Chip
  fields: FieldDef[]
  onRemove: () => void
}

export function FilterChip({ chip, fields, onRemove }: Props) {
  const label = chipLabel(chip, fields)
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-raise px-2 py-0.5 text-[12px] text-ink-2">
      <span>{label}</span>
      <button
        type="button"
        className="text-ink-3 hover:text-ink"
        aria-label={`Remove ${label}`}
        onClick={onRemove}
      >
        <X className="size-3" strokeWidth={2} aria-hidden />
      </button>
    </span>
  )
}

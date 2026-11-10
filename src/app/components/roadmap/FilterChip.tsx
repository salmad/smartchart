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
    <span className="inline-flex h-6 items-center gap-1 rounded-md bg-white/[.04] px-2 text-[12px] text-ink-2">
      <span>{label}</span>
      <button
        type="button"
        className="-mr-0.5 rounded p-0.5 text-ink-3 transition-colors hover:bg-panel hover:text-ink"
        aria-label={`Remove ${label}`}
        onClick={onRemove}
      >
        <X className="size-3" strokeWidth={2} aria-hidden />
      </button>
    </span>
  )
}

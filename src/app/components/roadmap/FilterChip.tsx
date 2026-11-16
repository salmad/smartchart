import { X } from 'lucide-react'
import type { Chip } from '@/engine/roadmaps/view'
import type { FieldDef } from '@/engine/roadmaps/types'
import { chipLabel } from './chipLabel'

interface Props {
  chip: Chip
  fields: FieldDef[]
  onRemove: () => void
}

/** One active filter in the toolbar, with its own remove. */
export function FilterChip({ chip, fields, onRemove }: Props) {
  const label = chipLabel(chip, fields)
  return (
    <span className="inline-flex h-7 flex-none items-center gap-0.5 rounded-md border border-line bg-panel pl-2 pr-1 text-[12px] text-ink-2">
      <span className="whitespace-nowrap">{label}</span>
      <button
        type="button"
        className="grid size-5 place-items-center rounded text-ink-3 outline-none transition-colors hover:bg-raise hover:text-ink focus-visible:ring-1 focus-visible:ring-line-2"
        aria-label={`Remove ${label}`}
        onClick={onRemove}
      >
        <X className="size-3" strokeWidth={2} aria-hidden />
      </button>
    </span>
  )
}

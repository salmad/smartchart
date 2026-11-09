import { GripVertical, Plus, Trash2 } from 'lucide-react'
import type { FieldOption } from '@/engine/roadmaps/types'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { newOptionId } from './fieldCounts'

interface Props {
  fieldId: string
  options: FieldOption[]
  onPatch: (options: FieldOption[]) => void
  onDelete: (optionId: string, name: string) => void
  onMove: (from: number, to: number) => void
}

/** Choice options inside the fields editor: rename, emoji, reorder, delete. */
export function FieldOptions({ fieldId, options, onPatch, onDelete, onMove }: Props) {
  const patchOne = (optionId: string, patch: Partial<FieldOption>) => {
    onPatch(options.map((o) => (o.id === optionId ? { ...o, ...patch } : o)))
  }

  return (
    <div className="mt-2 space-y-1.5 border-l border-line pl-3" data-field-options={fieldId}>
      {options.map((o, i) => (
        <div
          key={o.id}
          data-option-row={o.id}
          className="flex items-center gap-1.5"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget) return
            if (e.key === 'ArrowUp' && i > 0) { e.preventDefault(); onMove(i, i - 1) }
            if (e.key === 'ArrowDown' && i < options.length - 1) { e.preventDefault(); onMove(i, i + 1) }
          }}
        >
          <button
            type="button"
            aria-label={`Move option ${o.name}`}
            className="grid size-7 shrink-0 cursor-grab place-items-center rounded text-ink-3 hover:text-ink active:cursor-grabbing"
            onPointerDown={(e) => {
              e.preventDefault()
              const grip = e.currentTarget
              grip.setPointerCapture(e.pointerId)
              let over = i
              const rows = () => [...grip.closest('[data-field-options]')?.querySelectorAll('[data-option-row]') ?? []] as HTMLElement[]
              const pick = (ev: PointerEvent) => {
                const y = ev.clientY
                const ix = rows().findIndex((el) => {
                  const b = el.getBoundingClientRect()
                  return y >= b.top && y <= b.bottom
                })
                if (ix >= 0) over = ix
              }
              const up = () => {
                grip.removeEventListener('pointermove', pick)
                grip.removeEventListener('pointerup', up)
                if (over !== i) onMove(i, over)
              }
              grip.addEventListener('pointermove', pick)
              grip.addEventListener('pointerup', up)
            }}
          >
            <GripVertical className="size-3.5" strokeWidth={1.75} />
          </button>
          <Input
            className="h-8 w-12 shrink-0 px-1.5 text-center text-[15px]"
            defaultValue={o.emoji ?? ''}
            aria-label={`Emoji for ${o.name}`}
            placeholder="…"
            maxLength={4}
            onBlur={(e) => {
              const emoji = e.target.value.trim() || undefined
              if (emoji === (o.emoji ?? undefined)) return
              patchOne(o.id, { emoji })
            }}
          />
          <Input
            className="h-8 min-w-0 flex-1 text-[13px]"
            defaultValue={o.name}
            key={`${o.id}-${o.name}`}
            aria-label={`Option name`}
            onBlur={(e) => {
              const name = e.target.value.trim()
              if (!name || name === o.name) return
              patchOne(o.id, { name })
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="size-8 shrink-0 px-0 text-ink-3 hover:text-bad"
            aria-label={`Delete ${o.name}`}
            disabled={options.length < 2}
            onClick={() => onDelete(o.id, o.name)}
          >
            <Trash2 className="size-3.5" strokeWidth={1.75} />
          </Button>
        </div>
      ))}
      <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-[12.5px] text-ink-3 hover:text-ink" onClick={() => onPatch([...options, { id: newOptionId(), name: 'Option' }])}>
        <Plus className="size-3.5" strokeWidth={1.75} />
        Add option
      </Button>
    </div>
  )
}

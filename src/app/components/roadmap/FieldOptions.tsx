import { GripVertical, Loader2, Plus, SmilePlus, Sparkles, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { markOf, PICKER_EMOJI, suggestEmoji } from '@/engine/roadmaps/emoji'
import { OptionMark } from './OptionMark'
import { jev } from '@/engine/agent/llm'
import { useState } from 'react'
import type { FieldOption } from '@/engine/roadmaps/types'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { newOptionId } from './fieldCounts'

interface Props {
  fieldId: string
  /** The field's name, so a suggested emoji fits what the options mean. */
  fieldName: string
  options: FieldOption[]
  onPatch: (options: FieldOption[]) => void
  onDelete: (optionId: string, name: string) => void
  onMove: (from: number, to: number) => void
}

/** Choice options inside the fields editor: rename, an optional emoji that marks the option wherever it shows, reorder,
    delete. */
export function FieldOptions({ fieldId, fieldName, options, onPatch, onDelete, onMove }: Props) {
  const patchOne = (optionId: string, patch: Partial<FieldOption>) => {
    onPatch(options.map((o) => (o.id === optionId ? { ...o, ...patch } : o)))
  }

  return (
    <div className="ml-8 mt-0.5 grid gap-0.5" data-field-options={fieldId}>
      {options.map((o, i) => (
        <div
          key={o.id}
          data-option-row={o.id}
          className="group/opt -ml-[18px] flex items-center gap-0.5 rounded-md outline-none focus-visible:ring-1 focus-visible:ring-line-2"
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
            className="grid h-6 w-[18px] shrink-0 cursor-grab place-items-center rounded text-ink-3 opacity-0 outline-none transition-[opacity,color] duration-150 hover:text-ink focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-line-2 group-hover/opt:opacity-100 active:cursor-grabbing"
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
          <EmojiPick field={fieldName} name={o.name} emoji={o.emoji} onPick={(emoji) => { if (emoji !== o.emoji) patchOne(o.id, { emoji }) }} />
          <Input
            className="h-7 min-w-0 flex-1 border-transparent bg-transparent px-2 text-[13px] text-ink-2 shadow-none transition-colors hover:bg-panel focus:bg-panel focus:text-ink"
            defaultValue={o.name}
            key={`${o.id}-${o.name}`}
            aria-label="Option name"
            placeholder="Option name"
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
            className="size-7 shrink-0 px-0 text-ink-3 opacity-0 hover:bg-panel hover:text-ink focus-visible:opacity-100 group-hover/opt:opacity-100 disabled:hover:bg-transparent"
            aria-label={`Delete ${o.name}`}
            disabled={options.length < 2}
            onClick={() => onDelete(o.id, o.name)}
          >
            <Trash2 className="!size-3.5" strokeWidth={1.75} />
          </Button>
        </div>
      ))}
      <Button type="button" variant="ghost" size="sm" className="h-7 justify-self-start gap-1.5 px-2 font-normal text-ink-3 hover:bg-panel hover:text-ink" onClick={() => onPatch([...options, { id: newOptionId(), name: 'Option' }])}>
        <Plus className="!size-3.5" strokeWidth={1.75} aria-hidden />
        Add option
      </Button>
    </div>
  )
}

/** An option's mark: a quiet smiley until one is set, then the mark itself; either opens a small picker. Suggest asks
    the model for one; any other emoji, or one or two letters (UK), can be typed at the foot. */
function EmojiPick({ field, name, emoji, onPick }: { field: string; name: string; emoji?: string; onPick: (emoji: string | undefined) => void }) {
  const [open, setOpen] = useState(false)
  const [asking, setAsking] = useState<'idle' | 'busy' | 'none' | 'bad'>('idle')
  const pick = (e: string | undefined) => { onPick(e); setOpen(false) }
  const suggest = async () => {
    setAsking('busy')
    try {
      const got = (await suggestEmoji(jev, field, [{ id: 'one', name }])).one
      if (got) { setAsking('idle'); pick(got) } else setAsking('none')
    } catch (e) {
      // The service says why in plain words (sign in, a limit, unreachable).
      toast(e instanceof Error && e.message ? e.message : 'The model could not answer. Pick one instead.')
      setAsking('idle')
    }
  }
  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (next) setAsking('idle') }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="size-7 shrink-0 px-0 text-[14px] text-ink-3 hover:bg-panel hover:text-ink"
          aria-label={emoji ? `Mark for ${name}: ${emoji}. Change` : `Add a mark for ${name}`}
          title={emoji ? 'Change the mark' : 'Mark this option with an emoji or two letters, in every view'}
        >
          {emoji ? <OptionMark mark={emoji} /> : <SmilePlus className="!size-3.5" strokeWidth={1.75} aria-hidden />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-[15.5rem] p-2" aria-label={`Mark for ${name}`}>
        <div className="flex items-center justify-between gap-2 pb-1.5 pl-1">
          <p className="text-[11px] leading-tight text-ink-3">{asking === 'none' ? 'Nothing fits well. Pick or type one.' : asking === 'bad' ? 'One emoji, or up to two letters.' : `Marks ${name} in every view`}</p>
          <Button type="button" variant="ghost" size="sm" disabled={asking === 'busy'} className="h-6 shrink-0 gap-1 px-1.5 text-[12px] font-normal text-ink-2 hover:bg-panel hover:text-ink" onClick={suggest}>
            {asking === 'busy' ? <Loader2 className="!size-3 animate-spin" aria-hidden /> : <Sparkles className="!size-3" strokeWidth={1.75} aria-hidden />}
            Suggest
          </Button>
        </div>
        <div className="grid grid-cols-8 gap-0.5">
          {PICKER_EMOJI.map((e) => (
            <Button key={e} type="button" variant="ghost" size="sm" aria-label={e} aria-pressed={e === emoji}
              className="size-7 px-0 text-[15px] hover:bg-panel aria-pressed:bg-panel" onClick={() => pick(e)}>
              {e}
            </Button>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-1.5 border-t border-hair pt-2">
          <Input
            className="h-7 min-w-0 flex-1 bg-transparent px-2 text-[13px] shadow-none"
            placeholder="Or type an emoji or UK"
            aria-label="Type a mark"
            maxLength={16}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              e.preventDefault()
              const v = e.currentTarget.value
              if (!v.trim()) return
              const mark = markOf(v)
              if (mark) pick(mark)
              else setAsking('bad')
            }}
          />
          {emoji && (
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[12px] font-normal text-ink-3 hover:bg-panel hover:text-ink" onClick={() => pick(undefined)}>
              Remove
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

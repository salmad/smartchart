import { useState } from 'react'
import type { FieldDef, FieldValue, MemberLite } from '@/engine/roadmaps/types'
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover'
import { Command, CommandItem, CommandList } from '../../ui/command'
import { cn } from '@/app/lib/utils'
import { menuCommand, menuSurface } from '../roadmapChrome'
import { PersonCell } from './PersonCell'

interface Props {
  field: FieldDef
  value: FieldValue | undefined
  members: MemberLite[]
  disabled?: boolean
  onPick: (v: FieldValue | null) => void
}

function choiceLabel(field: FieldDef, raw: FieldValue | undefined): string {
  if (raw === undefined) return ''
  const sid = String(raw)
  const opt = field.options?.find((o) => o.id === sid)
  return opt ? `${opt.emoji ? `${opt.emoji} ` : ''}${opt.name}` : sid
}

export function FieldCell({ field, value, members, disabled, onPick }: Props) {
  const [open, setOpen] = useState(false)
  if (field.type === 'person') {
    return (
      <PersonCell
        assignee={value === undefined ? null : String(value)}
        members={members}
        disabled={disabled}
        onPick={(id) => onPick(id)}
      />
    )
  }
  if (field.type === 'date') {
    return (
      <input
        type="date"
        disabled={disabled}
        value={value === undefined ? '' : String(value)}
        onChange={(e) => onPick(e.target.value || null)}
        className="w-full min-w-0 rounded border-0 bg-transparent px-1 py-0.5 text-[12px] text-ink-2 hover:bg-raise focus:bg-raise focus:outline-none focus:ring-0"
        aria-label={field.name}
      />
    )
  }
  if (field.type === 'number' || field.type === 'text') {
    return (
      <input
        type={field.type === 'number' ? 'number' : 'text'}
        disabled={disabled}
        value={value === undefined ? '' : String(value)}
        onChange={(e) => {
          const t = e.target.value
          if (field.type === 'number') onPick(t === '' ? null : Number(t))
          else onPick(t.trim() === '' ? null : t)
        }}
        placeholder="—"
        className="w-full min-w-0 border-0 bg-transparent px-1 py-0.5 text-[12px] text-ink-2 tabular-nums placeholder:text-ink-3 hover:bg-raise focus:bg-raise focus:outline-none focus:ring-0"
        aria-label={field.name}
      />
    )
  }
  const shown = choiceLabel(field, value)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button type="button" className="block w-full truncate rounded px-1 py-0.5 text-left hover:bg-raise" aria-label={shown ? `${field.name}: ${shown}` : field.name}>
          {shown || <span className="text-ink-3">—</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className={cn('w-48 overflow-hidden p-1', menuSurface)} aria-label={`Choose ${field.name}`}>
        <Command className={menuCommand}>
          <CommandList label={field.name}>
            <CommandItem value="none" onSelect={() => { onPick(null); setOpen(false) }} className="text-[13px]">
              Clear
            </CommandItem>
            {(field.options ?? []).map((o) => (
              <CommandItem key={o.id} value={o.id} onSelect={() => { onPick(o.id); setOpen(false) }} className="gap-2 text-[13px]">
                {o.emoji && <span aria-hidden>{o.emoji}</span>}
                {o.name}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

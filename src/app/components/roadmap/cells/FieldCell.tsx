import type { FieldDef, FieldValue, MemberLite } from '@/engine/roadmaps/types'
import { OptionMark } from '../OptionMark'
import { cn } from '@/app/lib/utils'
import { Input } from '../../ui/input'
import { CellButton } from './CellButton'
import { CellMenu } from './CellMenu'
import { DateCell } from './DateCell'
import { PersonCell } from './PersonCell'

interface Props {
  field: FieldDef
  value: FieldValue | undefined
  members: MemberLite[]
  disabled?: boolean
  /** Always-visible words for no value (the panel); the table leaves it out. */
  placeholder?: string
  onPick: (v: FieldValue | null) => void
}

/** A custom field's value, edited the way its type asks: a picker, a calendar, or typing in place. */
export function FieldCell({ field, value, members, disabled, placeholder, onPick }: Props) {
  const text = value === undefined ? '' : String(value)
  if (field.type === 'person') {
    return <PersonCell assignee={text || null} members={members} disabled={disabled} placeholder={placeholder} onPick={onPick} />
  }
  if (field.type === 'date') {
    return <DateCell value={text || null} label={field.name} disabled={disabled} placeholder={placeholder} onPick={onPick} />
  }
  if (field.type === 'number' || field.type === 'text') {
    const number = field.type === 'number'
    return (
      <Input
        type={number ? 'number' : 'text'}
        disabled={disabled}
        value={text}
        onChange={(e) => {
          const t = e.target.value
          if (number) onPick(t === '' ? null : Number(t))
          else onPick(t.trim() === '' ? null : t)
        }}
        placeholder={placeholder ?? (disabled ? undefined : '+')}
        aria-label={field.name}
        className={cn(
          'h-7 rounded-md border-0 px-1.5 text-[13px] text-ink-2 shadow-none transition-colors duration-120 hover:bg-raise focus-visible:bg-raise disabled:cursor-default disabled:opacity-100 disabled:hover:bg-transparent md:text-[13px]',
          number && 'tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
          placeholder ? 'placeholder:text-ink-3' : 'placeholder:text-transparent focus-visible:placeholder:text-ink-3 group-hover:placeholder:text-ink-3',
        )}
      />
    )
  }
  const chosen = field.options?.find((o) => o.id === text)
  const shown = chosen?.name ?? text
  return (
    <CellMenu
      label={`Choose ${field.name}`}
      listLabel={field.name}
      options={(field.options ?? []).map((o) => ({ id: o.id, name: o.name, icon: o.emoji ? <OptionMark mark={o.emoji} /> : undefined }))}
      value={text || null}
      none="Clear"
      disabled={disabled}
      onPick={onPick}
    >
      <CellButton empty={!shown} placeholder={placeholder} title={shown || undefined} aria-label={shown ? `${field.name}: ${chosen?.emoji ? `${chosen.emoji} ` : ''}${shown}` : field.name} className="text-ink-2">
        <OptionMark mark={chosen?.emoji} />
        <span className="truncate">{shown}</span>
      </CellButton>
    </CellMenu>
  )
}

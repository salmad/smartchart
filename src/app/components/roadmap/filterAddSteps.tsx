import { STATUSES, STATUS_LABEL, type MemberLite } from '@/engine/roadmaps/types'
import { StatusGlyph } from './StatusGlyph'
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../ui/command'
import { Calendar } from '../ui/calendar'
import { dateOf, isoOf } from './dates'
import { cn } from '@/app/lib/utils'
import { FILTER_COMMAND_CLASS, FILTER_ITEM_CLASS, type FilterProperty } from './filterAddTypes'

export function FilterOperatorStep({
  property,
  onDatesOverdue,
  onDatesWhen,
  onEmpty,
  onOp,
}: {
  property: FilterProperty
  onDatesOverdue: () => void
  onDatesWhen: (when: 'before' | 'after') => void
  onEmpty: (is: boolean) => void
  onOp: (is: boolean) => void
}) {
  if (property.kind === 'dates') {
    return (
      <Command className={FILTER_COMMAND_CLASS}>
        <CommandList>
          <CommandGroup>
            <CommandItem className={FILTER_ITEM_CLASS} onSelect={onDatesOverdue}>
              Is overdue
            </CommandItem>
            <CommandItem className={FILTER_ITEM_CLASS} onSelect={() => onDatesWhen('before')}>
              Is before…
            </CommandItem>
            <CommandItem className={FILTER_ITEM_CLASS} onSelect={() => onDatesWhen('after')}>
              Is after…
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    )
  }

  const sparse =
    property.kind === 'field' &&
    (property.def.type === 'text' || property.def.type === 'number' || property.def.type === 'date')

  if (sparse) {
    return (
      <Command className={FILTER_COMMAND_CLASS}>
        <CommandList>
          <CommandGroup>
            <CommandItem className={FILTER_ITEM_CLASS} onSelect={() => onEmpty(true)}>
              Is empty
            </CommandItem>
            <CommandItem className={FILTER_ITEM_CLASS} onSelect={() => onEmpty(false)}>
              Is not empty
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    )
  }

  const ops: { label: string; is: boolean; empty?: boolean }[] = [
    { label: 'Is', is: true },
    { label: 'Is not', is: false },
  ]
  if (property.kind === 'assignee' || property.kind === 'field') {
    ops.push({ label: 'Is empty', is: true, empty: true })
    ops.push({ label: 'Is not empty', is: false, empty: true })
  }

  return (
    <Command className={FILTER_COMMAND_CLASS}>
      <CommandList>
        <CommandGroup>
          {ops.map((op) => (
            <CommandItem
              key={op.label}
              className={FILTER_ITEM_CLASS}
              onSelect={() => (op.empty ? onEmpty(op.is) : onOp(op.is))}
            >
              {op.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  )
}

export function FilterValueStep({
  property,
  members,
  onPick,
}: {
  property: FilterProperty
  members: MemberLite[]
  onPick: (values: (string | null)[]) => void
}) {
  if (property.kind === 'status') {
    return (
      <Command className={FILTER_COMMAND_CLASS}>
        <CommandInput placeholder="Search status…" className="h-9 text-[12.5px]" />
        <CommandList className="max-h-64">
          {STATUSES.map((s) => (
            <CommandItem key={s} className={cn(FILTER_ITEM_CLASS, 'gap-2')} onSelect={() => onPick([s])}>
              <StatusGlyph status={s} className="size-3.5" />
              {STATUS_LABEL[s]}
            </CommandItem>
          ))}
        </CommandList>
      </Command>
    )
  }

  if (property.kind === 'assignee') {
    return (
      <Command className={FILTER_COMMAND_CLASS}>
        <CommandInput placeholder="Search people…" className="h-9 text-[12.5px]" />
        <CommandList className="max-h-64">
          <CommandItem className={FILTER_ITEM_CLASS} onSelect={() => onPick([null])}>
            Unassigned
          </CommandItem>
          {members.map((m) => (
            <CommandItem key={m.id} className={FILTER_ITEM_CLASS} onSelect={() => onPick([m.id])}>
              {m.name}
            </CommandItem>
          ))}
        </CommandList>
      </Command>
    )
  }

  if (property.kind === 'field' && property.def.type === 'choice') {
    const options = property.def.options ?? []
    return (
      <Command className={FILTER_COMMAND_CLASS}>
        <CommandInput placeholder="Search options…" className="h-9 text-[12.5px]" />
        <CommandList className="max-h-64">
          {options.map((o) => (
            <CommandItem key={o.id} className={FILTER_ITEM_CLASS} onSelect={() => onPick([o.id])}>
              {o.emoji ? `${o.emoji} ` : ''}
              {o.name}
            </CommandItem>
          ))}
        </CommandList>
      </Command>
    )
  }

  if (property.kind === 'field' && property.def.type === 'person') {
    return (
      <Command className={FILTER_COMMAND_CLASS}>
        <CommandInput placeholder="Search people…" className="h-9 text-[12.5px]" />
        <CommandList className="max-h-64">
          {members.map((m) => (
            <CommandItem key={m.id} className={FILTER_ITEM_CLASS} onSelect={() => onPick([m.id])}>
              {m.name}
            </CommandItem>
          ))}
        </CommandList>
      </Command>
    )
  }

  return null
}

export function FilterDatePickStep({
  when,
  today,
  onPick,
}: {
  when: 'before' | 'after'
  today: string
  onPick: (iso: string) => void
}) {
  return (
    <div className="p-2">
      <Calendar
        mode="single"
        defaultMonth={dateOf(today)}
        selected={undefined}
        onSelect={(d) => {
          if (d) onPick(isoOf(d))
        }}
        className="bg-transparent p-1"
      />
      <p className="mt-1 px-1 text-[11px] text-ink-3">
        {when === 'before' ? 'Issues due before this date' : 'Issues due after this date'}
      </p>
    </div>
  )
}

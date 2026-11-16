import { Command, CommandGroup, CommandItem, CommandList } from '../ui/command'
import { Calendar } from '../ui/calendar'
import { dateOf, isoOf } from './dates'
import { FILTER_COMMAND_CLASS, FILTER_ITEM_CLASS, type FilterProperty } from './filterAddTypes'

export function FilterOperatorStep({
  property,
  onDatesOverdue,
  onDatesWhen,
  onEmpty,
}: {
  property: FilterProperty
  onDatesOverdue: () => void
  onDatesWhen: (when: 'before' | 'after') => void
  onEmpty: (is: boolean) => void
}) {
  if (property.kind === 'dates') {
    return (
      <Command tabIndex={-1} className={FILTER_COMMAND_CLASS}>
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

  // Text, number and date fields: only whether a value is there.
  return (
    <Command tabIndex={-1} className={FILTER_COMMAND_CLASS}>
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
      <p className="px-2 pb-1 text-[12px] text-ink-3">
        {when === 'before' ? 'Issues due before this date' : 'Issues due after this date'}
      </p>
    </div>
  )
}

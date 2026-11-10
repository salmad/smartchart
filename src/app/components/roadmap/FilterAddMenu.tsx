import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/app/lib/utils'
import type { Chip } from '@/engine/roadmaps/view'
import type { FieldDef, MemberLite, Status } from '@/engine/roadmaps/types'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '../ui/command'
import { filterPropertyLabel, FILTER_COMMAND_CLASS, FILTER_ITEM_CLASS, type FilterStep } from './filterAddTypes'
import { FilterDatePickStep, FilterOperatorStep, FilterValueStep } from './filterAddSteps'

interface Props {
  fields: FieldDef[]
  members: MemberLite[]
  today: string
  onAdd: (chip: Chip) => void
  onClose: () => void
}

export function FilterAddMenu({ fields, members, today, onAdd, onClose }: Props) {
  const [step, setStep] = useState<FilterStep>({ kind: 'property' })

  useEffect(() => {
    setStep({ kind: 'property' })
  }, [])

  const finish = useCallback(
    (chip: Chip) => {
      onAdd(chip)
      onClose()
    },
    [onAdd, onClose],
  )

  const choiceFields = fields.filter((f) => f.type === 'choice')
  const personFields = fields.filter((f) => f.type === 'person')
  const sparseFields = fields.filter((f) => f.type === 'text' || f.type === 'number' || f.type === 'date')

  const breadcrumb =
    step.kind === 'property'
      ? 'Choose a property'
      : step.kind === 'operator'
        ? filterPropertyLabel(step.property)
        : step.kind === 'value'
          ? `${filterPropertyLabel(step.property)} · ${step.is ? 'is' : 'is not'}`
          : step.kind === 'date'
            ? `Due date · ${step.when === 'before' ? 'before' : 'after'}`
            : ''

  const goProperty = () => setStep({ kind: 'property' })

  return (
    <div className="flex flex-col">
      <div className={cn('flex items-center gap-1 px-2 py-1.5', step.kind !== 'property' && 'border-b border-hair')}>
        {step.kind !== 'property' && (
          <button
            type="button"
            className="rounded-md p-1 text-ink-3 transition-colors hover:bg-panel hover:text-ink"
            aria-label="Back"
            onClick={() => {
              if (step.kind === 'operator') goProperty()
              else if (step.kind === 'value') setStep({ kind: 'operator', property: step.property })
              else if (step.kind === 'date') setStep({ kind: 'operator', property: { kind: 'dates' } })
            }}
          >
            <ChevronLeft className="size-3.5" strokeWidth={2} />
          </button>
        )}
        <p className="min-w-0 flex-1 truncate text-[11px] font-medium uppercase tracking-wide text-ink-3">
          {breadcrumb}
        </p>
      </div>

      {step.kind === 'property' && (
        <Command className={FILTER_COMMAND_CLASS}>
          <CommandInput placeholder="Search properties…" className="h-9 text-[12.5px]" />
          <CommandList className="max-h-72">
            <CommandEmpty className="py-4 text-[12px] text-ink-3">No matching properties</CommandEmpty>
            <CommandGroup heading="Built-in">
              <CommandItem
                className={FILTER_ITEM_CLASS}
                onSelect={() => setStep({ kind: 'operator', property: { kind: 'status' } })}
              >
                Status
              </CommandItem>
              <CommandItem
                className={FILTER_ITEM_CLASS}
                onSelect={() => setStep({ kind: 'operator', property: { kind: 'assignee' } })}
              >
                Assignee
              </CommandItem>
              <CommandItem
                className={FILTER_ITEM_CLASS}
                onSelect={() => setStep({ kind: 'operator', property: { kind: 'dates' } })}
              >
                Due date
              </CommandItem>
            </CommandGroup>
            {choiceFields.length > 0 && (
              <>
                <CommandSeparator className="bg-hair" />
                <CommandGroup heading="Choice fields">
                  {choiceFields.map((f) => (
                    <CommandItem
                      key={f.id}
                      className={FILTER_ITEM_CLASS}
                      onSelect={() => setStep({ kind: 'operator', property: { kind: 'field', def: f } })}
                    >
                      {f.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
            {personFields.length > 0 && (
              <>
                <CommandSeparator className="bg-hair" />
                <CommandGroup heading="People">
                  {personFields.map((f) => (
                    <CommandItem
                      key={f.id}
                      className={FILTER_ITEM_CLASS}
                      onSelect={() => setStep({ kind: 'operator', property: { kind: 'field', def: f } })}
                    >
                      {f.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
            {sparseFields.length > 0 && (
              <>
                <CommandSeparator className="bg-hair" />
                <CommandGroup heading="Other fields">
                  {sparseFields.map((f) => (
                    <CommandItem
                      key={f.id}
                      className={FILTER_ITEM_CLASS}
                      onSelect={() => setStep({ kind: 'operator', property: { kind: 'field', def: f } })}
                    >
                      {f.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      )}

      {step.kind === 'operator' && (
        <FilterOperatorStep
          property={step.property}
          onDatesOverdue={() => finish({ on: 'dates', when: 'overdue' })}
          onDatesWhen={(when) => setStep({ kind: 'date', when })}
          onEmpty={(is) => {
            if (step.property.kind === 'assignee') {
              finish({ on: 'assignee', is, values: [null] })
            } else if (step.property.kind === 'field') {
              finish({ on: 'field', field: step.property.def.id, is, values: [null] })
            }
          }}
          onOp={(is) => setStep({ kind: 'value', property: step.property, is })}
        />
      )}

      {step.kind === 'value' && (
        <FilterValueStep
          property={step.property}
          members={members}
          onPick={(values) => {
            if (step.property.kind === 'status') {
              finish({ on: 'status', is: step.is, values: values as Status[] })
            } else if (step.property.kind === 'assignee') {
              finish({ on: 'assignee', is: step.is, values })
            } else if (step.property.kind === 'field') {
              finish({ on: 'field', field: step.property.def.id, is: step.is, values })
            }
          }}
        />
      )}

      {step.kind === 'date' && (
        <FilterDatePickStep
          when={step.when}
          today={today}
          onPick={(iso) => finish({ on: 'dates', when: step.when, date: iso })}
        />
      )}
    </div>
  )
}

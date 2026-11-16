import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import type { Chip } from '@/engine/roadmaps/view'
import type { FieldDef, MemberLite, Status } from '@/engine/roadmaps/types'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '../ui/command'
import { filterPropertyLabel, FILTER_COMMAND_CLASS, FILTER_ITEM_CLASS, type FilterProperty, type FilterStep } from './filterAddTypes'
import { FilterDatePickStep, FilterOperatorStep, FilterValueStep } from './filterAddSteps'

interface Props {
  fields: FieldDef[]
  members: MemberLite[]
  today: string
  onAdd: (chip: Chip) => void
}

const BUILT_IN: FilterProperty[] = [{ kind: 'status' }, { kind: 'assignee' }, { kind: 'dates' }]

/** Add a filter in steps: what to filter on, how, then the value. */
export function FilterAddMenu({ fields, members, today, onAdd }: Props) {
  const [step, setStep] = useState<FilterStep>({ kind: 'property' })

  if (step.kind === 'property') {
    const pick = (property: FilterProperty) => setStep({ kind: 'operator', property })
    return (
      <Command className={FILTER_COMMAND_CLASS}>
        <CommandInput placeholder="Filter by…" className="h-9 text-[13px]" />
        <CommandList className="max-h-72">
          <CommandEmpty className="py-4 text-center text-[12px] text-ink-3">Nothing matches</CommandEmpty>
          <CommandGroup>
            {BUILT_IN.map((p) => (
              <CommandItem key={p.kind} className={FILTER_ITEM_CLASS} onSelect={() => pick(p)}>{filterPropertyLabel(p)}</CommandItem>
            ))}
          </CommandGroup>
          {fields.length > 0 && (
            <>
              <CommandSeparator className="bg-hair" />
              <CommandGroup>
                {fields.map((f) => (
                  <CommandItem key={f.id} className={FILTER_ITEM_CLASS} onSelect={() => pick({ kind: 'field', def: f })}>{f.name}</CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </Command>
    )
  }

  const trail =
    step.kind === 'operator'
      ? filterPropertyLabel(step.property)
      : step.kind === 'value'
        ? `${filterPropertyLabel(step.property)} ${step.is ? 'is' : 'is not'}`
        : `Due date is ${step.when}`
  const back = () => setStep(step.kind === 'operator' ? { kind: 'property' } : { kind: 'operator', property: step.kind === 'value' ? step.property : { kind: 'dates' } })

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1 border-b border-line px-1.5 py-1.5">
        <button
          type="button"
          className="grid size-6 place-items-center rounded-md text-ink-3 outline-none transition-colors hover:bg-panel hover:text-ink focus-visible:ring-1 focus-visible:ring-line-2"
          aria-label="Back"
          onClick={back}
        >
          <ChevronLeft className="size-3.5" strokeWidth={2} aria-hidden />
        </button>
        <p className="min-w-0 flex-1 truncate text-[12px] text-ink-2">{trail}</p>
      </div>

      {step.kind === 'operator' && (
        <FilterOperatorStep
          property={step.property}
          onDatesOverdue={() => onAdd({ on: 'dates', when: 'overdue' })}
          onDatesWhen={(when) => setStep({ kind: 'date', when })}
          onEmpty={(is) => {
            if (step.property.kind === 'assignee') onAdd({ on: 'assignee', is, values: [null] })
            else if (step.property.kind === 'field') onAdd({ on: 'field', field: step.property.def.id, is, values: [null] })
          }}
          onOp={(is) => setStep({ kind: 'value', property: step.property, is })}
        />
      )}

      {step.kind === 'value' && (
        <FilterValueStep
          property={step.property}
          members={members}
          onPick={(values) => {
            if (step.property.kind === 'status') onAdd({ on: 'status', is: step.is, values: values as Status[] })
            else if (step.property.kind === 'assignee') onAdd({ on: 'assignee', is: step.is, values })
            else if (step.property.kind === 'field') onAdd({ on: 'field', field: step.property.def.id, is: step.is, values })
          }}
        />
      )}

      {step.kind === 'date' && <FilterDatePickStep when={step.when} today={today} onPick={(iso) => onAdd({ on: 'dates', when: step.when, date: iso })} />}
    </div>
  )
}

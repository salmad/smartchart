import { useEffect, useRef, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import type { Chip } from '@/engine/roadmaps/view'
import type { FieldDef, MemberLite, Status } from '@/engine/roadmaps/types'
import { cn } from '@/app/lib/utils'
import { FieldIcon } from './FieldIcon'
import { FilterValuePicker, pickNoun, pickOptions } from './FilterValuePicker'
import { Command, CommandGroup, CommandItem, CommandList, CommandSeparator } from '../ui/command'
import { filterPropertyLabel, FILTER_COMMAND_CLASS, FILTER_ITEM_CLASS, type FilterProperty, type FilterStep } from './filterAddTypes'
import { FilterDatePickStep, FilterOperatorStep } from './filterAddSteps'

interface Props {
  fields: FieldDef[]
  members: MemberLite[]
  today: string
  /** Add a finished filter and close. */
  onAdd: (chip: Chip) => void
  /** The filter being picked, as it is after each tick (null once nothing is ticked). The menu stays open. */
  onPut: (chip: Chip | null) => void
}

const BUILT_IN: FilterProperty[] = [{ kind: 'status' }, { kind: 'assignee' }, { kind: 'dates' }]

/** Add a filter in steps: what to filter on, how, then the value. */
export function FilterAddMenu({ fields, members, today, onAdd, onPut }: Props) {
  const [step, setStep] = useState<FilterStep>({ kind: 'property' })
  const [picked, setPicked] = useState<(string | null)[]>([])
  const box = useRef<HTMLDivElement>(null)
  // Each step takes the keys as it opens: its search box, or its list.
  useEffect(() => {
    const el = box.current
    ;(el?.querySelector<HTMLElement>('[cmdk-input]') ?? el?.querySelector<HTMLElement>('[cmdk-root]'))?.focus()
  }, [step])

  if (step.kind === 'property') {
    // A property with values goes straight to them; dates and free-form fields ask how first.
    const pick = (property: FilterProperty) =>
      setStep(pickOptions(property, members).length ? { kind: 'value', property, is: true } : { kind: 'operator', property })
    // A short list of properties: read, not searched. Arrows and Enter still work.
    return (
      <div ref={box}>
        <Command tabIndex={-1} className={FILTER_COMMAND_CLASS}>
          <CommandList className="max-h-72 p-1">
            <CommandGroup className="p-0">
              {BUILT_IN.map((p) => (
                <CommandItem key={p.kind} className={FILTER_ITEM_CLASS} onSelect={() => pick(p)}>{filterPropertyLabel(p)}</CommandItem>
              ))}
            </CommandGroup>
            {fields.length > 0 && (
              <>
                <CommandSeparator className="bg-hair" />
                <CommandGroup className="p-0" heading="Fields">
                  {fields.map((f) => (
                    <CommandItem key={f.id} className={cn(FILTER_ITEM_CLASS, 'gap-2')} onSelect={() => pick({ kind: 'field', def: f })}><FieldIcon type={f.type} />{f.name}</CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </div>
    )
  }

  const trail =
    step.kind === 'operator'
      ? filterPropertyLabel(step.property)
      : step.kind === 'value'
        ? filterPropertyLabel(step.property)
        : `Due date is ${step.when}`
  const back = () => {
    if (step.kind === 'value' && picked.length) { onPut(null); setPicked([]) }
    setStep(step.kind === 'date' ? { kind: 'operator', property: { kind: 'dates' } } : { kind: 'property' })
  }

  return (
    <div ref={box} className="flex flex-col">
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
        />
      )}

      {step.kind === 'value' && (
        <FilterValuePicker
          options={pickOptions(step.property, members)}
          selected={picked}
          noun={pickNoun(step.property)}
          onChange={(values) => {
            setPicked(values)
            const p = step.property
            if (!values.length) onPut(null)
            else if (p.kind === 'status') onPut({ on: 'status', is: step.is, values: values as Status[] })
            else if (p.kind === 'assignee') onPut({ on: 'assignee', is: step.is, values })
            else if (p.kind === 'field') onPut({ on: 'field', field: p.def.id, is: step.is, values })
          }}
        />
      )}

      {step.kind === 'date' && <FilterDatePickStep when={step.when} today={today} onPick={(iso) => onAdd({ on: 'dates', when: step.when, date: iso })} />}
    </div>
  )
}

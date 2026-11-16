import { useEffect, useRef, type ReactNode } from 'react'
import { emptyLabel, type Chip } from '@/engine/roadmaps/view'
import { STATUSES, STATUS_LABEL, type FieldDef, type MemberLite } from '@/engine/roadmaps/types'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command'
import { Checkbox } from '../ui/checkbox'
import { Avatar } from './Avatar'
import { OptionMark } from './OptionMark'
import { StatusGlyph } from './StatusGlyph'
import { cn } from '@/app/lib/utils'
import { FILTER_COMMAND_CLASS, FILTER_ITEM_CLASS, type FilterProperty } from './filterAddTypes'

export interface PickOption {
  value: string | null
  label: string
  lead?: ReactNode
  /** More words the search box matches, such as an issue's key. */
  keywords?: string
}

/** A short list reads at a glance; past this, a search box leads. */
const SEARCH_FROM = 10

/** What a filter on this property can pick, in the order the roadmap keeps them; the empty value last. */
export function pickOptions(property: FilterProperty, members: MemberLite[]): PickOption[] {
  const people = members.map((m): PickOption => ({ value: m.id, label: m.name, lead: <Avatar name={m.name} /> }))
  switch (property.kind) {
    case 'status':
      return STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s], lead: <StatusGlyph status={s} /> }))
    case 'assignee':
      return [...people, { value: null, label: 'Unassigned' }]
    case 'field':
      if (property.def.type === 'choice') {
        return [
          ...(property.def.options ?? []).map((o): PickOption => ({ value: o.id, label: o.name, lead: o.emoji ? <OptionMark mark={o.emoji} /> : undefined })),
          { value: null, label: emptyLabel(property.def.name) },
        ]
      }
      if (property.def.type === 'person') return [...people, { value: null, label: emptyLabel(property.def.name) }]
      return []
    case 'dates':
      return []
  }
}

/** The noun its search box names. */
export const pickNoun = (p: FilterProperty): string =>
  p.kind === 'status' ? 'statuses' : p.kind === 'field' && p.def.type === 'choice' ? 'options' : 'people'

/** The property a value chip filters on, so its values can be picked again. */
export function chipProperty(chip: Chip, fields: FieldDef[]): FilterProperty | null {
  if (chip.on === 'status' || chip.on === 'assignee') return { kind: chip.on }
  if (chip.on !== 'field') return null
  const def = fields.find((f) => f.id === chip.field)
  return def ? { kind: 'field', def } : null
}

interface Props {
  options: PickOption[]
  selected: (string | null)[]
  /** Called on every tick, so the filter follows along; the caller drops the filter when nothing is left. */
  onChange: (values: (string | null)[]) => void
  /** Short noun for the search box ("options", "people"). */
  noun: string
}

/** Pick one or more values. Ticks apply as they happen, so there is no Apply; the list keeps its order. */
export function FilterValuePicker({ options, selected, onChange, noun }: Props) {
  const on = new Set(selected)
  const searching = options.length > SEARCH_FROM
  const root = useRef<HTMLDivElement>(null)
  // Without a search box, the list itself takes the keys, so arrows and Enter work at once.
  useEffect(() => { if (!searching) root.current?.focus() }, [searching])
  const toggle = (value: string | null) =>
    onChange(on.has(value) ? selected.filter((v) => v !== value) : options.map((o) => o.value).filter((v) => v === value || on.has(v)))

  return (
    <Command ref={root} tabIndex={-1} className={FILTER_COMMAND_CLASS}>
      {searching && <CommandInput autoFocus placeholder={`Search ${noun}…`} className="h-9 text-[13px]" />}
      <CommandList className="max-h-72 p-1 outline-none" aria-multiselectable>
        <CommandEmpty className="py-4 text-center text-[12px] text-ink-3">Nothing matches</CommandEmpty>
        <CommandGroup className="p-0">
          {options.map((o) => {
            const ticked = on.has(o.value)
            return (
              <CommandItem
                key={o.value ?? '∅'}
                value={`${o.label} ${o.keywords ?? ''} ${o.value ?? ''}`}
                aria-checked={ticked}
                className={cn(FILTER_ITEM_CLASS, 'h-8 gap-2.5', ticked && 'text-ink')}
                onSelect={() => toggle(o.value)}
              >
                <Checkbox checked={ticked} tabIndex={-1} aria-hidden className="pointer-events-none size-3.5 rounded-[4px] border-line-2 data-[state=checked]:border-ink data-[state=checked]:bg-ink data-[state=checked]:text-app-bg [&_svg]:size-2.5" />
                {o.lead}
                <span className={cn('min-w-0 flex-1 truncate', o.value === null && 'text-ink-3')}>{o.label}</span>
              </CommandItem>
            )
          })}
        </CommandGroup>
      </CommandList>
    </Command>
  )
}

import type { ReactNode } from 'react'
import { ChevronDown, type LucideIcon } from 'lucide-react'
import { cn } from '@/app/lib/utils'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '../ui/select'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu'

/** A menu choice. `section` heads a run of choices ("Fields" for the roadmap's own); `icon` leads the label. */
export interface MenuOption<T extends string = string> { value: T; label: string; icon?: ReactNode; section?: string }

/** Choices in order, with a heading wherever the section changes. */
function sectioned<O extends { section?: string }>(options: O[]): { section?: string; options: O[] }[] {
  const out: { section?: string; options: O[] }[] = []
  for (const o of options) {
    const last = out[out.length - 1]
    if (last && last.section === o.section) last.options.push(o)
    else out.push({ section: o.section, options: [o] })
  }
  return out
}

const menuLabel = 'px-2 pb-1 pt-1.5 text-[11px] font-normal text-ink-3'

/** A labelled group inside a View menu: a quiet label, a hairline above every group but the first.
    `icon` is accepted for callers that still pass one; the label alone is drawn. */
export function MenuSection({ title, children, className }: { icon?: LucideIcon; title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('border-t border-hair pt-2 first:border-t-0 first:pt-0', className)}>
      <h3 className="px-2 pb-1 text-[11px] text-ink-3">{title}</h3>
      {children}
    </section>
  )
}

/** The field a menu row opens: the select's trigger, and the multi-pick's, look the same. */
const menuField = 'h-7 w-40 gap-2 rounded-md border border-line bg-panel px-2 text-[13px] text-ink shadow-none transition-colors hover:border-line-2 focus:ring-line-2'
const menuItem = 'rounded-md text-[13px] text-ink-2 focus:bg-panel focus:text-ink'

/** One choice out of many on a single row: label left, the app's select right. Keeps a menu short. */
export function MenuSelect<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: MenuOption<T>[]; onChange: (v: T) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 px-2 py-1 text-[13px] text-ink-2">
      <span>{label}</span>
      <Select value={value} onValueChange={(v) => onChange(v as T)}>
        <SelectTrigger aria-label={label} className={menuField}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end" className="max-h-72">
          {sectioned(options).map((run, i) => (
            <SelectGroup key={run.section ?? i}>
              {i > 0 && <SelectSeparator className="bg-hair" />}
              {run.section && <SelectLabel className={menuLabel}>{run.section}</SelectLabel>}
              {run.options.map((o) => (
                <SelectItem key={o.value} value={o.value} className={menuItem}>
                  <span className="flex items-center gap-2">{o.icon}{o.label}</span>
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/** Several on/off choices on a single row: label left, a field that names what is on ("Start, Due +1"), a checklist
    under it that stays open while you tick. */
export function MenuMulti({ label, options, empty = 'None', onToggle }: { label: string; options: (MenuOption & { on: boolean })[]; empty?: string; onToggle: (value: string) => void }) {
  const on = options.filter((o) => o.on)
  const summary = on.length === 0 ? empty : on.length <= 2 ? on.map((o) => o.label).join(', ') : `${on[0].label}, ${on[1].label} +${on.length - 2}`
  return (
    <div className="flex items-center justify-between gap-3 px-2 py-1 text-[13px] text-ink-2">
      <span>{label}</span>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger aria-label={label} className={cn(menuField, 'flex items-center justify-between outline-none')}>
          <span className={cn('truncate', !on.length && 'text-ink-3')}>{summary}</span>
          <ChevronDown className="size-4 shrink-0 opacity-50" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-72 w-40 overflow-y-auto">
          {sectioned(options).map((run, i) => (
            <DropdownMenuGroup key={run.section ?? i}>
              {i > 0 && <DropdownMenuSeparator className="bg-hair" />}
              {run.section && <DropdownMenuLabel className={menuLabel}>{run.section}</DropdownMenuLabel>}
              {run.options.map((o) => (
                <DropdownMenuCheckboxItem key={o.value} checked={o.on} className={cn(menuItem, 'gap-2')} onSelect={(e) => e.preventDefault()} onCheckedChange={() => onToggle(o.value)}>
                  {o.icon}{o.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

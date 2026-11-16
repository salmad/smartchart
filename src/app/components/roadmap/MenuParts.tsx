import type { ReactNode } from 'react'
import { Check, type LucideIcon } from 'lucide-react'
import { cn } from '@/app/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Switch } from '../ui/switch'
import { menuRow } from './roadmapChrome'

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

/** One choice out of several: the chosen row carries a tick. */
export function MenuPick({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={on} className={cn(menuRow, 'flex items-center justify-between gap-2')} onClick={onClick}>
      <span className="truncate">{label}</span>
      {on && <Check className="size-3.5 shrink-0 text-ink" strokeWidth={2} aria-hidden />}
    </button>
  )
}

/** One on/off setting: label left, switch right, the whole row clickable. */
export function MenuSwitch({ label, on, onChange }: { label: string; on: boolean; onChange: () => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-1.5 text-[13px] text-ink-2 transition-colors hover:bg-panel hover:text-ink">
      <span className="truncate">{label}</span>
      <Switch checked={on} onCheckedChange={onChange} aria-label={label} />
    </label>
  )
}

/** One choice out of many on a single row: label left, the app's select right. Keeps a menu short. */
export function MenuSelect<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 px-2 py-1 text-[13px] text-ink-2">
      <span>{label}</span>
      <Select value={value} onValueChange={(v) => onChange(v as T)}>
        <SelectTrigger aria-label={label} className="h-7 w-36 gap-2 rounded-md border-line bg-panel px-2 text-[13px] text-ink shadow-none transition-colors hover:border-line-2 focus:ring-line-2">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end" className="max-h-72">
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} className="rounded-md text-[13px] text-ink-2 focus:bg-panel focus:text-ink">{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

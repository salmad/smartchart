/* The deck's own menu, opened from its name in the bar: its look (writing style, palette, accent) in a popover. */
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Style, Theme } from '@/engine/types'
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover'
import { AccentPanel, accentLook, paint } from './AccentPicker'

interface Props {
  /** The deck's name: the trigger, and the panel's heading. */
  title: string
  deckStyle: Style; theme: Theme; accent: string | null
  /** The writing style is fixed once the deck has slides: the agent wrote them in it. */
  styleLocked: boolean
  onStyle: (s: Style) => void; onTheme: (t: Theme) => void; onAccent: (hex: string | null) => void
}


export function LookMenu(p: Props) {
  const [open, setOpen] = useState(false)
  const dot = useRef<HTMLElement>(null)
  const l = accentLook(p.accent, p.theme)
  useLayoutEffect(() => { paint(dot.current, l.shown) }, [l.shown])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger aria-label={`${p.title}: deck look`} title="This deck’s look"
        className="-mx-1.5 flex h-8 min-w-0 cursor-pointer items-center gap-2 rounded-lg px-1.5 text-[13px] text-ink-2 outline-none transition-colors hover:bg-panel hover:text-ink focus-visible:ring-1 focus-visible:ring-line-2 data-[state=open]:bg-panel data-[state=open]:text-ink">
        <span className="truncate">{p.title}</span>
        <i ref={dot} className="size-2.5 flex-none rounded-full bg-[var(--sw)] shadow-[0_0_0_1px_rgba(255,255,255,.14)]" />
        <ChevronDown className="size-3.5 flex-none text-ink-3" />
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} aria-label="Deck look"
        className="grid w-72 gap-5 rounded-[14px] border-line-2 bg-raise p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.04),0_24px_48px_-16px_rgba(0,0,0,.7)]">
        <header className="grid gap-0.5">
          <h2 className="truncate text-[14px] font-medium text-ink">{p.title}</h2>
          <p className="text-[12.5px] text-ink-3">This deck’s look, on every slide.</p>
        </header>
        <Section title="Writing" note={p.styleLocked ? 'Set when the deck starts.' : undefined}>
          <Seg label="Deck style" value={p.deckStyle} disabled={p.styleLocked} onChange={p.onStyle}
            options={[['consulting', 'Consulting'], ['pitch', 'Pitch']]} />
        </Section>
        <Section title="Palette">
          <Seg label="Palette" value={p.theme} onChange={p.onTheme} options={[['ink', 'Ink'], ['paper', 'Paper']]} />
        </Section>
        <div className="grid gap-3"><AccentPanel look={l} accent={p.accent} onChange={p.onAccent} /></div>
      </PopoverContent>
    </Popover>
  )
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between font-mono text-[11px] font-medium uppercase leading-none tracking-[.08em] text-ink-3">
        <span>{title}</span>
        {note && <span className="font-sans text-xs normal-case tracking-normal">{note}</span>}
      </div>
      {children}
    </div>
  )
}

function Seg<T extends string>({ label, value, options, disabled, onChange }: { label: string; value: T; options: [T, ReactNode][]; disabled?: boolean; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="grid auto-cols-fr grid-flow-col rounded-[9px] border border-line bg-panel p-[3px]">
      {options.map(([v, text]) => (
        <button key={v} type="button" aria-pressed={v === value} disabled={disabled} onClick={() => onChange(v)}
          className="cursor-pointer rounded-md px-3 py-[5px] text-[13px] text-ink-2 disabled:cursor-not-allowed disabled:opacity-45 aria-pressed:bg-app-bg aria-pressed:text-ink aria-pressed:shadow-[0_0_0_1px_theme(colors.line-2)]">
          {text}
        </button>
      ))}
    </div>
  )
}

/* The deck's look in one bar button: writing style, palette and accent, in a popover. */
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { Style, Theme } from '@/engine/types'
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover'
import { AccentPanel, accentLook, paint } from './AccentPicker'

interface Props {
  deckStyle: Style; theme: Theme; accent: string | null
  /** The writing style is fixed once the deck has slides: the agent wrote them in it. */
  styleLocked: boolean
  onStyle: (s: Style) => void; onTheme: (t: Theme) => void; onAccent: (hex: string | null) => void
}

const STYLE_NAME: Record<Style, string> = { consulting: 'Consulting', pitch: 'Pitch' }
const THEME_NAME: Record<Theme, string> = { ink: 'Ink', paper: 'Paper' }

export function LookMenu(p: Props) {
  const [open, setOpen] = useState(false)
  const dot = useRef<HTMLElement>(null)
  const l = accentLook(p.accent, p.theme)
  useLayoutEffect(() => { paint(dot.current, l.shown) }, [l.shown])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger aria-label="Look"
        className="flex h-8 cursor-pointer items-center gap-2 rounded-[9px] border border-line bg-panel pl-[11px] pr-3 text-[13px] max-[900px]:pr-[11px] text-ink-2 transition-colors hover:border-line-2 hover:text-ink data-[state=open]:border-line-2 data-[state=open]:text-ink">
        <i ref={dot} className="size-3 flex-none rounded-full bg-[var(--sw)] shadow-[0_0_0_1px_rgba(255,255,255,.14)]" />
        <span className="max-[900px]:hidden">{STYLE_NAME[p.deckStyle]} · {THEME_NAME[p.theme]}</span>
      </PopoverTrigger>
      <PopoverContent align="center" sideOffset={8} aria-label="Look"
        className="grid w-72 gap-5 rounded-[14px] border-line-2 bg-raise p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.04),0_24px_48px_-16px_rgba(0,0,0,.7)]">
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

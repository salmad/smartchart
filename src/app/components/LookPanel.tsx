/* The deck's look, as an inspector down the right of the editor (writing style, palette, accent): open beside the
   slide so every change shows on it at once. Opened from the deck menu; it stays open until closed. */
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import type { Style, Theme } from '@/engine/types'
import { AccentPanel, accentLook } from './AccentPicker'

interface Props {
  deckStyle: Style; theme: Theme; accent: string | null
  /** The writing style is fixed once the deck has slides: the agent wrote them in it. */
  styleLocked: boolean
  onStyle: (s: Style) => void; onTheme: (t: Theme) => void; onAccent: (hex: string | null) => void
  onClose: () => void
}

export function LookPanel(p: Props) {
  const l = accentLook(p.accent, p.theme)
  return (
    <aside aria-label="Deck look" className="flex w-[288px] min-h-0 flex-none flex-col gap-5 overflow-y-auto border-l border-line bg-app-bg p-4 max-[900px]:order-2 max-[900px]:border-l-0 max-[900px]:border-t">
      <header className="flex items-start justify-between gap-3">
        <div className="grid gap-0.5">
          <h2 className="text-[14px] font-medium text-ink">Look</h2>
          <p className="text-[12.5px] text-ink-3">This deck’s look, on every slide.</p>
        </div>
        <button type="button" onClick={p.onClose} aria-label="Close look"
          className="-mr-1 -mt-1 grid size-7 flex-none cursor-pointer place-items-center rounded-md text-ink-3 transition-colors hover:bg-panel hover:text-ink">
          <X className="size-4" strokeWidth={1.75} />
        </button>
      </header>
      <Section title="Writing" note={p.styleLocked ? 'Set when the deck starts.' : undefined}>
        <Seg label="Deck style" value={p.deckStyle} disabled={p.styleLocked} onChange={p.onStyle}
          options={[['consulting', 'Consulting'], ['pitch', 'Pitch']]} />
      </Section>
      <Section title="Palette">
        <Seg label="Palette" value={p.theme} onChange={p.onTheme} options={[['ink', 'Ink'], ['paper', 'Paper']]} />
      </Section>
      <div className="grid gap-3"><AccentPanel look={l} accent={p.accent} onChange={p.onAccent} /></div>
    </aside>
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

export function Seg<T extends string>({ label, value, options, disabled, onChange, className }: { label: string; value: T; options: [T, ReactNode][]; disabled?: boolean; onChange: (v: T) => void; className?: string }) {
  return (
    <div role="group" aria-label={label} className={className ?? 'grid auto-cols-fr grid-flow-col rounded-[9px] border border-line bg-panel p-[3px]'}>
      {options.map(([v, text]) => (
        <button key={v} type="button" aria-pressed={v === value} disabled={disabled} onClick={() => onChange(v)}
          className="cursor-pointer rounded-md px-3 py-[5px] text-[13px] text-ink-2 transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-45 aria-pressed:bg-app-bg aria-pressed:text-ink aria-pressed:shadow-[0_0_0_1px_theme(colors.line-2)]">
          {text}
        </button>
      ))}
    </div>
  )
}

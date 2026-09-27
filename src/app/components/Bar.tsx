import type { ReactNode } from 'react'
import type { Style, Theme } from '@/engine/types'
import { Button } from '@/app/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select'
import { cn } from '@/app/lib/utils'
import { AccentPicker } from './AccentPicker'

export interface DeckOption { id: string; label: string }
export interface BarProps {
  deckStyle: Style; theme: Theme; accent: string | null; hasSlides: boolean; busy: boolean; live: boolean
  decks: DeckOption[]; deckId: string | null; canDelete: boolean
  onStyle: (s: Style) => void; onTheme: (t: Theme) => void; onAccent: (hex: string | null) => void
  onOpenDeck: (id: string) => void; onDelete: () => void; onNew: () => void; onPresent: () => void
  canAdd: boolean; onAdd: () => void
}

/** Top bar: deck style and palette, accent, saved decks, new deck and Present. */
export function Bar(p: BarProps) {
  return (
    <header className="flex h-14 items-center gap-6 border-b border-line pl-5 pr-4 max-[900px]:h-auto max-[900px]:flex-wrap max-[900px]:gap-x-3 max-[900px]:gap-y-2.5 max-[900px]:px-4 max-[900px]:py-3">
      <div className="flex min-w-0 items-baseline gap-2.5 max-[900px]:flex-1"><b className="font-semibold tracking-[-.01em]">SmartChart</b></div>
      <div className="mx-auto flex gap-2.5 max-[900px]:order-3 max-[900px]:m-0 max-[900px]:w-full">
        <Seg label="Deck style" value={p.deckStyle} disabled={p.hasSlides} onChange={p.onStyle}
          options={[['consulting', 'Consulting'], ['pitch', 'Pitch']]} />
        <Seg label="Palette" value={p.theme} onChange={p.onTheme} options={[['ink', 'Ink'], ['paper', 'Paper']]} />
        <AccentPicker accent={p.accent} theme={p.theme} onChange={p.onAccent} />
      </div>
      <div className="flex items-center gap-2.5 max-[900px]:contents">
        <span className={cn('flex items-center gap-1.5 whitespace-nowrap font-mono text-[11px] font-medium uppercase leading-none tracking-[.08em] before:size-1.5 before:rounded-full before:bg-current before:content-[""] max-[900px]:order-1',
          p.live ? 'text-ok' : 'text-ink-3')}>{p.live ? 'Ready' : 'Offline'}</span>
        {p.decks.length > 0 && (
          <Select value={p.deckId ?? undefined} onValueChange={p.onOpenDeck} disabled={p.busy}>
            <SelectTrigger aria-label="Deck" className="h-8 max-w-[280px] rounded-lg border-line-2 bg-panel px-2 text-[13px] shadow-none disabled:opacity-45 max-[900px]:order-4 max-[900px]:min-w-0 max-[900px]:flex-1">
              <SelectValue placeholder="Untitled deck" />
            </SelectTrigger>
            <SelectContent className="border-line-2 bg-raise text-ink">
              {p.decks.map((d) => <SelectItem key={d.id} value={d.id} className="text-[13px]">{d.label}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {p.canDelete && <Button variant="outline" onClick={p.onDelete} disabled={p.busy} className="max-[900px]:order-4">Delete</Button>}
        <Button variant="outline" onClick={p.onAdd} disabled={!p.canAdd || p.busy} className="max-[900px]:order-4">Add slide</Button>
        <Button variant="outline" onClick={p.onNew} disabled={p.busy} className="max-[900px]:order-4">New deck</Button>
        <Button onClick={p.onPresent} disabled={!p.hasSlides} className="max-[900px]:order-5">Present <kbd className="max-[900px]:hidden">F</kbd></Button>
      </div>
    </header>
  )
}

function Seg<T extends string>({ label, value, options, disabled, onChange }: { label: string; value: T; options: [T, ReactNode][]; disabled?: boolean; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="flex rounded-[9px] border border-line bg-panel p-[3px]">
      {options.map(([v, text]) => (
        <button key={v} type="button" aria-pressed={v === value} disabled={disabled} onClick={() => onChange(v)}
          className="cursor-pointer rounded-md px-3 py-[5px] text-[13px] text-ink-2 disabled:cursor-not-allowed disabled:opacity-45 aria-pressed:bg-raise aria-pressed:text-ink aria-pressed:shadow-[0_0_0_1px_theme(colors.line-2)]">
          {text}
        </button>
      ))}
    </div>
  )
}

import type { ReactNode } from 'react'
import type { Style, Theme } from '@/engine/types'
import { Button } from '@/app/components/ui/button'
import { go } from '@/app/route'
import { AccentPicker } from './AccentPicker'

export interface BarProps {
  deckStyle: Style; theme: Theme; accent: string | null; hasSlides: boolean; busy: boolean; live: boolean; title: string
  onStyle: (s: Style) => void; onTheme: (t: Theme) => void; onAccent: (hex: string | null) => void
  onPresent: () => void; canAdd: boolean; onAdd: () => void
  /** Shown to a visitor: sign in to keep the deck. */
  onSignIn?: () => void
}

/** Top bar: back to your decks, the deck's name, its look, Add slide and Present. Decks are opened and deleted in Your decks. */
export function Bar(p: BarProps) {
  return (
    <header className="flex h-14 items-center gap-6 border-b border-line pl-5 pr-4 max-[900px]:h-auto max-[900px]:flex-wrap max-[900px]:gap-x-3 max-[900px]:gap-y-2.5 max-[900px]:px-4 max-[900px]:py-3">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-baseline gap-2 text-[13px] max-[900px]:flex-1">
        <a href="/" onClick={(e) => { e.preventDefault(); go('/') }} className="whitespace-nowrap font-semibold tracking-[-.01em] text-ink hover:text-ink-2">SmartChart</a>
        <span aria-hidden className="text-ink-3">/</span>
        <span className="truncate text-ink-2" aria-current="page">{p.title}</span>
      </nav>
      <div className="mx-auto flex gap-2.5 max-[900px]:order-3 max-[900px]:m-0 max-[900px]:w-full">
        <Seg label="Deck style" value={p.deckStyle} disabled={p.hasSlides} onChange={p.onStyle}
          options={[['consulting', 'Consulting'], ['pitch', 'Pitch']]} />
        <Seg label="Palette" value={p.theme} onChange={p.onTheme} options={[['ink', 'Ink'], ['paper', 'Paper']]} />
        <AccentPicker accent={p.accent} theme={p.theme} onChange={p.onAccent} />
      </div>
      <div className="flex items-center gap-2.5 max-[900px]:contents">
        {!p.live && <span className="whitespace-nowrap text-[12.5px] text-ink-3 max-[900px]:order-1">Offline</span>}
        {p.onSignIn && <Button variant="outline" onClick={p.onSignIn} className="max-[900px]:order-4">Sign in</Button>}
        <Button variant="outline" onClick={p.onAdd} disabled={!p.canAdd || p.busy} className="max-[900px]:order-4">Add slide</Button>
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

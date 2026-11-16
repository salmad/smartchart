/* The look of a deck or a doc, as an inspector down the right (writing style for a deck, palette, accent): open beside
   the page so every change shows on it at once. It stays open until closed. A doc has no writing style to choose. */
import type { ReactNode } from 'react'
import type { Style, Theme } from '@/engine/types'
import { AccentPanel, accentLook } from './AccentPicker'
import { Seg } from './Seg'
import { PanelNote, SidePanel } from './SidePanel'

interface Props {
  noun?: 'deck' | 'doc'
  theme: Theme; accent: string | null
  /** A deck's writing style, fixed once it has slides (the agent wrote them in it); a doc passes neither. */
  deckStyle?: Style; styleLocked?: boolean; onStyle?: (s: Style) => void
  onTheme: (t: Theme) => void; onAccent: (hex: string | null) => void
  onClose: () => void
}

export function LookPanel(p: Props) {
  const l = accentLook(p.accent, p.theme), noun = p.noun ?? 'deck'
  return (
    <SidePanel label={`${noun === 'doc' ? 'Doc' : 'Deck'} look`} title="Look" note={<PanelNote>Your palette and accent, on every slide and doc.</PanelNote>}
      closeLabel="Close look" onClose={p.onClose}>
      <div className="grid min-h-0 flex-1 content-start gap-5 overflow-y-auto px-4 pb-4 pt-2">
        {p.deckStyle && p.onStyle && (
          <Section title="Writing" note={p.styleLocked ? 'Set when the deck starts.' : undefined}>
            <Seg label="Deck style" value={p.deckStyle} disabled={p.styleLocked} onChange={p.onStyle}
              options={[['consulting', 'Consulting'], ['pitch', 'Pitch']]} />
          </Section>
        )}
        <Section title="Palette">
          <Seg label="Palette" value={p.theme} onChange={p.onTheme} options={[['ink', 'Ink'], ['paper', 'Paper']]} />
        </Section>
        <div className="grid gap-3"><AccentPanel look={l} accent={p.accent} onChange={p.onAccent} /></div>
      </div>
    </SidePanel>
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

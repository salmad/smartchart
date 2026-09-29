import type { Style, Theme } from '@/engine/types'
import { PanelLeft } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { LookMenu } from './LookMenu'
import { ShareMenu } from './ShareMenu'

export interface BarProps {
  deckStyle: Style; theme: Theme; accent: string | null; hasSlides: boolean; busy: boolean; live: boolean; title: string
  onStyle: (s: Style) => void; onTheme: (t: Theme) => void; onAccent: (hex: string | null) => void
  onPresent: () => void; canAdd: boolean; onAdd: () => void
  decksOpen: boolean; onToggleDecks: () => void
  /** Occam: the site, at /home. */
  onSite: () => void
  /** The deck a share link can be made for; null when decks live only in this browser, or before the deck exists. */
  shareId: string | null
}

/** Top bar: the decks toggle, and the deck's name, which opens its look; Add slide, Share and Present on the right. */
export function Bar(p: BarProps) {
  return (
    <header className="flex h-14 items-center gap-6 border-b border-line pl-3 pr-4 max-[900px]:gap-3 max-[900px]:px-4">
      <button type="button" onClick={p.onToggleDecks} aria-label={p.decksOpen ? 'Hide your decks' : 'Show your decks'} aria-pressed={p.decksOpen} title={`${p.decksOpen ? 'Hide' : 'Show'} your decks (⌘\\)`}
        className="-mr-3 grid size-8 flex-none cursor-pointer place-items-center rounded-lg text-ink-3 transition-colors hover:bg-panel hover:text-ink aria-pressed:text-ink-2 max-[900px]:hidden">
        <PanelLeft className="size-[18px]" strokeWidth={1.75} />
      </button>
      <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-2 text-[13px]">
        <a href="/home" onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); p.onSite() }} className="whitespace-nowrap font-semibold tracking-[-.01em] text-ink hover:text-ink-2">Occam</a>
        <span aria-hidden className="text-ink-3">/</span>
        <LookMenu title={p.title} deckStyle={p.deckStyle} theme={p.theme} accent={p.accent} styleLocked={p.hasSlides}
          onStyle={p.onStyle} onTheme={p.onTheme} onAccent={p.onAccent} />
      </nav>
      <div className="flex items-center gap-2.5 max-[900px]:gap-2">
        {!p.live && <span className="whitespace-nowrap text-[12.5px] text-ink-3 max-[900px]:hidden">Offline</span>}
        {p.canAdd && <Button variant="outline" onClick={p.onAdd} disabled={p.busy} className="max-[900px]:hidden">Add slide</Button>}
        {p.hasSlides && p.shareId && <div className="max-[900px]:hidden"><ShareMenu key={p.shareId} deckId={p.shareId} /></div>}
        {p.hasSlides && <Button onClick={p.onPresent}>Present <kbd className="max-[900px]:hidden">F</kbd></Button>}
      </div>
    </header>
  )
}

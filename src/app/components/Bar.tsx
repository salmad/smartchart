import type { Style, Theme } from '@/engine/types'
import { Button } from '@/app/components/ui/button'
import { go } from '@/app/route'
import { LookMenu } from './LookMenu'

export interface BarProps {
  deckStyle: Style; theme: Theme; accent: string | null; hasSlides: boolean; busy: boolean; live: boolean; title: string
  onStyle: (s: Style) => void; onTheme: (t: Theme) => void; onAccent: (hex: string | null) => void
  onPresent: () => void; canAdd: boolean; onAdd: () => void
  /** Shown to a visitor: sign in to keep the deck. */
  onSignIn?: () => void
}

/** Top bar: back to your decks and the deck's name; its look, Add slide and Present on the right. */
export function Bar(p: BarProps) {
  return (
    <header className="flex h-14 items-center gap-6 border-b border-line pl-5 pr-4 max-[900px]:gap-3 max-[900px]:px-4">
      <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-baseline gap-2 text-[13px]">
        <a href="/" onClick={(e) => { e.preventDefault(); go('/') }} className="whitespace-nowrap font-semibold tracking-[-.01em] text-ink hover:text-ink-2">SmartChart</a>
        <span aria-hidden className="text-ink-3">/</span>
        <span className="truncate text-ink-2" aria-current="page">{p.title}</span>
      </nav>
      <div className="flex items-center gap-2.5 max-[900px]:gap-2">
        {!p.live && <span className="whitespace-nowrap text-[12.5px] text-ink-3 max-[900px]:hidden">Offline</span>}
        <LookMenu deckStyle={p.deckStyle} theme={p.theme} accent={p.accent} styleLocked={p.hasSlides}
          onStyle={p.onStyle} onTheme={p.onTheme} onAccent={p.onAccent} />
        {p.onSignIn && <Button variant="ghost" onClick={p.onSignIn}>Sign in</Button>}
        {p.canAdd && <Button variant="outline" onClick={p.onAdd} disabled={p.busy} className="max-[900px]:hidden">Add slide</Button>}
        <Button onClick={p.onPresent} disabled={!p.hasSlides}>Present <kbd className="max-[900px]:hidden">F</kbd></Button>
      </div>
    </header>
  )
}

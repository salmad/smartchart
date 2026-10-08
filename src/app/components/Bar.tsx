import { useState, type ReactNode } from 'react'
import { History, LayoutGrid, ListOrdered, MessageSquare, PanelLeft, Palette, Play, RectangleHorizontal, type LucideIcon } from 'lucide-react'
import type { Account } from '@/app/auth'
import { Button } from '@/app/components/ui/button'
import { AccountMenu } from './AccountMenu'
import { DeckMenu } from './DeckMenu'
import { DeckTitle } from './DeckTitle'
import { Seg } from './LookPanel'
import { ShareMenu } from './ShareMenu'

/** How the stage shows the deck: one slide to work on, every slide to order, or the titles to read the story. */
export type DeckView = 'slide' | 'grid' | 'story'

export interface BarProps {
  title: string; hasSlides: boolean; busy: boolean; live: boolean
  onRename: (name: string) => void
  /** Null before the deck is saved. */
  onDelete: (() => void) | null
  /** The deck's inspectors on the right: its look, and its versions (null when the decks' store keeps none). */
  lookOpen: boolean; onLook: () => void
  versionsOpen: boolean; onVersions: (() => void) | null
  /** The view switch; null when the stage shows something else (the starter picker, edit mode). */
  view: DeckView | null; onView: (v: DeckView) => void
  onPresent: () => void
  decksOpen: boolean; onToggleDecks: () => void
  chatOpen: boolean; onToggleChat: () => void
  /** Occam: the site, at /home. */
  onSite: () => void
  /** The deck a share link can be made for; null when decks live only in this browser, or before the deck exists. */
  shareId: string | null
  onPdf: () => void
  account: Account
  /** Starts the tour; null where there is no deck to show it on. */
  onTour: (() => void) | null
  /** Opens the red-pen review of a deck made elsewhere. */
  onReview?: () => void
}

const VIEWS: [DeckView, string, LucideIcon][] = [['slide', 'Slide', RectangleHorizontal], ['grid', 'Grid', LayoutGrid], ['story', 'Storyline', ListOrdered]]
// Icon and word; below 1200px the word steps back to the tooltip and the screen reader.
const views = VIEWS.map(([v, label, Icon]): [DeckView, ReactNode] => [v, (
  <span key={v} title={label} className="flex items-center gap-1.5">
    <Icon aria-hidden className="size-4" strokeWidth={1.75} /><span className="max-[1200px]:sr-only">{label}</span>
  </span>
)])

/** Top bar: the panels on the left (decks, chat) toggle at the left, the deck's name and menu; the view switch in the middle;
    the panels on the right (look, versions) toggle at the right, then Share, Present and you. */
export function Bar(p: BarProps) {
  const [renaming, setRenaming] = useState(false)
  return (
    <header className="grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-6 border-b border-line pl-3 pr-4 max-[900px]:flex max-[900px]:gap-3 max-[900px]:px-4">
      <div className="flex min-w-0 items-center gap-3 max-[900px]:flex-1">
        {/* The layout toggles, together as in Cursor's title bar: each shows whether its panel is open. */}
        <div className="flex flex-none items-center gap-0.5 max-[900px]:hidden">
          <Toggle open={p.decksOpen} onClick={p.onToggleDecks} label={`${p.decksOpen ? 'Hide' : 'Show'} your decks`} keys="⌘\\"><PanelLeft className="size-[18px]" strokeWidth={1.75} /></Toggle>
          <Toggle open={p.chatOpen} onClick={p.onToggleChat} label={`${p.chatOpen ? 'Hide' : 'Show'} the chat`} keys="⌘L"><MessageSquare className="size-[17px]" strokeWidth={1.75} /></Toggle>
        </div>
        <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-2 text-[13px]">
          <a href="/home" onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); p.onSite() }} className="whitespace-nowrap font-semibold tracking-[-.01em] text-ink hover:text-ink-2">Occam</a>
          <span aria-hidden className="text-ink-3">/</span>
          <DeckTitle name={p.title} editing={renaming} onEditing={setRenaming} onRename={p.onRename} disabled={p.busy} />
          <DeckMenu name={p.title} busy={p.busy} onRename={() => setRenaming(true)} onDelete={p.onDelete} />
        </nav>
      </div>
      <div data-tour="views" className="max-[900px]:hidden">
        {p.view && <Seg label="View" value={p.view} onChange={p.onView} options={views}
          className="flex rounded-[9px] border border-line bg-panel p-[3px]" />}
      </div>
      <div className="flex items-center justify-end gap-2.5 max-[900px]:gap-2">
        <div className="flex flex-none items-center gap-0.5 max-[900px]:hidden">
          <Toggle open={p.lookOpen} onClick={p.onLook} label="Look"><Palette className="size-[17px]" strokeWidth={1.75} /></Toggle>
          {p.hasSlides && p.onVersions && <Toggle open={p.versionsOpen} onClick={p.onVersions} label="Versions"><History className="size-[17px]" strokeWidth={1.75} /></Toggle>}
        </div>
        {!p.live && <span className="whitespace-nowrap text-[12.5px] text-ink-3 max-[900px]:hidden">Offline</span>}
        {p.hasSlides && <div data-tour="share" className="max-[900px]:hidden"><ShareMenu key={p.shareId ?? 'here'} deckId={p.shareId} onPdf={p.onPdf} /></div>}
        {p.hasSlides && <Button onClick={p.onPresent} title="Present in its own tab, so you can keep editing here. In it, P opens the presenter view: the next slide, your speaker notes and a timer."><Play aria-hidden className="!size-3.5" strokeWidth={2} />Present <kbd className="max-[900px]:hidden">F</kbd></Button>}
        <AccountMenu account={p.account} onTour={p.onTour} onReview={p.onReview} />
      </div>
    </header>
  )
}

/** A panel's toggle: pressed while its panel is open. */
function Toggle({ open, onClick, label, keys, children }: { open: boolean; onClick: () => void; label: string; keys?: string; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} aria-pressed={open} title={keys ? `${label} (${keys})` : label}
      className="grid size-8 cursor-pointer place-items-center rounded-lg text-ink-3 transition-colors hover:bg-panel hover:text-ink aria-pressed:bg-panel aria-pressed:text-ink">
      {children}
    </button>
  )
}

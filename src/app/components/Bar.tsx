import { useState, type ReactNode } from 'react'
import { LayoutGrid, ListOrdered, Pencil, Play, RectangleHorizontal, type LucideIcon } from 'lucide-react'
import type { Style } from '@/engine/types'
import type { Account } from '@/app/auth'
import { Button } from '@/app/components/ui/button'
import { AccountMenu } from './AccountMenu'
import { AppBar, BarDivider } from './AppBar'
import type { PageRef } from '@/engine/pages/tree'
import { PageMenu } from './PageMenu'
import type { Crumb } from './sidebar/usePageCrumbs'
import { DeckTitle } from './DeckTitle'
import { deckDownloads } from './Downloads'
import { Seg, SEG_TRACK } from './Seg'
import { ShareMenu } from './ShareMenu'
import { CommentsToggle } from './Toggle'

/** How the stage shows the deck: one slide to work on, every slide to order, or the titles to read the story. */
export type DeckView = 'slide' | 'grid' | 'story'

export interface BarProps {
  title: string; hasSlides: boolean; busy: boolean; live: boolean
  onRename: (name: string) => void
  /** Null before the deck is saved. */
  onDelete: (() => void) | null
  /** The pages above this deck, outermost first, and how to open one. */
  crumbs?: Crumb[]; onOpenPage?: (ref: PageRef) => void
  /** How many pages sit below the deck, or null when that can't be known. */
  subpages?: () => Promise<number | null>
  /** Opens the versions panel (from the deck's menu); null when the decks' store keeps none. */
  onVersions: (() => void) | null
  /** The deck's writing style, in its menu: fixed once it has slides. */
  deckStyle: Style; onStyle: (s: Style) => void
  /** The deck's file, from its menu. */
  onSource: () => void
  /** The open slide's comments; null with no slide. */
  comments: { open: boolean; count: number; onToggle: () => void } | null
  /** Edit the open slide; null with no slide or while it is being edited. */
  onEdit: (() => void) | null
  /** The view switch; null when the stage shows something else (the starter picker, edit mode). */
  view: DeckView | null; onView: (v: DeckView) => void
  onPresent: () => void
  decksOpen: boolean; onToggleDecks: () => void
  chatOpen: boolean
  /** Absent while the page has no agent panel to show (a new deck asks at its centre). */
  onToggleChat?: () => void
  /** Occam: the site, at /home. */
  onSite: () => void
  /** The deck a share link can be made for; null when decks live only in this browser, or before the deck exists. */
  shareId: string | null
  shareTarget?: 'deck' | 'doc'
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

/** Top bar: the sidebar's toggle, the deck's name, its menu and whether the models are there; the view switch in the
    middle; at the right the panels (the agent, comments), then the actions (Edit, Share, Present) and you. A doc's bar
    has the same groups in the same order. */
export function Bar(p: BarProps) {
  const [renaming, setRenaming] = useState(false)
  return (
    <AppBar sidebarOpen={p.decksOpen} onToggleSidebar={p.onToggleDecks} chat={p.onToggleChat && { open: p.chatOpen, onToggle: p.onToggleChat }}
      onSite={p.onSite} crumbs={p.crumbs} onOpenPage={p.onOpenPage}
      title={<>
        <DeckTitle name={p.title} editing={renaming} onEditing={setRenaming} onRename={p.onRename} disabled={p.busy} />
        <PageMenu noun="deck" name={p.title} busy={p.busy} onRename={() => setRenaming(true)} onDelete={p.onDelete} subpages={p.subpages}
          onVersions={p.hasSlides && p.onVersions ? p.onVersions : undefined} writing={{ value: p.deckStyle, locked: p.hasSlides, onChange: p.onStyle }}
          downloads={p.hasSlides ? deckDownloads(p.onPdf) : []} onSource={p.hasSlides ? p.onSource : undefined} />
      </>}
      badge={!p.live && <span className="whitespace-nowrap text-[12.5px] text-ink-3 max-[900px]:hidden">Offline</span>}
      center={<div data-tour="views" className="max-[900px]:hidden">{p.view && <Seg label="View" value={p.view} onChange={p.onView} options={views} className={SEG_TRACK} />}</div>}>
      {p.comments && <CommentsToggle tour="comments" keys="C" open={p.comments.open} count={p.comments.count} onClick={p.comments.onToggle} />}
      <BarDivider />
      {p.onEdit && <Button variant="outline" onClick={p.onEdit} disabled={p.busy} title="Edit this slide (E)"><Pencil aria-hidden className="!size-3.5" strokeWidth={1.75} />Edit</Button>}
      {p.hasSlides && p.shareId && <div data-tour="share" className="max-[900px]:hidden"><ShareMenu key={p.shareId ?? 'here'} target={p.shareTarget ?? 'deck'} id={p.shareId} downloads={deckDownloads(p.onPdf)} /></div>}
      {p.hasSlides && <Button onClick={p.onPresent} title="Present in its own tab, so you can keep editing here. In it, P opens the presenter view: the next slide, your speaker notes and a timer."><Play aria-hidden className="!size-3.5" strokeWidth={2} />Present <kbd className="max-[900px]:hidden">F</kbd></Button>}
      <AccountMenu account={p.account} onTour={p.onTour} onReview={p.onReview} />
    </AppBar>
  )
}

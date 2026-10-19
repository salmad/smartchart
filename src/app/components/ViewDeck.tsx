import type { ReactNode } from 'react'
import { PanelLeft, Play } from 'lucide-react'
import type { Deck } from '@/engine/types'
import type { Account } from '@/app/auth'
import { AccountMenu } from './AccountMenu'
import { Toggle } from './Bar'
import { ReadSlides } from './ReadSlides'
import { Button } from './ui/button'

interface Props {
  deck: Deck
  name: string
  ids: string[]
  sidebar: ReactNode
  sidebarOpen: boolean
  onToggleSidebar: () => void
  onPresent: (from: number) => void
  onSite: () => void
  account: Account
}

/** A deck opened by a viewer of its workspace (or, with nothing open, a quiet empty page): the slides to read and present, inside the shell, with no chat and
    nothing to edit. Live changes by its editors still arrive. */
export function ViewDeck({ deck, name, ids, sidebar, sidebarOpen, onToggleSidebar, onPresent, onSite, account }: Props) {
  return (
    <>
      <header className="flex h-14 items-center gap-3 border-b border-line pl-3 pr-4 max-[900px]:px-4">
        <div className="flex flex-none items-center gap-0.5 max-[900px]:hidden">
          <Toggle open={sidebarOpen} onClick={onToggleSidebar} label={`${sidebarOpen ? 'Hide' : 'Show'} the sidebar`} keys="⌘\\"><PanelLeft className="size-[18px]" strokeWidth={1.75} /></Toggle>
        </div>
        <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-2 text-[13px]">
          <a href="/home" onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); onSite() }} className="whitespace-nowrap font-semibold tracking-[-.01em] text-ink hover:text-ink-2">Occam</a>
          {ids.length > 0 && <><span aria-hidden className="text-ink-3">/</span><span className="truncate text-ink-2">{name}</span></>}
          <span title="You can read and present this deck. An owner of the workspace can make you an editor."
            className="ml-1 flex-none rounded-md border border-line px-1.5 py-0.5 text-[11.5px] leading-none text-ink-3">View only</span>
        </nav>
        {deck.slides.length > 0 && <Button onClick={() => onPresent(0)} title="Present in its own tab. In it, P opens the presenter view."><Play aria-hidden className="!size-3.5" strokeWidth={2} />Present</Button>}
        <AccountMenu account={account} />
      </header>
      <div className="flex h-[calc(100%-56px)] max-[900px]:h-auto">
        {sidebar}
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          {ids.length
            ? <ReadSlides deck={deck} ids={ids} onPresent={onPresent} />
            : <p className="py-24 text-center text-[13.5px] leading-[1.5] text-ink-3">Nothing here yet. You can view this workspace;<br />an editor adds decks and docs.</p>}
        </div>
      </div>
    </>
  )
}

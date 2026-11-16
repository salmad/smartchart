import type { ReactNode } from 'react'
import { Play } from 'lucide-react'
import type { Deck } from '@/engine/types'
import type { Account } from '@/app/auth'
import type { PageRef } from '@/engine/pages/tree'
import { AccountMenu } from './AccountMenu'
import { AppBar, ScreenBody } from './AppBar'
import type { Crumb } from './sidebar/usePageCrumbs'
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
  crumbs?: Crumb[]; onOpenPage?: (ref: PageRef) => void
}

/** A deck opened by a viewer of its workspace (or, with nothing open, a quiet empty page): the slides to read and present, inside the shell, with no chat and
    nothing to edit. Live changes by its editors still arrive. */
export function ViewDeck({ deck, name, ids, sidebar, sidebarOpen, onToggleSidebar, onPresent, onSite, account, crumbs, onOpenPage }: Props) {
  return (
    <>
      <AppBar sidebarOpen={sidebarOpen} onToggleSidebar={onToggleSidebar} onSite={onSite} crumbs={crumbs} onOpenPage={onOpenPage}
        title={ids.length > 0 ? <span className="truncate text-ink-2">{name}</span> : undefined}
        badge={<span title="You can read and present this deck. An owner of the workspace can make you an editor."
          className="ml-1 flex-none rounded-md border border-line px-1.5 py-0.5 text-[11.5px] leading-none text-ink-3">View only</span>}>
        {deck.slides.length > 0 && <Button onClick={() => onPresent(0)} title="Present in its own tab. In it, P opens the presenter view."><Play aria-hidden className="!size-3.5" strokeWidth={2} />Present</Button>}
        <AccountMenu account={account} />
      </AppBar>
      <ScreenBody>
        {sidebar}
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          {ids.length
            ? <ReadSlides deck={deck} ids={ids} onPresent={onPresent} />
            : <p className="py-24 text-center text-[13.5px] leading-[1.5] text-ink-3">Nothing here yet. You can view this workspace;<br />an editor adds decks and docs.</p>}
        </div>
      </ScreenBody>
    </>
  )
}

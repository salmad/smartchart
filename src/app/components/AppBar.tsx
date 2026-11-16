import type { ReactNode } from 'react'
import { PanelLeft, Sparkles } from 'lucide-react'
import type { PageRef } from '@/engine/pages/tree'
import { cn } from '@/app/lib/utils'
import { Crumbs } from './Crumbs'
import type { Crumb } from './sidebar/usePageCrumbs'
import { Toggle } from './Toggle'
import { HomeLink } from './Wordmark'

interface Props {
  sidebarOpen: boolean
  onToggleSidebar: () => void
  /** The agent's panel, on screens that have one. */
  chat?: { open: boolean; onToggle: () => void }
  /** Occam: the site, at /home. */
  onSite: () => void
  crumbs?: Crumb[]
  onOpenPage?: (ref: PageRef) => void
  /** The page's name (and its menu), after the breadcrumb; with none, the bar says only Occam. */
  title?: ReactNode
  /** A quiet word after the name ("View only"). */
  badge?: ReactNode
  /** The view switch, held in the middle of the bar. Without one the right side takes the room it needs. */
  center?: ReactNode
  /** The right side: the page's own controls, then you. */
  children: ReactNode
}

/** The bar at the top of every screen in the app: the sidebar's toggle and where you are on the left, the view switch in
    the middle, the agent's toggle and the page's controls on the right (the side its panel opens on). One height (h-bar, the `bar` spacing token); ScreenBody is what goes under it. */
export function AppBar({ sidebarOpen, onToggleSidebar, chat, onSite, crumbs, onOpenPage, title, badge, center, children }: Props) {
  return (
    <header className={cn('h-bar flex-none items-center border-b border-line pl-3 pr-4 max-[900px]:flex max-[900px]:gap-3 max-[900px]:px-4',
      center !== undefined ? 'grid grid-cols-[1fr_auto_1fr] gap-6' : 'flex gap-3')}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {/* Each panel's toggle sits on its side: the sidebar's here, the agent's at the right. */}
        <Toggle open={sidebarOpen} onClick={onToggleSidebar} label={`${sidebarOpen ? 'Hide' : 'Show'} the sidebar`} keys="⌘\\"><PanelLeft className="size-[18px]" strokeWidth={1.75} /></Toggle>
        <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-2 text-[13px]">
          <HomeLink onSite={onSite} />
          {title !== undefined && (
            <>
              <span aria-hidden className="text-ink-3">/</span>
              <Crumbs crumbs={crumbs} onOpen={(r) => onOpenPage?.(r)} />
              {title}
            </>
          )}
          {badge}
        </nav>
      </div>
      {center}
      <div className="flex min-w-0 items-center justify-end gap-2.5 max-[900px]:gap-2">
        {chat && <Toggle open={chat.open} onClick={chat.onToggle} label={`${chat.open ? 'Hide' : 'Show'} the agent`} keys="⌘L"><Sparkles className="size-[17px]" strokeWidth={1.75} /></Toggle>}
        {children}
      </div>
    </header>
  )
}

/** What sits under the bar: the sidebar, the page and its panels in a row, filling the height the bar leaves. In a
    narrow window it stacks and the page scrolls as one. */
export function ScreenBody({ children }: { children: ReactNode }) {
  return <div className="flex h-[calc(100%-theme(spacing.bar))] min-h-0 max-[900px]:h-auto max-[900px]:flex-col">{children}</div>
}

/** Between a bar's groups: the panel toggles on one side, the page's actions on the other. */
export function BarDivider() {
  return <span aria-hidden className="mx-0.5 h-4 w-px flex-none bg-line-2 max-[900px]:hidden" />
}

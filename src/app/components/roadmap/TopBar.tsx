import type { ReactNode } from 'react'
import { ChartGantt, Grid2x2, List, ListChecks, Plus, type LucideIcon } from 'lucide-react'
import type { Account } from '@/app/auth'
import type { PageRef } from '@/engine/pages/tree'
import type { ViewSettings } from '@/engine/roadmaps/view'
import { AccountMenu } from '../AccountMenu'
import { AppBar } from '../AppBar'
import { Seg, SEG_TRACK } from '../Seg'
import type { Crumb } from '../sidebar/usePageCrumbs'
import { Button } from '../ui/button'

type Layout = ViewSettings['layout']

const VIEWS: [Layout, string, LucideIcon][] = [['table', 'List', List], ['gantt', 'Gantt', ChartGantt], ['matrix', 'Matrix', Grid2x2], ['checks', 'Checks', ListChecks]]

interface Props {
  title: string
  account: Account
  sidebarOpen: boolean
  onToggleSidebar: () => void
  /** Occam: the site, at /home. */
  onSite: () => void
  crumbs?: Crumb[]
  onOpenPage?: (ref: PageRef) => void
  /** The view switch; null until the roadmap has loaded. */
  layout: Layout | null
  onLayout: (layout: Layout) => void
  /** Issues with something wrong, shown beside Checks; nothing at zero. */
  alarms: number
  /** Absent for a viewer who cannot edit. */
  onNewIssue?: () => void
}

/** The roadmap's bar, on the deck bar's grid: sidebar toggle and breadcrumb, the view switch in the middle, New issue and you. */
export function TopBar(p: Props) {
  // Icon and word, as the deck's view switch; below 1200px the word steps back to the tooltip and the screen reader.
  const views = VIEWS.map(([v, label, Icon]): [Layout, ReactNode] => [v, (
    <span key={v} title={label} className="flex items-center gap-1.5">
      <Icon aria-hidden className="size-4" strokeWidth={1.75} /><span className="max-[1200px]:sr-only">{label}</span>
      {v === 'checks' && p.alarms > 0 && (
        <span className="text-[11px] tabular-nums text-ink-3">{p.alarms}<span className="sr-only"> need attention</span></span>
      )}
    </span>
  )])
  return (
    <AppBar sidebarOpen={p.sidebarOpen} onToggleSidebar={p.onToggleSidebar} onSite={p.onSite} crumbs={p.crumbs} onOpenPage={p.onOpenPage}
      title={<span className="truncate text-ink-2" title={p.title}>{p.title}</span>}
      center={<nav aria-label="Roadmap views">{p.layout && <Seg label="View" value={p.layout} onChange={p.onLayout} options={views} className={SEG_TRACK} />}</nav>}>
      {p.layout && p.onNewIssue && (
        <Button onClick={p.onNewIssue}><Plus aria-hidden className="!size-3.5" strokeWidth={2} />New issue <kbd className="max-[900px]:hidden">C</kbd></Button>
      )}
      <AccountMenu account={p.account} />
    </AppBar>
  )
}

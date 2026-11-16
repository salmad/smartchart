import type { ReactNode } from 'react'
import { ChartGantt, Grid2x2, ListChecks, PanelLeft, Plus, Table2, type LucideIcon } from 'lucide-react'
import type { Account } from '@/app/auth'
import type { PageRef } from '@/engine/pages/tree'
import type { ViewSettings } from '@/engine/roadmaps/view'
import { AccountMenu } from '../AccountMenu'
import { Toggle } from '../Bar'
import { Crumbs } from '../Crumbs'
import { Seg } from '../LookPanel'
import type { Crumb } from '../sidebar/usePageCrumbs'
import { Button } from '../ui/button'
import { segTrack } from './roadmapChrome'

type Layout = ViewSettings['layout']

const VIEWS: [Layout, string, LucideIcon][] = [['table', 'Table', Table2], ['gantt', 'Gantt', ChartGantt], ['matrix', 'Matrix', Grid2x2], ['checks', 'Checks', ListChecks]]

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
    <header className="grid h-14 flex-none grid-cols-[1fr_auto_1fr] items-center gap-6 border-b border-line pl-3 pr-4 max-[900px]:gap-3 max-[900px]:px-4">
      <div className="flex min-w-0 items-center gap-3">
        <Toggle open={p.sidebarOpen} onClick={p.onToggleSidebar} label={`${p.sidebarOpen ? 'Hide' : 'Show'} the sidebar`} keys="⌘\\"><PanelLeft className="size-[18px]" strokeWidth={1.75} /></Toggle>
        <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-2 text-[13px]">
          <a href="/home" onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); p.onSite() }} className="whitespace-nowrap font-semibold tracking-[-.01em] text-ink hover:text-ink-2">Occam</a>
          <span aria-hidden className="text-ink-3">/</span>
          <Crumbs crumbs={p.crumbs} onOpen={(r) => p.onOpenPage?.(r)} />
          <span className="truncate text-ink-2" title={p.title}>{p.title}</span>
        </nav>
      </div>
      <nav aria-label="Roadmap views">
        {p.layout && <Seg label="View" value={p.layout} onChange={p.onLayout} options={views} className={segTrack} />}
      </nav>
      <div className="flex items-center justify-end gap-2.5 max-[900px]:gap-2">
        {p.layout && p.onNewIssue && (
          <Button onClick={p.onNewIssue}><Plus aria-hidden className="!size-3.5" strokeWidth={2} />New issue <kbd className="max-[900px]:hidden">C</kbd></Button>
        )}
        <AccountMenu account={p.account} />
      </div>
    </header>
  )
}

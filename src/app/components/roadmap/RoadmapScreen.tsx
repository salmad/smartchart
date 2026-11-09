import { PanelLeft } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import type { Account } from '@/app/auth'
import type { RoadmapRepo } from '@/app/roadmaps'
import type { PageRef } from '@/engine/pages/tree'
import { AccountMenu } from '../AccountMenu'
import { Toggle } from '../Bar'
import { Crumbs } from '../Crumbs'
import type { Crumb } from '../sidebar/usePageCrumbs'
import { useRoadmap } from './useRoadmap'
import { FieldsEditor } from './FieldsEditor'
import { TopBar } from './TopBar'
import { FilterBar } from './FilterBar'
import { IssueTable } from './IssueTable'
import { useViewSettings } from './useViewSettings'

const EMPTY = 'No issues yet. Press C or New issue to add the first.'

interface Props {
  id: string
  issue?: string
  repo: RoadmapRepo
  account: Account
  workspace: string | null
  canEdit: boolean
  sidebar: ReactNode
  sidebarOpen: boolean
  onToggleSidebar: () => void
  onSite: () => void
  crumbs?: Crumb[]
  onOpenPage?: (ref: PageRef) => void
  name?: string
}

/** A roadmap in the workspace shell: sidebar, bar, filters and the issue table. */
export function RoadmapScreen({ id, repo, account, canEdit, sidebar, sidebarOpen, onToggleSidebar, onSite, crumbs, onOpenPage, name }: Props) {
  const { view, act } = useRoadmap(repo, id, account.id)
  const [viewSettings, setViewSettings] = useViewSettings(id)
  const [fieldsOpen, setFieldsOpen] = useState(false)
  const title = view.state?.roadmap.name ?? name ?? ''
  const customFields = view.state?.roadmap.fields ?? []
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const liveCount = view.state?.issues.filter((i) => i.deletedAt === null).length ?? 0
  const hasIssues = liveCount > 0
  const showTable = hasIssues || customFields.length > 0

  return (
    <div className="flex h-full flex-col bg-app-bg">
      <header className="flex h-14 items-center gap-3 border-b border-line pl-3 pr-4 max-[900px]:px-4">
        <div className="flex flex-none items-center gap-0.5">
          <Toggle open={sidebarOpen} onClick={onToggleSidebar} label={`${sidebarOpen ? 'Hide' : 'Show'} the sidebar`} keys="⌘\\"><PanelLeft className="size-[18px]" strokeWidth={1.75} /></Toggle>
        </div>
        <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-2 text-[13px]">
          <a href="/home" onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); onSite() }} className="whitespace-nowrap font-semibold tracking-[-.01em] text-ink hover:text-ink-2">Occam</a>
          <span aria-hidden className="text-ink-3">/</span>
          <Crumbs crumbs={crumbs} onOpen={(r) => onOpenPage?.(r)} />
          <span className="truncate text-ink-2">{title}</span>
        </nav>
        {view.state && (
          <TopBar canEdit={canEdit} fields={customFields} view={viewSettings} onView={setViewSettings} onFields={() => setFieldsOpen(true)} />
        )}
        <AccountMenu account={account} />
      </header>
      <div className="flex h-[calc(100%-56px)] min-h-0 max-[900px]:h-auto max-[900px]:flex-col">
        {sidebar}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-app-bg">
          {view.error && <p className="px-8 py-10 text-[13.5px] text-ink-2">{view.error}</p>}
          {!view.error && !view.state && <p className="px-8 py-10 text-[13.5px] text-ink-2">Opening the roadmap…</p>}
          {view.state && showTable && (
            <>
              {hasIssues && <FilterBar fields={customFields} view={viewSettings} issueCount={liveCount} onChange={setViewSettings} />}
              <IssueTable state={view.state} view={viewSettings} members={view.members} today={today} onView={setViewSettings} />
            </>
          )}
          {view.state && !showTable && (
            <p className="px-8 py-10 text-[13.5px] text-ink-2">{EMPTY}</p>
          )}
        </main>
      </div>
      {view.state && canEdit && (
        <FieldsEditor
          open={fieldsOpen}
          onClose={() => setFieldsOpen(false)}
          fields={customFields}
          issues={view.state.issues}
          act={act}
          refused={view.said}
        />
      )}
    </div>
  )
}

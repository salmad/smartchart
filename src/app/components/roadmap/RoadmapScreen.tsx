import { PanelLeft } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Account } from '@/app/auth'
import type { RoadmapRepo } from '@/app/roadmaps'
import type { PageRef } from '@/engine/pages/tree'
import type { Theme } from '@/engine/types'
import { go } from '@/app/route'
import { DEV_ACCOUNT } from '@/app/dev-account'
import { useUserLook } from '@/app/useUserLook'
import { AccountMenu } from '../AccountMenu'
import { Toggle } from '../Bar'
import { Crumbs } from '../Crumbs'
import type { Crumb } from '../sidebar/usePageCrumbs'
import { useRoadmap } from './useRoadmap'
import { FieldsEditor } from './FieldsEditor'
import { TopBar, ViewTabs } from './TopBar'
import { FilterBar } from './FilterBar'
import { IssueTable } from './IssueTable'
import { Gantt } from './Gantt'
import { Matrix } from './Matrix'
import { Checks } from './Checks'
import { useViewSettings } from './useViewSettings'
import { runChecks, type CheckId } from '@/engine/roadmaps/checks'
import { liveChips } from '@/engine/roadmaps/view'
import { IssuePanel } from './IssuePanel'
import { IssuePage } from './IssuePage'
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
export function RoadmapScreen({ id, issue: routeIssue, repo, account, canEdit, sidebar, sidebarOpen, onToggleSidebar, onSite, crumbs, onOpenPage, name }: Props) {
  const { view, act } = useRoadmap(repo, id, account.id)
  const { look } = useUserLook(account.id, account.id !== DEV_ACCOUNT.id)
  const [viewSettings, setViewSettings] = useViewSettings(id)
  const [fieldsOpen, setFieldsOpen] = useState(false)
  const [panelId, setPanelId] = useState<string | null>(null)
  const [todayRequest, setTodayRequest] = useState(0)
  const title = view.state?.roadmap.name ?? name ?? ''
  const customFields = view.state?.roadmap.fields ?? []
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const liveCount = view.state?.issues.filter((i) => i.deletedAt === null).length ?? 0
  const hasIssues = liveCount > 0
  // New issue bumps this; the table opens a compose row at the end for each bump (and shows itself to do it).
  const [newIssue, setNewIssue] = useState(0)
  const live = view.state?.issues.filter((i) => i.deletedAt === null) ?? []
  const isChecks = viewSettings.layout === 'checks'
  const isMatrix = viewSettings.layout === 'matrix'
  const isGantt = viewSettings.layout === 'gantt'
  const showTable = hasIssues || customFields.length > 0 || newIssue > 0
  // Matrix/Gantt need setup UI even before issues or extra fields exist.
  const showMain = showTable || isChecks || isMatrix || isGantt

  const checkReport = useMemo(() => {
    const chips = liveChips(customFields, viewSettings.chips)
    return runChecks(live, { today, chips })
  }, [customFields, live, today, viewSettings.chips])

  const openCheck = useCallback(
    (id: CheckId) => {
      setViewSettings((v) => {
        const chips = v.chips.filter((c) => c.on !== 'check')
        return { ...v, layout: 'table', chips: [...chips, { on: 'check', id }] }
      })
    },
    [setViewSettings],
  )
  const knownFields = useRef<Set<string>>(new Set())
  const fieldsPrimed = useRef(false)

  useEffect(() => {
    if (routeIssue) setPanelId(null)
  }, [routeIssue])

  const openIssue = useCallback((issueId: string) => {
    if (routeIssue) go(`/r/${id}/${issueId}`)
    else setPanelId(issueId)
  }, [id, routeIssue])

  const openId = routeIssue ?? panelId
  const openIssueRow = openId ? live.find((i) => i.id === openId) ?? null : null
  // The roadmap's chrome is dark whatever the user's Look, so an issue's body draws on Ink (Paper's dark type would vanish on it).
  const lookProps: { theme: Theme; accent?: string } = { theme: 'ink', accent: look.accent ?? undefined }

  useEffect(() => {
    const ids = new Set(customFields.map((f) => f.id))
    if (!fieldsPrimed.current) {
      knownFields.current = ids
      fieldsPrimed.current = true
      return
    }
    const added = [...ids].filter((id) => !knownFields.current.has(id))
    knownFields.current = ids
    if (!added.length) return
    setViewSettings((v) => {
      const next = added.filter((id) => !v.columns.includes(id))
      return next.length ? { ...v, columns: [...v.columns, ...next] } : v
    })
  }, [customFields, setViewSettings])

  return (
    <div className="flex h-full flex-col bg-app-bg">
      <header className="flex h-14 items-center gap-3 border-b border-line pl-3 pr-4 max-[900px]:px-4">
        <div className="flex flex-none items-center gap-0.5">
          <Toggle open={sidebarOpen} onClick={onToggleSidebar} label={`${sidebarOpen ? 'Hide' : 'Show'} the sidebar`} keys="⌘\\"><PanelLeft className="size-[18px]" strokeWidth={1.75} /></Toggle>
        </div>
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-[13px]">
          <a href="/home" onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); onSite() }} className="whitespace-nowrap font-semibold tracking-[-.01em] text-ink hover:text-ink-2">Occam</a>
          <span aria-hidden className="text-ink-3">/</span>
          <Crumbs crumbs={crumbs} onOpen={(r) => onOpenPage?.(r)} />
          <span className="truncate text-ink-2">{title}</span>
        </nav>
        {view.state && <ViewTabs view={viewSettings} checksBadge={checkReport.issues} onView={setViewSettings} />}
        <div className="min-w-0 flex-1" />
        {view.state && (
          <TopBar
            canEdit={canEdit}
            fields={customFields}
            view={viewSettings}
            onView={setViewSettings}
            onFields={() => setFieldsOpen(true)}
            onNewIssue={() => {
              setPanelId(null)
              // Only the table and the Gantt have a place to type a title; Matrix and Checks hand over to the table.
              if (isMatrix || isChecks) setViewSettings((v) => ({ ...v, layout: 'table' }))
              setNewIssue((n) => n + 1)
            }}
            onToday={() => setTodayRequest((n) => n + 1)}
          />
        )}
        <AccountMenu account={account} />
      </header>
      <div className="flex h-[calc(100%-56px)] min-h-0 max-[900px]:h-auto max-[900px]:flex-col">
        {sidebar}
        <main className="flex min-h-0 min-w-0 flex-1 overflow-hidden bg-app-bg">
          {view.error && <p className="px-8 py-10 text-[13.5px] text-ink-2">{view.error}</p>}
          {!view.error && !view.state && <p className="px-8 py-10 text-[13.5px] text-ink-2">Opening the roadmap…</p>}
          {view.state && routeIssue && openIssueRow && (
            <IssuePage
              roadmapId={id}
              issue={openIssueRow}
              roadmap={view.state.roadmap}
              fields={customFields}
              issues={live}
              members={view.members}
              canEdit={canEdit}
              act={act}
              repo={repo}
              look={lookProps}
              said={view.said}
              onBack={() => go(`/r/${id}`)}
              onOpenIssue={openIssue}
            />
          )}
          {view.state && !routeIssue && showMain && (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              {hasIssues && (
                <FilterBar
                  fields={customFields}
                  members={view.members}
                  today={today}
                  view={viewSettings}
                  issueCount={liveCount}
                  onChange={setViewSettings}
                />
              )}
              {viewSettings.layout === 'table' ? (
                <IssueTable
                  state={view.state}
                  view={viewSettings}
                  members={view.members}
                  today={today}
                  onView={setViewSettings}
                  canEdit={canEdit}
                  act={act}
                  said={view.said}
                  onOpenIssue={openIssue}
                  newIssue={newIssue}
                />
              ) : viewSettings.layout === 'gantt' ? (
                <Gantt
                  state={view.state}
                  members={view.members}
                  view={viewSettings}
                  today={today}
                  onView={setViewSettings}
                  canEdit={canEdit}
                  act={act}
                  onOpenIssue={openIssue}
                  todayRequest={todayRequest}
                  said={view.said}
                  newIssue={newIssue}
                />
              ) : viewSettings.layout === 'checks' ? (
                <Checks report={checkReport} hasIssues={hasIssues} onOpen={openCheck} />
              ) : (
                <Matrix
                  state={view.state}
                  view={viewSettings}
                  members={view.members}
                  today={today}
                  canEdit={canEdit}
                  onView={setViewSettings}
                  onOpenIssue={openIssue}
                  onOpenFields={() => setFieldsOpen(true)}
                />
              )}
            </div>
          )}
          {view.state && !routeIssue && panelId && openIssueRow && (
            <IssuePanel
              roadmapId={id}
              issue={openIssueRow}
              roadmap={view.state.roadmap}
              fields={customFields}
              issues={live}
              members={view.members}
              canEdit={canEdit}
              act={act}
              repo={repo}
              look={lookProps}
              onClose={() => setPanelId(null)}
              onFullPage={() => go(`/r/${id}/${panelId}`)}
              onOpenIssue={openIssue}
            />
          )}
          {view.state && !routeIssue && !showMain && (
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

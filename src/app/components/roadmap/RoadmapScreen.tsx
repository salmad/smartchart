import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Account } from '@/app/auth'
import type { RoadmapRepo } from '@/app/roadmaps'
import type { PageRef } from '@/engine/pages/tree'
import type { Theme } from '@/engine/types'
import { go } from '@/app/route'
import { DEV_ACCOUNT } from '@/app/dev-account'
import { useUserLook } from '@/app/useUserLook'
import { ScreenBody } from '../AppBar'
import type { Crumb } from '../sidebar/usePageCrumbs'
import { useRoadmap } from './useRoadmap'
import { FieldsEditor } from './FieldsEditor'
import { TopBar } from './TopBar'
import { FilterBar } from './FilterBar'
import { IssueTable } from './IssueTable'
import { Gantt } from './Gantt'
import { Matrix } from './Matrix'
import { Checks } from './Checks'
import { useViewSettings } from './useViewSettings'
import { runChecks, type CheckId } from '@/engine/roadmaps/checks'
import { liveChips, matchesChips } from '@/engine/roadmaps/view'
import { buildIndex } from '@/engine/roadmaps/index'
import { IssuePanel } from './IssuePanel'
import { EmptyRoadmap } from './EmptyRoadmap'
import { IssuePage } from './IssuePage'

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

/** A roadmap in the workspace shell: the bar, the sidebar, one toolbar row, then the chosen view and the issue panel. */
export function RoadmapScreen({ id, issue: routeIssue, repo, account, canEdit, sidebar, sidebarOpen, onToggleSidebar, onSite, crumbs, onOpenPage, name }: Props) {
  const { view, act } = useRoadmap(repo, id, account.id)
  const { look } = useUserLook(account.id, account.id !== DEV_ACCOUNT.id)
  const [viewSettings, setViewSettings] = useViewSettings(id)
  const [fieldsOpen, setFieldsOpen] = useState(false)
  const [panelId, setPanelId] = useState<string | null>(null)
  const [todayRequest, setTodayRequest] = useState(0)
  const title = view.state?.roadmap.name ?? name ?? ''
  const customFields = useMemo(() => view.state?.roadmap.fields ?? [], [view.state?.roadmap.fields])
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  // New issue bumps this; the table opens a compose row at the end for each bump (and shows itself to do it).
  const [newIssue, setNewIssue] = useState(0)
  const live = useMemo(() => view.state?.issues.filter((i) => i.deletedAt === null) ?? [], [view.state?.issues])
  const hasIssues = live.length > 0
  const isChecks = viewSettings.layout === 'checks'
  const isMatrix = viewSettings.layout === 'matrix'
  const showTable = hasIssues || customFields.length > 0 || newIssue > 0
  // The matrix needs its setup (which fields are the axes) before any issue exists; an empty Gantt is a blank grid, so
  // it shows the empty state, and New issue there opens its own row to type in.
  const showMain = showTable || isChecks || isMatrix

  const matchCount = useMemo(() => {
    const chips = liveChips(customFields, viewSettings.chips)
    if (!chips.length) return undefined
    const idx = buildIndex(live)
    return live.filter((i) => matchesChips(i, chips, today, idx)).length
  }, [customFields, live, today, viewSettings.chips])

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

  const startIssue = useCallback(() => {
    setPanelId(null)
    // Only the table and the Gantt have a place to type a title; Matrix and Checks hand over to the table.
    setViewSettings((v) => (v.layout === 'matrix' || v.layout === 'checks' ? { ...v, layout: 'table' } : v))
    setNewIssue((n) => n + 1)
  }, [setViewSettings])
  const onNewIssue = canEdit ? startIssue : undefined

  // C starts the first issue from the empty roadmap; once a view is up it owns its own keys.
  const emptyKeys = canEdit && Boolean(view.state) && !routeIssue && !showMain && !fieldsOpen
  useEffect(() => {
    if (!emptyKeys) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'c' || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"]')) return
      e.preventDefault()
      startIssue()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [emptyKeys, startIssue])

  return (
    <div className="flex h-full flex-col bg-app-bg">
      <TopBar
        title={title}
        account={account}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={onToggleSidebar}
        onSite={onSite}
        crumbs={crumbs}
        onOpenPage={onOpenPage}
        layout={view.state ? viewSettings.layout : null}
        onLayout={(layout) => setViewSettings((v) => ({ ...v, layout }))}
        alarms={checkReport.alarms}
        onNewIssue={onNewIssue}
      />
      <ScreenBody>
        {sidebar}
        <main className="flex min-h-0 min-w-0 flex-1 overflow-hidden bg-app-bg">
          {view.error && <p role="alert" className="m-auto max-w-sm px-8 text-center text-[13px] leading-[1.5] text-ink-2">{view.error}</p>}
          {!view.error && !view.state && <p className="m-auto text-[13px] text-ink-3">Opening the roadmap…</p>}
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
          {view.state && !routeIssue && (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <FilterBar
                fields={customFields}
                members={view.members}
                today={today}
                view={viewSettings}
                issueCount={live.length}
                matchCount={matchCount}
                onChange={setViewSettings}
                onToday={() => setTodayRequest((n) => n + 1)}
                settings={canEdit ? { open: fieldsOpen, onOpen: () => setFieldsOpen(true) } : undefined}
              />
              <div key={showMain ? viewSettings.layout : 'empty'} className="flex min-h-0 min-w-0 flex-1 flex-col animate-in fade-in-0 duration-200">
              {!showMain ? (
                <EmptyRoadmap onNewIssue={onNewIssue} />
              ) : viewSettings.layout === 'table' ? (
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
        </main>
      </ScreenBody>
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

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Settings2 } from 'lucide-react'
import type { MemberLite, RoadmapState } from '@/engine/roadmaps/types'
import type { RoadmapOp } from '@/engine/roadmaps/ops'
import { currentSprint, sprintAt } from '@/engine/roadmaps/sprints'
import { sprintRows, type SprintRow } from '@/engine/roadmaps/sprintView'
import { toggleFolded, viewFilters, type ViewSettings } from '@/engine/roadmaps/view'
import { cn } from '@/app/lib/utils'
import { GroupHeader } from './GroupLabel'
import { IssueKey } from './issueParts'
import { StatusPick } from './PropertyPick'
import { SprintAddTasks } from './SprintAddTasks'
import { SprintRhythm } from './SprintRhythm'
import { ToolButton } from './ToolButton'
import { shortDate, sprintHeading } from './dates'

interface Props {
  state: RoadmapState
  view: ViewSettings
  members: MemberLite[]
  /** The signed-in person: their group comes first. */
  me: string
  today: string
  canEdit: boolean
  act: (op: RoadmapOp) => 'ok' | string
  onView: (v: ViewSettings | ((prev: ViewSettings) => ViewSettings)) => void
  onOpenIssue: (id: string) => void
}

/** The sprint's open tasks as a list under the people doing them, yours first. Opens on the current sprint; the arrows look one
    sprint back or ahead, and the view forgets where they were when it closes. */
export function SprintView({ state, view, members, me, today, canEdit, act, onView, onOpenIssue }: Props) {
  const { roadmap } = state
  const rhythm = roadmap.sprints
  const [offset, setOffset] = useState(0)
  const names = useMemo(() => new Map(members.map((m) => [m.id, m.name])), [members])
  const filters = useMemo(() => viewFilters(roadmap.fields, view), [roadmap.fields, view])
  // Before the first day there is no current sprint: the view opens on Sprint 1.
  const base = rhythm ? currentSprint(rhythm, today)?.n ?? 1 : 1
  const sprint = rhythm ? sprintAt(rhythm, Math.max(1, base + offset)) : null
  const rows = useMemo(
    () => (sprint ? sprintRows(state, sprint, { me, today, filters, folded: view.folded, names }) : []),
    [state, sprint, me, today, filters, view.folded, names],
  )
  const saveRhythm = (r: { start: string; weeks: number }) => act({ op: 'roadmap', sprints: r })

  if (!rhythm || !sprint) {
    return (
      <section role="region" aria-label="Sprint" className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
        <p className="text-[13px] text-ink-2">Sprints aren't set up for this roadmap.</p>
        {canEdit && (
          <SprintRhythm rhythm={null} today={today} onSave={saveRhythm}>
            <ToolButton>Set up sprints</ToolButton>
          </SprintRhythm>
        )}
      </section>
    )
  }

  const groupKeys = rows.filter((r): r is Extract<SprintRow, { kind: 'group' }> => r.kind === 'group').map((r) => r.key)
  const onToggle = (key: string, all: boolean) => onView((v) => ({ ...v, folded: toggleFolded(v.folded, key, groupKeys, all) }))

  return (
    <section role="region" aria-label="Sprint" className="min-h-0 min-w-0 flex-1 overflow-auto">
      <div className="mx-auto w-full max-w-[860px] px-4 pb-10 pt-6">
        <header className="flex h-8 items-center gap-1 px-1.5">
          <h2 className="min-w-0 flex-1 truncate text-[15px] font-medium tracking-[-.01em] text-ink" aria-live="polite">{sprintHeading(sprint, today)}</h2>
          {canEdit && sprint.end >= today && <SprintAddTasks state={state} sprint={sprint} act={act} />}
          <ToolButton className="px-1.5" aria-label="Previous sprint" disabled={sprint.n <= 1} onClick={() => setOffset((o) => o - 1)}>
            <ChevronLeft strokeWidth={1.75} aria-hidden />
          </ToolButton>
          <ToolButton className="px-1.5" aria-label="Next sprint" onClick={() => setOffset((o) => o + 1)}>
            <ChevronRight strokeWidth={1.75} aria-hidden />
          </ToolButton>
          {canEdit && (
            <SprintRhythm rhythm={rhythm} today={today} onSave={saveRhythm}>
              <ToolButton className="px-1.5" aria-label="Sprint rhythm"><Settings2 strokeWidth={1.75} aria-hidden /></ToolButton>
            </SprintRhythm>
          )}
        </header>
        {rows.length === 0 ? (
          <p className="px-1.5 pt-6 text-[13px] text-ink-3">Nothing left in Sprint {sprint.n}.</p>
        ) : (
          <div className="mt-4" role="list">
            {rows.map((row) =>
              row.kind === 'group' ? (
                <div key={row.key} role="listitem" className="flex h-9 cursor-default items-center border-b border-hair" onClick={(e) => onToggle(row.key, e.altKey)}>
                  <GroupHeader label={row.label} count={row.count} person={row.assignee !== null} open={row.open} depth={0} onToggle={(all) => onToggle(row.key, all)} />
                </div>
              ) : (
                <div
                  key={row.key}
                  role="listitem"
                  data-issue-id={row.issue.id}
                  className="group flex h-[35px] cursor-pointer items-center gap-2 border-b border-hair pl-6 pr-1.5 text-[13px] text-ink transition-colors duration-120 hover:bg-hair"
                  onClick={(e) => { if (!(e.target as HTMLElement).closest('[data-skip-open]')) onOpenIssue(row.issue.id) }}
                >
                  <span data-skip-open className="flex-none">
                    <StatusPick status={row.issue.status} disabled={!canEdit} onPick={(status) => { act({ op: 'set', ids: [row.issue.id], props: { status } }) }} />
                  </span>
                  <IssueKey roadmap={roadmap} issue={row.issue} />
                  <button
                    type="button"
                    title={row.issue.title}
                    className="min-w-0 truncate rounded text-left outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    onClick={(e) => { e.stopPropagation(); onOpenIssue(row.issue.id) }}
                  >
                    {row.issue.title}
                  </button>
                  {row.parentTitle && <span className="min-w-0 flex-1 truncate text-ink-3" title={row.parentTitle}>{row.parentTitle}</span>}
                  {!row.parentTitle && <span className="flex-1" />}
                  {row.carried && <span className="flex-none whitespace-nowrap text-[12px] text-ink-3">Carried over</span>}
                  <span className="flex-none">
                    {row.issue.due && (
                      <span className={cn('whitespace-nowrap px-1.5 tabular-nums', row.issue.due < today ? 'text-bad' : 'text-ink-2')}>{shortDate(row.issue.due, today)}</span>
                    )}
                  </span>
                </div>
              ),
            )}
          </div>
        )}
      </div>
    </section>
  )
}

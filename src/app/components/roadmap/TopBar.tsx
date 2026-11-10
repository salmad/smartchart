import type { FieldDef } from '@/engine/roadmaps/types'
import type { ViewSettings } from '@/engine/roadmaps/view'
import { Button } from '../ui/button'
import { cn } from '@/app/lib/utils'
import { DisplayMenu } from './DisplayMenu'
import { GanttControls } from './GanttControls'
import type { Scale } from '@/engine/roadmaps/gantt'

interface Props {
  canEdit: boolean
  fields: FieldDef[]
  view: ViewSettings
  checksBadge?: number
  onView: (v: ViewSettings | ((prev: ViewSettings) => ViewSettings)) => void
  onFields?: () => void
  onNewIssue?: () => void
  onToday?: () => void
}

const tabClass = (active: boolean) =>
  cn(
    'rounded-md px-2.5 py-1 text-[12.5px] font-medium transition-colors',
    active ? 'bg-raise text-ink shadow-[0_0_0_1px_theme(colors.line)]' : 'text-ink-3 hover:text-ink',
  )

/** Roadmap chrome below the crumbs: Table / Gantt tabs, Display, Fields, and New issue. */
export function TopBar({ canEdit, fields, view, checksBadge = 0, onView, onFields, onNewIssue, onToday }: Props) {
  const setLayout = (layout: ViewSettings['layout']) => onView({ ...view, layout })
  const setScale = (scale: Scale) => onView({ ...view, scale })

  return (
    <div className="flex flex-none items-center gap-2">
      <nav aria-label="Roadmap views" className="flex items-center gap-0.5 rounded-lg border border-line bg-panel p-0.5">
        <button
          type="button"
          className={tabClass(view.layout === 'table')}
          aria-pressed={view.layout === 'table'}
          onClick={() => setLayout('table')}
        >
          Table
        </button>
        <button
          type="button"
          className={tabClass(view.layout === 'gantt')}
          aria-pressed={view.layout === 'gantt'}
          onClick={() => setLayout('gantt')}
        >
          Gantt
        </button>
        <button
          type="button"
          className={tabClass(view.layout === 'matrix')}
          aria-pressed={view.layout === 'matrix'}
          onClick={() => setLayout('matrix')}
        >
          Matrix
        </button>
        <button
          type="button"
          className={cn(tabClass(view.layout === 'checks'), 'inline-flex items-center gap-1.5')}
          aria-pressed={view.layout === 'checks'}
          aria-label={checksBadge > 0 ? `Checks, ${checksBadge} issues` : 'Checks'}
          onClick={() => setLayout('checks')}
        >
          Checks
          {checksBadge > 0 && (
            <span className="rounded-full bg-bad/15 px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums text-bad">
              {checksBadge}
            </span>
          )}
        </button>
      </nav>
      {view.layout === 'gantt' && onToday && (
        <GanttControls scale={view.scale} onScale={setScale} onToday={onToday} />
      )}
      {view.layout !== 'checks' && <DisplayMenu fields={fields} view={view} onChange={onView} />}
      {canEdit && (
        <>
          <Button variant="ghost" size="sm" className="h-8 text-ink-3 hover:text-ink" onClick={onFields}>Fields</Button>
          <Button size="sm" className="h-8" onClick={onNewIssue}>New issue</Button>
        </>
      )}
    </div>
  )
}

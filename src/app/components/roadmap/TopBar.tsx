import type { ReactNode } from 'react'
import { Columns3, Plus } from 'lucide-react'
import type { FieldDef } from '@/engine/roadmaps/types'
import type { ViewSettings } from '@/engine/roadmaps/view'
import { Button } from '../ui/button'
import { Seg } from '../LookPanel'
import { DisplayMenu } from './DisplayMenu'
import { GanttControls } from './GanttControls'
import { chromeGhost, segTrack } from './roadmapChrome'
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

type Layout = ViewSettings['layout']

const LAYOUTS: Layout[] = ['table', 'gantt', 'matrix', 'checks']

/** Table / Gantt / Matrix / Checks. It sits beside the breadcrumb, so it never moves when the actions change. */
export function ViewTabs({ view, checksBadge = 0, onView }: Pick<Props, 'view' | 'checksBadge' | 'onView'>) {
  const setLayout = (layout: Layout) => onView((v) => ({ ...v, layout }))
  const label: Record<Layout, ReactNode> = {
    table: 'Table',
    gantt: 'Gantt',
    matrix: 'Matrix',
    checks: (
      <>
        Checks
        {checksBadge > 0 && (
          <span className="ml-1.5 rounded-full bg-bad/15 px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums text-bad">
            <span className="sr-only">, </span>
            {checksBadge}
            <span className="sr-only"> issues</span>
          </span>
        )}
      </>
    ),
  }
  return (
    <nav aria-label="Roadmap views" className="flex-none">
      <Seg label="View" value={view.layout} onChange={setLayout} options={LAYOUTS.map((l) => [l, label[l]])} className={segTrack} />
    </nav>
  )
}

/** The actions at the header's right edge: this view's own controls, Display, Fields, New issue. */
export function TopBar({ canEdit, fields, view, onView, onFields, onNewIssue, onToday }: Props) {
  const setScale = (scale: Scale) => onView((v) => ({ ...v, scale }))

  return (
    <div className="flex flex-none items-center gap-2">
      {view.layout === 'gantt' && onToday && (
        <GanttControls scale={view.scale} onScale={setScale} onToday={onToday} />
      )}
      {view.layout !== 'checks' && <DisplayMenu fields={fields} view={view} onChange={onView} />}
      {canEdit && (
        <>
          <Button variant="ghost" size="sm" className={`h-8 gap-1.5 ${chromeGhost}`} onClick={onFields}>
            <Columns3 className="size-[15px]" strokeWidth={1.75} aria-hidden />
            Fields
          </Button>
          <Button size="sm" className="h-8 gap-1.5" onClick={onNewIssue}>
            <Plus className="size-[15px]" strokeWidth={2} aria-hidden />
            New issue
          </Button>
        </>
      )}
    </div>
  )
}

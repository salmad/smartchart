import type { FieldDef } from '@/engine/roadmaps/types'
import type { ViewSettings } from '@/engine/roadmaps/view'
import { Button } from '../ui/button'
import { cn } from '@/app/lib/utils'
import { DisplayMenu } from './DisplayMenu'

interface Props {
  canEdit: boolean
  fields: FieldDef[]
  view: ViewSettings
  onView: (v: ViewSettings | ((prev: ViewSettings) => ViewSettings)) => void
  onFields?: () => void
  onNewIssue?: () => void
}

/** Roadmap chrome below the crumbs: one tab (Table), Display, Fields, and New issue. */
export function TopBar({ canEdit, fields, view, onView, onFields, onNewIssue }: Props) {
  return (
    <div className="flex flex-none items-center gap-2">
      <nav aria-label="Roadmap views" className="flex items-center gap-0.5 rounded-lg border border-line bg-panel p-0.5">
        <span className={cn('rounded-md px-2.5 py-1 text-[12.5px] font-medium text-ink', 'bg-raise shadow-[0_0_0_1px_theme(colors.line)]')}>Table</span>
      </nav>
      <DisplayMenu fields={fields} view={view} onChange={onView} />
      {canEdit && (
        <>
          <Button variant="ghost" size="sm" className="h-8 text-ink-3 hover:text-ink" onClick={onFields}>Fields</Button>
          <Button size="sm" className="h-8" onClick={onNewIssue}>New issue</Button>
        </>
      )}
    </div>
  )
}

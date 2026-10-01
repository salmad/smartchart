// src/app/edit/GanttMenu.tsx
/* The gantt's right-click menu: what can be done to the row or period under the pointer, and to the milestones. */
import { ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from '@/app/components/ui/context-menu'
import type { ganttFor } from '@/engine/slides/gantt'

type Gantt = ReturnType<typeof ganttFor>
type Patch = Record<string, unknown> | null
export interface GanttCtx { row: number | null; period: number | null }

export function GanttMenu({ g, ctx, write, onClosed }: { g: Gantt; ctx: GanttCtx; write: (p: Patch) => void; onClosed: () => void }) {
  const { row, period } = ctx
  const item = (label: string, p: Patch) => <ContextMenuItem key={label} disabled={!p} onSelect={() => write(p)}>{label}</ContextMenuItem>
  const line = row === null ? null : g.lines[row]
  // Below a group means below its last sub-row.
  let below = row === null ? 0 : row + 1
  while (line?.group && g.lines[below]?.level === 1) below++
  return (
    <ContextMenuContent data-edit-chrome className="min-w-48" onCloseAutoFocus={(e) => { e.preventDefault(); onClosed() }}>
      {row !== null && line && (<>
        {item('Insert workstream above', g.insertRow(row))}
        {item('Insert workstream below', g.insertRow(below))}
        {item('Add sub-row', g.addSubRow(row))}
        <ContextMenuSeparator />
        {item(line.focus ? 'Remove highlight' : 'Highlight', g.setHighlight(row, !line.focus))}
        {item('Indent', g.indent(row))}
        {item('Outdent', g.outdent(row))}
        <ContextMenuSeparator />
        {item('Delete', g.removeRow(row))}
        {line.group && item('Delete group and sub-rows', g.removeRow(row, true))}
        <ContextMenuSeparator />
      </>)}
      {period !== null && (<>
        {item('Insert period left', g.insertPeriod(period))}
        {item('Insert period right', g.insertPeriod(period + 1))}
        {item('Delete period', g.removePeriod(period))}
        <ContextMenuSeparator />
      </>)}
      {item('Add milestone', g.insertMilestone())}
      {g.milestones.map((m, i) => item(`Delete milestone ${m.label || i + 1}`, g.removeMilestone(i)))}
    </ContextMenuContent>
  )
}

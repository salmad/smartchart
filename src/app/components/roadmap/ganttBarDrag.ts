import { daysBetween, type DragMode, type Mark } from '@/engine/roadmaps/gantt'
import type { Axis } from './ganttAxis'
import { ROW_H } from './issueTableView'

export const DRAG_CLICK_PX = 3
/** A one-day bar at Quarter scale is 2 px of time: it is drawn, and grabbed, at least this wide. */
export const MIN_BAR_W = 12
const END_ZONE = 6
const MILESTONE_REACH = 8

/** A lane's drawing height (the row less its hairline) and the row's height class: the table's row height. */
export const LANE_H = ROW_H - 1
export const ROW_CLASS = 'h-9'

export function barBox(start: string, due: string, axis: Axis): { x: number; w: number } {
  return { x: axis.xOf(start), w: Math.max(MIN_BAR_W, (daysBetween(start, due) + 1) * axis.px) }
}

export function barDraggable(mark: Mark): boolean {
  return mark.kind === 'bar' || mark.kind === 'milestone' || (mark.kind === 'bracket' && mark.own)
}

export function barHitMode(x: number, start: string, due: string, axis: Axis, mark: Mark): DragMode | null {
  if (!barDraggable(mark)) return null
  if (mark.kind === 'milestone') {
    const cx = axis.xOf(mark.day) + axis.px / 2
    return Math.abs(x - cx) <= MILESTONE_REACH ? 'move' : null
  }
  const box = barBox(start, due, axis)
  const rel = x - box.x
  if (rel < 0 || rel > box.w) return null
  const zone = Math.min(END_ZONE, box.w / 3)
  if (rel <= zone) return 'start'
  if (rel >= box.w - zone) return 'end'
  return 'move'
}

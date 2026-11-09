import { daysBetween, type DragMode, type Mark } from '@/engine/roadmaps/gantt'
import type { Axis } from './ganttAxis'

export const BAR_END_ZONE = 6
export const DRAG_CLICK_PX = 3

export function barDraggable(mark: Mark): boolean {
  if (mark.kind === 'bar') return true
  if (mark.kind === 'milestone') return true
  if (mark.kind === 'bracket' && mark.own) return true
  return false
}

export function barHitMode(x: number, start: string, due: string, axis: Axis, mark: Mark): DragMode | null {
  if (!barDraggable(mark)) return null
  if (mark.kind === 'milestone') {
    const cx = axis.xOf(mark.day) + axis.px / 2
    return Math.abs(x - cx) <= 8 ? 'move' : null
  }
  const barX = axis.xOf(start)
  const barW = (daysBetween(start, due) + 1) * axis.px
  const rel = x - barX
  if (rel < 0 || rel > barW) return null
  if (rel <= BAR_END_ZONE) return 'start'
  if (rel >= barW - BAR_END_ZONE) return 'end'
  return 'move'
}

export function barLaneCursor(
  canEdit: boolean,
  mark: Mark,
  x: number | null,
  start: string | null,
  due: string | null,
  axis: Axis,
  dragging: boolean,
): string | undefined {
  if (!canEdit || !start || !due || !barDraggable(mark)) return undefined
  if (dragging) return 'grabbing'
  if (x === null) return 'grab'
  const mode = barHitMode(x, start, due, axis, mark)
  if (mode === 'start' || mode === 'end') return 'ew-resize'
  if (mode === 'move') return 'grab'
  return undefined
}

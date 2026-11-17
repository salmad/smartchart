import { useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { daysBetween, dropDates, placeLabel, type Mark } from '@/engine/roadmaps/gantt'
import type { TableRow } from '@/engine/roadmaps/view'
import { cn } from '@/app/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { shortDate } from './dates'
import type { Axis } from './ganttAxis'
import { LANE_H, barBox, barDraggable, barHitMode } from './ganttBarDrag'
import { BarMark, DragTip, GhostBar, MarkLabel, MilestoneMark, SpanMark, labelWidth } from './GanttMarks'
import type { DragPreview, useBarDrag } from './useBarDrag'
import type { useIssueDatesDrop } from './useIssueDatesDrop'

interface Props {
  row: TableRow
  /** The issue's mark, or a group's span over its rows. */
  mark: Mark
  axis: Axis
  width: number
  today: string
  canEdit: boolean
  /** The first lane sits under the header, so its drag tip opens downwards. */
  first: boolean
  barDrag: ReturnType<typeof useBarDrag>
  datesDrop: ReturnType<typeof useIssueDatesDrop>
}

/** The mark as it would be if the drag ended now. A bar squeezed to one day is a milestone. */
function dragged(mark: Mark, preview: DragPreview | null): Mark {
  if (!preview || mark.kind === 'none') return mark
  if (mark.kind === 'milestone') return { ...mark, day: preview.start }
  if (preview.start === preview.due) {
    return { kind: 'milestone', day: preview.start, done: mark.kind === 'bar' && mark.done, alert: mark.alert, overdue: mark.overdue, label: mark.label }
  }
  return { ...mark, start: preview.start, due: preview.due }
}

function spanOf(mark: Mark): { start: string; due: string } | null {
  if (mark.kind === 'none') return null
  return mark.kind === 'milestone' ? { start: mark.day, due: mark.day } : { start: mark.start, due: mark.due }
}

function boxOf(mark: Mark, axis: Axis): { x: number; w: number } | null {
  if (mark.kind === 'none') return null
  if (mark.kind === 'milestone') return { x: axis.xOf(mark.day) + axis.px / 2 - 8, w: 16 }
  return barBox(mark.start, mark.due, axis)
}

function datesText(start: string, due: string, today: string): string {
  if (start === due) return shortDate(start, today)
  const days = daysBetween(start, due) + 1
  return `${shortDate(start, today)} – ${shortDate(due, today)} · ${days} days`
}

export function GanttLane({ row, mark, axis, width, today, canEdit, first, barDrag, datesDrop }: Props) {
  const issue = row.kind === 'issue' ? row.issue : null
  const [hoverX, setHoverX] = useState<number | null>(null)

  const preview = issue && barDrag.preview?.id === issue.id ? barDrag.preview : null
  const draw = dragged(mark, preview)
  const box = boxOf(draw, axis)
  const span = spanOf(mark)
  const draggable = !!issue && barDraggable(mark)
  const schedulable = !!issue && canEdit && mark.kind === 'none'
  const mode = draggable && span && hoverX !== null ? barHitMode(hoverX, span.start, span.due, axis, mark) : null
  const lit = mode !== null || preview !== null
  const todayX = axis.xOf(today) + axis.px / 2

  const dropGhost = issue && datesDrop.ghost?.laneId === issue.id ? datesDrop.ghost : null
  const ghost = dropGhost ?? (schedulable && hoverX !== null ? dropDates(axis.dayAt(hoverX)) : null)

  const text = preview ? null : draw.kind === 'none' ? null : draw.label ?? (draw.kind === 'milestone' ? shortDate(draw.day, today) : null)
  const at = text && box ? placeLabel(box, labelWidth(text), todayX, width) : null

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!issue) return
    const el = e.currentTarget
    const x = e.clientX - el.getBoundingClientRect().left
    const hit = draggable && span ? barHitMode(x, span.start, span.due, axis, mark) : null
    if (hit && span) barDrag.handlers(issue.id, span.start, span.due, hit).onPointerDown(e.nativeEvent, el)
    else if (schedulable) barDrag.clickToSchedule(issue.id).onPointerDown(e.nativeEvent, el)
    else barDrag.clickToOpen(issue.id).onPointerDown(e.nativeEvent, el)
  }

  let graphic: ReactNode = null
  if (draw.kind === 'bar' && box) {
    graphic = <BarMark {...box} status={issue?.status ?? 'todo'} overdue={draw.overdue} lit={lit} grips={canEdit && lit} />
  } else if (draw.kind === 'bracket' && box) {
    graphic = <SpanMark {...box} own={draw.own} blocked={issue?.status === 'blocked'} lit={lit} />
  } else if (draw.kind === 'milestone') {
    graphic = <MilestoneMark cx={axis.xOf(draw.day) + axis.px / 2} status={issue?.status ?? 'todo'} lit={lit} />
  }

  return (
    <div
      data-issue={issue?.id}
      data-mark={issue || mark.kind !== 'none' ? mark.kind : undefined}
      data-done={'done' in mark && mark.done ? 'true' : undefined}
      data-alert={'alert' in mark && mark.alert ? 'true' : undefined}
      onDragOver={issue && canEdit ? datesDrop.laneOver(issue.id) : undefined}
      onDragLeave={canEdit ? datesDrop.laneLeave : undefined}
      onDrop={canEdit ? datesDrop.laneDrop : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={issue && canEdit ? (e) => setHoverX(e.clientX - e.currentTarget.getBoundingClientRect().left) : undefined}
      onPointerLeave={() => setHoverX(null)}
      className={cn(
        'relative shrink-0 grow transition-colors duration-150 ease-out group-hover/row:bg-ink/[.025]',
        preview ? 'z-[4] cursor-grabbing' : 'z-[1]',
        !preview && (mode === 'move' ? 'cursor-grab' : mode ? 'cursor-ew-resize' : issue && 'cursor-pointer'),
      )}
    >
      <svg width={width} height={LANE_H} className="pointer-events-none block overflow-visible">
        {ghost && <GhostBar {...barBox(ghost.start, ghost.due, axis)} firm={dropGhost !== null} />}
        {ghost && !dropGhost && (
          <MarkLabel x={axis.xOf(ghost.due) + axis.px + 8} side="right" alert={false}>{datesText(ghost.start, ghost.due, today)}</MarkLabel>
        )}
        {graphic && issue && span && !preview ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <g className="pointer-events-auto">{graphic}</g>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[280px] text-[12px]">
              <p className="truncate font-medium">{issue.title}</p>
              <p className="tabular-nums opacity-70">{datesText(span.start, span.due, today)}</p>
              {mark.kind !== 'none' && mark.label && <p>{mark.label}</p>}
              {mark.kind === 'bracket' && !mark.own && <p className="opacity-70">Dates come from its sub-issues</p>}
            </TooltipContent>
          </Tooltip>
        ) : graphic}
        {text && at && <MarkLabel x={at.x} side={at.side} alert={draw.kind !== 'none' && draw.alert}>{text}</MarkLabel>}
        {preview && <DragTip x={preview.x} max={width} below={first}>{datesText(preview.start, preview.due, today)}</DragTip>}
      </svg>
    </div>
  )
}

import { useCallback, useState, type DragEvent as ReactDragEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { daysBetween, type Mark } from '@/engine/roadmaps/gantt'
import type { IssueDatesGhost } from './useIssueDatesDrop'
import type { TableRow } from '@/engine/roadmaps/view'
import { cn } from '@/app/lib/utils'
import type { Axis } from './ganttAxis'
import { barDraggable, barHitMode, barLaneCursor } from './ganttBarDrag'
import type { useBarDrag } from './useBarDrag'

const H = 32

type BarDragApi = ReturnType<typeof useBarDrag>

interface LaneProps {
  row: TableRow
  mark: Mark
  axis: Axis
  width: number
  groupSpan?: { start: string; due: string } | null
  canEdit: boolean
  preview: { id: string; start: string; due: string } | null
  dragging: boolean
  barDrag: BarDragApi
  datesGhost: IssueDatesGhost | null
  onDatesOver: (e: ReactDragEvent<HTMLDivElement>) => void
  onDatesLeave: () => void
  onDatesDrop: (e: ReactDragEvent<HTMLDivElement>) => void
}

function laneDataAttrs(mark: Mark): Record<string, string | undefined> {
  if (mark.kind === 'none') return { 'data-mark': 'none' }
  if (mark.kind === 'bar') {
    return {
      'data-mark': 'bar',
      'data-done': mark.done ? 'true' : undefined,
      'data-alert': mark.alert ? 'true' : undefined,
    }
  }
  if (mark.kind === 'bracket') {
    return { 'data-mark': 'bracket', 'data-alert': mark.alert ? 'true' : undefined, 'data-own': mark.own ? 'true' : 'false' }
  }
  return {
    'data-mark': 'milestone',
    'data-done': mark.done ? 'true' : undefined,
    'data-alert': mark.alert ? 'true' : undefined,
  }
}

function bracketPath(start: string, due: string, axis: Axis, own: boolean, alert: boolean) {
  const px = axis.px
  const x1 = axis.xOf(start)
  const x2 = axis.xOf(due) + px
  const y1 = 12
  const y2 = 20
  const d = `M ${x1} ${y2} L ${x1} ${y1} L ${x2} ${y1} L ${x2} ${y2}`
  return (
    <path
      d={d}
      fill="none"
      strokeWidth={1.5}
      className={alert ? 'stroke-bad' : own ? 'stroke-ink-2' : 'stroke-ink-3'}
    />
  )
}

function markGraphic(mark: Mark, axis: Axis) {
  const px = axis.px
  if (mark.kind === 'bracket') {
    return bracketPath(mark.start, mark.due, axis, mark.own, mark.alert)
  }
  if (mark.kind === 'bar') {
    const x = axis.xOf(mark.start)
    const w = (daysBetween(mark.start, mark.due) + 1) * px
    return (
      <rect
        x={x}
        y={9}
        width={w}
        height={14}
        rx={4}
        strokeWidth={1}
        className={
          mark.done
            ? 'fill-ok/60 stroke-ink/15'
            : mark.alert
              ? 'fill-ink/10 stroke-bad'
              : 'fill-ink/10 stroke-ink/15'
        }
      />
    )
  }
  if (mark.kind === 'milestone') {
    const cx = axis.xOf(mark.day) + px / 2
    const cy = 16
    return (
      <g transform={`translate(${cx} ${cy}) rotate(45)`}>
        <rect
          x={-5.5}
          y={-5.5}
          width={11}
          height={11}
          strokeWidth={1}
          className={
            mark.done
              ? 'fill-ok stroke-ok'
              : mark.alert
                ? 'fill-ink stroke-bad'
                : 'fill-ink stroke-ink'
          }
        />
      </g>
    )
  }
  return null
}

function labelEndX(mark: Mark, axis: Axis): number {
  const px = axis.px
  if (mark.kind === 'bar') return axis.xOf(mark.due) + px
  if (mark.kind === 'bracket') return axis.xOf(mark.due) + px
  if (mark.kind === 'milestone') return axis.xOf(mark.day) + px / 2 + 8
  return 0
}

function labelFor(mark: Mark): string | null {
  if (mark.kind === 'none') return null
  if (mark.kind === 'milestone') return mark.label
  return mark.label
}

function alertMark(mark: Mark): boolean {
  return mark.kind !== 'none' && 'alert' in mark && !!mark.alert
}

function markForDraw(
  mark: Mark,
  preview: { id: string; start: string; due: string } | null,
  issueId: string | undefined,
): Mark {
  if (!preview || !issueId || preview.id !== issueId) return mark
  if (mark.kind === 'bar' || (mark.kind === 'bracket' && mark.own)) {
    if (preview.start === preview.due) {
      const lbl = (mark.kind === 'bar' || mark.kind === 'bracket') ? mark.label : ''
      return {
        kind: 'milestone',
        day: preview.start,
        done: mark.kind === 'bar' ? mark.done : false,
        alert: mark.kind === 'bar' ? mark.alert : mark.kind === 'bracket' ? mark.alert : false,
        label: lbl ?? `${preview.start}`,
      }
    }
    if (mark.kind === 'bar') {
      return { ...mark, start: preview.start, due: preview.due }
    }
    return { ...mark, start: preview.start, due: preview.due }
  }
  if (mark.kind === 'milestone') {
    return { ...mark, day: preview.start }
  }
  return mark
}

function dropGhostGraphic(start: string, due: string, axis: Axis) {
  const px = axis.px
  const x = axis.xOf(start)
  const w = (daysBetween(start, due) + 1) * px
  return (
    <rect
      x={x}
      y={9}
      width={w}
      height={14}
      rx={4}
      strokeWidth={1}
      className="fill-ink/15 stroke-ink/30 pointer-events-none"
    />
  )
}

export function GanttLane({
  row,
  mark,
  axis,
  width,
  groupSpan,
  canEdit,
  preview,
  dragging,
  barDrag,
  datesGhost,
  onDatesOver,
  onDatesLeave,
  onDatesDrop,
}: LaneProps) {
  const issueId = row.kind === 'issue' ? row.issue.id : undefined
  const issueStart = row.kind === 'issue' ? row.issue.start : null
  const issueDue = row.kind === 'issue' ? row.issue.due : null
  const [hoverX, setHoverX] = useState<number | null>(null)

  let draw: Mark = mark
  if (row.kind === 'group' && groupSpan) {
    draw = { kind: 'bracket', start: groupSpan.start, due: groupSpan.due, own: false, alert: false, label: null }
  } else if (issueId) {
    draw = markForDraw(mark, preview, issueId)
  }

  const text = labelFor(draw)
  const endX = labelEndX(draw, axis)
  const attrs = row.kind === 'issue' ? laneDataAttrs(mark) : draw.kind === 'bracket' ? { 'data-mark': 'bracket' } : {}

  const noDatesHint = mark.kind === 'none' ? 'Drag the issue here to give it dates' : undefined
  const bracketHint = mark.kind === 'bracket' && !mark.own ? 'Dates come from its sub-issues.' : undefined
  const title = noDatesHint ?? bracketHint
  const showDatesGhost = !!(issueId && datesGhost && datesGhost.laneId === issueId)
  const cursor = barLaneCursor(canEdit, mark, hoverX, issueStart, issueDue, axis, dragging && preview?.id === issueId)
  const draggable = !!(issueId && issueStart && issueDue && barDraggable(mark))

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!issueId) return
      const el = e.currentTarget
      const rect = el.getBoundingClientRect()
      const x = e.clientX - rect.left
      if (draggable) {
        const mode = barHitMode(x, issueStart!, issueDue!, axis, mark)
        if (mode) {
          barDrag.handlers(issueId, issueStart!, issueDue!, mode).onPointerDown(e.nativeEvent, el)
          return
        }
      }
      barDrag.clickToOpen(issueId).onPointerDown(e.nativeEvent, el)
    },
    [axis, barDrag, draggable, issueDue, issueId, issueStart, mark],
  )

  return (
    <div
      data-issue={issueId}
      {...attrs}
      title={title}
      onDragOver={canEdit ? onDatesOver : undefined}
      onDragLeave={canEdit ? onDatesLeave : undefined}
      onDrop={canEdit ? onDatesDrop : undefined}
      className={cn(
        'relative z-[1] h-8 border-b border-hair',
        cursor === 'grab' && 'cursor-grab',
        cursor === 'grabbing' && 'cursor-grabbing',
        cursor === 'ew-resize' && 'cursor-ew-resize',
      )}
      onPointerDown={issueId ? onPointerDown : undefined}
      onPointerMove={
        issueId && canEdit && draggable
          ? (e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              setHoverX(e.clientX - rect.left)
            }
          : undefined
      }
      onPointerLeave={draggable ? () => setHoverX(null) : undefined}
    >
      <svg width={width} height={H} className="pointer-events-none block overflow-visible">
        {showDatesGhost && dropGhostGraphic(datesGhost.start, datesGhost.due, axis)}
        {draw.kind !== 'none' && markGraphic(draw, axis)}
        {text && (
          <text
            x={endX + 6}
            y={17}
            className={alertMark(draw) ? 'fill-bad text-[11.5px]' : 'fill-ink-2 text-[11.5px]'}
          >
            {text}
          </text>
        )}
      </svg>
    </div>
  )
}

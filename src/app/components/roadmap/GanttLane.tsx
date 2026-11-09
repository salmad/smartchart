import { daysBetween, type Mark } from '@/engine/roadmaps/gantt'
import type { TableRow } from '@/engine/roadmaps/view'
import type { Axis } from './ganttAxis'

const H = 32

interface LaneProps {
  row: TableRow
  mark: Mark
  axis: Axis
  width: number
  groupSpan?: { start: string; due: string } | null
  onOpenIssue?: (id: string) => void
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
    return { 'data-mark': 'bracket', 'data-alert': mark.alert ? 'true' : undefined }
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

export function GanttLane({ row, mark, axis, width, groupSpan, onOpenIssue }: LaneProps) {
  const issueId = row.kind === 'issue' ? row.issue.id : undefined

  let draw: Mark = mark
  if (row.kind === 'group' && groupSpan) {
    draw = { kind: 'bracket', start: groupSpan.start, due: groupSpan.due, own: false, alert: false, label: null }
  }

  const text = labelFor(draw)
  const endX = labelEndX(draw, axis)
  const attrs = row.kind === 'issue' ? laneDataAttrs(mark) : draw.kind === 'bracket' ? { 'data-mark': 'bracket' } : {}

  return (
    <div
      className="relative z-[1] h-8 border-b border-hair"
      data-issue={issueId}
      {...attrs}
      onClick={issueId ? () => onOpenIssue?.(issueId) : undefined}
      role={issueId ? 'button' : undefined}
      tabIndex={issueId ? 0 : undefined}
    >
      <svg width={width} height={H} className="block overflow-visible">
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

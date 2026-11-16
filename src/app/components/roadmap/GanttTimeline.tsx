import { useMemo } from 'react'
import type { Issue } from '@/engine/roadmaps/types'
import { type Mark, type Range, type Scale, addDays, daysBetween, ticks } from '@/engine/roadmaps/gantt'
import type { TableRow } from '@/engine/roadmaps/view'
import { dateSpan } from '@/engine/roadmaps/rollup'
import { cn } from '@/app/lib/utils'
import { shortDate } from './dates'
import type { Axis } from './ganttAxis'
import { labelWidth } from './GanttMarks'

const HEAD_H = 36
const TICK_PAD = 6
/** Both layers start under the header and run to the bottom of the view, past the last row. */
const UNDER_HEAD = 'pointer-events-none absolute top-9 h-[calc(100%-36px)]'

interface Frame {
  range: Range
  scale: Scale
  today: string
  width: number
  axis: Axis
}

/** A group row's span: the earliest start and latest due of the issues in it, shown or folded away. */
export function groupMark(live: Issue[], row: Extract<TableRow, { kind: 'group' }>): Mark {
  let start: string | null = null
  let due: string | null = null
  for (const id of row.tops) {
    const span = dateSpan(live, id)
    if (span.start !== null && (start === null || span.start < start)) start = span.start
    if (span.due !== null && (due === null || span.due > due)) due = span.due
  }
  if (start === null || due === null) return { kind: 'none' }
  return { kind: 'bracket', start, due, own: false, alert: false, overdue: false, label: null }
}

/** A parent under a group spans only that group's part of its work. */
export function partMark(mark: Mark, row: Extract<TableRow, { kind: 'issue' }>): Mark {
  if (!row.part || mark.kind !== 'bracket') return mark
  const { start, due } = row.part
  return start === null || due === null ? { kind: 'none' } : { ...mark, start, due }
}

function weekendXs(range: Range, px: number): number[] {
  const out: number[] = []
  const total = daysBetween(range.from, range.to) + 1
  for (let i = 0; i < total; i++) {
    const dow = new Date(`${addDays(range.from, i)}T00:00:00Z`).getUTCDay()
    if (dow === 6) out.push(i * px)
  }
  return out
}

/** The header band: period names, and today as a gold pill on its line. A period name the pill would touch
    steps aside for it. */
export function GanttScaleRow({ range, scale, today, width, axis }: Frame) {
  const tickList = useMemo(() => ticks(range, scale, today), [range, scale, today])
  const x = axis.xOf(today) + axis.px / 2
  const label = shortDate(today, today)
  const pillW = labelWidth(label) + 14
  const pillX = Math.round(x - pillW / 2)
  const clear = (from: number, to: number) => to < pillX - 6 || from > pillX + pillW + 6

  return (
    <svg width={width} height={HEAD_H} className="block shrink-0">
      {tickList.map((t) => (
        <g key={t.iso}>
          <line x1={t.x + 0.5} x2={t.x + 0.5} y1={HEAD_H - 10} y2={HEAD_H} className="stroke-line-2" />
          {clear(t.x + TICK_PAD, t.x + TICK_PAD + labelWidth(t.label)) && (
            <text x={t.x + TICK_PAD} y={HEAD_H / 2} dominantBaseline="central" className="fill-ink-3 text-[11px] tabular-nums">
              {t.label}
            </text>
          )}
        </g>
      ))}
      <rect x={x - 1} y={0} width={2} height={HEAD_H} className="fill-none" role="separator" aria-label={label} />
      <line x1={x} x2={x} y1={HEAD_H - 8} y2={HEAD_H} className="stroke-gold" />
      <rect x={pillX} y={9} width={pillW} height={18} rx={5} className="fill-gold/15" />
      <text x={pillX + pillW / 2} y={18} dominantBaseline="central" textAnchor="middle" className="fill-gold text-[11px] font-medium tabular-nums">
        {label}
      </text>
    </svg>
  )
}

/** Behind the lanes: period boundaries as hairlines, and at Week scale the weekends, barely there. */
export function GanttGrid({ range, scale, today, width, axis, className }: Frame & { className: string }) {
  const tickList = useMemo(() => ticks(range, scale, today), [range, scale, today])
  const weekends = useMemo(() => (scale === 'week' ? weekendXs(range, axis.px) : []), [range, scale, axis.px])
  return (
    <svg width={width} className={cn(UNDER_HEAD, 'z-0', className)} aria-hidden>
      {weekends.map((x) => (
        <rect key={x} x={x} y={0} width={axis.px * 2} height="100%" className="fill-white/[.018]" />
      ))}
      {tickList.map((t) => (
        <line key={t.iso} x1={t.x + 0.5} x2={t.x + 0.5} y1={0} y2="100%" className="stroke-hair" />
      ))}
    </svg>
  )
}

/** Today, over the lanes: one thin gold line. */
export function GanttTodayRule({ today, width, axis, className }: Pick<Frame, 'today' | 'width' | 'axis'> & { className: string }) {
  const x = axis.xOf(today) + axis.px / 2
  return (
    <svg width={width} className={cn(UNDER_HEAD, 'z-[3]', className)} aria-hidden>
      <line x1={x} x2={x} y1={0} y2="100%" className="stroke-gold/70" />
    </svg>
  )
}

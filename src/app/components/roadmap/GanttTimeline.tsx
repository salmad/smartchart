import { useMemo } from 'react'
import type { Issue } from '@/engine/roadmaps/types'
import {
  type Mark,
  type Range,
  type Scale,
  type Tick,
  addDays,
  daysBetween,
  ticks,
} from '@/engine/roadmaps/gantt'
import type { TableRow } from '@/engine/roadmaps/view'
import { dateSpan } from '@/engine/roadmaps/rollup'
import { shortDate } from './dates'
import { GanttLane } from './GanttLane'
import { makeAxis, type Axis } from './ganttAxis'
import type { useBarDrag } from './useBarDrag'

type BarDragApi = ReturnType<typeof useBarDrag>

export type { Axis } from './ganttAxis'

const SCALE_H = 30

function groupSpan(live: Issue[], rows: TableRow[], at: number): { start: string; due: string } | null {
  let start: string | null = null
  let due: string | null = null
  for (let i = at + 1; i < rows.length; i++) {
    const r = rows[i]
    if (r.kind === 'group') break
    if (r.kind !== 'issue') continue
    const span = dateSpan(live, r.issue.id)
    if (span.start !== null && (start === null || span.start < start)) start = span.start
    if (span.due !== null && (due === null || span.due > due)) due = span.due
  }
  if (start === null || due === null) return null
  return { start, due }
}

function weekendRects(range: Range, axis: Axis): { x: number; w: number }[] {
  const px = axis.px
  const out: { x: number; w: number }[] = []
  const total = daysBetween(range.from, range.to) + 1
  for (let i = 0; i < total; i++) {
    const iso = addDays(range.from, i)
    const dow = new Date(`${iso}T00:00:00Z`).getUTCDay()
    if (dow === 0 || dow === 6) out.push({ x: i * px, w: px })
  }
  return out
}

export function GanttScaleRow({
  range,
  scale,
  today,
  width,
  axis,
}: {
  range: Range
  scale: Scale
  today: string
  width: number
  axis: Axis
}) {
  const tickList = useMemo(() => ticks(range, scale, today), [range, scale, today])
  const weekends = scale === 'week' ? weekendRects(range, axis) : []

  return (
    <div className="sticky top-0 z-20 h-[30px] border-b border-line bg-app-bg">
      <svg width={width} height={SCALE_H} className="block">
        {weekends.map((w, i) => (
          <rect key={i} x={w.x} y={0} width={w.w} height={SCALE_H} className="fill-panel" />
        ))}
        {tickList.map((t: Tick) => (
          <g key={t.iso}>
            <line x1={t.x} x2={t.x} y1={0} y2={SCALE_H} className="stroke-line" strokeWidth={1} />
            <text x={t.x + 6} y={19} className="fill-ink-3 text-[11px]">
              {t.label}
            </text>
          </g>
        ))}
        <TodayLine axis={axis} today={today} height={SCALE_H} />
      </svg>
    </div>
  )
}

function TodayLine({ axis, today, height, tag = true }: { axis: Axis; today: string; height: number; tag?: boolean }) {
  const x = axis.xOf(today) + axis.px / 2
  const label = shortDate(today, today)
  const tagW = label.length * 6.5 + 10
  return (
    <g>
      <line x1={x} x2={x} y1={0} y2={height} className="stroke-gold" strokeWidth={1} />
      {tag ? (
        <>
          <rect
            x={x - 1}
            y={0}
            width={2}
            height={height}
            className="fill-none pointer-events-none"
            role="separator"
            aria-label={label}
          />
          <rect x={x + 4} y={4} width={tagW} height={18} rx={4} className="fill-raise stroke-gold/40" strokeWidth={1} />
          <text x={x + 9} y={16} className="fill-gold text-[10.5px]">
            {label}
          </text>
        </>
      ) : null}
    </g>
  )
}

export function GanttTimelineGrid({
  range,
  scale,
  today,
  width,
  axis,
  height,
}: {
  range: Range
  scale: Scale
  today: string
  width: number
  axis: Axis
  height: number
}) {
  const tickList = useMemo(() => ticks(range, scale, today), [range, scale, today])
  const weekends = scale === 'week' ? weekendRects(range, axis) : []
  return (
    <svg
      width={width}
      height={height}
      className="pointer-events-none absolute inset-0 z-0"
      aria-hidden
    >
      {weekends.map((w, i) => (
        <rect key={i} x={w.x} y={0} width={w.w} height={height} className="fill-panel" />
      ))}
      {tickList.map((t) => (
        <line key={t.iso} x1={t.x} x2={t.x} y1={0} y2={height} className="stroke-line" strokeWidth={1} />
      ))}
      <TodayLine axis={axis} today={today} height={height} tag={false} />
    </svg>
  )
}

export function GanttTimelineBody({
  row,
  allRows,
  absIndex,
  live,
  markOf,
  axis,
  width,
  canEdit,
  barDrag,
}: {
  row: TableRow
  allRows: TableRow[]
  absIndex: number
  live: Issue[]
  markOf: (id: string) => Mark
  axis: Axis
  width: number
  canEdit: boolean
  barDrag: BarDragApi
}) {
  const group = row.kind === 'group' ? groupSpan(live, allRows, absIndex) : null
  const mark = row.kind === 'issue' ? markOf(row.issue.id) : { kind: 'none' as const }
  return (
    <GanttLane
      row={row}
      mark={mark}
      axis={axis}
      width={width}
      groupSpan={group}
      canEdit={canEdit}
      preview={barDrag.preview}
      dragging={barDrag.dragging}
      barDrag={barDrag}
    />
  )
}

export function useGanttLayout(range: Range, px: number) {
  const width = (daysBetween(range.from, range.to) + 1) * px
  const axis = useMemo(() => makeAxis(range, px), [range, px])
  return { width, axis }
}

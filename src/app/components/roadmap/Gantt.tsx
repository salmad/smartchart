import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Issue, RoadmapState } from '@/engine/roadmaps/types'
import type { TableRow, ViewSettings } from '@/engine/roadmaps/view'
import { tableRows } from '@/engine/roadmaps/view'
import type { RoadmapOp } from '@/engine/roadmaps/ops'
import {
  PX_PER_DAY,
  ganttRange,
  markFor,
  type Mark,
} from '@/engine/roadmaps/gantt'
import { shortDate } from './dates'
import { GANTT_ROW_H, VIRT, rowSlice, visibleRows } from './issueTableView'
import { GanttListRow } from './GanttList'
import { GanttScaleRow, GanttTimelineBody, useGanttLayout } from './GanttTimeline'
import type { Axis } from './ganttAxis'

interface Props {
  state: RoadmapState
  view: ViewSettings
  today: string
  onView: (v: ViewSettings | ((prev: ViewSettings) => ViewSettings)) => void
  canEdit: boolean
  act: (op: RoadmapOp) => 'ok' | string
  onOpenIssue?: (id: string) => void
  todayRequest: number
}

export function Gantt({ state, view, today, onView, onOpenIssue, todayRequest, canEdit: _canEdit, act: _act }: Props) {
  const live = useMemo(() => state.issues.filter((i) => i.deletedAt === null), [state.issues])
  const allRows = useMemo(() => tableRows(state, view, today), [state, view, today])
  const filtersActive = view.chips.length > 0
  const rows = useMemo(() => visibleRows(allRows, filtersActive), [allRows, filtersActive])

  const range = useMemo(() => ganttRange(live, today, view.scale), [live, today, view.scale])
  const px = PX_PER_DAY[view.scale]
  const { width, axis } = useGanttLayout(range, px)

  const marks = useMemo(() => {
    const fmt = (iso: string) => shortDate(iso, today)
    const m = new Map<string, Mark>()
    for (const issue of live) {
      m.set(issue.id, markFor(live, issue.id, today, fmt))
    }
    return m
  }, [live, today])

  const markOf = useCallback((id: string) => marks.get(id) ?? { kind: 'none' as const }, [marks])

  const onToggleCollapse = useCallback(
    (id: string) => {
      onView({
        ...view,
        collapsed: view.collapsed.includes(id) ? view.collapsed.filter((c) => c !== id) : [...view.collapsed, id],
      })
    },
    [onView, view],
  )

  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewHeight, setViewHeight] = useState(900)

  const slice = useMemo(
    () => rowSlice(rows.length, scrollTop, viewHeight, GANTT_ROW_H),
    [rows.length, scrollTop, viewHeight],
  )

  const body = rows.length > VIRT ? rows.slice(slice.start, slice.end) : rows
  const padTop = rows.length > VIRT ? slice.start * GANTT_ROW_H : 0
  const padBottom = rows.length > VIRT ? (rows.length - slice.end) * GANTT_ROW_H : 0

  const onScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setScrollTop((t) => (t === el.scrollTop ? t : el.scrollTop))
    setViewHeight((h) => (h === el.clientHeight ? h : el.clientHeight))
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    setViewHeight(el.clientHeight)
  }, [rows.length])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const todayX = axis.xOf(today) + px / 2
    el.scrollLeft = Math.max(0, todayX - el.clientWidth / 4)
  }, [axis, today, px, todayRequest])

  return (
    <section role="region" aria-label="Timeline" className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto" onScroll={onScroll}>
        <div className="grid w-max min-w-full grid-cols-[330px_1fr]">
          <div className="sticky left-0 top-0 z-30 h-[30px] border-b border-line bg-app-bg" />
          <GanttScaleRow range={range} scale={view.scale} today={today} width={width} axis={axis} />

          {padTop > 0 && <GanttPad h={padTop} width={width} />}
          {body.map((row, i) => (
            <GanttRowPair
              key={rowKey(row)}
              row={row}
              allRows={rows}
              absIndex={rows.length > VIRT ? slice.start + i : i}
              live={live}
              mark={row.kind === 'issue' ? markOf(row.issue.id) : null}
              markOf={markOf}
              axis={axis}
              width={width}
              onToggleCollapse={onToggleCollapse}
              onOpenIssue={onOpenIssue}
            />
          ))}
          {padBottom > 0 && <GanttPad h={padBottom} width={width} />}
        </div>
      </div>
    </section>
  )
}

function rowKey(row: TableRow): string {
  return row.kind === 'group' ? `g-${row.key}` : row.issue.id
}

function GanttPad({ h, width }: { h: number; width: number }) {
  return (
    <>
      <div className="sticky left-0 z-10 bg-app-bg" aria-hidden>
        <svg height={h} width={330} className="block" aria-hidden />
      </div>
      <GanttPadSvg h={h} width={width} />
    </>
  )
}

function GanttPadSvg({ h, width }: { h: number; width: number }) {
  return <svg height={h} width={width} className="block" aria-hidden />
}

function GanttRowPair({
  row,
  allRows,
  absIndex,
  live,
  mark,
  markOf,
  axis,
  width,
  onToggleCollapse,
  onOpenIssue,
}: {
  row: TableRow
  allRows: TableRow[]
  absIndex: number
  live: Issue[]
  mark: Mark | null
  markOf: (id: string) => Mark
  axis: Axis
  width: number
  onToggleCollapse: (id: string) => void
  onOpenIssue?: (id: string) => void
}) {
  return (
    <>
      <div className="sticky left-0 z-10 bg-app-bg">
        <GanttListRow
          row={row}
          mark={mark ?? { kind: 'none' }}
          onToggleCollapse={onToggleCollapse}
          onOpenIssue={onOpenIssue}
        />
      </div>
      <GanttTimelineBody
        row={row}
        allRows={allRows}
        absIndex={absIndex}
        live={live}
        markOf={markOf}
        axis={axis}
        width={width}
        onOpenIssue={onOpenIssue}
      />
    </>
  )
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RoadmapState } from '@/engine/roadmaps/types'
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
import { GanttScaleRow, GanttTimelineBody, GanttTimelineGrid, useGanttLayout } from './GanttTimeline'
import { useBarDrag } from './useBarDrag'
interface Props {
  state: RoadmapState
  view: ViewSettings
  today: string
  onView: (v: ViewSettings | ((prev: ViewSettings) => ViewSettings)) => void
  canEdit: boolean
  act: (op: RoadmapOp) => 'ok' | string
  onOpenIssue?: (id: string) => void
  todayRequest: number
  said?: string | null
}

export function Gantt({ state, view, today, onView, onOpenIssue, todayRequest, canEdit, act, said }: Props) {
  const live = useMemo(() => state.issues.filter((i) => i.deletedAt === null), [state.issues])
  const allRows = useMemo(() => tableRows(state, view, today), [state, view, today])
  const filtersActive = view.chips.length > 0
  const rows = useMemo(() => visibleRows(allRows, filtersActive), [allRows, filtersActive])

  const range = useMemo(() => ganttRange(live, today, view.scale), [live, today, view.scale])
  const px = PX_PER_DAY[view.scale]
  const { width, axis } = useGanttLayout(range, px)

  const openIssue = useCallback((id: string) => { onOpenIssue?.(id) }, [onOpenIssue])
  const barDrag = useBarDrag({ axis, canEdit, act, onOpen: openIssue })

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
  const timelineHeight = rows.length * GANTT_ROW_H

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
      {said && <p role="status" className="border-b border-line bg-panel px-4 py-2 text-[12.5px] text-ink-2">{said}</p>}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto" onScroll={onScroll}>
        <div className="grid w-max min-w-full grid-cols-[330px_1fr]">
          <div className="sticky left-0 top-0 z-30 h-[30px] border-b border-line bg-app-bg" />
          <GanttScaleRow range={range} scale={view.scale} today={today} width={width} axis={axis} />

          <div className="sticky left-0 z-10 bg-app-bg">
            {padTop > 0 && <GanttListPad h={padTop} />}
            {body.map((row) => (
              <GanttListRow
                key={rowKey(row)}
                row={row}
                mark={row.kind === 'issue' ? markOf(row.issue.id) : { kind: 'none' }}
                onToggleCollapse={onToggleCollapse}
                onOpenIssue={onOpenIssue}
              />
            ))}
            {padBottom > 0 && <GanttListPad h={padBottom} />}
          </div>

          <div className="relative">
            <GanttTimelineGrid
              range={range}
              scale={view.scale}
              today={today}
              width={width}
              axis={axis}
              height={timelineHeight}
            />
            {padTop > 0 && <GanttPadSvg h={padTop} width={width} />}
            {body.map((row, i) => (
              <GanttTimelineBody
                key={rowKey(row)}
                row={row}
                allRows={rows}
                absIndex={rows.length > VIRT ? slice.start + i : i}
                live={live}
                markOf={markOf}
                axis={axis}
                width={width}
                canEdit={canEdit}
                barDrag={barDrag}
              />
            ))}
            {padBottom > 0 && <GanttPadSvg h={padBottom} width={width} />}
          </div>
        </div>
      </div>
    </section>
  )
}

function rowKey(row: TableRow): string {
  return row.kind === 'group' ? `g-${row.key}` : row.issue.id
}

function GanttListPad({ h }: { h: number }) {
  return <svg height={h} width={330} className="block" aria-hidden />
}

function GanttPadSvg({ h, width }: { h: number; width: number }) {
  return <svg height={h} width={width} className="relative z-[1] block" aria-hidden />
}

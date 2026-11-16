import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { MemberLite, RoadmapState } from '@/engine/roadmaps/types'
import type { ViewSettings } from '@/engine/roadmaps/view'
import { filtering, tableRows } from '@/engine/roadmaps/view'
import type { RoadmapOp } from '@/engine/roadmaps/ops'
import { PX_PER_DAY, daysBetween, ganttRange, markFor, type Mark } from '@/engine/roadmaps/gantt'
import { cn } from '@/app/lib/utils'
import { personGroup, ROW_H, VIRT, rowSlice, useGroupToggle, visibleRows } from './issueTableView'
import { makeAxis } from './ganttAxis'
import { ROW_CLASS } from './ganttBarDrag'
import { GanttListRow } from './GanttList'
import { GanttLane } from './GanttLane'
import { GanttCompose } from './GanttCompose'
import { newIssueId } from './issueIds'
import { GanttGrid, GanttScaleRow, GanttTodayRule, groupMark, partMark } from './GanttTimeline'
import { useBarDrag } from './useBarDrag'
import { useIssueDatesDrop } from './useIssueDatesDrop'

interface Props {
  state: RoadmapState
  members: MemberLite[]
  view: ViewSettings
  today: string
  onView: (v: ViewSettings | ((prev: ViewSettings) => ViewSettings)) => void
  canEdit: boolean
  act: (op: RoadmapOp) => 'ok' | string
  onOpenIssue?: (id: string) => void
  todayRequest: number
  said?: string | null
  /** Bumped by the top bar's New issue: open a compose row at the end of the list. */
  newIssue?: number
}

/** The list column gives way as the view narrows (a side panel opening, a small window), so the timeline keeps
    most of the room. `at` is the view width from which a size applies; `inset` starts the timeline's layers. */
const LIST_SIZES = [
  { at: 1040, w: 360, list: 'w-[360px]', inset: 'left-[360px]' },
  { at: 760, w: 300, list: 'w-[300px]', inset: 'left-[300px]' },
  { at: 560, w: 248, list: 'w-[248px]', inset: 'left-[248px]' },
  { at: 0, w: 196, list: 'w-[196px]', inset: 'left-[196px]' },
] as const

const listSize = (viewWidth: number) => LIST_SIZES.find((s) => viewWidth >= s.at) ?? LIST_SIZES[LIST_SIZES.length - 1]

const NONE: Mark = { kind: 'none' }
const ROW = cn('group/row flex min-w-full border-b border-hair', ROW_CLASS)
const LIST_CELL = 'sticky left-0 z-10 shrink-0 border-r border-line bg-app-bg'

export function Gantt({ state, members, view, today, onView, onOpenIssue, todayRequest, canEdit, act, said, newIssue = 0 }: Props) {
  const [composing, setComposing] = useState(false)
  const seenNewIssue = useRef(newIssue)
  useEffect(() => {
    if (newIssue === seenNewIssue.current) return
    seenNewIssue.current = newIssue
    if (canEdit) setComposing(true)
  }, [newIssue, canEdit])

  const live = useMemo(() => state.issues.filter((i) => i.deletedAt === null), [state.issues])
  const names = useMemo(() => new Map(members.map((m) => [m.id, m.name])), [members])
  const allRows = useMemo(() => tableRows(state, view, today, names), [state, view, today, names])
  const filtersActive = filtering(view)
  const rows = useMemo(() => visibleRows(allRows, filtersActive), [allRows, filtersActive])

  const range = useMemo(() => ganttRange(live, today, view.scale), [live, today, view.scale])
  const px = PX_PER_DAY[view.scale]
  const axis = useMemo(() => makeAxis(range, px), [range, px])
  const width = (daysBetween(range.from, range.to) + 1) * px
  const frame = { range, scale: view.scale, today, width, axis }

  const openIssue = useCallback((id: string) => { onOpenIssue?.(id) }, [onOpenIssue])
  const barDrag = useBarDrag({ axis, canEdit, act, onOpen: openIssue })
  const datesDrop = useIssueDatesDrop({ axis, canEdit, act })

  const marks = useMemo(() => new Map(live.map((issue) => [issue.id, markFor(live, issue.id, today)])), [live, today])

  const onToggleCollapse = useCallback(
    (id: string) => {
      onView((v) => ({ ...v, collapsed: v.collapsed.includes(id) ? v.collapsed.filter((c) => c !== id) : [...v.collapsed, id] }))
    },
    [onView],
  )

  const onToggleGroup = useGroupToggle(rows, onView)

  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [box, setBox] = useState({ w: 1200, h: 900 })
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const measure = () => setBox((b) => (b.w === el.clientWidth && b.h === el.clientHeight ? b : { w: el.clientWidth, h: el.clientHeight }))
    measure()
    const watch = new ResizeObserver(measure)
    watch.observe(el)
    return () => watch.disconnect()
  }, [])
  const size = listSize(box.w)

  const virtual = rows.length > VIRT
  const slice = useMemo(() => rowSlice(rows.length, scrollTop, box.h, ROW_H), [rows.length, scrollTop, box.h])
  const body = virtual ? rows.slice(slice.start, slice.end) : rows
  const padTop = virtual ? slice.start * ROW_H : 0
  const padBottom = virtual ? (rows.length - slice.end) * ROW_H : 0

  // Today sits a third of the way into the visible timeline: on open, on Today, and when the scale changes; not
  // when a drag or a live update moves the range.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const visible = el.clientWidth - listSize(el.clientWidth).w
    el.scrollLeft = Math.max(0, daysBetween(range.from, today) * px + px / 2 - visible / 3)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayRequest, view.scale])

  return (
    <section role="region" aria-label="Timeline" className="flex min-h-0 flex-1 flex-col">
      {said && <p role="status" className="border-b border-line bg-panel px-4 py-2 text-[12px] text-ink-2">{said}</p>}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto" onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}>
        <div className="relative flex min-h-full w-max min-w-full flex-col">
          <div className="sticky top-0 z-20 flex h-9 min-w-full shrink-0 border-b border-line bg-app-bg">
            <div className={cn(LIST_CELL, size.list, 'flex items-center pl-[60px] text-[11px] text-ink-3')}>Issue</div>
            <GanttScaleRow {...frame} />
          </div>
          <GanttGrid {...frame} className={size.inset} />
          <GanttTodayRule {...frame} className={size.inset} />

          {padTop > 0 && <svg height={padTop} width={1} className="block shrink-0" aria-hidden />}
          {body.map((row, i) => {
            const at = virtual ? slice.start + i : i
            const mark = row.kind === 'issue' ? partMark(marks.get(row.issue.id) ?? NONE, row) : groupMark(live, row)
            return (
              <div key={row.kind === 'group' ? `g-${row.key}` : row.key} className={cn(ROW, 'shrink-0', row.kind === 'group' && 'bg-panel')}>
                <div className={cn(LIST_CELL, size.list, row.kind === 'group' && 'bg-panel')}>
                  <GanttListRow
                    row={row}
                    roadmap={state.roadmap}
                    person={row.kind === 'group' && personGroup(row.key)}
                    mark={mark}
                    canEdit={canEdit}
                    compact={size.w < 300}
                    datesDrop={datesDrop}
                    onToggleCollapse={onToggleCollapse}
                    onToggleGroup={onToggleGroup}
                    onOpenIssue={onOpenIssue}
                  />
                </div>
                <GanttLane row={row} mark={mark} axis={axis} width={width} today={today} canEdit={canEdit} first={at === 0} barDrag={barDrag} datesDrop={datesDrop} />
              </div>
            )
          })}
          {padBottom > 0 && <svg height={padBottom} width={1} className="block shrink-0" aria-hidden />}
          {composing && (
            <div className={cn(ROW, 'shrink-0')}>
              <div className={cn(LIST_CELL, size.list)}>
                <GanttCompose
                  onCancel={() => setComposing(false)}
                  onCommit={(title) => {
                    act({ op: 'create', issues: [{ id: newIssueId(), parentId: null, title }] })
                    setComposing(false)
                  }}
                />
              </div>
            </div>
          )}
          <div className="flex min-w-full flex-1">
            <div className={cn(LIST_CELL, size.list)} />
          </div>
        </div>
      </div>
    </section>
  )
}

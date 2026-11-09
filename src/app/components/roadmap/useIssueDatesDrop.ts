import { useCallback, useState, type DragEvent } from 'react'
import { dropDates, type Mark } from '@/engine/roadmaps/gantt'
import type { RoadmapOp } from '@/engine/roadmaps/ops'
import { toast } from 'sonner'
import type { Axis } from './ganttAxis'

export const ISSUE_DATES_MIME = 'application/x-occam-issue-dates'

export type IssueDatesGhost = { laneId: string; start: string; due: string }

interface Options {
  axis: Axis
  canEdit: boolean
  act: (op: RoadmapOp) => 'ok' | string
}

export function listRowDatesDraggable(canEdit: boolean, mark: Mark): boolean {
  if (!canEdit) return false
  if (mark.kind === 'none') return true
  if (mark.kind === 'bracket' && !mark.own) return true
  return false
}

function hasDatesMime(e: DragEvent) {
  return e.dataTransfer.types.includes(ISSUE_DATES_MIME)
}

export function useIssueDatesDrop({ axis, canEdit, act }: Options) {
  const [ghost, setGhost] = useState<IssueDatesGhost | null>(null)

  const listDragStart = useCallback(
    (id: string) => (e: DragEvent<HTMLDivElement>) => {
      if (!canEdit) {
        e.preventDefault()
        return
      }
      e.dataTransfer.effectAllowed = 'copy'
      e.dataTransfer.setData(ISSUE_DATES_MIME, id)
    },
    [canEdit],
  )

  const listDragEnd = useCallback(() => setGhost(null), [])

  const laneOver = useCallback(
    (laneId: string) => (e: DragEvent<HTMLDivElement>) => {
      if (!canEdit || !hasDatesMime(e)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      const x = e.clientX - e.currentTarget.getBoundingClientRect().left
      const { start, due } = dropDates(axis.dayAt(x))
      setGhost({ laneId, start, due })
    },
    [axis, canEdit],
  )

  const laneLeave = useCallback(() => setGhost(null), [])

  const laneDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (!canEdit) return
      const id = e.dataTransfer.getData(ISSUE_DATES_MIME)
      if (!id) return
      e.preventDefault()
      setGhost(null)
      const x = e.clientX - e.currentTarget.getBoundingClientRect().left
      const { start, due } = dropDates(axis.dayAt(x))
      const out = act({ op: 'set', ids: [id], props: { start, due } })
      if (out !== 'ok') toast(out)
    },
    [act, axis, canEdit],
  )

  return { ghost, listDragStart, listDragEnd, laneOver, laneLeave, laneDrop }
}

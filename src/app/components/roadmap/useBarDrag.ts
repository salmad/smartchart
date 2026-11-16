import { useCallback, useEffect, useRef, useState } from 'react'
import { dragDates, dropDates, type DragMode } from '@/engine/roadmaps/gantt'
import type { RoadmapOp } from '@/engine/roadmaps/ops'
import { toast } from 'sonner'
import type { Axis } from './ganttAxis'
import { DRAG_CLICK_PX } from './ganttBarDrag'

type DragState = {
  id: string
  mode: DragMode
  originStart: string
  originDue: string
  startX: number
  startY: number
}

interface Options {
  axis: Axis
  canEdit: boolean
  act: (op: RoadmapOp) => 'ok' | string
  onOpen: (id: string) => void
}

/** A bar mid-drag: its dates so far, and where the pointer is along the lane (for the dates tip). */
export interface DragPreview {
  id: string
  start: string
  due: string
  x: number
}

export function useBarDrag({ axis, canEdit, act, onOpen }: Options) {
  const [preview, setPreview] = useState<DragPreview | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const dragCleanupRef = useRef<(() => void) | null>(null)

  const cancel = useCallback(() => {
    dragCleanupRef.current?.()
    dragCleanupRef.current = null
    dragRef.current = null
    setPreview(null)
  }, [])

  useEffect(() => {
    if (!canEdit) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dragRef.current) cancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canEdit, cancel])

  const handlers = useCallback(
    (id: string, start: string, due: string, mode: DragMode) => ({
      onPointerDown: (e: PointerEvent, target: HTMLElement) => {
        if (!canEdit) {
          if (e.button === 0) onOpen(id)
          return
        }
        if (e.button !== 0) return
        e.preventDefault()
        e.stopPropagation()
        try {
          target.setPointerCapture(e.pointerId)
        } catch {
          /* synthetic events may omit capture */
        }
        dragRef.current = {
          id,
          mode,
          originStart: start,
          originDue: due,
          startX: e.clientX,
          startY: e.clientY,
        }
        const laneX = e.clientX - target.getBoundingClientRect().left

        const onMove = (ev: PointerEvent | MouseEvent) => {
          const d = dragRef.current
          if (!d) return
          const dx = ev.clientX - d.startX
          const days = Math.round(dx / axis.px)
          const next = dragDates(d.originStart, d.originDue, d.mode, days)
          setPreview({ id: d.id, start: next.start, due: next.due, x: laneX + dx })
        }

        const end = (ev: PointerEvent | MouseEvent) => {
          const d = dragRef.current
          if (!d) return
          dragRef.current = null
          cleanup()
          try {
            if ('pointerId' in ev && target.hasPointerCapture(ev.pointerId)) target.releasePointerCapture(ev.pointerId)
          } catch {
            /* ignore */
          }

          const dx = ev.clientX - d.startX
          const dy = ev.clientY - d.startY
          const dist = Math.hypot(dx, dy)
          if (dist < DRAG_CLICK_PX) {
            setPreview(null)
            onOpen(id)
            return
          }

          const days = Math.round(dx / axis.px)
          const next = dragDates(d.originStart, d.originDue, d.mode, days)
          setPreview(null)
          if (next.start === d.originStart && next.due === d.originDue) return
          const out = act({ op: 'set', ids: [id], props: { start: next.start, due: next.due } })
          if (out !== 'ok') toast(out)
        }

        const cleanup = () => {
          dragCleanupRef.current = null
          window.removeEventListener('pointermove', onMove)
          window.removeEventListener('pointerup', end)
          window.removeEventListener('pointercancel', end)
          window.removeEventListener('mousemove', onMove)
          window.removeEventListener('mouseup', end)
        }
        dragCleanupRef.current = cleanup

        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', end)
        window.addEventListener('pointercancel', end)
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', end)
      },
    }),
    [act, axis.px, canEdit, onOpen],
  )

  const clickToSchedule = useCallback(
    (id: string) => ({
      onPointerDown: (e: PointerEvent, target: HTMLElement) => {
        if (!canEdit || e.button !== 0) return
        e.preventDefault()
        e.stopPropagation()
        const rect = target.getBoundingClientRect()
        const startX = e.clientX
        const startY = e.clientY
        const end = (ev: PointerEvent | MouseEvent) => {
          cleanup()
          const dist = Math.hypot(ev.clientX - startX, ev.clientY - startY)
          if (dist >= DRAG_CLICK_PX) return
          const x = ev.clientX - rect.left
          const { start, due } = dropDates(axis.dayAt(x))
          const out = act({ op: 'set', ids: [id], props: { start, due } })
          if (out !== 'ok') toast(out)
        }
        const cleanup = () => {
          window.removeEventListener('pointerup', end)
          window.removeEventListener('pointercancel', end)
          window.removeEventListener('mouseup', end)
        }
        window.addEventListener('pointerup', end)
        window.addEventListener('pointercancel', end)
        window.addEventListener('mouseup', end)
        try {
          target.setPointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }
      },
    }),
    [act, axis, canEdit],
  )

  const clickToOpen = useCallback(
    (id: string) => ({
      onPointerDown: (e: PointerEvent, target: HTMLElement) => {
        if (e.button !== 0) return
        if (!canEdit) {
          onOpen(id)
          return
        }
        e.preventDefault()
        const startX = e.clientX
        const startY = e.clientY
        const end = (ev: PointerEvent | MouseEvent) => {
          cleanup()
          if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_CLICK_PX) onOpen(id)
        }
        const cleanup = () => {
          window.removeEventListener('pointerup', end)
          window.removeEventListener('pointercancel', end)
          window.removeEventListener('mouseup', end)
        }
        window.addEventListener('pointerup', end)
        window.addEventListener('pointercancel', end)
        window.addEventListener('mouseup', end)
        try {
          target.setPointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }
      },
    }),
    [canEdit, onOpen],
  )

  return { preview, handlers, clickToSchedule, clickToOpen }
}

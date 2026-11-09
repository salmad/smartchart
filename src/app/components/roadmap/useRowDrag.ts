import { useCallback, useState, type DragEvent } from 'react'
import type { Issue } from '@/engine/roadmaps/types'
import type { RoadmapOp } from '@/engine/roadmaps/ops'
import { issueDropTarget } from './issueDrop'

const MIME = 'application/x-occam-issue'

interface Options {
  issues: Issue[]
  canEdit: boolean
  act: (op: RoadmapOp) => 'ok' | string
  onRefused: (msg: string) => void
}

export function useRowDrag({ issues, canEdit, act, onRefused }: Options) {
  const [dragId, setDragId] = useState<string | null>(null)

  const start = useCallback((id: string) => (e: DragEvent<HTMLTableRowElement>) => {
    if (!canEdit) { e.preventDefault(); return }
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData(MIME, id)
    setDragId(id)
  }, [canEdit])

  const end = useCallback(() => setDragId(null), [])

  const over = useCallback((overId: string) => (e: DragEvent<HTMLTableRowElement>) => {
    if (!dragId || dragId === overId) return
    const rect = e.currentTarget.getBoundingClientRect()
    const y = (e.clientY - rect.top) / Math.max(1, rect.height)
    const drop = issueDropTarget(issues, dragId, overId, y)
    if (drop) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
    }
  }, [dragId, issues])

  const dropOn = useCallback((overId: string) => (e: DragEvent<HTMLTableRowElement>) => {
    if (!dragId) return
    const rect = e.currentTarget.getBoundingClientRect()
    const y = (e.clientY - rect.top) / Math.max(1, rect.height)
    const target = issueDropTarget(issues, dragId, overId, y)
    setDragId(null)
    if (!target) return
    e.preventDefault()
    const out = act({ op: 'move', id: dragId, parentId: target.parentId, before: target.before, after: target.after })
    if (out !== 'ok') onRefused(out)
  }, [act, dragId, issues, onRefused])

  return { dragId, start, end, over, dropOn }
}

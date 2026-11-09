import { useCallback, useEffect, type RefObject } from 'react'
import type { RoadmapOp } from '@/engine/roadmaps/ops'

export interface ComposeDraft {
  id: string
  parentId: string | null
  after?: string
  title: string
}

function editingField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true
  if (target.isContentEditable) return true
  return !!target.closest('[contenteditable=""], [contenteditable="true"]')
}

interface Options {
  root: RefObject<HTMLElement | null>
  order: string[]
  focusId: string | null
  setFocusId: (id: string | null) => void
  compose: ComposeDraft | null
  setCompose: (d: ComposeDraft | null) => void
  canEdit: boolean
  act: (op: RoadmapOp) => 'ok' | string
  onStartCompose: (child: boolean) => void
  selection: { toggle: (id: string, extend: boolean) => void; selectAll: () => void }
}

export function useTableKeys({
  root,
  order,
  focusId,
  setFocusId,
  compose,
  setCompose,
  canEdit,
  act,
  onStartCompose,
  selection,
}: Options) {
  const moveFocus = useCallback((dir: -1 | 1) => {
    if (!order.length) return
    const i = focusId ? order.indexOf(focusId) : -1
    const next = Math.max(0, Math.min(order.length - 1, (i < 0 ? 0 : i) + dir))
    setFocusId(order[next])
  }, [focusId, order, setFocusId])

  const commitCompose = useCallback(() => {
    if (!compose) return
    const title = compose.title.trim()
    if (!title) { setCompose(null); return }
    act({
      op: 'create',
      issues: [{ id: compose.id, parentId: compose.parentId, title, after: compose.after }],
    })
    setCompose(null)
    setFocusId(compose.id)
  }, [act, compose, setCompose, setFocusId])

  useEffect(() => {
    const el = root.current
    if (!el) return
    const onKey = (e: KeyboardEvent) => {
      if (!canEdit) return
      if (editingField(e.target)) return
      const mod = e.metaKey || e.ctrlKey
      if (compose && e.key === 'Enter') {
        e.preventDefault()
        commitCompose()
        return
      }
      if (e.key === 'Escape' && compose) {
        e.preventDefault()
        setCompose(null)
        return
      }
      if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        selection.selectAll()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        moveFocus(1)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        moveFocus(-1)
        return
      }
      if (e.key.toLowerCase() === 'c' && !mod && !e.shiftKey) {
        e.preventDefault()
        onStartCompose(false)
        return
      }
      if (e.key.toLowerCase() === 'c' && e.shiftKey && !mod) {
        e.preventDefault()
        onStartCompose(true)
        return
      }
      if (e.key.toLowerCase() === 'x' && focusId && !mod) {
        e.preventDefault()
        selection.toggle(focusId, e.shiftKey)
      }
    }
    el.addEventListener('keydown', onKey)
    return () => el.removeEventListener('keydown', onKey)
  }, [canEdit, commitCompose, compose, focusId, moveFocus, onStartCompose, root, selection, setCompose])

  return { commitCompose }
}

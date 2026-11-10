import { useCallback, useEffect, type RefObject } from 'react'
import type { MatrixCell as Cell } from '@/engine/roadmaps/matrix'

export interface MatrixFocus {
  issueId: string
  col: number
}

function cellFocusable(cell: Cell): boolean {
  return cell.kind === 'one' || cell.kind === 'many'
}

function editingField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true
  if (target.isContentEditable) return true
  return !!target.closest('[contenteditable=""], [contenteditable="true"]')
}

function rowTitleControl(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const btn = target.closest('th button')
  return !!btn && !btn.hasAttribute('data-matrix-cell')
}

interface RowSlice {
  kind: 'group' | 'issue'
  issueId?: string
  cells?: Cell[]
}

function rowOf(rows: RowSlice[], issueId: string): number {
  return rows.findIndex((r) => r.kind === 'issue' && r.issueId === issueId)
}

function popoverOpen(root: HTMLElement): boolean {
  return !!root.querySelector('[data-radix-popper-content-wrapper]')
}

interface Options {
  root: RefObject<HTMLElement | null>
  rows: RowSlice[]
  colCount: number
  focus: MatrixFocus | null
  setFocus: (f: MatrixFocus | null) => void
  onActivate: (issueId: string, col: number) => void
}

export function useMatrixKeys({ root, rows, colCount, focus, setFocus, onActivate }: Options) {
  const nextSpot = useCallback(
    (issueId: string, col: number, dRow: number, dCol: number): MatrixFocus | null => {
      let r = rowOf(rows, issueId)
      let c = col
      if (r < 0) return null
      for (let n = 0; n < rows.length * colCount + 2; n++) {
        r += dRow
        c += dCol
        if (r < 0 || r >= rows.length || c < 0 || c >= colCount) return null
        const rowSlice = rows[r]
        if (rowSlice.kind === 'group') continue
        const cell = rowSlice.cells?.[c]
        if (cell && cellFocusable(cell) && rowSlice.issueId) return { issueId: rowSlice.issueId, col: c }
      }
      return null
    },
    [colCount, rows],
  )

  useEffect(() => {
    const el = root.current
    if (!el) return
    const onKey = (e: KeyboardEvent) => {
      if (editingField(e.target)) return
      if (!focus) return
      if (popoverOpen(el) && ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const n = nextSpot(focus.issueId, focus.col, 1, 0)
        if (n) setFocus(n)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        const n = nextSpot(focus.issueId, focus.col, -1, 0)
        if (n) setFocus(n)
        return
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        const n = nextSpot(focus.issueId, focus.col, 0, 1)
        if (n) setFocus(n)
        return
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        const n = nextSpot(focus.issueId, focus.col, 0, -1)
        if (n) setFocus(n)
        return
      }
      if (e.key === 'Enter') {
        if (rowTitleControl(e.target)) return
        e.preventDefault()
        onActivate(focus.issueId, focus.col)
      }
    }
    el.addEventListener('keydown', onKey)
    return () => el.removeEventListener('keydown', onKey)
  }, [focus, nextSpot, onActivate, root, setFocus])
}

export function firstMatrixFocus(rows: RowSlice[], colCount: number): MatrixFocus | null {
  for (let r = 0; r < rows.length; r++) {
    if (rows[r].kind === 'group') continue
    for (let c = 0; c < colCount; c++) {
      const cell = rows[r].cells?.[c]
      if (cell && cellFocusable(cell) && rows[r].issueId) return { issueId: rows[r].issueId!, col: c }
    }
  }
  return null
}

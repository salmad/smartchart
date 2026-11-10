import { useCallback, useEffect, type RefObject } from 'react'
import type { MatrixCell as Cell } from '@/engine/roadmaps/matrix'

export interface MatrixFocus {
  row: number
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

interface RowSlice {
  kind: 'group' | 'issue'
  cells?: Cell[]
}

interface Options {
  root: RefObject<HTMLElement | null>
  rows: RowSlice[]
  colCount: number
  focus: MatrixFocus | null
  setFocus: (f: MatrixFocus | null) => void
  onActivate: (row: number, col: number) => void
}

export function useMatrixKeys({ root, rows, colCount, focus, setFocus, onActivate }: Options) {
  const nextSpot = useCallback(
    (row: number, col: number, dRow: number, dCol: number): MatrixFocus | null => {
      let r = row
      let c = col
      for (let n = 0; n < rows.length * colCount + 2; n++) {
        r += dRow
        c += dCol
        if (r < 0 || r >= rows.length || c < 0 || c >= colCount) return null
        const rowSlice = rows[r]
        if (rowSlice.kind === 'group') continue
        const cell = rowSlice.cells?.[c]
        if (cell && cellFocusable(cell)) return { row: r, col: c }
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
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const n = nextSpot(focus.row, focus.col, 1, 0)
        if (n) setFocus(n)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        const n = nextSpot(focus.row, focus.col, -1, 0)
        if (n) setFocus(n)
        return
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        const n = nextSpot(focus.row, focus.col, 0, 1)
        if (n) setFocus(n)
        return
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        const n = nextSpot(focus.row, focus.col, 0, -1)
        if (n) setFocus(n)
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const target = document.activeElement
        if (target instanceof HTMLElement) target.click()
        else onActivate(focus.row, focus.col)
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
      if (cell && cellFocusable(cell)) return { row: r, col: c }
    }
  }
  return null
}

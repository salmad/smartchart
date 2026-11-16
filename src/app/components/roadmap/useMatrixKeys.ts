import { useEffect, type RefObject } from 'react'
import type { MatrixRow } from '@/engine/roadmaps/matrix'

/** The focused cell, by the row's key and the column's place, so it survives rows coming and going. The key, not the
    issue: one issue can show under several groups. */
export interface MatrixFocus {
  row: string
  col: number
}

const STEP: Record<string, [number, number]> = { ArrowDown: [1, 0], ArrowUp: [-1, 0], ArrowRight: [0, 1], ArrowLeft: [0, -1] }

function filled(row: MatrixRow | undefined, col: number): MatrixFocus | null {
  if (row?.kind !== 'issue') return null
  const cell = row.cells[col]
  return cell && cell.kind !== 'empty' ? { row: row.key, col } : null
}

/** The next filled cell in a direction: empty cells and group rows are stepped over. */
function nextSpot(rows: MatrixRow[], from: MatrixFocus, dRow: number, dCol: number): MatrixFocus | null {
  let r = rows.findIndex((row) => row.key === from.row)
  if (r < 0) return null
  let c = from.col
  for (;;) {
    r += dRow
    c += dCol
    if (r < 0 || r >= rows.length || c < 0) return null
    const row = rows[r]
    if (row.kind === 'issue' && c >= row.cells.length) return null
    const hit = filled(row, c)
    if (hit) return hit
  }
}

export function firstMatrixFocus(rows: MatrixRow[]): MatrixFocus | null {
  for (const row of rows) {
    if (row.kind !== 'issue') continue
    for (let c = 0; c < row.cells.length; c++) {
      const hit = filled(row, c)
      if (hit) return hit
    }
  }
  return null
}

export const cellSelector = (f: MatrixFocus) => `[data-matrix-cell="${CSS.escape(`${f.row}:${f.col}`)}"]`

interface Options {
  root: RefObject<HTMLElement | null>
  rows: MatrixRow[]
  focus: MatrixFocus | null
  setFocus: (f: MatrixFocus) => void
}

/** Arrows move the focused cell; Enter presses that same cell. The listener is native, so keys typed inside a cell's
    popover (a portal) never reach the grid. */
export function useMatrixKeys({ root, rows, focus, setFocus }: Options) {
  useEffect(() => {
    const el = root.current
    if (!el || !focus) return
    const onKey = (e: KeyboardEvent) => {
      const step = STEP[e.key]
      if (step) {
        e.preventDefault()
        const next = nextSpot(rows, focus, step[0], step[1])
        if (next) setFocus(next)
        return
      }
      // Enter on a row's own buttons (expand, open) is theirs.
      if (e.key !== 'Enter' || (e.target instanceof Element && e.target.closest('th'))) return
      e.preventDefault()
      el.querySelector<HTMLElement>(cellSelector(focus))?.click()
    }
    el.addEventListener('keydown', onKey)
    return () => el.removeEventListener('keydown', onKey)
  }, [focus, root, rows, setFocus])
}

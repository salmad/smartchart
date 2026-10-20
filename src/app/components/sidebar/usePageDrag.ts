/* Dragging a page in the tree: which row is held, where it would land, and the line or ring that shows it. The decision itself
   is `dropTarget`; this carries it out with the browser's own drag events (no library), and a drop goes through the same `onMove`
   as the keyboard's moves. */
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type RefObject } from 'react'
import { keyOf, type PageRef, type PageSummary } from '@/engine/pages/tree'
import type { MoveTo } from '@/app/pages'
import { dropTarget, type Drop } from './dropTarget'
import { shownDepth, type Row } from './flatten'

const MIME = 'application/x-occam-page'
/** Where the line starts, from the left of the tree: the list's padding, the level's indent, then past the chevron. */
/** Hovering a collapsed row this long opens it; the tree scrolls this far per dragover within EDGE px of its edge. */
const OPEN_MS = 600, EDGE = 32, SCROLL = 8
const INDENT_PX = [6, 20, 34, 48], LEFT_PAD = 8, PAST_CHEVRON = 22

export interface DragLine { top: number; left: number }
interface State { ref: PageRef; drop: Drop | null; line: DragLine | null }

interface Options {
  rows: Row[]
  pages: PageSummary[] | null
  canWrite: boolean
  busy: boolean
  tree: RefObject<HTMLDivElement>
  onMove: (ref: PageRef, to: MoveTo) => Promise<string | null>
  onToggle: (ref: PageRef, open?: boolean) => void
}

export function usePageDrag({ rows, pages, canWrite, busy, tree, onMove, onToggle }: Options) {
  const [state, setState] = useState<State | null>(null), [said, setSaid] = useState('')
  const timer = useRef<{ key: string; id: number } | null>(null)
  const stopTimer = useCallback(() => { if (timer.current) window.clearTimeout(timer.current.id); timer.current = null }, [])
  useEffect(() => stopTimer, [stopTimer])
  const byKey = useMemo(() => new Map(rows.map((r) => [keyOf(r.ref), r])), [rows])

  /** Where the line goes, in pixels inside the (positioned) tree: above `before`, or under the last row. */
  const lineFor = useCallback((drop: Drop): DragLine | null => {
    const root = tree.current
    if (!root || drop.indicator.kind !== 'line') return null
    const { before, depth } = drop.indicator, left = LEFT_PAD + INDENT_PX[shownDepth(depth) - 1] + PAST_CHEVRON
    const el = before === 'end' ? [...root.querySelectorAll<HTMLElement>('[data-row]')].at(-1) : root.querySelector<HTMLElement>(`[data-row="${CSS.escape(keyOf(before))}"]`)
    if (!el) return null
    return { top: before === 'end' ? el.offsetTop + el.offsetHeight + 1 : el.offsetTop - 1, left }
  }, [tree])

  const clear = useCallback(() => { stopTimer(); setState(null) }, [stopTimer])

  const start = (row: Row) => (e: DragEvent<HTMLElement>) => {
    if (!canWrite || busy) { e.preventDefault(); return }
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData(MIME, keyOf(row.ref)) // Firefox starts no drag without data
    setState({ ref: row.ref, drop: null, line: null })
  }

  /** The nearest ancestor that scrolls the tree; at the edges it scrolls while the pointer is held there. */
  const scrollEdges = (y: number) => {
    let el = tree.current?.parentElement ?? null
    while (el && !/auto|scroll/.test(getComputedStyle(el).overflowY)) el = el.parentElement
    if (!el) return
    const box = el.getBoundingClientRect()
    if (y < box.top + EDGE) el.scrollTop -= SCROLL
    else if (y > box.bottom - EDGE) el.scrollTop += SCROLL
  }

  const over = (e: DragEvent<HTMLElement>) => {
    if (!state || !pages) return
    scrollEdges(e.clientY)
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-row]'), row = el && byKey.get(el.dataset.row ?? '')
    // Over a row, or over the tree's own blank space under the last row; anywhere else is not a target.
    const target = row ? { at: row.ref, y: (e.clientY - (el as HTMLElement).getBoundingClientRect().top) / Math.max(1, (el as HTMLElement).offsetHeight) }
      : e.target === e.currentTarget ? { at: 'end' as const, y: 0.5 } : null
    const drop = target ? dropTarget(rows, pages, state.ref, target.at, target.y) : null
    if (drop) { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }
    // Resting on a collapsed row's middle opens it, so a page can be dropped inside.
    const hover = drop?.indicator.kind === 'into' && drop.expand ? keyOf(drop.indicator.row) : null
    if (hover !== timer.current?.key) {
      stopTimer()
      if (hover && drop?.expand) { const open = drop.expand; timer.current = { key: hover, id: window.setTimeout(() => { timer.current = null; onToggle(open, true) }, OPEN_MS) } }
    }
    const same = (a: Drop | null, b: Drop | null) => JSON.stringify(a && [a.to, a.indicator]) === JSON.stringify(b && [b.to, b.indicator])
    if (!same(drop, state.drop)) setState({ ref: state.ref, drop, line: drop && lineFor(drop) })
  }

  const drop = (e: DragEvent<HTMLElement>) => {
    const was = state
    clear()
    if (!was?.drop) return
    e.preventDefault()
    if (was.drop.expand) onToggle(was.drop.expand, true)
    const name = (r: PageRef | null) => (r && byKey.get(keyOf(r))?.name) ?? '', moved = name(was.ref), parent = was.drop.to.parent
    void onMove(was.ref, was.drop.to).then((refused) => {
      if (!refused) setSaid(parent ? `Moved “${moved}” under “${name(parent)}”.` : `Moved “${moved}” to the top level.`)
    })
  }

  /** The pointer left the tree altogether: no target, but the drag goes on. */
  const leave = (e: DragEvent<HTMLElement>) => {
    if (state?.drop && !e.currentTarget.contains(e.relatedTarget as Node | null)) { stopTimer(); setState({ ref: state.ref, drop: null, line: null }) }
  }

  return {
    said,
    dragged: state?.ref ?? null,
    into: state?.drop?.indicator.kind === 'into' ? state.drop.indicator.row : null,
    line: state?.line ?? null,
    rowProps: (row: Row) => ({ draggable: canWrite && !busy, onDragStart: start(row), onDragEnd: clear }),
    treeProps: { onDragOver: over, onDrop: drop, onDragLeave: leave },
  }
}

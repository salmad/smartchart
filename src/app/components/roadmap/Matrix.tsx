import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { OptionMark } from './OptionMark'
import type { MemberLite, RoadmapState } from '@/engine/roadmaps/types'
import { toggleFolded, type ViewSettings } from '@/engine/roadmaps/view'
import { liveMatrix, matrixGrid, type MatrixCol } from '@/engine/roadmaps/matrix'
import { shortDate } from './dates'
import { cn } from '@/app/lib/utils'
import { colAria } from './matrixCellMeta'
import { rowSlice, useGroupToggle, VIRT } from './issueTableView'
import { MatrixTitleCell, TITLE_COL } from './MatrixTitle'
import { MatrixGroupCellView, MatrixIssueCell } from './MatrixCell'
import { cellSelector, firstMatrixFocus, useMatrixKeys, type MatrixFocus } from './useMatrixKeys'
import { Button } from '../ui/button'
import { Fold } from './GroupLabel'

interface Props {
  state: RoadmapState
  view: ViewSettings
  members: MemberLite[]
  today: string
  canEdit?: boolean
  onView: (v: ViewSettings | ((prev: ViewSettings) => ViewSettings)) => void
  onOpenIssue?: (id: string) => void
  onOpenFields?: () => void
}

const ROW_H = 40
const REGION = 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden outline-none'
/** One value column's width: a cell's card (mark, title, strip, share, quarter) fits without truncating. */
const COL_W = 'w-[208px]'
const NOTE = 'px-8 py-10 text-[13.5px] text-ink-2'

export function Matrix({ state, view, members, today, canEdit, onView, onOpenIssue, onOpenFields }: Props) {
  const fields = state.roadmap.fields
  const matrix = liveMatrix(fields, view)
  const { cols, rows } = useMemo(
    () => matrixGrid(state, view, today, { names: new Map(members.map((m) => [m.id, m.name])), date: (iso) => shortDate(iso, today) }),
    [state, view, today, members],
  )
  const liveIssues = useMemo(() => state.issues.filter((i) => i.deletedAt === null), [state.issues])
  const parents = useMemo(() => new Set(liveIssues.flatMap((i) => i.parentId ?? [])), [liveIssues])

  const [focus, setFocus] = useState<MatrixFocus | null>(null)
  const rootRef = useRef<HTMLElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewHeight, setViewHeight] = useState(900)

  const virtual = rows.length > VIRT
  const slice = rowSlice(rows.length, scrollTop, viewHeight, ROW_H)
  const body = virtual ? rows.slice(slice.start, slice.end) : rows

  const toggle = useCallback(
    (id: string) =>
      onView((v) => {
        const open = v.matrix.expanded
        return { ...v, matrix: { ...v.matrix, expanded: open.includes(id) ? open.filter((x) => x !== id) : [...open, id] } }
      }),
    [onView],
  )
  const toggleGroup = useGroupToggle(rows, onView)
  const toggleCols = useCallback(
    (optionId: string, all: boolean) =>
      onView((v) => {
        const level = [...new Set(cols.map((c) => c.parts[0].optionId))]
        return { ...v, matrix: { ...v.matrix, foldedCols: toggleFolded(v.matrix.foldedCols, optionId, level, all) } }
      }),
    [onView, cols],
  )
  const open = useCallback((id: string) => onOpenIssue?.(id), [onOpenIssue])

  useMatrixKeys({ root: rootRef, rows, focus, setFocus })

  // The focused cell always exists: when its row goes (collapse, filter), focus returns to the first filled cell.
  useEffect(() => {
    const alive = focus && rows.some((r) => r.kind === 'issue' && r.key === focus.row && (r.cells[focus.col]?.kind ?? 'empty') !== 'empty')
    if (!alive) setFocus(firstMatrixFocus(rows))
  }, [focus, rows])

  // Keyboard focus follows the focused cell, unless the person is working somewhere else (a menu, the issue panel).
  useEffect(() => {
    const root = rootRef.current
    if (!root || !focus) return
    const at = document.activeElement
    if (at && at !== document.body && !root.contains(at)) return
    if (virtual) {
      const top = rows.findIndex((r) => r.key === focus.row) * ROW_H
      const el = scrollRef.current
      if (el && (top < el.scrollTop || top + 2 * ROW_H > el.scrollTop + el.clientHeight)) el.scrollTop = Math.max(0, top - ROW_H)
    }
    root.querySelector<HTMLElement>(cellSelector(focus))?.focus()
    // Only a move of the focused cell pulls keyboard focus; new rows alone do not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.row, focus?.col])

  const onScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setScrollTop(el.scrollTop)
    setViewHeight(el.clientHeight)
    setMoreRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  // Whether columns lie past the right edge: re-checked as the pane resizes and as columns come and go.
  const [moreRight, setMoreRight] = useState(false)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const check = () => setMoreRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
    check()
    const seen = new ResizeObserver(check)
    seen.observe(el)
    if (el.firstElementChild) seen.observe(el.firstElementChild)
    return () => seen.disconnect()
  }, [cols.length, rows.length])

  if (!matrix.cols.length) {
    // Every field already groups the rows: say so, rather than asking for a field the roadmap has.
    const allGrouped = fields.length > 0
    return (
      <section role="region" aria-label="Matrix" className={REGION}>
        <div className="mx-auto w-full max-w-sm px-6 py-16 text-center">
          <h2 className="text-[15px] font-medium tracking-[-.01em] text-ink">{allGrouped ? 'No field left for the columns' : 'The matrix needs a field'}</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">
            {allGrouped
              ? 'Every field groups the rows. Group by fewer in Display, and the one you free makes the columns.'
              : 'Add a field such as Country or Workstream. Its values become the columns.'}
          </p>
          {canEdit && onOpenFields && (
            <Button type="button" variant={allGrouped ? 'outline' : 'default'} className="mt-5" onClick={onOpenFields}>
              Add a field
            </Button>
          )}
        </div>
      </section>
    )
  }

  const colField = fields.find((f) => f.id === matrix.cols[0])?.name ?? ''
  const note = !rows.length
    ? view.chips.length
      ? 'No issues match the filters.'
      : 'No issues yet.'
    : !cols.length
      ? `No issue has a ${colField} yet. Set one on an issue, or keep a column in view from Display.`
      : null
  if (note) {
    return (
      <section role="region" aria-label="Matrix" className={REGION}>
        <p className={NOTE}>{note}</p>
      </section>
    )
  }

  const paired = matrix.cols.length === 2
  const rowNames = matrix.rows.map((id) => fields.find((f) => f.id === id)?.name).filter((n): n is string => !!n)

  return (
    <section ref={rootRef} role="region" aria-label="Matrix" className={REGION}>
      <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto" onScroll={onScroll}>
        {/* Every value column is one fixed width, whatever the filter or the pane leaves: a strip means the same length
            in every view, and nothing moves sideways as columns come and go. Past the pane, the grid scrolls. */}
        <table className="w-max table-fixed border-separate border-spacing-0 text-[13px]">
          <colgroup>
            <col className="w-[280px]" />
            {cols.map((col) => <col key={col.key} className={COL_W} />)}
          </colgroup>
          <thead className="sticky top-0 z-20">
            <tr>
              <th scope="col" rowSpan={paired ? 2 : 1} className={cn(TITLE_COL, HEAD, 'z-30 border-b-line px-3 align-bottom')}>
                <span className="flex h-9 items-center">{rowNames.length ? rowNames.join(' › ') : 'Issue'}</span>
              </th>
              {paired
                ? spans(cols).map((s) => (
                    <th
                      key={s.key}
                      scope="colgroup"
                      colSpan={s.span}
                      rowSpan={s.folded ? 2 : 1}
                      className={cn(HEAD, 'h-8 pl-1.5 pr-3 text-left text-ink-2', s.folded && 'border-b border-b-line align-bottom')}
                    >
                      <span className={cn('flex items-center gap-1', s.folded && 'h-9')}>
                        <Fold open={!s.folded} label={s.name} onToggle={(all) => toggleCols(s.key, all)} />
                        <Option emoji={s.emoji} name={s.name} />
                      </span>
                    </th>
                  ))
                : cols.map((col) => <ColHead key={col.key} col={col} part={0} />)}
            </tr>
            {paired && <tr>{cols.filter((col) => !col.folded).map((col) => <ColHead key={col.key} col={col} part={1} />)}</tr>}
          </thead>
          <tbody>
            {virtual && slice.start > 0 && <Pad h={slice.start * ROW_H} cols={cols.length} />}
            {body.map((row) => (
              <tr key={row.key} data-matrix-row={row.kind === 'issue' ? row.issue.id : `group:${row.key}`} className="group/row">
                <MatrixTitleCell row={row} roadmap={state.roadmap} onToggle={toggle} onToggleGroup={toggleGroup} onOpenIssue={open} />
                {row.kind === 'group'
                  ? row.cells.map((cell, ci) => <MatrixGroupCellView key={cols[ci].key} col={cols[ci]} cell={cell} show={matrix.show} issues={liveIssues} today={today} />)
                  : row.cells.map((cell, ci) => (
                      <MatrixIssueCell
                        key={cols[ci].key}
                        roadmap={state.roadmap}
                        issues={liveIssues}
                        parents={parents}
                        members={members}
                        rowIssue={row.issue}
                        col={cols[ci]}
                        cell={cell}
                        show={matrix.show}
                        today={today}
                        cellTag={`${row.key}:${ci}`}
                        focused={focus?.row === row.key && focus.col === ci}
                        onFocus={() => setFocus({ row: row.key, col: ci })}
                        onOpen={open}
                      />
                    ))}
              </tr>
            ))}
            {virtual && slice.end < rows.length && <Pad h={(rows.length - slice.end) * ROW_H} cols={cols.length} />}
          </tbody>
        </table>
      </div>
      {/* More columns to the right: a soft fade at the edge says so. */}
      <div aria-hidden className={cn('pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-app-bg to-transparent transition-opacity duration-150', moreRight ? 'opacity-100' : 'opacity-0')} />
      </div>
    </section>
  )
}

const HEAD = 'bg-app-bg text-[12px] font-normal text-ink-3'

function Option({ emoji, name }: { emoji?: string; name: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <OptionMark mark={emoji} />
      <span className="truncate" title={name}>{name}</span>
    </span>
  )
}

/** A column's own header: its option of the last column field. With two fields the first field's option spans above. */
function ColHead({ col, part }: { col: MatrixCol; part: 0 | 1 }) {
  const p = col.parts[part]
  return (
    <th scope="col" aria-label={colAria(col.parts)} className={cn(HEAD, 'h-9 border-b border-b-line px-3 text-left', part === 0 && 'text-ink-2')}>
      <Option emoji={p.emoji} name={p.name} />
    </th>
  )
}

/** Runs of neighbouring columns that share the first field's option. */
function spans(cols: MatrixCol[]): { key: string; name: string; emoji?: string; span: number; folded: boolean }[] {
  const out: { key: string; name: string; emoji?: string; span: number; folded: boolean }[] = []
  for (const col of cols) {
    const p = col.parts[0]
    const last = out[out.length - 1]
    if (last?.key === p.optionId) last.span++
    else out.push({ key: p.optionId, name: p.name, emoji: p.emoji, span: 1, folded: col.folded === true })
  }
  return out
}

function Pad({ h, cols }: { h: number; cols: number }) {
  return (
    <tr aria-hidden>
      <td colSpan={cols + 1} className="p-0 leading-[0]">
        <svg height={h} width={1} className="block" />
      </td>
    </tr>
  )
}

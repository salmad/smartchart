import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MemberLite, RoadmapState } from '@/engine/roadmaps/types'
import type { ViewSettings } from '@/engine/roadmaps/view'
import { liveMatrix, matrixGrid, type MatrixCol } from '@/engine/roadmaps/matrix'
import { shortDate } from './dates'
import { cn } from '@/app/lib/utils'
import { colAria } from './matrixCellMeta'
import { rowSlice, VIRT } from './issueTableView'
import { MatrixTitleCell, matrixRowKey, TITLE_COL } from './MatrixTitle'
import { MatrixGroupCellView, MatrixIssueCell } from './MatrixCell'
import { cellSelector, firstMatrixFocus, useMatrixKeys, type MatrixFocus } from './useMatrixKeys'
import { Button } from '../ui/button'

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
const NOTE = 'px-8 py-10 text-[13.5px] text-ink-2'

export function Matrix({ state, view, members, today, canEdit, onView, onOpenIssue, onOpenFields }: Props) {
  const fields = state.roadmap.fields
  const matrix = liveMatrix(fields, view.matrix)
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
  const open = useCallback((id: string) => onOpenIssue?.(id), [onOpenIssue])

  useMatrixKeys({ root: rootRef, rows, focus, setFocus })

  // The focused cell always exists: when its row goes (collapse, filter), focus returns to the first filled cell.
  useEffect(() => {
    const alive = focus && rows.some((r) => r.kind === 'issue' && r.issue.id === focus.issueId && (r.cells[focus.col]?.kind ?? 'empty') !== 'empty')
    if (!alive) setFocus(firstMatrixFocus(rows))
  }, [focus, rows])

  // Keyboard focus follows the focused cell, unless the person is working somewhere else (a menu, the issue panel).
  useEffect(() => {
    const root = rootRef.current
    if (!root || !focus) return
    const at = document.activeElement
    if (at && at !== document.body && !root.contains(at)) return
    if (virtual) {
      const top = rows.findIndex((r) => r.kind === 'issue' && r.issue.id === focus.issueId) * ROW_H
      const el = scrollRef.current
      if (el && (top < el.scrollTop || top + 2 * ROW_H > el.scrollTop + el.clientHeight)) el.scrollTop = Math.max(0, top - ROW_H)
    }
    root.querySelector<HTMLElement>(cellSelector(focus))?.focus()
    // Only a move of the focused cell pulls keyboard focus; new rows alone do not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.issueId, focus?.col])

  const onScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setScrollTop(el.scrollTop)
    setViewHeight(el.clientHeight)
  }, [])

  if (!matrix.cols.length) {
    return (
      <section role="region" aria-label="Matrix" className={REGION}>
        <div className="mx-auto w-full max-w-sm px-6 py-16 text-center">
          <h2 className="text-[15px] font-medium tracking-[-.01em] text-ink">The matrix needs a field</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">
            Add a field such as Country or Workstream. Its values become the columns.
          </p>
          {canEdit && onOpenFields && (
            <Button type="button" className="mt-5" onClick={onOpenFields}>
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
      ? `No issue has a ${colField} yet. Set one on an issue, or keep a column in view from Layout.`
      : null
  if (note) {
    return (
      <section role="region" aria-label="Matrix" className={REGION}>
        <p className={NOTE}>{note}</p>
      </section>
    )
  }

  const paired = matrix.cols.length === 2
  const rowField = fields.find((f) => f.id === matrix.rowField)?.name

  return (
    <section ref={rootRef} role="region" aria-label="Matrix" className={REGION}>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto" onScroll={onScroll}>
        <table className="w-max min-w-full border-separate border-spacing-0 text-[13px]">
          <thead className="sticky top-0 z-20">
            <tr>
              <th scope="col" rowSpan={paired ? 2 : 1} className={cn(TITLE_COL, HEAD, 'z-30 border-b-line px-3 align-bottom')}>
                <span className="flex h-9 items-center">{rowField ?? 'Issue'}</span>
              </th>
              {paired
                ? spans(cols).map((s) => (
                    <th key={s.key} scope="colgroup" colSpan={s.span} className={cn(HEAD, 'h-8 border-l border-hair px-3 text-left text-ink-2')}>
                      <Option emoji={s.emoji} name={s.name} />
                    </th>
                  ))
                : cols.map((col) => <ColHead key={col.key} col={col} part={0} />)}
            </tr>
            {paired && <tr>{cols.map((col) => <ColHead key={col.key} col={col} part={1} />)}</tr>}
          </thead>
          <tbody>
            {virtual && slice.start > 0 && <Pad h={slice.start * ROW_H} cols={cols.length} />}
            {body.map((row) => (
              <tr key={matrixRowKey(row)} data-matrix-row={matrixRowKey(row)} className="group/row">
                <MatrixTitleCell row={row} roadmap={state.roadmap} onToggle={toggle} onOpenIssue={open} />
                {row.kind === 'group'
                  ? row.cells.map((cell, ci) => <MatrixGroupCellView key={cols[ci].key} col={cols[ci]} cell={cell} show={matrix.show} />)
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
                        cellTag={`${row.issue.id}:${ci}`}
                        focused={focus?.issueId === row.issue.id && focus.col === ci}
                        onFocus={() => setFocus({ issueId: row.issue.id, col: ci })}
                        onOpen={open}
                      />
                    ))}
              </tr>
            ))}
            {virtual && slice.end < rows.length && <Pad h={(rows.length - slice.end) * ROW_H} cols={cols.length} />}
          </tbody>
        </table>
      </div>
    </section>
  )
}

const HEAD = 'bg-app-bg text-[12px] font-normal text-ink-3'

function Option({ emoji, name }: { emoji?: string; name: string }) {
  return (
    <span className="flex items-center gap-1.5">
      {emoji && <span aria-hidden>{emoji}</span>}
      <span className="truncate" title={name}>{name}</span>
    </span>
  )
}

/** A column's own header: its option of the last column field. With two fields the first field's option spans above. */
function ColHead({ col, part }: { col: MatrixCol; part: 0 | 1 }) {
  const p = col.parts[part]
  return (
    <th scope="col" aria-label={colAria(col.parts)} className={cn(HEAD, 'h-9 max-w-[320px] border-b border-l border-hair border-b-line px-3 text-left', part === 0 && 'text-ink-2')}>
      <Option emoji={p.emoji} name={p.name} />
    </th>
  )
}

/** Runs of neighbouring columns that share the first field's option. */
function spans(cols: MatrixCol[]): { key: string; name: string; emoji?: string; span: number }[] {
  const out: { key: string; name: string; emoji?: string; span: number }[] = []
  for (const col of cols) {
    const p = col.parts[0]
    const last = out[out.length - 1]
    if (last?.key === p.optionId) last.span++
    else out.push({ key: p.optionId, name: p.name, emoji: p.emoji, span: 1 })
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

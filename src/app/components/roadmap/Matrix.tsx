import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MemberLite, RoadmapState } from '@/engine/roadmaps/types'
import type { ViewSettings } from '@/engine/roadmaps/view'
import { matrixGrid, liveMatrix, type MatrixCol, type MatrixRow } from '@/engine/roadmaps/matrix'
import { colAria } from './matrixCellMeta'
import { MATRIX_ROW_H, rowSlice, visibleRows, VIRT } from './issueTableView'
import { MatrixTitleCell, matrixRowKey } from './MatrixTitle'
import { MatrixGroupCellView, MatrixIssueCell } from './MatrixCell'
import { firstMatrixFocus, useMatrixKeys, type MatrixFocus } from './useMatrixKeys'
import { MatrixDisplay } from './MatrixDisplay'
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

const NO_CHOICE = 'Matrix needs at least one choice field (for example Country or Workstream).'
const NO_COLUMN = 'Pick which choice field becomes the columns — rows stay as your issue tree, or group by another choice field.'

export function Matrix({ state, view, members, today, canEdit, onView, onOpenIssue, onOpenFields }: Props) {
  const fields = state.roadmap.fields
  const choiceCount = fields.filter((f) => f.type === 'choice').length
  const matrix = liveMatrix(fields, view.matrix)
  // Open already working: until someone picks, the first choice field is the rows and the second the columns (one field: the columns).
  const untouched = view.matrix.rowField === null && view.matrix.cols.length === 0 && view.matrix.pins.length === 0
  useEffect(() => {
    if (!untouched) return
    const [first, second] = fields.filter((f) => f.type === 'choice')
    if (!first) return
    onView((v) => ({ ...v, matrix: { ...v.matrix, rowField: second ? first.id : null, cols: [second ? second.id : first.id] } }))
  }, [untouched, fields, onView])
  const hint = choiceCount === 0 ? NO_CHOICE : matrix.cols.length === 0 ? NO_COLUMN : null

  const { cols, rows: allRows } = useMemo(
    () => (hint ? { cols: [] as MatrixCol[], rows: [] as MatrixRow[] } : matrixGrid(state, view, today)),
    [hint, state, view, today],
  )

  const filtersActive = view.chips.length > 0
  const rows = useMemo(() => visibleRows(allRows, filtersActive), [allRows, filtersActive])
  const liveIssues = useMemo(() => state.issues.filter((i) => i.deletedAt === null), [state.issues])

  const [focus, setFocus] = useState<MatrixFocus | null>(null)
  const rootRef = useRef<HTMLElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewHeight, setViewHeight] = useState(900)

  const slice = useMemo(
    () => rowSlice(rows.length, scrollTop, viewHeight, MATRIX_ROW_H),
    [rows.length, scrollTop, viewHeight],
  )

  const body = rows.length > VIRT ? rows.slice(slice.start, slice.end) : rows
  const padTop = rows.length > VIRT ? slice.start * MATRIX_ROW_H : 0
  const padBottom = rows.length > VIRT ? (rows.length - slice.end) * MATRIX_ROW_H : 0

  const onToggleCollapse = useCallback(
    (id: string) => {
      onView({
        ...view,
        collapsed: view.collapsed.includes(id) ? view.collapsed.filter((c) => c !== id) : [...view.collapsed, id],
      })
    },
    [onView, view],
  )

  const open = useCallback((id: string) => { onOpenIssue?.(id) }, [onOpenIssue])

  const keyRows = useMemo(
    () =>
      rows.map((r) =>
        r.kind === 'group'
          ? { kind: 'group' as const }
          : { kind: 'issue' as const, issueId: r.issue.id, cells: r.cells },
      ),
    [rows],
  )

  const onActivate = useCallback(
    (issueId: string, col: number) => {
      const r = rows.find((row) => row.kind === 'issue' && row.issue.id === issueId)
      if (!r || r.kind !== 'issue') return
      const cell = r.cells[col]
      if (cell.kind === 'one') {
        open(cell.issueId)
        return
      }
      if (cell.kind === 'many') {
        const btn = rootRef.current?.querySelector(`button[data-matrix-cell="${issueId}:${col}"]`)
        if (btn instanceof HTMLButtonElement) btn.click()
      }
    },
    [open, rows],
  )

  useMatrixKeys({ root: rootRef, rows: keyRows, colCount: cols.length, focus, setFocus, onActivate })

  useEffect(() => {
    if (!focus) {
      const f = firstMatrixFocus(keyRows, cols.length)
      if (f) setFocus(f)
      return
    }
    const live = keyRows.some((r) => r.kind === 'issue' && r.issueId === focus.issueId)
    if (!live) setFocus(firstMatrixFocus(keyRows, cols.length))
  }, [cols.length, focus, keyRows])

  useEffect(() => {
    if (!focus) return
    const row = rows.findIndex((r) => r.kind === 'issue' && r.issue.id === focus.issueId)
    if (row >= 0 && rows.length > VIRT) {
      const top = row * MATRIX_ROW_H
      const el = scrollRef.current
      if (el && (top < el.scrollTop || top + MATRIX_ROW_H > el.scrollTop + el.clientHeight)) {
        el.scrollTop = Math.max(0, top - MATRIX_ROW_H)
      }
    }
  }, [focus, rows])

  useEffect(() => {
    if (hint || !focus || !rootRef.current) return
    const root = rootRef.current
    const ae = document.activeElement
    const inPortal = ae instanceof Element && ae.closest('[data-radix-popper-content-wrapper]')
    if (inPortal) return
    if (document.querySelector('[data-radix-popper-content-wrapper] [data-state="open"]')) return
    if (ae && ae !== document.body && !root.contains(ae)) return
    const btn = root.querySelector(`button[data-matrix-cell="${focus.issueId}:${focus.col}"]`)
    if (btn instanceof HTMLButtonElement) btn.focus({ preventScroll: true })
  }, [focus?.issueId, focus?.col, hint])

  const onScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setScrollTop((t) => (t === el.scrollTop ? t : el.scrollTop))
    setViewHeight((h) => (h === el.clientHeight ? h : el.clientHeight))
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    setViewHeight(el.clientHeight)
  }, [rows.length])

  if (hint) {
    return (
      <section
        role="region"
        aria-label="Matrix"
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto"
      >
        <div className="mx-auto w-full max-w-md px-6 py-10">
          <h2 className="text-[15px] font-medium tracking-[-.01em] text-ink">Configure the matrix</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{hint}</p>
          {choiceCount > 0 ? (
            <div className="mt-6">
              <MatrixDisplay fields={fields} view={view} onChange={onView} />
            </div>
          ) : canEdit && onOpenFields ? (
            <Button type="button" size="sm" className="mt-5" onClick={onOpenFields}>
              Open Fields
            </Button>
          ) : null}
          <p className="mt-4 text-[11.5px] text-ink-3">
            Or use <span className="text-ink-2">Layout</span> in the toolbar. Matrix rows and columns must be{' '}
            <span className="text-ink-2">choice</span> fields (add them under Fields).
          </p>
        </div>
      </section>
    )
  }

  return (
    <section
      ref={rootRef}
      role="region"
      aria-label="Matrix"
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden outline-none"
      tabIndex={-1}
    >
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto" onScroll={onScroll}>
        <table className="w-max min-w-full border-collapse text-[12px]">
          <thead className="sticky top-0 z-20 bg-app-bg">
            <tr className="h-9 border-b border-line text-[11.5px] text-ink-3">
              <th
                scope="col"
                className="sticky left-0 z-30 min-w-[280px] bg-app-bg px-3 text-left font-medium"
              >
                Title
              </th>
              {cols.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  aria-label={colAria(col.parts)}
                  className="min-w-[160px] border-l border-hair px-3 text-left font-medium"
                >
                  <MatrixColHead col={col} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {padTop > 0 && <MatrixPad h={padTop} cols={cols.length} />}
            {body.map((row) => (
                <tr
                  key={matrixRowKey(row)}
                  data-matrix-row={row.kind === 'group' ? `group:${row.key}` : row.issue.id}
                  className="h-14"
                >
                  <MatrixTitleCell
                    row={row}
                    roadmap={state.roadmap}
                    onToggleCollapse={onToggleCollapse}
                    onOpenIssue={open}
                  />
                  {row.kind === 'group'
                    ? row.cells.map((cell, ci) => (
                        <MatrixGroupCellView
                          key={cols[ci]?.key ?? ci}
                          issues={liveIssues}
                          col={cols[ci]}
                          cell={cell}
                          show={view.matrix.show}
                        />
                      ))
                    : row.cells.map((cell, ci) => (
                        <MatrixIssueCell
                          key={cols[ci]?.key ?? ci}
                          roadmap={state.roadmap}
                          issues={liveIssues}
                          members={members}
                          col={cols[ci]}
                          cell={cell}
                          show={view.matrix.show}
                          today={today}
                          cellTag={`${row.issue.id}:${ci}`}
                          focused={focus?.issueId === row.issue.id && focus?.col === ci}
                          onFocus={() => setFocus({ issueId: row.issue.id, col: ci })}
                          onOpen={open}
                        />
                      ))}
                </tr>
            ))}
            {padBottom > 0 && <MatrixPad h={padBottom} cols={cols.length} />}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function MatrixColHead({ col }: { col: MatrixCol }) {
  if (col.parts.length === 1) {
    const p = col.parts[0]
    return (
      <span>
        {p.emoji && <span aria-hidden>{p.emoji} </span>}
        {p.name}
      </span>
    )
  }
  return (
    <div className="flex flex-col gap-0.5 leading-tight">
      <span>
        {col.parts[0].emoji && <span aria-hidden>{col.parts[0].emoji} </span>}
        {col.parts[0].name}
      </span>
      <span className="text-[10.5px] text-ink-3">{col.parts[1].name}</span>
    </div>
  )
}

function MatrixPad({ h, cols }: { h: number; cols: number }) {
  return (
    <tr aria-hidden className="border-0">
      <td colSpan={cols + 1} className="p-0 leading-[0]">
        <svg height={h} width={1} className="block w-full" aria-hidden />
      </td>
    </tr>
  )
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MemberLite, RoadmapState } from '@/engine/roadmaps/types'
import type { ViewSettings } from '@/engine/roadmaps/view'
import { matrixGrid, liveMatrix, type MatrixCol, type MatrixRow } from '@/engine/roadmaps/matrix'
import { colAria } from './matrixCellMeta'
import { MATRIX_ROW_H, rowSlice, visibleRows, VIRT } from './issueTableView'
import { MatrixTitleCell, matrixRowKey } from './MatrixTitle'
import { MatrixGroupCellView, MatrixIssueCell } from './MatrixCell'
import { firstMatrixFocus, useMatrixKeys, type MatrixFocus } from './useMatrixKeys'

interface Props {
  state: RoadmapState
  view: ViewSettings
  members: MemberLite[]
  today: string
  onView: (v: ViewSettings | ((prev: ViewSettings) => ViewSettings)) => void
  onOpenIssue?: (id: string) => void
}

const NO_CHOICE = 'Add a choice field to line the work up in columns.'
const NO_COLUMN = 'Choose a column field in Display.'

export function Matrix({ state, view, members, today, onView, onOpenIssue }: Props) {
  const fields = state.roadmap.fields
  const choiceCount = fields.filter((f) => f.type === 'choice').length
  const matrix = liveMatrix(fields, view.matrix)
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
    () => rows.map((r) => (r.kind === 'group' ? { kind: 'group' as const } : { kind: 'issue' as const, cells: r.cells })),
    [rows],
  )

  const onActivate = useCallback(
    (row: number, col: number) => {
      const r = rows[row]
      if (r.kind !== 'issue') return
      const cell = r.cells[col]
      if (cell.kind === 'one') open(cell.issueId)
    },
    [open, rows],
  )

  useMatrixKeys({ root: rootRef, rows: keyRows, colCount: cols.length, focus, setFocus, onActivate })

  useEffect(() => {
    if (focus) return
    const f = firstMatrixFocus(keyRows, cols.length)
    if (f) setFocus(f)
  }, [cols.length, focus, keyRows])

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
      <section role="region" aria-label="Matrix" className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <p className="px-8 py-10 text-[13.5px] text-ink-2">{hint}</p>
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
                  className="min-w-[148px] px-2 text-center font-medium"
                >
                  <MatrixColHead col={col} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {padTop > 0 && <MatrixPad rows={padTop / MATRIX_ROW_H} cols={cols.length} />}
            {body.map((row, i) => {
              const rowIndex = rows.length > VIRT ? slice.start + i : i
              return (
                <tr
                  key={matrixRowKey(row)}
                  data-matrix-row={row.kind === 'group' ? `group:${row.key}` : row.issue.id}
                  className="h-[34px]"
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
                          members={members}
                          col={cols[ci]}
                          cell={cell}
                          show={view.matrix.show}
                          today={today}
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
                          focused={focus?.row === rowIndex && focus.col === ci}
                          onFocus={() => setFocus({ row: rowIndex, col: ci })}
                          onOpen={open}
                        />
                      ))}
                </tr>
              )
            })}
            {padBottom > 0 && <MatrixPad rows={padBottom / MATRIX_ROW_H} cols={cols.length} />}
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

function MatrixPad({ rows: n, cols }: { rows: number; cols: number }) {
  return (
    <tr aria-hidden style={{ height: n * MATRIX_ROW_H }}>
      <td colSpan={cols + 1} />
    </tr>
  )
}

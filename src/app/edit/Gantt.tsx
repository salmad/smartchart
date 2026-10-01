// src/app/edit/Gantt.tsx
/* The timeline as a gantt (spec 4.3): a workstream per row, a column per period. Press and drag across a row to paint its bar;
   or move with the arrows, extend with shift, and press Space. Milestones sit in rows of their own: click a period to move one.
   Right-click a row or a period for insert, indent and delete; drag a row's grip to move it, and drop it on the right of a row to nest it
   under that one. Names and periods are typed in place. */
import { useRef, useState, type KeyboardEvent } from 'react'
import { Diamond, GripVertical, Plus } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { ContextMenu, ContextMenuTrigger } from '@/app/components/ui/context-menu'
import { ganttFor } from '@/engine/slides/gantt'
import type { Style } from '@/engine/types'
import { dropPlace } from './drag'
import { GanttMenu, type GanttCtx } from './GanttMenu'
import type { SlideEdit } from './useSlideEdit'

type Patch = Record<string, unknown> | null

export function Gantt({ edit, deckStyle }: { edit: SlideEdit; deckStyle: Style }) {
  const g = ganttFor(edit.draft, deckStyle), n = g.periods.length
  const [paint, setPaint] = useState<{ row: number; a: number; b: number } | null>(null)
  const [rawAt, setAt] = useState({ r: 0, p: 0, a: 0 }), [dropAt, setDropAt] = useState<{ before: number; level: 0 | 1 } | null>(null)
  const [ctx, setCtx] = useState<GanttCtx>({ row: null, period: null })
  const grid = useRef<HTMLDivElement>(null)
  // Rows and periods can go (delete, undo): the cursor is read through the grid as it is now.
  const top = (x: number, len: number) => Math.max(0, Math.min(x, len - 1)), at = { r: top(rawAt.r, g.lines.length), p: top(rawAt.p, n), a: top(rawAt.a, n) }
  const write = (p: Patch) => { if (p) edit.patch(p) }
  const issue = (path: string) => edit.issues.find((i) => i.path && (i.path === path || path.startsWith(`${i.path}.`) || path.startsWith(`${i.path}[`)))

  const lo = (r: number) => (paint?.row === r ? Math.min(paint.a, paint.b) : g.lines[r].start), hi = (r: number) => (paint?.row === r ? Math.max(paint.a, paint.b) : g.lines[r].end)
  const finish = () => { if (paint) { write(g.setBar(paint.row, paint.a, paint.b)); setPaint(null) } }

  const onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT') return
    const d: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }
    if (d[e.key]) {
      e.preventDefault()
      const r = Math.max(0, Math.min(at.r + d[e.key][0], g.lines.length - 1)), p = Math.max(0, Math.min(at.p + d[e.key][1], n - 1))
      setAt({ r, p, a: e.shiftKey ? at.a : p }); return
    }
    if ((e.key === ' ' || e.key === 'Enter') && !g.lines[at.r]?.group) { e.preventDefault(); write(g.setBar(at.r, at.a, at.p)); setAt({ ...at, a: at.p }) }
  }
  const dragRow = (e: React.PointerEvent<HTMLElement>, index: number) => {
    e.preventDefault(); const grip = e.currentTarget; grip.setPointerCapture(e.pointerId)
    let drop: { before: number; level: 0 | 1 } | null = null
    const boxes = () => [...(grid.current?.querySelectorAll('tbody tr[data-row]') ?? [])].map((el) => el.getBoundingClientRect())
    const mv = (ev: PointerEvent) => {
      const label = grid.current?.querySelector('[data-label]')?.getBoundingClientRect()
      if (label) { drop = dropPlace(boxes(), { x: ev.clientX, y: ev.clientY }, label); setDropAt(drop) }
    }
    const up = () => { grip.removeEventListener('pointermove', mv); grip.removeEventListener('pointerup', up); setDropAt(null); if (drop) write(g.place(index, drop.before, drop.level)) }
    grip.addEventListener('pointermove', mv); grip.addEventListener('pointerup', up)
  }

  const hasSub = g.lines.some((l) => l.level === 1)
  /** The bar's tone follows the slide: highlight, then top-level against sub-row when there are sub-rows. */
  const tone = (l: typeof g.lines[number] | null) => (l?.focus ? 'bg-ink' : hasSub ? (l?.level === 0 ? 'bg-ink/70' : 'bg-ink/30') : 'bg-ink/45')
  /** The drop line: above the row it lands before, from the grip (top level) or from the name (nested); past the last row it sits under it. */
  const dropClass = (i: number) => {
    if (!dropAt) return ''
    const nested = dropAt.level === 1
    if (dropAt.before === i) return nested ? '[&>td:not(:first-child)]:shadow-[0_-2px_0_0_theme(colors.ink)]' : '[&>td]:shadow-[0_-2px_0_0_theme(colors.ink)]'
    if (dropAt.before === g.lines.length && i === g.lines.length - 1) return nested ? '[&>td:not(:first-child)]:shadow-[0_2px_0_0_theme(colors.ink)]' : '[&>td]:shadow-[0_2px_0_0_theme(colors.ink)]'
    return ''
  }
  const bar = (r: number, p: number) => (p >= lo(r) && p <= hi(r))
  const periodCells = (row: number | null, mile: number | null) => g.periods.map((_, p) => {
    const filled = row !== null && bar(row, p), diamond = mile !== null && g.milestones[mile]?.at === p
    const ln = row === null ? null : g.lines[row], group = !!ln?.group
    return (
      <td key={p} role="gridcell" aria-label={row !== null ? `${g.rows[row].label || `Workstream ${row + 1}`}, ${g.periods[p] || `period ${p + 1}`}${filled ? ', in bar' : ''}` : `Milestone ${(mile ?? 0) + 1}, ${g.periods[p] || `period ${p + 1}`}${diamond ? ', here' : ''}`}
        aria-selected={row !== null && at.r === row && at.p === p} data-r={row ?? undefined} data-p={p}
        onPointerDown={(e) => { if (e.button !== 0) return; grid.current?.focus(); if (group) return; if (row !== null) { setAt({ r: row, p, a: p }); setPaint({ row, a: p, b: p }) } else if (mile !== null) write(g.setMilestone(mile, p)) }}
        onPointerEnter={(e) => { if (paint && row === paint.row && e.buttons & 1) setPaint({ ...paint, b: p }) }}
        className={`h-9 min-w-10 cursor-crosshair border-b border-line px-0 ${at.r === row && at.p === p ? 'shadow-[inset_0_0_0_1.5px_theme(colors.ink)]' : ''}`}>
        {filled && <div className={`mx-0 ${group ? 'h-2' : 'h-5'} ${tone(ln)} ${p === lo(row as number) ? 'ml-1 rounded-l-md' : ''} ${p === hi(row as number) ? 'mr-1 rounded-r-md' : ''}`} />}
        {diamond && <Diamond className="mx-auto size-4 fill-ink text-ink" />}
      </td>
    )
  })

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div ref={grid} role="grid" aria-label="Timeline" tabIndex={0} onKeyDown={onKey} onPointerUp={finish} onPointerCancel={() => setPaint(null)}
            onContextMenuCapture={(e) => { const el = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-row], [data-pcol]') : null; setCtx({ row: el?.dataset.row !== undefined ? Number(el.dataset.row) : null, period: el?.dataset.pcol !== undefined ? Number(el.dataset.pcol) : null }) }}
            className="min-h-0 overflow-auto rounded-lg outline-none ring-1 ring-line focus-visible:ring-ink-3">
            <table className="w-full border-separate border-spacing-0 text-[13px]">
              <thead className="sticky top-0 z-10 bg-panel">
                <tr><th className="w-8" /><th className="min-w-44 border-b border-line px-2 py-1 text-left font-normal text-ink-3">Workstream</th>
                  {g.periods.map((p, i) => (
                    <th key={i} data-pcol={i} className="border-b border-line px-0.5 py-1 font-normal">
                      <input aria-label={`Period ${i + 1}`} value={p} placeholder="–" onChange={(e) => write({ [`chart.periods[${i}]`]: e.target.value })} className={`h-7 w-full min-w-10 rounded-sm bg-transparent px-1 text-center text-ink outline-none focus:bg-raise ${issue(`chart.periods[${i}]`) ? 'underline decoration-warn decoration-2' : ''}`} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {g.lines.map((ln, i) => (
                  <tr key={i} data-row={i} className={dropClass(i)}>
                    <td className="border-b border-line text-center"><button type="button" aria-label={`Move workstream ${i + 1}`} onPointerDown={(e) => dragRow(e, i)} className="grid size-6 cursor-grab touch-none place-items-center text-ink-3 hover:text-ink"><GripVertical className="size-3.5" /></button></td>
                    <td data-label className="border-b border-line px-0">
                      <input aria-label={`Workstream ${i + 1}`} value={ln.row.label} placeholder="Name" onChange={(e) => write({ [`chart.rows[${i}].label`]: e.target.value })} className={`h-9 w-full bg-transparent outline-none focus:bg-raise ${ln.level === 1 ? 'pl-6 pr-2' : 'px-2'} ${ln.group ? 'font-semibold' : ''} ${issue(`chart.rows[${i}].label`) ? 'underline decoration-warn decoration-2 underline-offset-4' : ''}`} />
                    </td>
                    {periodCells(i, null)}
                  </tr>
                ))}
                {g.milestones.map((m, i) => (
                  <tr key={`m${i}`} className={i === 0 ? '[&>td]:border-t [&>td]:border-t-line-2' : ''}>
                    <td className="border-b border-line" />
                    <td className="border-b border-line px-0">
                      <input aria-label={`Milestone ${i + 1}`} value={m.label} placeholder="Milestone" onChange={(e) => write({ [`chart.milestones[${i}].label`]: e.target.value })} className="h-9 w-full bg-transparent px-2 outline-none focus:bg-raise" />
                    </td>
                    {periodCells(null, i)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ContextMenuTrigger>
        <GanttMenu g={g} ctx={ctx} write={write} onClosed={() => grid.current?.focus()} />
      </ContextMenu>
      <div className="flex items-center gap-2 text-[12px] text-ink-3">
        <Button size="sm" variant="ghost" disabled={!g.insertRow(g.rows.length)} onClick={() => write(g.insertRow(g.rows.length))}><Plus className="size-3.5" /> Workstream</Button>
        <Button size="sm" variant="ghost" disabled={!g.insertPeriod(n)} onClick={() => write(g.insertPeriod(n))}><Plus className="size-3.5" /> Period</Button>
        <Button size="sm" variant="ghost" disabled={!g.insertMilestone()} onClick={() => write(g.insertMilestone())}><Plus className="size-3.5" /> Milestone</Button>
        <span className="ml-1">Drag across a row to set its bar. Arrow keys and Space work too.</span>
      </div>
    </div>
  )
}

/* The chart as a grid of inputs, in the chart's place and at its size (spec 4.3). Every change writes the chart
   through edit.patch; "Show chart" or a click outside flips back. */
import { useEffect, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/app/components/ui/dialog'
import { Input } from '@/app/components/ui/input'
import { addMilestone, addPeriod, addRow, addSeries, chartGrid, fromGrid, gridLimits, removeMilestone, removePeriod, removeRow, removeSeries, type Grid } from '@/engine/slides/grid'
import type { Chart, Style } from '@/engine/types'
import type { SlideEdit } from './useSlideEdit'

/** A typed number: "1,200", "−5", "(3.1)" and "12%" all read; anything else is not a number (null). */
function parseNum(v: string): number | null {
  const t = v.trim().replace(/[,\s%]/g, '').replace(/[−–]/g, '-')
  if (t === '') return 0
  const neg = /^\(.*\)$/.test(t), n = Number(neg ? `-${t.slice(1, -1)}` : t)
  return Number.isFinite(n) ? n : null
}

/** A number cell: it shows what is typed, writes every value that is a number as it is typed, and flags what isn't. */
function NumCell({ label, value, disabled, className, onCommit }: { label: string; value: number | null; disabled?: boolean; className: string; onCommit: (n: number) => void }) {
  const [text, setText] = useState(value === null ? '' : String(value)), seen = useRef(value)
  // The grid changed under the cell (a row removed): show the value it now holds.
  useEffect(() => { if (value !== seen.current) { seen.current = value; setText(value === null ? '' : String(value)) } }, [value])
  const bad = parseNum(text) === null
  return <Input aria-label={label} aria-invalid={bad} inputMode="decimal" className={`${className} text-right ${bad ? 'text-warn' : ''}`} disabled={disabled} value={text}
    onChange={(e) => { setText(e.target.value); const n = parseNum(e.target.value); if (n !== null) { seen.current = n; onCommit(n) } }} />
}

export function ChartGrid({ edit, deckStyle: style, onClose }: { edit: SlideEdit; deckStyle: Style; onClose: () => void }) {
  const chart = edit.draft.chart as Chart, g = chartGrid(chart), lim = gridLimits(style)
  const put = (next: Grid) => edit.patch({ chart: fromGrid(chart, next) })

  const cell = 'h-9 rounded-md px-2.5 text-[13px]', del = (onClick: () => void, label: string) => (
    <button type="button" aria-label={label} onClick={onClick} className="grid size-6 place-items-center text-ink-3 hover:text-ink"><X className="size-3.5" /></button>)

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent data-chart-grid className="flex max-h-[85vh] w-[min(56rem,calc(100vw-2rem))] max-w-none flex-col gap-4 p-6">
        <DialogHeader>
          <DialogTitle>Chart data</DialogTitle>
          <DialogDescription>The chart redraws when you close this.</DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto pr-1">
      {g.kind === 'bars' && (
        <table className="w-full border-separate border-spacing-x-2 border-spacing-y-1.5">
          <thead><tr><th className="px-1 text-left text-[12px] font-normal text-ink-3">Category</th>{g.series.map((s, j) => (
            <th key={j}><div className="flex items-center"><Input aria-label={`Series ${j + 1} name`} className={cell} value={s.name}
              onChange={(e) => put({ ...g, series: g.series.map((x, k) => (k === j ? { ...x, name: e.target.value } : x)) })} />
              {g.series.length > lim.series[0] && del(() => put(removeSeries(g, j, lim)), `Remove series ${j + 1}`)}</div></th>))}
            <th>{g.series.length < lim.series[1] && <Button size="sm" variant="ghost" onClick={() => put(addSeries(g, lim))}><Plus className="size-3.5" /> Series</Button>}</th></tr></thead>
          <tbody>{g.categories.map((c, i) => (
            <tr key={i}><td><Input aria-label={`Category ${i + 1}`} className={cell} value={c} onChange={(e) => put({ ...g, categories: g.categories.map((x, k) => (k === i ? e.target.value : x)) })} /></td>
              {g.series.map((s, j) => <td key={j}><NumCell label={`${s.name || `Series ${j + 1}`}, ${c}`} className={cell} value={s.values[i]}
                onCommit={(n) => put({ ...g, series: g.series.map((x, k) => (k === j ? { ...x, values: x.values.map((v, m) => (m === i ? n : v)) } : x)) })} /></td>)}
              <td>{g.categories.length > lim.categories[0] && del(() => put(removeRow(g, i, lim)), `Remove ${c || `row ${i + 1}`}`)}</td></tr>))}</tbody>
        </table>
      )}
      {g.kind === 'waterfall' && (
        <table className="w-full border-separate border-spacing-x-2 border-spacing-y-1.5"><tbody>{g.items.map((it, i) => (
          <tr key={i}>
            <td><Input aria-label={`Step ${i + 1} label`} className={cell} value={it.label} onChange={(e) => put({ ...g, items: g.items.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)) })} /></td>
            <td><NumCell label={`${it.label || `Step ${i + 1}`} value`} className={cell} disabled={it.total} value={it.value}
              onCommit={(n) => put({ ...g, items: g.items.map((x, k) => (k === i ? { ...x, value: n } : x)) })} /></td>
            <td><label className="flex items-center gap-1 text-[12px] text-ink-3"><input type="checkbox" checked={it.total} onChange={(e) => put({ ...g, items: g.items.map((x, k) => (k === i ? { ...x, total: e.target.checked } : x)) })} /> Total</label></td>
            <td>{g.items.length > lim.items[0] && del(() => put(removeRow(g, i, lim)), `Remove ${it.label || `step ${i + 1}`}`)}</td></tr>))}</tbody></table>
      )}
      {g.kind === 'timeline' && (
        <div className="grid gap-2 text-[12px]">
          <p className="text-[12px] text-ink-3">Periods</p>
          <div className="flex flex-wrap items-center gap-1">{g.periods.map((p, i) => (
            <span key={i} className="flex items-center"><Input aria-label={`Period ${i + 1}`} className={`${cell} w-16`} value={p} onChange={(e) => put({ ...g, periods: g.periods.map((x, k) => (k === i ? e.target.value : x)) })} />
              {g.periods.length > lim.periods[0] && del(() => put(removePeriod(g, i, lim)), `Remove period ${p || i + 1}`)}</span>))}
            {g.periods.length < lim.periods[1] && <Button size="sm" variant="ghost" onClick={() => put(addPeriod(g, lim))}><Plus className="size-3.5" /> Period</Button>}</div>
          <p className="mt-1 text-[12px] text-ink-3">Workstreams: name, start, end</p>
          {g.rows.map((r, i) => (
            <div key={i} className="flex items-center gap-1">
              <Input aria-label={`Workstream ${i + 1}`} className={cell} value={r.label} onChange={(e) => put({ ...g, rows: g.rows.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)) })} />
              {(['start', 'end'] as const).map((side) => (
                <select key={side} aria-label={`${r.label || `Workstream ${i + 1}`} ${side}`} className="h-7 rounded-sm bg-raise px-1" value={r[side]}
                  onChange={(e) => put({ ...g, rows: g.rows.map((x, k) => (k === i ? { ...x, [side]: Number(e.target.value) } : x)) })}>
                  {g.periods.map((p, n) => <option key={n} value={n}>{p || `Period ${n + 1}`}</option>)}</select>))}
              {g.rows.length > lim.rows[0] && del(() => put(removeRow(g, i, lim)), `Remove ${r.label || `workstream ${i + 1}`}`)}
            </div>))}
          {g.milestones.length > 0 && <p className="mt-1 text-[12px] text-ink-3">Milestones: name, when</p>}
          {g.milestones.map((m, i) => (
            <div key={`m${i}`} className="flex items-center gap-1">
              <Input aria-label={`Milestone ${i + 1}`} className={cell} value={m.label} onChange={(e) => put({ ...g, milestones: g.milestones.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)) })} />
              <select aria-label={`${m.label || `Milestone ${i + 1}`} at`} className="h-7 rounded-sm bg-raise px-1" value={m.at}
                onChange={(e) => put({ ...g, milestones: g.milestones.map((x, k) => (k === i ? { ...x, at: Number(e.target.value) } : x)) })}>
                {g.periods.map((p, n) => <option key={n} value={n}>{p || `Period ${n + 1}`}</option>)}</select>
              {del(() => put(removeMilestone(g, i, lim)), `Remove milestone ${m.label || i + 1}`)}
            </div>))}
          {g.milestones.length < lim.milestones[1] && <Button size="sm" variant="ghost" className="w-fit" onClick={() => put(addMilestone(g, lim))}><Plus className="size-3.5" /> Milestone</Button>}
        </div>
      )}
        </div>
      <div className="flex items-center gap-2">
        {g.kind !== 'timeline' && <Button size="sm" variant="ghost" onClick={() => put(addRow(g, lim))}><Plus className="size-3.5" /> {g.kind === 'bars' ? 'Category' : 'Step'}</Button>}
        {g.kind === 'timeline' && <Button size="sm" variant="ghost" onClick={() => put(addRow(g, lim))}><Plus className="size-3.5" /> Workstream</Button>}
        <Button className="ml-auto" onClick={onClose}>Done</Button>
      </div>
      </DialogContent>
    </Dialog>
  )
}

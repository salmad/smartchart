/* The chart as a grid of inputs, in the chart's place and at its size (spec 4.3). Every change writes the chart
   through edit.patch; "Show chart" or a click outside flips back. */
import { useEffect, useRef } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { addMilestone, addPeriod, addRow, addSeries, chartGrid, fromGrid, gridLimits, removeMilestone, removePeriod, removeRow, removeSeries, type Grid } from '@/engine/slides/grid'
import type { Chart, Style } from '@/engine/types'
import type { SlideEdit } from './useSlideEdit'

const num = (v: string) => (v.trim() === '' ? 0 : Number(v.replace(/,/g, '')))

export function ChartGrid({ edit, slide, deckStyle: style, onClose }: { edit: SlideEdit; slide: HTMLElement | null; deckStyle: Style; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null), chart = edit.draft.chart as Chart, g = chartGrid(chart), lim = gridLimits(style)
  const put = (next: Grid) => edit.patch({ chart: fromGrid(chart, next) })

  useEffect(() => {
    const host = slide?.querySelector('[data-chart]'), frame = slide?.parentElement, el = box.current
    if (!host || !frame || !el) return
    const a = host.getBoundingClientRect(), b = frame.getBoundingClientRect()
    for (const [k, v] of Object.entries({ l: a.left - b.left, t: a.top - b.top, w: a.width, h: a.height })) el.style.setProperty(`--${k}`, `${v}px`)
    const away = (e: PointerEvent) => { if (!el.contains(e.target as Node)) onClose() }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    document.addEventListener('pointerdown', away, true); document.addEventListener('keydown', esc, true)
    return () => { document.removeEventListener('pointerdown', away, true); document.removeEventListener('keydown', esc, true) }
  }, [slide, onClose])

  const cell = 'h-7 rounded-sm px-1.5 text-[12px]', del = (onClick: () => void, label: string) => (
    <button type="button" aria-label={label} onClick={onClick} className="grid size-6 place-items-center text-ink-3 hover:text-ink"><X className="size-3.5" /></button>)

  return (
    <div ref={box} data-chart-grid className="absolute left-[var(--l)] top-[var(--t)] z-10 flex h-[var(--h)] w-[var(--w)] flex-col gap-2 overflow-auto rounded-lg bg-panel/95 p-3 shadow-[0_0_0_1px_theme(colors.line-2)] backdrop-blur">
      {g.kind === 'bars' && (
        <table className="w-full border-separate border-spacing-1">
          <thead><tr><th />{g.series.map((s, j) => (
            <th key={j}><div className="flex items-center"><Input aria-label={`Series ${j + 1} name`} className={cell} value={s.name}
              onChange={(e) => put({ ...g, series: g.series.map((x, k) => (k === j ? { ...x, name: e.target.value } : x)) })} />
              {g.series.length > lim.series[0] && del(() => put(removeSeries(g, j, lim)), `Remove series ${j + 1}`)}</div></th>))}
            <th>{g.series.length < lim.series[1] && <Button size="sm" variant="ghost" onClick={() => put(addSeries(g, lim))}><Plus className="size-3.5" /> Series</Button>}</th></tr></thead>
          <tbody>{g.categories.map((c, i) => (
            <tr key={i}><td><Input aria-label={`Category ${i + 1}`} className={cell} value={c} onChange={(e) => put({ ...g, categories: g.categories.map((x, k) => (k === i ? e.target.value : x)) })} /></td>
              {g.series.map((s, j) => <td key={j}><Input aria-label={`${s.name || `Series ${j + 1}`}, ${c}`} inputMode="decimal" className={`${cell} text-right`} defaultValue={String(s.values[i])}
                onBlur={(e) => put({ ...g, series: g.series.map((x, k) => (k === j ? { ...x, values: x.values.map((v, n) => (n === i ? num(e.target.value) : v)) } : x)) })} /></td>)}
              <td>{g.categories.length > lim.categories[0] && del(() => put(removeRow(g, i, lim)), `Remove ${c || `row ${i + 1}`}`)}</td></tr>))}</tbody>
        </table>
      )}
      {g.kind === 'waterfall' && (
        <table className="w-full border-separate border-spacing-1"><tbody>{g.items.map((it, i) => (
          <tr key={i}>
            <td><Input aria-label={`Step ${i + 1} label`} className={cell} value={it.label} onChange={(e) => put({ ...g, items: g.items.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)) })} /></td>
            <td><Input aria-label={`${it.label || `Step ${i + 1}`} value`} inputMode="decimal" className={`${cell} text-right`} disabled={it.total} defaultValue={it.value === null ? '' : String(it.value)}
              onBlur={(e) => put({ ...g, items: g.items.map((x, k) => (k === i ? { ...x, value: num(e.target.value) } : x)) })} /></td>
            <td><label className="flex items-center gap-1 text-[12px] text-ink-3"><input type="checkbox" checked={it.total} onChange={(e) => put({ ...g, items: g.items.map((x, k) => (k === i ? { ...x, total: e.target.checked } : x)) })} /> Total</label></td>
            <td>{g.items.length > lim.items[0] && del(() => put(removeRow(g, i, lim)), `Remove ${it.label || `step ${i + 1}`}`)}</td></tr>))}</tbody></table>
      )}
      {g.kind === 'timeline' && (
        <div className="grid gap-2 text-[12px]">
          <div className="flex flex-wrap items-center gap-1">{g.periods.map((p, i) => (
            <span key={i} className="flex items-center"><Input aria-label={`Period ${i + 1}`} className={`${cell} w-16`} value={p} onChange={(e) => put({ ...g, periods: g.periods.map((x, k) => (k === i ? e.target.value : x)) })} />
              {g.periods.length > lim.periods[0] && del(() => put(removePeriod(g, i, lim)), `Remove period ${p || i + 1}`)}</span>))}
            {g.periods.length < lim.periods[1] && <Button size="sm" variant="ghost" onClick={() => put(addPeriod(g, lim))}><Plus className="size-3.5" /> Period</Button>}</div>
          {g.rows.map((r, i) => (
            <div key={i} className="flex items-center gap-1">
              <Input aria-label={`Workstream ${i + 1}`} className={cell} value={r.label} onChange={(e) => put({ ...g, rows: g.rows.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)) })} />
              {(['start', 'end'] as const).map((side) => (
                <select key={side} aria-label={`${r.label || `Workstream ${i + 1}`} ${side}`} className="h-7 rounded-sm bg-raise px-1" value={r[side]}
                  onChange={(e) => put({ ...g, rows: g.rows.map((x, k) => (k === i ? { ...x, [side]: Number(e.target.value) } : x)) })}>
                  {g.periods.map((p, n) => <option key={n} value={n}>{p || `Period ${n + 1}`}</option>)}</select>))}
              {g.rows.length > lim.rows[0] && del(() => put(removeRow(g, i, lim)), `Remove ${r.label || `workstream ${i + 1}`}`)}
            </div>))}
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
      <div className="mt-auto flex gap-2">
        {g.kind !== 'timeline' && <Button size="sm" variant="ghost" onClick={() => put(addRow(g, lim))}><Plus className="size-3.5" /> {g.kind === 'bars' ? 'Category' : 'Step'}</Button>}
        {g.kind === 'timeline' && <Button size="sm" variant="ghost" onClick={() => put(addRow(g, lim))}><Plus className="size-3.5" /> Workstream</Button>}
        <Button size="sm" variant="outline" className="ml-auto" onClick={onClose}>Show chart</Button>
      </div>
    </div>
  )
}

// src/app/edit/Sheet.tsx
/* A chart's data as a spreadsheet (spec 4.3): move with the arrows, type to replace a cell, Enter or double-click to edit,
   Tab and Enter to move on, drag or shift-arrow to select a range, copy and paste tab-separated text, right-click for rows
   and columns. It writes the real slide paths through the model's patches, so ⌘Z is the slide's own history. */
import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { GripHorizontal, GripVertical, Plus } from 'lucide-react'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/app/components/ui/context-menu'
import { Button } from '@/app/components/ui/button'
import { failed, parseTsv, pasteInto, replaceFromTable, toTsv, type SheetModel } from '@/engine/slides/sheet'
import type { Style } from '@/engine/types'
import { dropIndex } from './drag'
import type { SlideEdit } from './useSlideEdit'

interface Sel { r0: number; c0: number; r1: number; c1: number }
const norm = (s: Sel) => ({ r0: Math.min(s.r0, s.r1), r1: Math.max(s.r0, s.r1), c0: Math.min(s.c0, s.c1), c1: Math.max(s.c0, s.c1) })
const show = (v: string | number | boolean | null) => (v === null ? '' : typeof v === 'number' ? v.toLocaleString('en-GB', { maximumFractionDigits: 6 }) : typeof v === 'boolean' ? (v ? '✓' : '') : v)
const raw = (v: string | number | boolean | null) => (v === null ? '' : String(v))

export function Sheet({ edit, model, deckStyle, note, onNote }: { edit: SlideEdit; model: SheetModel; deckStyle: Style; note: string; onNote: (s: string) => void }) {
  void deckStyle
  const [anchor, setAnchor] = useState({ r: 0, c: 0 }), [focus, setFocus] = useState({ r: 0, c: 0 })
  const [editing, setEditing] = useState<{ r: number; c: number; text: string; error?: string } | null>(null)
  const [dropAt, setDropAt] = useState<{ kind: 'row' | 'col'; index: number } | null>(null)
  const grid = useRef<HTMLDivElement>(null), dragging = useRef(false)
  const sel = norm({ r0: anchor.r, c0: anchor.c, r1: focus.r, c1: focus.c }), maxR = model.rows - 1, maxC = model.cols.length - 1
  const clamp = (p: { r: number; c: number }) => ({ r: Math.max(0, Math.min(p.r, maxR)), c: Math.max(0, Math.min(p.c, maxC)) })
  const inSel = (r: number, c: number) => r >= sel.r0 && r <= sel.r1 && c >= sel.c0 && c <= sel.c1
  const issueAt = (path: string) => edit.issues.find((i) => i.path && (i.path === path || path.startsWith(`${i.path}.`) || path.startsWith(`${i.path}[`)))

  const write = (p: Record<string, unknown> | null | { error: string }) => { if (p && !failed(p)) edit.patch(p) }
  const commit = (r: number, c: number, text: string): boolean => {
    const p = model.set(r, c, text)
    if (failed(p)) { setEditing({ r, c, text, error: p.error }); return false }
    edit.patch(p); setEditing(null); return true
  }
  const move = (dr: number, dc: number, extend: boolean) => {
    const next = clamp({ r: focus.r + dr, c: focus.c + dc })
    setFocus(next); if (!extend) setAnchor(next)
  }
  const start = (r: number, c: number, text?: string) => { if (!model.readOnly?.(r, c) && model.cols[c].type !== 'flag') setEditing({ r, c, text: text ?? raw(model.get(r, c)) }) }
  const clear = () => {
    const merged: Record<string, unknown> = {}
    for (let r = sel.r0; r <= sel.r1; r++) for (let c = sel.c0; c <= sel.c1; c++) {
      if (model.readOnly?.(r, c) || model.cols[c].type === 'flag') continue
      const p = model.set(r, c, model.cols[c].type === 'number' ? '0' : '')
      if (!failed(p)) Object.assign(merged, p)
    }
    if (Object.keys(merged).length) edit.patch(merged)
  }
  const copy = (): string => toTsv(Array.from({ length: sel.r1 - sel.r0 + 1 }, (_, i) => Array.from({ length: sel.c1 - sel.c0 + 1 }, (_, j) => raw(model.get(sel.r0 + i, sel.c0 + j)))))

  const onKey = (e: KeyboardEvent) => {
    if (editing) return
    const mod = e.metaKey || e.ctrlKey
    if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); setAnchor({ r: 0, c: 0 }); setFocus({ r: maxR, c: maxC }); return }
    if (mod) return
    const arrows: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }
    if (arrows[e.key]) { e.preventDefault(); move(...arrows[e.key], e.shiftKey); return }
    if (e.key === 'Tab') { e.preventDefault(); move(0, e.shiftKey ? -1 : 1, false); return }
    if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); start(focus.r, focus.c); return }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); clear(); return }
    if (e.key === ' ' && model.cols[focus.c].type === 'flag') { e.preventDefault(); write(model.set(focus.r, focus.c, String(!model.get(focus.r, focus.c)))); return }
    if (e.key === 'Escape' && (sel.r0 !== sel.r1 || sel.c0 !== sel.c1)) { e.preventDefault(); e.stopPropagation(); setAnchor(focus); return }
    if (e.key.length === 1 && !e.altKey) { e.preventDefault(); start(focus.r, focus.c, e.key) }
  }
  const onEditKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!editing) return
    // ⌘S or ⌘Enter while a cell is open: write the cell first, then let the slide save.
    if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === 's' || e.key === 'Enter')) { const p = model.set(editing.r, editing.c, editing.text); if (!failed(p)) edit.patch(p); setEditing(null); return }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setEditing(null); grid.current?.focus(); return }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      if (commit(editing.r, editing.c, editing.text)) { move(e.key === 'Enter' ? (e.shiftKey ? -1 : 1) : 0, e.key === 'Tab' ? (e.shiftKey ? -1 : 1) : 0, false); grid.current?.focus() }
    }
  }
  /** Pasted text lands in the cells from the selection; with everything selected it replaces the data, so a pasted table becomes a new chart. */
  const pasteText = (text: string, replace = false) => {
    const data = parseTsv(text), all = replace || (sel.r0 === 0 && sel.c0 === 0 && sel.r1 === maxR && sel.c1 === maxC)
    const r = all ? replaceFromTable(edit.draft, deckStyle, data) : pasteInto(edit.draft, deckStyle, { r: sel.r0, c: sel.c0 }, data)
    if (r.slide.chart) edit.patch({ chart: r.slide.chart })
    onNote(r.note ?? (all ? 'Replaced the chart data.' : ''))
  }
  const onPaste = (e: ClipboardEvent) => {
    if (editing) return
    const text = e.clipboardData.getData('text/plain')
    if (!text) return
    e.preventDefault()
    pasteText(text)
  }
  const onCopy = (e: ClipboardEvent, cut: boolean) => { if (editing) return; e.preventDefault(); e.clipboardData.setData('text/plain', copy()); if (cut) clear() }

  /* Drag a row or column by its grip. */
  const dragGrip = (e: React.PointerEvent<HTMLElement>, kind: 'row' | 'col', index: number) => {
    e.preventDefault(); const grip = e.currentTarget; grip.setPointerCapture(e.pointerId)
    const boxes = () => [...(grid.current?.querySelectorAll(kind === 'row' ? 'tbody tr' : 'thead th[data-col]') ?? [])].map((el) => el.getBoundingClientRect())
    let to = index
    const mv = (ev: PointerEvent) => { to = dropIndex(boxes(), kind === 'col' ? index - 1 : index, { x: ev.clientX, y: ev.clientY }, kind === 'row' ? 'y' : 'x') + (kind === 'col' ? 1 : 0); setDropAt({ kind, index: to }) }
    const up = () => { grip.removeEventListener('pointermove', mv); grip.removeEventListener('pointerup', up); setDropAt(null); if (to !== index) write(kind === 'row' ? model.moveRow(index, to) : model.moveCol?.(index, to) ?? null) }
    grip.addEventListener('pointermove', mv); grip.addEventListener('pointerup', up)
  }

  const menu = (items: { label: string; p: Record<string, unknown> | null }[]) => items.map((i) => <ContextMenuItem key={i.label} disabled={!i.p} onSelect={() => write(i.p)}>{i.label}</ContextMenuItem>)
  const rowItems = [{ label: 'Insert row above', p: model.insertRow(sel.r0) }, { label: 'Insert row below', p: model.insertRow(sel.r1 + 1) }, { label: sel.r1 > sel.r0 ? 'Delete rows' : 'Delete row', p: model.removeRows(sel.r0, sel.r1) }]
  const colItems = model.insertCol ? [{ label: 'Insert column left', p: model.insertCol(Math.max(1, sel.c0)) ?? null }, { label: 'Insert column right', p: model.insertCol(sel.c1 + 1) ?? null }, { label: 'Delete column', p: model.removeCols?.(sel.c0, sel.c1) ?? null }] : []

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div ref={grid} role="grid" aria-label="Chart data" tabIndex={0} onKeyDown={onKey} onPaste={onPaste} onCopy={(e) => onCopy(e, false)} onCut={(e) => onCopy(e, true)}
            onPointerUp={() => { dragging.current = false }} className="min-h-0 overflow-auto rounded-lg outline-none ring-1 ring-line focus-visible:ring-ink-3">
            <table className="w-full border-separate border-spacing-0 text-[13px]">
              <thead className="sticky top-0 z-10 bg-panel">
                <tr><th className="w-8" />
                  {model.cols.map((col, c) => (
                    <th key={c} data-col={c} role="columnheader" className={`relative border-b border-line px-1 py-1 text-left font-normal text-ink-3 ${dropAt?.kind === 'col' && dropAt.index === c ? 'border-l-2 border-l-ink' : ''}`}>
                      <div className="flex items-center">
                        {model.moveCol && c >= 1 && <button type="button" aria-label={`Move column ${c}`} onPointerDown={(e) => dragGrip(e, 'col', c)} className="grid size-5 shrink-0 cursor-grab touch-none place-items-center text-ink-3 hover:text-ink"><GripHorizontal className="size-3.5" /></button>}
                        {col.headerPath
                          ? <input aria-label={`Column ${c} name`} value={col.header} placeholder="Name" onChange={(e) => write(model.setHeader(c, e.target.value))} className="h-7 w-full min-w-20 rounded-sm bg-transparent px-1.5 text-ink outline-none focus:bg-raise" />
                          : <span className="px-1.5">{col.header}</span>}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: model.rows }, (_, r) => (
                  <tr key={r} role="row" className={dropAt?.kind === 'row' && dropAt.index === r ? 'shadow-[0_-2px_0_0_theme(colors.ink)]' : ''}>
                    <td className="w-8 border-b border-line text-center text-[11px] text-ink-3"><button type="button" aria-label={`Move row ${r + 1}`} onPointerDown={(e) => dragGrip(e, 'row', r)} className="grid size-6 cursor-grab touch-none place-items-center hover:text-ink"><GripVertical className="size-3.5" /></button></td>
                    {model.cols.map((col, c) => {
                      const active = inSel(r, c), here = focus.r === r && focus.c === c, issue = issueAt(model.path(r, c)), ro = model.readOnly?.(r, c)
                      const isEditing = editing?.r === r && editing.c === c
                      return (
                        <td key={c} role="gridcell" aria-selected={active} title={issue?.msg} data-r={r} data-c={c}
                          onPointerDown={(e) => { if (e.button !== 0 || isEditing) return; grid.current?.focus(); dragging.current = true; setEditing(null); if (e.shiftKey) setFocus({ r, c }); else { setAnchor({ r, c }); setFocus({ r, c }) } }}
                          onPointerEnter={(e) => { if (dragging.current && e.buttons & 1) setFocus({ r, c }) }}
                          onDoubleClick={() => start(r, c)}
                          className={`h-9 border-b border-line px-0 ${active ? 'bg-ink/10' : ''} ${here ? 'shadow-[inset_0_0_0_1.5px_theme(colors.ink)]' : ''} ${issue ? 'underline decoration-warn decoration-2 underline-offset-4' : ''} ${ro ? 'text-ink-3' : ''}`}>
                          {isEditing
                            ? <input autoFocus aria-label={`Row ${r + 1}, column ${c + 1}`} value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value, error: undefined })} onKeyDown={onEditKey}
                                onBlur={() => { if (editing) { const p = model.set(r, c, editing.text); if (!failed(p)) edit.patch(p); setEditing(null) } }}
                                inputMode={col.type === 'number' ? 'decimal' : 'text'} className={`h-9 w-full bg-raise px-2.5 outline-none ${col.type === 'number' ? 'text-right' : ''} ${editing.error ? 'text-warn' : ''}`} />
                            : col.type === 'flag'
                              ? <button type="button" tabIndex={-1} aria-label={`Total, row ${r + 1}`} aria-pressed={!!model.get(r, c)} onClick={() => write(model.set(r, c, String(!model.get(r, c))))} className="grid h-9 w-full place-items-center">{model.get(r, c) ? '✓' : <span className="text-ink-3">–</span>}</button>
                              : <div className={`flex h-9 items-center px-2.5 ${col.type === 'number' ? 'justify-end tabular-nums' : ''}`}>{show(model.get(r, c))}</div>}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent data-edit-chrome className="min-w-48" onCloseAutoFocus={(e) => { e.preventDefault(); grid.current?.focus() }}>
          {menu(rowItems)}{colItems.length > 0 && <ContextMenuSeparator />}{menu(colItems)}
        </ContextMenuContent>
      </ContextMenu>
      <div className="flex items-center gap-2 text-[12px] text-ink-3">
        <Button size="sm" variant="ghost" disabled={!model.insertRow(model.rows)} onClick={() => write(model.insertRow(model.rows))}><Plus className="size-3.5" /> Row</Button>
        {model.insertCol && <Button size="sm" variant="ghost" disabled={!model.insertCol(model.cols.length)} onClick={() => write(model.insertCol?.(model.cols.length) ?? null)}><Plus className="size-3.5" /> Series</Button>}
        <Button size="sm" variant="ghost" onClick={() => { void navigator.clipboard.readText().then((t) => t && pasteText(t, true)).catch(() => onNote('Allow clipboard access, or select all (⌘A) and press ⌘V.')) }}>Paste table</Button>
        <span role="status" className="ml-1 min-w-0 truncate">{editing?.error ?? (note || 'Select all (⌘A) and paste to replace the data with a table.')}</span>
      </div>
    </div>
  )
}

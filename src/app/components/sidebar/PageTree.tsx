import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { FileText, Plus, Presentation } from 'lucide-react'
import { keyOf, type PageKind, type PageRef } from '@/engine/pages/tree'
import { MENU_ICON, MENU_ITEM } from '../menu'
import { Button } from '../ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu'
import type { Row } from './flatten'
import { PageRow } from './PageRow'
import { step, typeahead } from './treeKeys'

interface Props {
  /** Null while loading. */
  rows: Row[] | null
  failed: boolean
  /** Editors and owners make, rename and delete; a viewer only opens and expands. */
  canWrite: boolean
  busy: boolean
  onOpen: (ref: PageRef) => void
  onToggle: (ref: PageRef, open?: boolean) => void
  onNew: (kind: PageKind, parent: PageRef | null) => void
  onRename: (row: Row) => void
  onDelete: (row: Row) => void
}

/** The workspace's pages as one tree: its label and +, then the rows. The keyboard is the WAI-ARIA tree's: arrows move and
    expand, Home and End jump, Enter opens, typing a letter jumps to a name, Shift+F10 opens a row's menu. */
export function PageTree({ rows, failed, canWrite, busy, onOpen, onToggle, onNew, onRename, onDelete }: Props) {
  // The row that takes Tab is the last one focused, else the open page, else the first.
  const [focusKey, setFocusKey] = useState<string | null>(null), [menu, setMenu] = useState<string | null>(null)
  const refs = useRef<HTMLDivElement>(null), typed = useRef({ text: '', at: 0 })
  const list = useMemo(() => rows ?? [], [rows])
  const tabbable = (list.find((r) => keyOf(r.ref) === focusKey) ?? list.find((r) => r.open) ?? list[0])?.ref
  // Position among siblings (rows sharing a parent), for assistive tech: the rows are one flat list.
  const places = useMemo(() => {
    const size = new Map<string, number>(), seen = new Map<string, number>(), out = new Map<string, { index: number; size: number }>()
    const parentOf = (r: Row) => (r.parentRef ? keyOf(r.parentRef) : '')
    for (const r of list) size.set(parentOf(r), (size.get(parentOf(r)) ?? 0) + 1)
    for (const r of list) { const p = parentOf(r), n = (seen.get(p) ?? 0) + 1; seen.set(p, n); out.set(keyOf(r.ref), { index: n, size: size.get(p) ?? n }) }
    return out
  }, [list])

  const focus = (ref: PageRef) => { setFocusKey(keyOf(ref)); refs.current?.querySelector<HTMLElement>(`[data-row="${CSS.escape(keyOf(ref))}"]`)?.focus() }
  // After a row vanishes or the list reloads, keep Tab on a row that is still there.
  useEffect(() => { if (focusKey && rows && !rows.some((r) => keyOf(r.ref) === focusKey)) setFocusKey(null) }, [rows, focusKey])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>, row: Row) => {
    if (e.target !== e.currentTarget || e.altKey || e.ctrlKey || e.metaKey) return
    if (canWrite && (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10'))) { e.preventDefault(); setMenu(keyOf(row.ref)); return }
    if (e.key.length === 1 && e.key !== ' ') {
      const now = Date.now(), t = typed.current
      t.text = now - t.at > 600 ? e.key : t.text + e.key; t.at = now
      const hit = typeahead(list, row.ref, t.text)
      if (hit) { e.preventDefault(); focus(hit) }
      return
    }
    const next = step(list, row.ref, e.key)
    if (!next) return
    e.preventDefault()
    if ('focus' in next) focus(next.focus)
    else if ('toggle' in next) onToggle(next.toggle, next.open)
    else if (!busy) onOpen(next.open)
  }

  return (
    <section className="grid content-start">
      <div className="flex h-9 items-center justify-between pl-[18px] pr-3">
        <h2 className="font-mono text-[11px] font-medium uppercase leading-none tracking-[.1em] text-ink-3">Pages</h2>
        {canWrite && (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild disabled={busy}>
              <Button variant="ghost" size="sm" aria-label="New page" title="New page" className="size-7 p-0 text-ink-3 hover:text-ink"><Plus className="!size-3.5" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[150px] rounded-[10px] border-line-2 bg-raise p-1 text-ink">
              <DropdownMenuItem onSelect={() => onNew('doc', null)} className={MENU_ITEM}><FileText {...MENU_ICON} />New doc</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onNew('deck', null)} className={MENU_ITEM}><Presentation {...MENU_ICON} />New deck</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <div ref={refs} role="tree" aria-label="Pages" className="grid content-start gap-px px-2 pb-3">
        {rows === null && !failed && [0, 1].map((k) => <div key={k} className="mx-2 my-2 h-4 animate-pulse rounded bg-line" />)}
        {failed && <p className="px-2.5 py-2 text-[12.5px] text-ink-3">Couldn’t load your pages.</p>}
        {rows !== null && !failed && !rows.length && <p className="px-2.5 py-2 text-[12.5px] text-ink-3">No pages yet.</p>}
        {!failed && list.map((row) => {
          const k = keyOf(row.ref)
          return (
            <PageRow key={k} row={row} place={places.get(k) ?? { index: 1, size: 1 }} focused={!!tabbable && keyOf(tabbable) === k} canWrite={canWrite} busy={busy}
              menuOpen={menu === k} onMenuOpen={(o) => setMenu(o ? k : null)} onOpen={onOpen} onToggle={(ref) => onToggle(ref)} onRename={onRename} onAdd={(r, kind) => onNew(kind, r.ref)} onDelete={onDelete}
              onKeyDown={(e) => onKeyDown(e, row)} onFocus={(e) => { if (e.target === e.currentTarget) setFocusKey(k) }} />
          )
        })}
      </div>
    </section>
  )
}

import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react'
import { ArrowLeft, ArrowRight, MessageSquare, MoreHorizontal, Plus, Trash2 } from 'lucide-react'
import { contexts } from '@/engine/slides/render'
import type { Deck } from '@/engine/types'
import type { Item } from '@/app/store'
import { cn } from '@/app/lib/utils'
import { useEdgeFade } from '@/app/fade'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu'
import { SlideView } from './SlideView'
import { MENU_ICON, MENU_ITEM } from './menu'

interface Props {
  items: Item[]; current: number; deck: Deck; busy: boolean
  onSelect: (index: number) => void; onAdd: () => void
  onMove: (id: string, to: number) => void; onRemove: (id: string) => void
  /** Set right after a delete: the strip offers Undo for a few seconds. */
  removed: Item | null; onRestore: () => void
  /** A slim filmstrip under the slide, or every slide as a grid (the light table). */
  layout: 'row' | 'grid'
  /** Grid: a double click or Enter opens the slide. */
  onOpen?: (index: number) => void
  /** Open comments per slide id. */
  noted?: Record<string, number>
}

const UNDO_MS = 6000

/** The deck as thumbnails: a click selects, a drag reorders; each slide's menu moves or deletes it. */
export function Strip({ items, current, deck, busy, onSelect, onAdd, onMove, onRemove, removed, onRestore, layout, onOpen, noted = {} }: Props) {
  const [dragged, setDragged] = useState<string | null>(null), [gap, setGap] = useState<number | null>(null)
  const [undo, setUndo] = useState(false)
  // Undo stays up a few seconds after each delete; ⌘Z brings the slide back meanwhile.
  useEffect(() => {
    if (!removed) return setUndo(false)
    setUndo(true)
    const t = setTimeout(() => setUndo(false), UNDO_MS)
    const key = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !(e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement)) { e.preventDefault(); onRestore() }
    }
    document.addEventListener('keydown', key)
    return () => { clearTimeout(t); document.removeEventListener('keydown', key) }
  }, [removed, onRestore])

  // The filmstrip fades where it has more slides, and keeps the current one in view as the arrows move through the deck.
  const fade = useEdgeFade(), row = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (layout === 'row') row.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [current, layout, items.length])

  if (!items.length && !undo) return null
  const ctx = contexts(deck), grid = layout === 'grid'
  const thumb = grid ? 'w-full' : 'w-28 max-[900px]:w-24'

  // The drop gap is the slot before thumbnail i (items.length: after the last).
  const over = (e: DragEvent<HTMLDivElement>, i: number) => {
    if (!dragged) return
    e.preventDefault()
    const r = e.currentTarget.getBoundingClientRect()
    setGap(e.clientX < r.left + r.width / 2 ? i : i + 1)
  }
  const drop = () => {
    const from = items.findIndex((it) => it.id === dragged)
    if (dragged && gap !== null && from >= 0) onMove(dragged, gap > from ? gap - 1 : gap)
    setDragged(null); setGap(null)
  }
  const keys = (e: KeyboardEvent, it: Item, i: number) => {
    if (e.key === 'Enter' && onOpen) { e.preventDefault(); onOpen(i); return }
    if (busy) return
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); onRemove(it.id) }
    if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); onMove(it.id, i - 1) }
    if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); onMove(it.id, i + 1) }
  }

  return (
    <div className="min-w-0 flex-none max-[900px]:order-2 max-[900px]:px-4 max-[900px]:pb-5 max-[900px]:pt-1">
      {undo && (
        <p role="status" className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-raise px-4 py-2 text-[13px] text-ink-2 shadow-[0_0_0_1px_theme(colors.line-2),0_12px_32px_rgba(0,0,0,.5)]">
          Slide deleted.
          <button type="button" onClick={onRestore} disabled={busy} className="cursor-pointer font-medium text-ink underline-offset-2 hover:underline disabled:opacity-45">Undo</button>
        </p>
      )}
      <div ref={(el) => { row.current = el; fade(grid ? null : el) }} aria-label="Slides" role="group" className={grid ? 'grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-x-6 gap-y-5 p-1' : 'edge-fade flex gap-2.5 overflow-x-auto px-1 pb-1 pt-1'} onDragOver={(e) => { if (dragged) e.preventDefault() }} onDrop={drop}>
        {items.map((it, i) => (
          <div key={it.id} data-strip-item draggable={!busy} onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDragged(it.id) }}
            onDragEnd={() => { setDragged(null); setGap(null) }} onDragOver={(e) => over(e, i)}
            className={cn('group relative', !grid && 'flex-none', dragged === it.id && 'opacity-40')}>
            {gap === i && <i aria-hidden className={cn('absolute top-0 w-0.5 rounded-full bg-ink', grid ? '-left-[13px] h-[calc(100%-1.25rem)]' : '-left-[6px] h-[63px] max-[900px]:h-[54px]')} />}
            {gap === i + 1 && i === items.length - 1 && <i aria-hidden className={cn('absolute top-0 w-0.5 rounded-full bg-ink', grid ? '-right-[13px] h-[calc(100%-1.25rem)]' : '-right-[6px] h-[63px] max-[900px]:h-[54px]')} />}
            <button type="button" data-strip-thumb aria-current={i === current} aria-label={`Slide ${i + 1}`} onClick={() => onSelect(i)} onDoubleClick={() => onOpen?.(i)} onKeyDown={(e) => keys(e, it, i)}
              className={cn('peer grid w-full cursor-pointer text-left outline-none', grid ? 'gap-2' : 'gap-1')}>
              <SlideView slide={it.slide} deck={deck} ctx={ctx[i]}
                className={cn('pointer-events-none relative aspect-video overflow-hidden rounded-md shadow-[0_0_0_1px_theme(colors.line)] group-hover:shadow-[0_0_0_1px_theme(colors.ink-3)] group-has-[[aria-current=true]]:shadow-[0_0_0_2px_theme(colors.app-bg),0_0_0_4px_theme(colors.ink)] group-has-[:focus-visible]:shadow-[0_0_0_2px_theme(colors.app-bg),0_0_0_4px_theme(colors.ink)]', thumb)} />
              <span className={cn('flex gap-2 font-mono font-medium leading-none text-ink-3', grid ? 'text-[11px]' : 'text-[10px]')}>
                <b className="font-medium text-ink-2">{String(i + 1).padStart(2, '0')}</b>
                {it.status === 'draft' && <i className="not-italic text-warn">draft</i>}
                {!!noted[it.id] && <i aria-label={`${noted[it.id]} open comment${noted[it.id] === 1 ? '' : 's'}`} className="ml-auto flex items-center gap-1 not-italic text-ink-2"><MessageSquare aria-hidden className="size-2.5" strokeWidth={2} />{noted[it.id]}</i>}
              </span>
            </button>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger aria-label={`Slide ${i + 1} options`} disabled={busy}
                className="absolute right-1 top-1 grid size-6 cursor-pointer place-items-center rounded-md bg-raise/90 text-ink-2 opacity-0 shadow-[0_0_0_1px_theme(colors.line-2)] outline-none backdrop-blur transition-opacity hover:text-ink focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100 disabled:hidden">
                <MoreHorizontal className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[168px] rounded-[10px] border-line-2 bg-raise p-1 text-ink">
                <DropdownMenuItem disabled={i === 0} onSelect={() => onMove(it.id, i - 1)} className={MENU_ITEM}><ArrowLeft {...MENU_ICON} />Move left<kbd className="ml-auto text-ink-3">⌥←</kbd></DropdownMenuItem>
                <DropdownMenuItem disabled={i === items.length - 1} onSelect={() => onMove(it.id, i + 1)} className={MENU_ITEM}><ArrowRight {...MENU_ICON} />Move right<kbd className="ml-auto text-ink-3">⌥→</kbd></DropdownMenuItem>
                <DropdownMenuSeparator className="bg-line" />
                <DropdownMenuItem onSelect={() => onRemove(it.id)} className={MENU_ITEM}><Trash2 {...MENU_ICON} />Delete slide<kbd className="ml-auto text-ink-3">⌫</kbd></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
        <button type="button" aria-label="Add a slide" onClick={onAdd} disabled={busy}
          className={cn('grid flex-none cursor-pointer place-items-center self-start rounded-md border border-dashed border-line-2 text-ink-3 transition-colors hover:border-ink-3 hover:text-ink disabled:cursor-not-allowed disabled:opacity-45', grid ? 'aspect-video w-full' : 'h-[63px] w-12 max-[900px]:h-[54px]')}>
          <Plus className={grid ? 'size-5' : 'size-4'} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  )
}

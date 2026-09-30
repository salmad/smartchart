import { useEffect, useState, type DragEvent, type KeyboardEvent } from 'react'
import { BookOpenText, MoreHorizontal } from 'lucide-react'
import { contexts } from '@/engine/slides/render'
import type { Deck } from '@/engine/types'
import type { Item } from '@/app/store'
import { cn } from '@/app/lib/utils'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu'
import { SlideView } from './SlideView'

interface Props {
  items: Item[]; current: number; deck: Deck; busy: boolean
  onSelect: (index: number) => void; onAdd: () => void
  onMove: (id: string, to: number) => void; onRemove: (id: string) => void
  /** Set right after a delete: the strip offers Undo for a few seconds. */
  removed: Item | null; onRestore: () => void
  /** Opens the storyline; shown once the deck has two content slides. */
  onStory: () => void
}

const UNDO_MS = 6000
const MENU_ITEM = 'rounded-md px-2 py-1.5 text-[13px] text-ink-2 focus:bg-panel focus:text-ink'

/** The deck as a row of thumbnails: a click selects, a drag reorders; each slide's menu moves or deletes it. */
export function Strip({ items, current, deck, busy, onSelect, onAdd, onMove, onRemove, removed, onRestore, onStory }: Props) {
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

  if (!items.length && !undo) return null
  const ctx = contexts(deck)
  const story = items.filter((it) => it.slide.template !== 'cover' && it.slide.template !== 'section').length >= 2

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
    if (busy) return
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); onRemove(it.id) }
    if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); onMove(it.id, i - 1) }
    if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); onMove(it.id, i + 1) }
  }

  return (
    <div className="min-w-0 flex-none max-[900px]:order-2 max-[900px]:px-4 max-[900px]:pb-5 max-[900px]:pt-1">
      <h3 className="mb-2.5 flex items-center gap-3 font-mono text-[11px] font-medium uppercase leading-none tracking-[.1em] text-ink-3">
        Deck · {items.length} slide{items.length === 1 ? '' : 's'}
        {undo && (
          <span role="status" className="flex items-center gap-2 font-sans text-[12.5px] normal-case tracking-normal text-ink-2">
            Slide deleted.
            <button type="button" onClick={onRestore} disabled={busy} className="cursor-pointer font-medium text-ink underline-offset-2 hover:underline disabled:opacity-45">Undo</button>
          </span>
        )}
        {story && (
          <button type="button" onClick={onStory} title="Read the deck as its titles, and check the story"
            className="ml-auto flex cursor-pointer items-center gap-1.5 font-sans text-[12.5px] normal-case tracking-normal text-ink-2 transition-colors hover:text-ink">
            <BookOpenText className="size-3.5" strokeWidth={1.75} />Storyline
          </button>
        )}
      </h3>
      <div className="flex gap-3 overflow-x-auto px-0.5 pb-2 pt-0.5" onDragOver={(e) => { if (dragged) e.preventDefault() }} onDrop={drop}>
        {items.map((it, i) => (
          <div key={it.id} data-strip-item draggable={!busy} onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDragged(it.id) }}
            onDragEnd={() => { setDragged(null); setGap(null) }} onDragOver={(e) => over(e, i)}
            className={cn('group relative flex-[0_0_176px] max-[900px]:basis-36', dragged === it.id && 'opacity-40')}>
            {gap === i && <i aria-hidden className="absolute -left-[7px] top-0 aspect-video w-0.5 rounded-full bg-ink" />}
            {gap === i + 1 && i === items.length - 1 && <i aria-hidden className="absolute -right-[7px] top-0 aspect-video w-0.5 rounded-full bg-ink" />}
            <button type="button" data-strip-thumb aria-current={i === current} aria-label={`Slide ${i + 1}`} onClick={() => onSelect(i)} onKeyDown={(e) => keys(e, it, i)}
              className="peer grid w-full cursor-pointer gap-1.5 text-left outline-none">
              <SlideView slide={it.slide} deck={deck} ctx={ctx[i]}
                className="pointer-events-none relative aspect-video w-44 overflow-hidden rounded-md shadow-[0_0_0_1px_theme(colors.line)] group-hover:shadow-[0_0_0_1px_theme(colors.ink-3)] group-has-[[aria-current=true]]:shadow-[0_0_0_2px_theme(colors.ink)] group-has-[:focus-visible]:shadow-[0_0_0_2px_theme(colors.ink)] max-[900px]:w-36" />
              <span className="flex gap-2 font-mono text-[11px] font-medium leading-none text-ink-3">
                <b className="font-medium text-ink-2">{String(i + 1).padStart(2, '0')}</b>
                {it.status === 'draft' && <i className="not-italic text-warn">draft</i>}
              </span>
            </button>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger aria-label={`Slide ${i + 1} options`} disabled={busy}
                className="absolute right-1.5 top-1.5 grid size-6 cursor-pointer place-items-center rounded-md bg-raise/90 text-ink-2 opacity-0 shadow-[0_0_0_1px_theme(colors.line-2)] outline-none backdrop-blur transition-opacity hover:text-ink focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100 disabled:hidden">
                <MoreHorizontal className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[168px] rounded-[10px] border-line-2 bg-raise p-1 text-ink">
                <DropdownMenuItem disabled={i === 0} onSelect={() => onMove(it.id, i - 1)} className={MENU_ITEM}>Move left<kbd className="ml-auto text-ink-3">⌥←</kbd></DropdownMenuItem>
                <DropdownMenuItem disabled={i === items.length - 1} onSelect={() => onMove(it.id, i + 1)} className={MENU_ITEM}>Move right<kbd className="ml-auto text-ink-3">⌥→</kbd></DropdownMenuItem>
                <DropdownMenuSeparator className="bg-line" />
                <DropdownMenuItem onSelect={() => onRemove(it.id)} className={MENU_ITEM}>Delete slide<kbd className="ml-auto text-ink-3">⌫</kbd></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
        <button type="button" aria-label="Add a slide" onClick={onAdd} disabled={busy}
          className="grid aspect-video w-44 flex-none cursor-pointer place-items-center self-start rounded-md border border-dashed border-line-2 text-[22px] font-light text-ink-3 transition-colors hover:border-ink-3 hover:text-ink disabled:cursor-not-allowed disabled:opacity-45 max-[900px]:w-36">+</button>
      </div>
    </div>
  )
}

import { useState, type DragEventHandler, type FocusEventHandler, type KeyboardEventHandler } from 'react'
import { ChevronRight, FilePlus2, FileText, FolderInput, MoreHorizontal, Pencil, Plus, Presentation, Trash2 } from 'lucide-react'
import { cn } from '@/app/lib/utils'
import { keyOf, MAX_DEPTH, type PageKind, type PageRef } from '@/engine/pages/tree'
import { MENU_ICON, MENU_ITEM } from '../menu'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '../ui/dropdown-menu'
import { ago } from './ago'
import { shownDepth, type Row } from './flatten'

/** 14 px a level, to the fourth; written out so Tailwind sees every class. */
const INDENT = ['pl-1.5', 'pl-5', 'pl-[34px]', 'pl-[48px]']

interface Props {
  row: Row
  /** Where this row sits among its siblings, for assistive tech (the rows are one flat list). */
  place: { index: number; size: number }
  /** The one row that takes Tab. */
  focused: boolean
  canWrite: boolean
  busy: boolean
  menuOpen: boolean
  onMenuOpen: (open: boolean) => void
  onOpen: (ref: PageRef) => void
  onToggle: (ref: PageRef) => void
  onRename: (row: Row) => void
  onAdd: (row: Row, kind: PageKind) => void
  onMove: (row: Row) => void
  onDelete: (row: Row) => void
  onKeyDown: KeyboardEventHandler<HTMLDivElement>
  onFocus: FocusEventHandler<HTMLDivElement>
  /** Dragging this row to a new place (only for editors). `dragging`: it is the one held; `into`: a drop would make it the parent. */
  drag: { draggable: boolean; onDragStart: DragEventHandler<HTMLDivElement>; onDragEnd: DragEventHandler<HTMLDivElement> }
  dragging: boolean
  into: boolean
}

/** A ··· or + button that shows on hover and focus, and stays while its menu is open. */
const HOVER_BUTTON = 'absolute top-1/2 grid size-7 -translate-y-1/2 cursor-pointer place-items-center rounded-md text-ink-3 opacity-0 outline-none transition-opacity hover:bg-panel hover:text-ink focus-visible:opacity-100 group-hover:opacity-100 group-focus-visible:opacity-100 data-[state=open]:opacity-100'

function AddItems({ row, onAdd }: { row: Row; onAdd: (row: Row, kind: PageKind) => void }) {
  return (
    <>
      <DropdownMenuItem onSelect={() => onAdd(row, 'doc')} className={MENU_ITEM}><FileText {...MENU_ICON} />Doc</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => onAdd(row, 'deck')} className={MENU_ITEM}><Presentation {...MENU_ICON} />Deck</DropdownMenuItem>
    </>
  )
}

const noun = (row: Row) => row.ref.kind

/** One page of the tree: chevron, kind glyph, name, and the ··· menu for editors. Its time is the tooltip. */
export function PageRow({ row, place, focused, canWrite, busy, menuOpen, onMenuOpen, onOpen, onToggle, onRename, onAdd, onMove, onDelete, onKeyDown, onFocus, drag, dragging, into }: Props) {
  const Glyph = row.ref.kind === 'doc' ? FileText : Presentation
  // The two menus are mounted when the pointer or the keyboard first reaches the row (or a menu is asked for): a thousand rows
  // with two menus each cost more than the whole rest of the tree.
  const [armed, setArmed] = useState(false)
  const menus = canWrite && (armed || menuOpen)
  const tip = row.ref.kind === 'deck' && row.slides !== null ? `${row.slides} slide${row.slides === 1 ? '' : 's'} · ${ago(row.updated)}` : ago(row.updated)
  return (
    <div role="treeitem" data-row={keyOf(row.ref)} aria-level={row.depth} aria-posinset={place.index} aria-setsize={place.size}
      aria-expanded={row.hasChildren ? row.expanded : undefined} aria-selected={row.open} aria-current={row.open ? 'page' : undefined}
      aria-disabled={busy && !row.open ? true : undefined} tabIndex={focused ? 0 : -1} title={tip} onKeyDown={onKeyDown} onFocus={(e) => { setArmed(true); onFocus(e) }} onMouseEnter={() => setArmed(true)} {...drag}
      onClick={() => { if (!row.open && !busy) onOpen(row.ref) }}
      className={cn('group relative flex h-8 cursor-pointer items-center gap-1.5 rounded-lg pr-2 outline-none hover:pr-16 focus-within:pr-16 has-[[data-state=open]]:pr-16 transition-colors focus-visible:ring-1 focus-visible:ring-line-2 aria-disabled:cursor-not-allowed aria-disabled:opacity-45',
        INDENT[shownDepth(row.depth) - 1], row.open ? 'bg-raise shadow-[0_0_0_1px_theme(colors.line)]' : 'hover:bg-panel', dragging && 'opacity-40', into && 'bg-panel ring-1 ring-gold/70')}>
      {row.hasChildren
        ? <button type="button" tabIndex={-1} aria-label={`${row.expanded ? 'Collapse' : 'Expand'} ${row.name}`} onClick={(e) => { e.stopPropagation(); onToggle(row.ref) }}
            className="grid size-4 flex-none cursor-pointer place-items-center rounded text-ink-3 hover:text-ink">
            <ChevronRight className={cn('size-3.5 transition-transform', row.expanded && 'rotate-90')} strokeWidth={1.75} />
          </button>
        : <span className="size-4 flex-none" aria-hidden />}
      <Glyph className="size-3.5 flex-none text-ink-3" strokeWidth={1.75} aria-hidden />
      <span className={cn('truncate text-[13px]', row.open ? 'text-ink' : 'text-ink-2')}>{row.name}</span>
      {menus && (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger aria-label={`Add subpage to ${row.name}`} disabled={busy || row.depth >= MAX_DEPTH} tabIndex={-1} onClick={(e) => e.stopPropagation()}
            className={cn(HOVER_BUTTON, 'right-[34px] disabled:hidden')}>
            <Plus className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[150px] rounded-[10px] border-line-2 bg-raise p-1 text-ink" onClick={(e) => e.stopPropagation()}>
            <AddItems row={row} onAdd={onAdd} />
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {menus && (
        <DropdownMenu modal={false} open={menuOpen} onOpenChange={onMenuOpen}>
          <DropdownMenuTrigger aria-label={`More for ${row.name}`} disabled={busy} tabIndex={-1} onClick={(e) => e.stopPropagation()}
            className={cn(HOVER_BUTTON, 'right-1.5 disabled:hidden')}>
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[150px] rounded-[10px] border-line-2 bg-raise p-1 text-ink" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onSelect={() => onRename(row)} className={MENU_ITEM}><Pencil {...MENU_ICON} />Rename…</DropdownMenuItem>
            {row.depth < MAX_DEPTH && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className={MENU_ITEM}><FilePlus2 {...MENU_ICON} />Add subpage</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="min-w-[130px] rounded-[10px] border-line-2 bg-raise p-1 text-ink"><AddItems row={row} onAdd={onAdd} /></DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
            <DropdownMenuItem onSelect={() => onMove(row)} className={MENU_ITEM}><FolderInput {...MENU_ICON} />Move to…</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onDelete(row)} className={MENU_ITEM}><Trash2 {...MENU_ICON} />Delete {noun(row)}…</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

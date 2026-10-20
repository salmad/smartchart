import { useEffect, useRef } from 'react'
import { MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/app/lib/utils'
import { Button } from '../ui/button'
import { MENU_ICON, MENU_ITEM } from '../menu'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu'

export interface ListRow { id: string; name: string; sub: string }

interface Props {
  title: 'Docs' | 'Decks'
  /** Null while loading. */
  rows: ListRow[] | null
  error: boolean
  /** The row open on screen. */
  current: string | null
  /** Editors and owners make, rename and delete; a viewer only opens. */
  canWrite: boolean
  busy: boolean
  onOpen: (id: string) => void
  /** Called when a row has been pointed at or focused for a moment: read what opening it needs ahead of the click. */
  onAhead?: (id: string) => void
  onNew: () => void
  onRename: (row: ListRow) => void
  onDelete: (row: ListRow) => void
}

const noun = { Docs: 'doc', Decks: 'deck' } as const

/** One section of the sidebar: its label and New, then its rows, newest first, each with Rename and Delete in its ··· menu. */
export function ItemList({ title, rows, error, current, canWrite, busy, onOpen, onAhead, onNew, onRename, onDelete }: Props) {
  const one = noun[title]
  const pause = useRef<ReturnType<typeof setTimeout>>()
  const ahead = (id: string) => { clearTimeout(pause.current); if (onAhead) pause.current = setTimeout(() => onAhead(id), 100) }
  useEffect(() => () => clearTimeout(pause.current), [])
  return (
    <section className="grid content-start">
      <div className="flex h-9 items-center justify-between pl-[18px] pr-3">
        <h2 className="font-mono text-[11px] font-medium uppercase leading-none tracking-[.1em] text-ink-3">{title}</h2>
        {canWrite && (
          <Button variant="ghost" size="sm" onClick={onNew} disabled={busy} aria-label={`New ${one}`} title={`New ${one}`} className="size-7 p-0 text-ink-3 hover:text-ink">
            <Plus className="!size-3.5" />
          </Button>
        )}
      </div>
      <ul aria-label={title} className="grid content-start gap-px px-2 pb-3">
        {rows === null && !error && [0, 1].map((k) => <li key={k} className="mx-2 my-2 h-4 animate-pulse rounded bg-line" />)}
        {error && <li className="px-2.5 py-2 text-[12.5px] text-ink-3">Couldn’t load your {title.toLowerCase()}.</li>}
        {rows !== null && !error && !rows.length && <li className="px-2.5 py-2 text-[12.5px] text-ink-3">No {title.toLowerCase()} yet.</li>}
        {rows?.map((r) => {
          const open = r.id === current
          return (
            <li key={r.id} className="group relative">
              <button type="button" onClick={() => { if (!open) onOpen(r.id) }} onPointerEnter={() => ahead(r.id)} onFocus={() => ahead(r.id)} onPointerLeave={() => clearTimeout(pause.current)} onBlur={() => clearTimeout(pause.current)} disabled={busy && !open} aria-current={open ? 'page' : undefined}
                className={cn('grid w-full cursor-pointer gap-0.5 rounded-lg py-2 pl-2.5 pr-9 text-left outline-none transition-colors focus-visible:ring-1 focus-visible:ring-line-2 disabled:cursor-not-allowed disabled:opacity-45',
                  open ? 'bg-raise shadow-[0_0_0_1px_theme(colors.line)]' : 'hover:bg-panel')}>
                <span className={cn('truncate text-[13px]', open ? 'text-ink' : 'text-ink-2')}>{r.name}</span>
                <span className="text-[11.5px] text-ink-3">{r.sub}</span>
              </button>
              {canWrite && (
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger aria-label={`More for ${r.name}`} disabled={busy}
                    className="absolute right-1.5 top-1/2 grid size-7 -translate-y-1/2 cursor-pointer place-items-center rounded-md text-ink-3 opacity-0 outline-none transition-opacity hover:bg-panel hover:text-ink focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100 disabled:hidden">
                    <MoreHorizontal className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-[150px] rounded-[10px] border-line-2 bg-raise p-1 text-ink">
                    <DropdownMenuItem onSelect={() => onRename(r)} className={MENU_ITEM}><Pencil {...MENU_ICON} />Rename…</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onDelete(r)} className={MENU_ITEM}><Trash2 {...MENU_ICON} />Delete {one}…</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

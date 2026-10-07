import { useCallback, useEffect, useState } from 'react'
import { MoreHorizontal, Plus, Trash2 } from 'lucide-react'
import type { DeckRepo, DeckSummary } from '@/app/store'
import { cn } from '@/app/lib/utils'
import { Button } from './ui/button'
import { DeleteDeck } from './DeleteDeck'
import { MENU_ICON, MENU_ITEM } from './menu'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu'

interface Props {
  repo: DeckRepo
  /** The open deck: its name is live (it follows its first title), and it is listed before its first save. */
  current: { id: string | null; name: string; slides: number }
  busy: boolean
  onOpen: (id: string) => void; onNew: () => void; onDeleted: (id: string) => void
}

type Row = Pick<DeckSummary, 'id' | 'name' | 'updated' | 'slides'>

/** Your decks down the left of the editor, newest first: open one, start one, or delete one. */
export function Decks({ repo, current, busy, onOpen, onNew, onDeleted }: Props) {
  const [rows, setRows] = useState<Row[] | null>(null), [error, setError] = useState(false)
  const [doomed, setDoomed] = useState<Row | null>(null)

  const load = useCallback(async () => {
    try { setRows((await repo.list()).filter((d) => d.slides > 0)); setError(false) } catch { setError(true) }
  }, [repo])
  // Reloaded when the open deck changes, so a deck saved for the first time shows up with its real time.
  useEffect(() => { void load() }, [load, current.id])

  // The open deck first appears here before its first save, and always under its live name.
  const listed = rows ?? []
  const all = current.id && current.slides && !listed.some((r) => r.id === current.id)
    ? [{ id: current.id, name: current.name, updated: Date.now(), slides: current.slides }, ...listed]
    : listed

  const remove = async () => {
    if (!doomed) return
    const d = doomed
    setDoomed(null)
    setRows((all) => all?.filter((x) => x.id !== d.id) ?? null)
    if (await repo.remove(d.id)) onDeleted(d.id)
    else { setError(true); void load() }
  }

  return (
    <nav aria-label="Your decks" className="flex w-[248px] min-h-0 flex-none flex-col border-r border-line bg-app-bg max-[900px]:hidden">
      <div className="flex items-center justify-between px-3 pb-2 pt-3">
        <h2 className="pl-2 font-mono text-[11px] font-medium uppercase leading-none tracking-[.1em] text-ink-3">Decks</h2>
        <Button variant="ghost" size="sm" onClick={onNew} disabled={busy} aria-label="New deck" className="gap-1.5">
          <Plus className="!size-3.5" />New
        </Button>
      </div>
      <ul className="grid min-h-0 flex-1 content-start gap-px overflow-y-auto px-2 pb-4">
        {rows === null && !error && [0, 1, 2].map((k) => <li key={k} className="mx-2 my-2 h-4 animate-pulse rounded bg-line" />)}
        {error && <li className="px-2 py-2 text-[12.5px] text-ink-3">Couldn’t load your decks.</li>}
        {rows !== null && !error && !all.length && <li className="px-2.5 py-2 text-[12.5px] text-ink-3">No decks yet.</li>}
        {all.map((r) => {
          const open = r.id === current.id
          return (
            <li key={r.id} className="group relative">
              <button type="button" onClick={() => { if (!open) onOpen(r.id) }} disabled={busy && !open} aria-current={open ? 'page' : undefined}
                className={cn('grid w-full cursor-pointer gap-0.5 rounded-lg py-2 pl-2.5 pr-9 text-left outline-none transition-colors focus-visible:ring-1 focus-visible:ring-line-2 disabled:cursor-not-allowed disabled:opacity-45',
                  open ? 'bg-raise shadow-[0_0_0_1px_theme(colors.line)]' : 'hover:bg-panel')}>
                <span className={cn('truncate text-[13px]', open ? 'text-ink' : 'text-ink-2')}>{open ? current.name : r.name}</span>
                <span className="text-[11.5px] text-ink-3">{meta(open ? current.slides : r.slides, r.updated)}</span>
              </button>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger aria-label={`More for ${r.name}`} disabled={busy}
                  className="absolute right-1.5 top-1/2 grid size-7 -translate-y-1/2 cursor-pointer place-items-center rounded-md text-ink-3 opacity-0 outline-none transition-opacity hover:bg-panel hover:text-ink focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100 disabled:hidden">
                  <MoreHorizontal className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[150px] rounded-[10px] border-line-2 bg-raise p-1 text-ink">
                  <DropdownMenuItem onSelect={() => setDoomed(r)} className={MENU_ITEM}><Trash2 {...MENU_ICON} />Delete deck…</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          )
        })}
      </ul>

      <DeleteDeck name={doomed?.name ?? null} onCancel={() => setDoomed(null)} onConfirm={() => void remove()} />
    </nav>
  )
}

/** A row's second line: "12 slides · 5 min ago". The open deck shows its live count, highlighted rather than labelled. */
const meta = (n: number, updated: number) => `${n} slide${n === 1 ? '' : 's'} · ${ago(updated)}`

/** "just now", "5 min ago", "2 h ago", "yesterday", "3 days ago", then the date. */
export function ago(ms: number, now = Date.now()): string {
  const m = Math.round((now - ms) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24)
  if (d === 1) return 'yesterday'
  if (d < 7) return `${d} days ago`
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: now - ms > 31536e6 ? 'numeric' : undefined })
}

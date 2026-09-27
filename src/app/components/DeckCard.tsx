import { MoreHorizontal } from 'lucide-react'
import { upgrade } from '@/engine/slides/schema'
import { contexts } from '@/engine/slides/render'
import { deckName, type SavedDeck } from '@/app/store'
import { SlideView } from './SlideView'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu'

interface Props { deck: SavedDeck; onOpen: () => void; onDelete: () => void }

/** One deck: its first slide drawn live, its name and when it was last edited. */
export function DeckCard({ deck, onOpen, onDelete }: Props) {
  const name = deckName(deck), slides = deck.items.map((it) => upgrade(it.slide)), n = slides.length
  const ctx = n ? contexts({ footer: name, slides })[0] : null
  return (
    <div className="group relative grid gap-3">
      <button type="button" onClick={onOpen} aria-label={`Open ${name}`}
        className="block overflow-hidden rounded-xl bg-stage shadow-[0_0_0_1px_rgba(18,18,17,.08)] outline-none transition-shadow hover:shadow-[0_16px_40px_-20px_rgba(18,18,17,.5),0_0_0_1px_rgba(18,18,17,.12)] focus-visible:ring-2 focus-visible:ring-type focus-visible:ring-offset-2">
        {ctx
          ? <SlideView slide={slides[0]} deck={{ style: deck.style, theme: deck.theme, accent: deck.accent }} ctx={ctx} className="pointer-events-none relative aspect-video w-full overflow-hidden" />
          : <span className="grid aspect-video place-items-center text-[14px] text-[#A39B8E]">No slides yet</span>}
      </button>
      <div className="flex items-start justify-between gap-3">
        <div className="grid min-w-0 gap-0.5">
          <h2 className="truncate text-[15px] font-medium">{name}</h2>
          <p className="text-[13px] text-type-2">{n} slide{n === 1 ? '' : 's'} · edited {ago(deck.updated)}</p>
        </div>
        {/* Not modal: a modal menu that opens the delete dialog leaves the page unclickable once both close. */}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger aria-label={`More for ${name}`} className="-mr-2 grid size-9 flex-none place-items-center rounded-full text-type-2 outline-none hover:bg-paper-2 hover:text-type focus-visible:ring-2 focus-visible:ring-type">
            <MoreHorizontal className="size-[18px]" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[160px] rounded-xl border-rule bg-white p-1.5 text-type">
            <DropdownMenuItem onSelect={onOpen} className="rounded-lg px-2 py-2 text-[14px] focus:bg-paper-2 focus:text-type">Open</DropdownMenuItem>
            <DropdownMenuItem onSelect={onDelete} className="rounded-lg px-2 py-2 text-[14px] text-[#B42318] focus:bg-[#FDECEA] focus:text-[#B42318]">Delete…</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

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

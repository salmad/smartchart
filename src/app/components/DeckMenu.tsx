/* The deck's own menu, beside its name: rename it, open its look, or delete it. */
import { useRef, useState } from 'react'
import { History, MoreHorizontal, Palette, Pencil, Trash2 } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu'
import { DeleteDeck } from './DeleteDeck'
import { MENU_ICON, MENU_ITEM as ITEM } from './menu'

interface Props {
  name: string; busy: boolean
  onRename: () => void; onLook: () => void
  /** Null when the decks' store keeps no versions. */
  onVersions: (() => void) | null
  /** Null before the deck has been saved: there is nothing to delete yet. */
  onDelete: (() => void) | null
}

export function DeckMenu({ name, busy, onRename, onLook, onVersions, onDelete }: Props) {
  const [confirm, setConfirm] = useState(false)
  // Rename puts the cursor in the name: the menu closing must not take focus back to its button.
  const renaming = useRef(false)
  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger aria-label="Deck menu" title="Deck menu"
          className="grid size-7 flex-none cursor-pointer place-items-center rounded-md text-ink-3 outline-none transition-colors hover:bg-panel hover:text-ink focus-visible:ring-1 focus-visible:ring-line-2 data-[state=open]:bg-panel data-[state=open]:text-ink">
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={6} onCloseAutoFocus={(e) => { if (renaming.current) { e.preventDefault(); renaming.current = false } }}
          className="min-w-[180px] rounded-[10px] border-line-2 bg-raise p-1 text-ink">
          <DropdownMenuItem disabled={busy} onSelect={() => { renaming.current = true; onRename() }} className={ITEM}><Pencil {...MENU_ICON} />Rename</DropdownMenuItem>
          <DropdownMenuItem onSelect={onLook} className={ITEM}><Palette {...MENU_ICON} />Look</DropdownMenuItem>
          {onVersions && <DropdownMenuItem onSelect={onVersions} className={ITEM}><History {...MENU_ICON} />Versions</DropdownMenuItem>}
          {onDelete && <>
            <DropdownMenuSeparator className="bg-line" />
            <DropdownMenuItem disabled={busy} onSelect={() => setConfirm(true)} className={ITEM}><Trash2 {...MENU_ICON} />Delete deck…</DropdownMenuItem>
          </>}
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteDeck name={confirm ? name : null} onCancel={() => setConfirm(false)} onConfirm={() => { setConfirm(false); onDelete?.() }} />
    </>
  )
}

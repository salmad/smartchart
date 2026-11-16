/* The ⋯ beside a deck's or doc's name: what is about the page itself and not used every minute. Rename, its versions,
   a deck's writing style, downloads, its source file, and Delete last. */
import { useRef, useState } from 'react'
import { Code2, Download, History, MoreHorizontal, Pencil, Trash2, Type } from 'lucide-react'
import type { Style } from '@/engine/types'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator,
  DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { DeleteDeck } from './DeleteDeck'
import { MENU_ICON } from './menu'

export interface PageDownload { label: string; run: () => void }

interface Props {
  noun: 'deck' | 'doc'
  name: string; busy: boolean
  onRename?: () => void
  /** Opens the versions panel; absent where no versions are kept. */
  onVersions?: () => void
  /** A deck's writing style, fixed once it has slides. */
  writing?: { value: Style; locked: boolean; onChange: (s: Style) => void }
  downloads?: PageDownload[]
  onSource?: () => void
  /** Null before the page has been saved: there is nothing to delete yet. */
  onDelete?: (() => void) | null
  /** How many pages sit below this one (null when that can't be known: the delete then waits). */
  subpages?: () => Promise<number | null>
}

const STYLES: [Style, string][] = [['consulting', 'Consulting'], ['pitch', 'Pitch']]

export function PageMenu({ noun, name, busy, onRename, onVersions, writing, downloads = [], onSource, onDelete, subpages }: Props) {
  const [confirm, setConfirm] = useState(false), [kids, setKids] = useState(0)
  const ask = async () => {
    const n = subpages ? await subpages() : 0
    if (n === null) return
    setKids(n); setConfirm(true)
  }
  // Rename puts the cursor in the name once the menu has gone: a menu still closing takes focus back from the field
  // (to its button, or to itself when the field's width moves it from under the pointer) and the half-typed name is kept.
  const renaming = useRef(false)
  const label = noun === 'deck' ? 'Deck menu' : 'Doc menu'
  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger data-tour={noun === 'deck' ? 'deck' : undefined} aria-label={label} title={label}
          className="grid size-7 flex-none cursor-pointer place-items-center rounded-md text-ink-3 outline-none transition-colors hover:bg-panel hover:text-ink focus-visible:ring-1 focus-visible:ring-line-2 data-[state=open]:bg-panel data-[state=open]:text-ink">
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={6} onCloseAutoFocus={(e) => { if (renaming.current) { e.preventDefault(); renaming.current = false; onRename?.() } }}
          className="min-w-[200px]">
          {onRename && <DropdownMenuItem disabled={busy} onSelect={() => { renaming.current = true }}><Pencil {...MENU_ICON} />Rename</DropdownMenuItem>}
          {onVersions && <DropdownMenuItem onSelect={onVersions}><History {...MENU_ICON} />Version history</DropdownMenuItem>}
          {writing && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger disabled={busy}><Type {...MENU_ICON} />Writing style</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-[180px]">
                <DropdownMenuRadioGroup value={writing.value} onValueChange={(v) => writing.onChange(v as Style)}>
                  {STYLES.map(([v, l]) => <DropdownMenuRadioItem key={v} value={v} disabled={writing.locked && v !== writing.value}>{l}</DropdownMenuRadioItem>)}
                </DropdownMenuRadioGroup>
                {writing.locked && <p className="px-2 pb-1.5 pt-1 text-[12px] text-ink-3">Set when the deck starts.</p>}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
          {downloads.length > 0 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger><Download {...MENU_ICON} />Download</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-[160px]">
                {downloads.map((d) => <DropdownMenuItem key={d.label} onSelect={d.run}>{d.label}</DropdownMenuItem>)}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
          {onSource && <DropdownMenuItem onSelect={onSource}><Code2 {...MENU_ICON} />View source</DropdownMenuItem>}
          {onDelete && <>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={busy} onSelect={() => void ask()}><Trash2 {...MENU_ICON} />Delete {noun}…</DropdownMenuItem>
          </>}
        </DropdownMenuContent>
      </DropdownMenu>
      {onDelete && <DeleteDeck name={confirm ? name : null} what={noun} subpages={kids} onCancel={() => setConfirm(false)} onConfirm={() => { setConfirm(false); onDelete() }} />}
    </>
  )
}

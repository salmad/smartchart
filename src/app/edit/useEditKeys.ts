/* The edit keys over a slide or a doc figure: ⌘Z undoes; Bold, Focus, move and delete come from the same actions as the
   menu. Esc peels back one layer (a selection, then the item) before it asks about Discard. `saveKeys` with ⌘ run
   `save` (a deck slide: ⌘S and ⌘↵; a figure: ⌘↵ is Done, and ⌘S stays the doc's). */
import { useEffect } from 'react'
import { actionsFor } from '@/engine/slides/actions'
import type { Style } from '@/engine/types'
import type { SlideEdit } from './useSlideEdit'

interface Options { grid: boolean; discard: () => void; save: () => void; saveKeys: string[] }

export function useEditKeys(edit: SlideEdit, style: Style, { grid, discard, save, saveKeys }: Options) {
  const keysAt = saveKeys.join(' ')
  useEffect(() => {
    const keys = keysAt.split(' ')
    const key = (e: KeyboardEvent) => {
      if (e.isComposing || e.keyCode === 229 || edit.saving) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && keys.includes(e.key)) { e.preventDefault(); save(); return }
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) edit.redo(); else edit.undo(); return }
      if (e.key === 'Escape') {
        if (e.defaultPrevented || grid) return
        e.preventDefault()
        if (edit.target.kind === 'cells' || edit.target.kind === 'item' || (edit.target.kind === 'text' && edit.target.from !== edit.target.to)) { edit.setTarget({ kind: 'slide' }); window.getSelection()?.removeAllRanges(); return }
        discard(); return
      }
      // Shortcuts act on what is selected, or on the item the cursor is in.
      let t = edit.target
      const inField = document.activeElement instanceof HTMLElement ? document.activeElement : null
      if (t.kind !== 'cells' && t.kind !== 'item' && !(t.kind === 'text' && t.from !== t.to) && inField?.closest('[data-item]')) t = { kind: 'item', item: inField.closest<HTMLElement>('[data-item]')?.dataset.item ?? '' }
      const acts = actionsFor(t, edit.draft, style)
      const find = (id: string) => acts.find((a) => a.id === id || a.id === `row-${id}` || a.id === `col-${id}`)
      let a = null
      if (mod && e.key.toLowerCase() === 'b') a = find('bold')
      else if (mod && e.shiftKey && e.key.toLowerCase() === 'h') a = find('focus')
      else if (e.altKey && e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowLeft')) a = t.kind === 'cells' && e.key === 'ArrowLeft' ? acts.find((x) => x.id === 'col-move-earlier') : find('move-earlier')
      else if (e.altKey && e.shiftKey && (e.key === 'ArrowDown' || e.key === 'ArrowRight')) a = t.kind === 'cells' && e.key === 'ArrowRight' ? acts.find((x) => x.id === 'col-move-later') : find('move-later')
      else if (e.key === 'Backspace' && edit.target.kind === 'item' && !(inField?.isContentEditable)) a = find('delete')
      if (a) { e.preventDefault(); edit.apply(a.run()) }
    }
    const leave = (e: BeforeUnloadEvent) => { if (edit.dirty) e.preventDefault() }
    document.addEventListener('keydown', key); window.addEventListener('beforeunload', leave)
    return () => { document.removeEventListener('keydown', key); window.removeEventListener('beforeunload', leave) }
  }, [edit, discard, grid, style, save, keysAt])
}

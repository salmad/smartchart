/* Edit mode for a doc: the draft, the editor page and its bar, ⌘S / ⌘Z, and asking before changes are dropped. */
import { useCallback, useEffect, type ReactNode } from 'react'
import { DEFAULT_THEME } from '@/engine/docs/render'
import type { Doc } from '@/engine/docs/types'
import { DocEditor } from './DocEditor'
import { EditBar } from './DocBar'
import { docOf, useDocEdit } from './useDocEdit'
import { serializeDoc } from '@/engine/docs/serialize'

interface Props {
  doc: Doc
  /** Null when saved; otherwise why not, as a sentence. */
  save: (doc: Doc) => Promise<string | null>
  onDone: () => void
  /** Someone else saved a newer version, or this save was refused for it. */
  stale: { by: string | null; onReload: () => void; refused: boolean } | null
  comments: { open: boolean; count: number; onToggle: () => void }
  children: (bar: ReactNode, page: ReactNode) => ReactNode
}

export function DocEditing({ doc, save, onDone, stale, comments, children }: Props) {
  const edit = useDocEdit({ doc, save, onDone })
  const discard = useCallback(() => { if (!edit.dirty || window.confirm('Discard your changes to this doc?')) edit.discard() }, [edit])

  // The words as they would be saved, for the clipboard.
  const copyText = useCallback(async () => {
    try { await navigator.clipboard.writeText(serializeDoc(docOf(doc, edit.draft))); return true } catch { return false }
  }, [doc, edit])

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.isComposing || e.keyCode === 229 || edit.saving) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key === 's') { e.preventDefault(); void edit.save(); return }
      // An open figure has its own history (useEditKeys).
      if (mod && e.key.toLowerCase() === 'z' && !edit.figure) { e.preventDefault(); if (e.shiftKey) edit.redo(); else edit.undo() }
    }
    const leave = (e: BeforeUnloadEvent) => { if (edit.dirty) e.preventDefault() }
    document.addEventListener('keydown', key); window.addEventListener('beforeunload', leave)
    return () => { document.removeEventListener('keydown', key); window.removeEventListener('beforeunload', leave) }
  }, [edit])

  return <>{children(<EditBar edit={edit} onDiscard={discard} comments={comments} stale={stale && { ...stale, onCopy: copyText }} />, <DocEditor edit={edit} theme={doc.theme ?? DEFAULT_THEME} accent={doc.accent} />)}</>
}

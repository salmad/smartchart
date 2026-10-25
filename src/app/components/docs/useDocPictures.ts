/* Paste or drop a picture on the doc page while editing: it becomes an image figure at the cursor. */
import { useCallback, useEffect, useState } from 'react'
import type { DocEdit } from './useDocEdit'
import { imageFiles, insertImageFigure, uploadDocImage } from './docPictures'

export function useDocPictures(edit: DocEdit, root: HTMLElement | null) {
  const [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false)
  const dismiss = useCallback(() => setError(null), [])

  const add = useCallback(async (file: File) => {
    const { editor } = edit
    if (!editor || edit.saving) return
    setBusy(true); setError(null)
    try {
      const { src, alt } = await uploadDocImage(file)
      if (!insertImageFigure(editor, edit.originals, src, alt)) setError('Put the cursor in the doc body, then paste or drop a picture.')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }, [edit])

  useEffect(() => {
    if (!root || !edit.editor || edit.saving) return
    const inFigure = (t: EventTarget | null) => t instanceof Element && !!t.closest('[data-figure-edit]')
    const onPaste = (e: ClipboardEvent) => {
      if (inFigure(e.target)) return
      const files = imageFiles(e.clipboardData)
      if (!files.length) return
      e.preventDefault()
      void add(files[0])
    }
    const onDragOver = (e: DragEvent) => { if (imageFiles(e.dataTransfer).length) e.preventDefault() }
    const onDrop = (e: DragEvent) => {
      if (inFigure(e.target)) return
      const files = imageFiles(e.dataTransfer)
      if (!files.length) return
      e.preventDefault()
      void add(files[0])
    }
    root.addEventListener('paste', onPaste)
    root.addEventListener('dragover', onDragOver)
    root.addEventListener('drop', onDrop)
    return () => { root.removeEventListener('paste', onPaste); root.removeEventListener('dragover', onDragOver); root.removeEventListener('drop', onDrop) }
  }, [root, edit.editor, edit.saving, add])

  return { busy, error, dismiss }
}

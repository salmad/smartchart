/* An issue's description in edit mode: the doc editor's page with nothing above it. Formatting comes from the selection
   bar and the slash menu; Save and Cancel sit under the text. Loaded on first use (it brings the editor). */
import { useEffect } from 'react'
import type { Doc } from '@/engine/docs/types'
import type { Theme } from '@/engine/types'
import { Button } from '../ui/button'
import { DocEditor } from '../docs/DocEditor'
import { useDocEdit } from '../docs/useDocEdit'

interface Props {
  doc: Doc
  docId: string
  look: { theme: Theme; accent?: string }
  /** Null when saved; otherwise why not, as a sentence. */
  save: (doc: Doc) => Promise<string | null>
  onDone: () => void
  /** Someone saved a newer description: loading it drops the edits here. */
  onReload: (() => void) | null
}

export function IssueBodyEditor({ doc, docId, look, save, onDone, onReload }: Props) {
  const edit = useDocEdit({ doc, theme: look.theme, accent: look.accent, save, onDone })
  const { editor } = edit

  useEffect(() => { editor?.commands.focus('end') }, [editor])

  const cancel = () => { if (!edit.dirty || window.confirm('Discard your changes to the description?')) edit.discard() }

  return (
    <div
      className="doc-embed"
      onKeyDown={(e) => {
        if (edit.saving) return
        if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'Enter')) { e.preventDefault(); void edit.save() }
      }}
    >
      <DocEditor edit={edit} theme={look.theme} accent={look.accent} docId={docId} />
      <div className="mt-3 flex items-center justify-end gap-2">
        {edit.error && (
          <p role="alert" className="mr-auto min-w-0 text-[12.5px] text-warn">
            {edit.error}{' '}
            {onReload && <button type="button" className="text-ink underline-offset-2 hover:underline" onClick={onReload}>Load the newer one</button>}
          </p>
        )}
        <Button size="sm" variant="ghost" onClick={cancel} disabled={edit.saving}>Cancel</Button>
        <Button size="sm" onClick={() => void edit.save()} disabled={edit.saving}>{edit.saving ? 'Saving…' : 'Save'}</Button>
      </div>
    </div>
  )
}

/* The doc's controls in the bar: Edit while reading (editors and owners only), Discard and Save while editing. */
import { Button } from '@/app/components/ui/button'
import type { DocEdit } from './useDocEdit'

export function ReadBar({ canEdit, onEdit }: { canEdit: boolean; onEdit: () => void }) {
  return canEdit ? <Button size="sm" variant="outline" onClick={onEdit}>Edit</Button> : null
}

export function EditBar({ edit, onDiscard }: { edit: DocEdit; onDiscard: () => void }) {
  return (
    <div className="flex items-center gap-2">
      {edit.error && <span role="alert" className="max-w-[360px] truncate text-[13px] text-warn">{edit.error}</span>}
      <Button size="sm" variant="ghost" onClick={onDiscard} disabled={edit.saving}>Discard</Button>
      <Button size="sm" onClick={() => void edit.save()} disabled={edit.saving}>{edit.saving ? 'Saving…' : 'Save'}</Button>
    </div>
  )
}

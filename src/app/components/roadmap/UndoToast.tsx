import { toast } from 'sonner'

/** After a delete, offer Undo for eight seconds. */
export function offerDeleteUndo(label: string, onUndo: () => void) {
  toast(label, {
    duration: 8000,
    action: { label: 'Undo', onClick: onUndo },
  })
}

import { Button } from './ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog'

/** Confirm before a whole deck (or doc) goes: it can't come back. Used by the deck menu and the sidebar. `subpages`: how many
    pages sit below it; they go too, so the dialog says how many and the button counts them in. */
export function DeleteDeck({ name, what = 'deck', subpages = 0, onCancel, onConfirm }: { name: string | null; what?: 'deck' | 'doc' | 'roadmap'; subpages?: number; onCancel: () => void; onConfirm: () => void }) {
  const kids = subpages > 0
  return (
    <Dialog open={name !== null} onOpenChange={(o) => { if (!o) onCancel() }}>
      <DialogContent className="max-w-[400px]">
        <DialogTitle>Delete “{name}”{kids && ` and its ${subpages} subpage${subpages === 1 ? '' : 's'}`}?</DialogTitle>
        <DialogDescription>
          {kids ? 'Their slides, text and figures go with them.' : what === 'deck' ? 'Its slides and chat go with it.' : what === 'doc' ? 'Its text and figures go with it.' : 'Its issues go with it.'} This can’t be undone.
        </DialogDescription>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={onConfirm}>{kids ? `Delete ${subpages + 1} pages` : `Delete ${what}`}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

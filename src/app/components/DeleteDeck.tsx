import { Button } from './ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog'

/** Confirm before a whole deck (or doc) goes: it can't come back. Used by the deck menu and the sidebar. `subpages`: how many
    pages sit below it; they go too, so the dialog says how many and the button counts them in. */
export function DeleteDeck({ name, what = 'deck', subpages = 0, onCancel, onConfirm }: { name: string | null; what?: 'deck' | 'doc'; subpages?: number; onCancel: () => void; onConfirm: () => void }) {
  const kids = subpages > 0
  return (
    <Dialog open={name !== null} onOpenChange={(o) => { if (!o) onCancel() }}>
      <DialogContent className="max-w-[400px] gap-0 rounded-[14px] border-line-2 bg-raise p-6 text-ink">
        <DialogTitle className="text-[16px] font-semibold tracking-[-.01em]">Delete “{name}”{kids && ` and its ${subpages} subpage${subpages === 1 ? '' : 's'}`}?</DialogTitle>
        <DialogDescription className="mt-2 text-[13.5px] leading-[1.5] text-ink-2">
          {kids ? 'Their slides, text and figures go with them.' : what === 'deck' ? 'Its slides and chat go with it.' : 'Its text and figures go with it.'} This can’t be undone.
        </DialogDescription>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={onConfirm}>{kids ? `Delete ${subpages + 1} pages` : `Delete ${what}`}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

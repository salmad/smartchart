import type { Issue } from '@/engine/roadmaps/types'
import type { RoadmapOp } from '@/engine/roadmaps/ops'
import { subtree } from '@/engine/roadmaps/tree'
import { offerDeleteUndo } from './UndoToast'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog'

interface Props {
  deleteIds: string[] | null
  liveIssues: Issue[]
  onClose: () => void
  act: (op: RoadmapOp) => 'ok' | string
  onDeleted: () => void
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Confirm before issues go, counting the sub-issues that go with them; the toast after offers Undo. In the app's
    confirm-dialog dress (as deleting a deck). */
export function IssueDeleteDialog({ deleteIds, liveIssues, onClose, act, onDeleted }: Props) {
  const ids = deleteIds ?? []
  const all = new Set(ids.flatMap((id) => subtree(liveIssues, id).map((n) => n.id)))
  const sub = all.size - ids.filter((id) => all.has(id)).length
  const what = ids.length === 1 ? liveIssues.find((i) => i.id === ids[0])?.title ?? 'this issue' : plural(ids.length, 'issue')
  const withSubs = sub > 0 ? ` and ${plural(sub, 'sub-issue')}` : ''

  const confirm = () => {
    act({ op: 'delete', ids })
    offerDeleteUndo(`Deleted ${ids.length === 1 ? 'the issue' : plural(ids.length, 'issue')}${withSubs}.`, () => act({ op: 'restore', ids }))
    onDeleted()
    onClose()
  }

  return (
    <Dialog open={ids.length > 0} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-[400px] gap-0 rounded-[14px] border-line-2 bg-raise p-6 text-ink">
        <DialogTitle className="text-[16px] font-semibold leading-[1.35] tracking-[-.01em]">Delete {what}?</DialogTitle>
        <DialogDescription className="mt-2 text-[13.5px] leading-[1.5] text-ink-2">
          {sub > 0
            ? `${ids.length === 1 ? 'The issue' : 'They'}${withSubs} will be deleted.`
            : `${ids.length === 1 ? 'The issue' : 'They'} will be deleted.`} You can undo it straight after.
        </DialogDescription>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={confirm}>Delete</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

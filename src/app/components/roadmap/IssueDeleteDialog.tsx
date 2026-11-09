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

function pendingCopy(deleteIds: string[], liveIssues: Issue[]) {
  let sub = 0
  for (const id of deleteIds) sub += subtree(liveIssues, id).length - 1
  const root = liveIssues.find((i) => i.id === deleteIds[0])
  return { sub, title: root?.title ?? 'issue' }
}

export function IssueDeleteDialog({ deleteIds, liveIssues, onClose, act, onDeleted }: Props) {
  const pending = deleteIds?.length ? pendingCopy(deleteIds, liveIssues) : null

  const confirm = () => {
    if (!deleteIds?.length) return
    const ids = deleteIds
    const total = new Set<string>()
    let sub = 0
    for (const id of ids) {
      const nodes = subtree(liveIssues, id)
      for (const n of nodes) {
        if (id !== n.id) sub++
        total.add(n.id)
      }
    }
    const label = sub > 0
      ? `Deleted${ids.length > 1 ? ` ${ids.length} issues` : ''} and ${sub} sub-issue${sub === 1 ? '' : 's'}.`
      : `Deleted${ids.length > 1 ? ` ${ids.length} issues` : ' issue'}.`
    act({ op: 'delete', ids })
    offerDeleteUndo(label, () => act({ op: 'restore', ids }))
    onDeleted()
    onClose()
  }

  return (
    <Dialog open={!!deleteIds?.length} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent aria-describedby={undefined}>
        <DialogTitle>Delete {pending?.title}?</DialogTitle>
        <DialogDescription className="text-[13px] text-ink-2">
          {pending && pending.sub > 0
            ? `This issue and ${pending.sub} sub-issue${pending.sub === 1 ? '' : 's'} will be removed.`
            : 'This issue will be removed.'}
        </DialogDescription>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="default" className="bg-bad text-app-bg hover:bg-bad/90" onClick={confirm}>
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

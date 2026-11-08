/* Original ⇄ Suggestion, Approve and Cancel for the active block proposal (editors only). */
import { cn } from '@/app/lib/utils'
import { Button } from '@/app/components/ui/button'
import type { DocProposal } from '@/engine/docs/proposals'
import { keepsLabel, keepsTitle, type ProposalShowing } from './proposal-preview'

interface Props {
  proposals: DocProposal[]
  active: DocProposal
  index: number
  showing: ProposalShowing
  canEdit: boolean
  busy?: boolean
  keepsDoc: import('@/engine/docs/types').Doc
  onShowing: (s: ProposalShowing) => void
  onIndex: (i: number) => void
  onApprove: () => void
  onCancel: () => void
}

export function ProposalBar({ proposals, active, index, showing, canEdit, busy, keepsDoc, onShowing, onIndex, onApprove, onCancel }: Props) {
  if (!canEdit) return null
  const label = keepsLabel(keepsDoc, active)
  const drop = keepsTitle(keepsDoc, active)
  const prev = () => onIndex((index - 1 + proposals.length) % proposals.length)
  const next = () => onIndex((index + 1) % proposals.length)
  return (
    <div className="sticky bottom-0 z-10 border-t border-line bg-app-bg/95 px-4 py-3 backdrop-blur-sm" data-print-hide>
      <div className="mx-auto flex max-w-[46rem] flex-wrap items-center gap-2 text-[13px]">
        <span className="text-ink-2">Suggestion</span>
        <div className="inline-flex rounded-lg border border-line bg-panel p-0.5">
          <button type="button" onClick={() => onShowing('original')} className={cn('rounded-md px-2.5 py-1', showing === 'original' ? 'bg-raise text-ink' : 'text-ink-3 hover:text-ink')}>Original</button>
          <button type="button" onClick={() => onShowing('suggestion')} className={cn('rounded-md px-2.5 py-1', showing === 'suggestion' ? 'bg-raise text-ink' : 'text-ink-3 hover:text-ink')}>Suggestion</button>
        </div>
        <span className="text-ink-3" title={drop}>{label}</span>
        {proposals.length > 1 && (
          <span className="inline-flex items-center gap-1 text-ink-3">
            <button type="button" className="px-1 hover:text-ink" onClick={prev} aria-label="Previous suggestion">‹</button>
            {index + 1} of {proposals.length}
            <button type="button" className="px-1 hover:text-ink" onClick={next} aria-label="Next suggestion">›</button>
          </span>
        )}
        <span className="flex-1" />
        <Button size="sm" variant="ghost" disabled={busy} onClick={onCancel}>Cancel</Button>
        <Button size="sm" disabled={busy} onClick={onApprove}>Approve</Button>
      </div>
    </div>
  )
}

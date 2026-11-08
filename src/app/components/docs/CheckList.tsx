/* Open checks, each under the block it is about. Pick a check to see its block in the doc; then ask Occam to fix it or
   dismiss it (select, then confirm). */
import { cn } from '@/app/lib/utils'
import { Button } from '@/app/components/ui/button'
import type { DocProposal } from '@/engine/docs/proposals'
import { checkText, type CheckGroup, type CheckRow } from './checkRows'
import type { FixState } from './useCheckActions'

export interface RowActions {
  selected: string | null
  onSelect: (row: CheckRow | null) => void
  onShow: (blockId: string) => void
  /** Editors only: the fix and dismiss actions. */
  canEdit: boolean
  fixBlocked: string | null
  fixes: Record<string, FixState>
  onFix: (row: CheckRow, label: string) => void
  onQuiet: (key: string, on: boolean) => void
  onReview: (p: DocProposal) => void
}

export function CheckList({ groups, actions }: { groups: CheckGroup[]; actions: RowActions }) {
  return (
    <div className="grid gap-4" data-check-list>
      {groups.map((g) => (
        <section key={g.blockId} className="grid gap-1" aria-label={g.label}>
          <h3 className="min-w-0">
            {g.blockId === 'doc'
              ? <span className="text-[12px] font-medium text-ink-2">{g.label}</span>
              : <button type="button" title="Show in doc" onClick={() => actions.onShow(g.blockId)}
                  className="max-w-full cursor-pointer truncate text-left text-[12px] font-medium text-ink-2 transition-colors hover:text-ink">{g.label}</button>}
          </h3>
          <ul className="grid gap-0.5">
            {g.rows.map((r) => <Row key={r.key} row={r} label={g.label} actions={actions} />)}
          </ul>
        </section>
      ))}
    </div>
  )
}

function Row({ row, label, actions }: { row: CheckRow; label: string; actions: RowActions }) {
  const on = actions.selected === row.key, fix = actions.fixes[row.key]
  return (
    <li className={cn('-mx-2 rounded-lg transition-colors', on && 'bg-panel')} data-check-row={row.key}>
      <button type="button" aria-expanded={on} onClick={() => actions.onSelect(on ? null : row)}
        className={cn('flex w-full cursor-pointer items-baseline gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] leading-snug transition-colors',
          on ? 'text-ink' : 'text-ink-2 hover:bg-panel hover:text-ink')}>
        <span aria-hidden className={cn('size-1.5 flex-none translate-y-[-1px] rounded-full', row.soft ? 'bg-ink-3' : 'bg-warn')} />
        <span>{checkText(row.check)}</span>
      </button>
      {on && actions.canEdit && (
        <div className="grid gap-2 px-2 pb-2 pl-[22px]">
          <FixLine fix={fix} onReview={actions.onReview} />
          <div className="flex flex-wrap items-center gap-1.5">
            {fix?.busy !== true && !(fix && fix.proposals.length) && (
              <Button size="sm" disabled={!!actions.fixBlocked} title={actions.fixBlocked ?? 'Occam leaves a suggestion you review in place'}
                onClick={() => actions.onFix(row, label)}>{fix ? 'Ask again' : 'Ask Occam to fix'}</Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => actions.onQuiet(row.key, true)}>Dismiss</Button>
          </div>
          {actions.fixBlocked && !fix && <p className="text-[12px] text-ink-3">{actions.fixBlocked}</p>}
        </div>
      )}
    </li>
  )
}

function FixLine({ fix, onReview }: { fix: FixState | undefined; onReview: (p: DocProposal) => void }) {
  if (!fix) return null
  if (fix.busy) return <p className="flex items-center gap-2 text-[12.5px] text-ink-2" role="status"><i className="spinner" />Occam is working on a fix…</p>
  if (fix.proposals.length) {
    const p = fix.proposals[0]
    return (
      <div className="grid gap-1.5" role="status">
        <p className="text-[12.5px] text-ink-2">Occam left a suggestion: <span className="text-ink">{p.label}</span></p>
        <div><Button size="sm" onClick={() => onReview(p)}>Review suggestion</Button></div>
      </div>
    )
  }
  return <p className="text-[12.5px] text-ink-2" role="status">{fix.reply ?? 'Occam couldn’t reach the models. Try again.'}</p>
}

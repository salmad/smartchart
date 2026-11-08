/* Doc checks and suggestions — inspector on the right, like Comments. One honest summary (every open check and stored
   suggestion counts), the open checks under the blocks they are about, then what passed and what the writer dismissed. */
import { useMemo, useState, type ReactNode } from 'react'
import { CircleCheck, X } from 'lucide-react'
import { cn } from '@/app/lib/utils'
import type { DocCheck } from '@/engine/docs/checks'
import type { DocProposal } from '@/engine/docs/proposals'
import type { Doc } from '@/engine/docs/types'
import { checkText, groupChecks } from './checkRows'
import { CheckList, type RowActions } from './CheckList'

interface Props {
  doc: Doc
  checks: DocCheck[]
  /** Open checks and stored suggestions: the number the bar shows too. */
  count: number
  quiet: ReadonlySet<string>
  proposals: DocProposal[]
  loading: boolean
  canEdit: boolean
  actions: RowActions
  error?: string | null
  onPick?: (proposal: DocProposal) => void
  onDismiss?: (id: string) => void
  onClose: () => void
}

export function DocChecks({ doc, checks, count, quiet, proposals, loading, canEdit, actions, error, onPick, onDismiss, onClose }: Props) {
  const failed = useMemo(() => checks.filter((c) => !c.ok), [checks])
  const open = useMemo(() => groupChecks(doc, failed).map((g) => ({ ...g, rows: g.rows.filter((r) => !quiet.has(r.key)) })).filter((g) => g.rows.length), [doc, failed, quiet])
  const dismissed = useMemo(() => groupChecks(doc, failed).flatMap((g) => g.rows.filter((r) => quiet.has(r.key))), [doc, failed, quiet])
  const passed = useMemo(() => checks.filter((c) => c.ok), [checks])

  return (
    <aside aria-label="Checks" data-tour="checks-panel"
      className="flex w-[320px] min-h-0 flex-none flex-col border-l border-line bg-app-bg max-[900px]:fixed max-[900px]:inset-x-0 max-[900px]:bottom-0 max-[900px]:z-20 max-[900px]:max-h-[45dvh] max-[900px]:w-auto max-[900px]:border-l-0 max-[900px]:border-t">
      <header className="flex items-start justify-between gap-3 p-4 pb-3">
        <div className="grid gap-0.5">
          <h2 className="text-[14px] font-medium text-ink">Checks</h2>
          {count
            ? <p className="text-[13px] font-medium text-ink" data-check-summary>{count} to look at</p>
            : <p className="flex items-center gap-1.5 text-[13px] text-ink-2" data-check-summary><CircleCheck aria-hidden className="size-4 text-ok" strokeWidth={1.75} />Reads well</p>}
          <p className="text-[12.5px] text-ink-3">{count ? 'Pick one to see it in the doc.' : dismissed.length ? `Nothing open; ${dismissed.length} dismissed.` : 'Structure and every figure pass.'}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close checks"
          className="-mr-1 -mt-1 grid size-7 flex-none cursor-pointer place-items-center rounded-md text-ink-3 transition-colors hover:bg-panel hover:text-ink">
          <X className="size-4" strokeWidth={1.75} />
        </button>
      </header>
      <div className="grid min-h-0 flex-1 content-start gap-5 overflow-y-auto px-4 pb-4">
        {loading && <p className="flex items-center gap-2 text-[13px] text-ink-2"><i className="spinner" />Finding suggestions…</p>}
        {error && <p className="text-[12.5px] text-bad" role="alert">{error}</p>}

        {proposals.length > 0 && (
          <section className="grid gap-2">
            <h3 className="text-[12px] font-medium text-ink-2">Suggestions</h3>
            <ul className="grid gap-2">
              {proposals.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => { actions.onShow(p.blockIds[0]); onPick?.(p) }}
                    className="grid w-full cursor-pointer gap-0.5 rounded-lg border border-line bg-panel p-3 text-left transition-colors hover:border-line-2">
                    <span className="text-[13px] font-medium text-ink">{p.label}</span>
                    <span className="text-[12.5px] text-ink-2">{p.why}</span>
                    <span className="text-[11.5px] text-ink-3">{p.by}</span>
                  </button>
                  {canEdit && onDismiss && (
                    <button type="button" className="mt-1 text-[12px] text-ink-3 hover:text-ink" onClick={() => void onDismiss(p.id)}>Dismiss</button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {open.length > 0 && <CheckList groups={open} actions={actions} />}

        {passed.length > 0 && (
          <Fold label={`${passed.length} passed`}>
            <ul className="grid gap-1">{passed.map((c) => <li key={`${c.blockId}-${c.id}`} className="text-[12.5px] text-ink-3">{checkText(c)}</li>)}</ul>
          </Fold>
        )}
        {dismissed.length > 0 && (
          <Fold label={`${dismissed.length} dismissed`}>
            <ul className="grid gap-1.5">{dismissed.map((r) => (
              <li key={r.key} className="flex items-baseline justify-between gap-3 text-[12.5px] text-ink-3">
                <span>{checkText(r.check)}</span>
                {canEdit && <button type="button" className="flex-none cursor-pointer text-[12px] text-ink-2 hover:text-ink" onClick={() => actions.onQuiet(r.key, false)}>Restore</button>}
              </li>
            ))}</ul>
          </Fold>
        )}
      </div>
    </aside>
  )
}

function Fold({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <section className="grid gap-2 border-t border-line pt-3">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}
        className="flex cursor-pointer items-center gap-2 text-[12.5px] text-ink-2 hover:text-ink">
        <span className={cn('text-ink-3 transition-transform', open && 'rotate-90')} aria-hidden>›</span>{label}
      </button>
      {open && children}
    </section>
  )
}

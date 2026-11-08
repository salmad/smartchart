/* Doc readability and figure checks, with Occam and agent suggestions — inspector on the right, like Comments. */
import { useState } from 'react'
import { CircleCheck, X } from 'lucide-react'
import { cn } from '@/app/lib/utils'
import type { DocCheck } from '@/engine/docs/checks'
import type { DocProposal } from '@/engine/docs/proposals'

interface Props {
  verdict: DocCheck | null
  readability: DocCheck[]
  figures: DocCheck[]
  proposals: DocProposal[]
  loading: boolean
  canEdit: boolean
  onShow: (blockId: string) => void
  onPick?: (proposal: DocProposal) => void
  onDismiss?: (id: string) => void
  onClose: () => void
}

export function DocChecks({ verdict, readability, figures, proposals, loading, canEdit, onShow, onPick, onDismiss, onClose }: Props) {
  const [figOpen, setFigOpen] = useState(false)
  const wall = verdict && !verdict.ok
  const passed = readability.filter((c) => c.ok)

  return (
    <aside aria-label="Checks" data-tour="checks-panel"
      className="flex w-[320px] min-h-0 flex-none flex-col border-l border-line bg-app-bg max-[900px]:fixed max-[900px]:inset-x-0 max-[900px]:bottom-0 max-[900px]:z-20 max-[900px]:max-h-[70dvh] max-[900px]:w-auto max-[900px]:border-l-0 max-[900px]:border-t">
      <header className="flex items-start justify-between gap-3 p-4 pb-3">
        <div className="grid gap-0.5">
          <h2 className="text-[14px] font-medium text-ink">Checks</h2>
          <p className="text-[12.5px] text-ink-3">Structure and figures, then suggestions you can try in place.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close checks"
          className="-mr-1 -mt-1 grid size-7 flex-none cursor-pointer place-items-center rounded-md text-ink-3 transition-colors hover:bg-panel hover:text-ink">
          <X className="size-4" strokeWidth={1.75} />
        </button>
      </header>
      <div className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto px-4 pb-4">
        <section className="grid gap-1">
          {loading ? <p className="flex items-center gap-2 text-[13px] text-ink-2"><i className="spinner" />Finding suggestions…</p>
            : wall
              ? <p className="text-[13px] font-medium text-gold">Reads as a wall of text</p>
              : <p className="flex items-center gap-2 text-[13px] text-ink-2"><CircleCheck aria-hidden className="size-4 text-ok" strokeWidth={1.75} />Reads well</p>}
          {verdict && <p className="text-[12.5px] text-ink-3">{verdict.msg}</p>}
        </section>

        {proposals.length > 0 && (
          <section className="grid gap-2">
            <h3 className="text-[12px] font-medium text-ink-2">Suggestions</h3>
            <ul className="grid gap-2">
              {proposals.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => { onShow(p.blockIds[0]); onPick?.(p) }}
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

        {readability.some((c) => !c.ok) && (
          <section className="grid gap-2">
            <h3 className="text-[12px] font-medium text-ink-2">Readability</h3>
            <ul className="grid gap-1.5">{readability.filter((c) => !c.ok).map((c) => (
              <li key={`${c.blockId}-${c.id}`} className="text-[12.5px] text-warn">{c.msg}</li>
            ))}</ul>
          </section>
        )}

        {figures.length > 0 && (
          <section className="grid gap-2 border-t border-line pt-2">
            <button type="button" aria-expanded={figOpen} onClick={() => setFigOpen(!figOpen)}
              className="flex cursor-pointer items-center gap-2 text-[12.5px] text-ink-2 hover:text-ink">
              <span className={cn('text-ink-3 transition-transform', figOpen && 'rotate-90')} aria-hidden>›</span>
              Figure checks ({figures.filter((c) => !c.ok).length} to look at)
            </button>
            {figOpen && (
              <ul className="grid gap-1.5">{figures.map((c) => (
                <li key={`${c.blockId}-${c.id}`} className={cn('text-[12.5px]', c.ok ? 'text-ink-3' : 'text-warn')}>{c.msg}</li>
              ))}</ul>
            )}
          </section>
        )}

        {passed.length > 0 && readability.every((c) => c.ok) && (
          <p className="text-[12.5px] text-ink-3">Paragraphs and sections pass the readability checks.</p>
        )}
      </div>
    </aside>
  )
}

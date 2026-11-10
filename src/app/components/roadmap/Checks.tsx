import { CHECK_COPY, CHECK_IDS, type CheckId, type CheckReport } from '@/engine/roadmaps/checks'
import { cn } from '@/app/lib/utils'

interface Props {
  report: CheckReport
  hasIssues: boolean
  onOpen: (id: CheckId) => void
}

const BAD: CheckId[] = ['overdue', 'blocked', 'outside_parent', 'done_open']

/** Seven check rows; card click hands off to the table filter. */
export function Checks({ report, hasIssues, onOpen }: Props) {
  return (
    <section role="region" aria-label="Checks" className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
      {!hasIssues && (
        <p className="px-8 pb-2 pt-6 text-[13px] text-ink-3">No issues on this roadmap yet.</p>
      )}
      <ul className="divide-y divide-hair">
        {CHECK_IDS.map((id) => {
          const card = report.cards.find((c) => c.id === id) ?? { id, count: 0, issueIds: [] }
          const copy = CHECK_COPY[id]
          const count = card.count
          const countClass = cn(
            'tabular-nums text-[13px] font-medium',
            count === 0 ? 'text-ink-3' : BAD.includes(id) ? 'text-bad' : 'text-ink',
          )
          const inner = (
            <>
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-medium text-ink">{copy.label}</div>
                <div className="mt-0.5 text-[12.5px] text-ink-3">{copy.detail}</div>
              </div>
              <span className={countClass}>{count}</span>
            </>
          )
          if (count === 0) {
            return (
              <li key={id} className="flex w-full items-center gap-4 px-8 py-3.5 text-left">
                {inner}
              </li>
            )
          }
          return (
            <li key={id}>
              <button
                type="button"
                className="flex w-full items-center gap-4 px-8 py-3.5 text-left transition-colors hover:bg-white/[.03]"
                aria-label={`${copy.label}, ${count} issues`}
                onClick={() => onOpen(id)}
              >
                {inner}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
